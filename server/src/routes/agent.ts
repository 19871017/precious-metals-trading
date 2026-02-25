import { Router, Request, Response } from 'express';
import { Pool } from 'pg';
import bcrypt from 'bcryptjs';
import { AgentService, AgentType, AgentStatus } from '../services/agent.service';
import { validateAgentCodeFormat, validatePhoneNumber, validateEmail } from '../utils/helpers';
import logger from '../utils/logger';

// 统一响应格式辅助函数
const success = (data: any, message: string = '操作成功') => ({
  code: 0,
  message,
  data,
  timestamp: Date.now()
});

const error = (code: number, message: string) => ({
  code,
  message,
  data: null,
  timestamp: Date.now()
});

export function createAgentRoutes(pool: Pool): Router {
  const router = Router();
  const agentService = new AgentService(pool);

  /**
   * POST /api/agent/login
   * 代理登录
   */
  router.post('/login', async (req: Request, res: Response) => {
    try {
      const { username, password } = req.body;

      if (!username || !password) {
        return res.status(400).json(error(400, '用户名和密码不能为空'));
      }

      // 查询代理
      const result = await pool.query(
        'SELECT * FROM agents WHERE username = $1 AND status = $2',
        [username, AgentStatus.NORMAL]
      );

      if (result.rows.length === 0) {
        return res.status(401).json(error(401, '用户名或密码错误或账号已被禁用'));
      }

      const agent = result.rows[0];

      // 使用bcrypt验证密码
      const passwordMatch = await bcrypt.compare(password, agent.password_hash);

      if (!passwordMatch) {
        logger.warn(`[Agent] 登录失败: 用户名 ${username} 密码错误`);
        return res.status(401).json(error(401, '用户名或密码错误'));
      }

      // 更新最后登录时间
      await pool.query(
        'UPDATE agents SET last_login_time = CURRENT_TIMESTAMP WHERE id = $1',
        [agent.id]
      );

      // 返回代理信息
      res.json(success({
        agentId: agent.id,
        agentCode: agent.agent_code,
        agentType: agent.agent_type,
        username: agent.username,
        realName: agent.real_name,
        phone: agent.phone,
        totalBalance: agent.total_balance,
        availableBalance: agent.available_balance
      }, '登录成功'));

    } catch (err) {
      logger.error('代理登录错误:', err);
      res.status(500).json(error(500, '服务器错误'));
    }
  });

  /**
   * POST /api/agent/register
   * 代理注册（需要总代理推荐或管理员创建）
   */
  router.post('/register', async (req: Request, res: Response) => {
    try {
      const {
        agentType,
        parentAgentCode,
        username,
        password,
        realName,
        phone,
        email
      } = req.body;

      // 验证必填字段
      if (!agentType || !username || !password || !realName || !phone) {
        return res.status(400).json(error(400, '必填字段不能为空'));
      }

      // 验证手机号格式
      if (!validatePhoneNumber(phone)) {
        return res.status(400).json(error(400, '手机号格式不正确'));
      }

      // 验证邮箱格式（如果提供）
      if (email && !validateEmail(email)) {
        return res.status(400).json(error(400, '邮箱格式不正确'));
      }

      // 验证代理类型
      if (![AgentType.TOTAL_AGENT, AgentType.SUB_AGENT].includes(agentType)) {
        return res.status(400).json(error(400, '代理类型不正确'));
      }

      // 验证分代理必须提供上级代理代码
      if (agentType === AgentType.SUB_AGENT && !parentAgentCode) {
        return res.status(400).json(error(400, '分代理必须提供上级总代理的代理代码'));
      }

      // 验证上级代理代码
      let parentAgentId: number | undefined;
      if (parentAgentCode) {
        const parentValidation = await agentService.validateAgentCode(parentAgentCode);
        if (!parentValidation.valid) {
          return res.status(400).json(error(400, '上级代理代码不存在或已被禁用'));
        }

        // 验证上级必须是总代理
        if (parentValidation.agentType !== AgentType.TOTAL_AGENT) {
          return res.status(400).json(error(400, '只有总代理可以作为上级代理'));
        }

        parentAgentId = parentValidation.agentId;
      }

      // 创建代理
      const result = await agentService.createAgent(
        {
          agentType,
          parentAgentId,
          username,
          password,
          realName,
          phone,
          email
        },
        'self'
      );

      res.json(success(result, '注册成功'));

    } catch (err) {
      logger.error('代理注册错误:', err);
      res.status(500).json(error(500, (err as Error).message || '注册失败'));
    }
  });

  /**
   * POST /api/agent/validate-code
   * 验证代理代码（客户注册时使用）
   */
  router.post('/validate-code', async (req: Request, res: Response) => {
    try {
      const { agentCode } = req.body;

      if (!agentCode) {
        return res.status(400).json(error(400, '代理代码不能为空'));
      }

      // 验证格式
      if (!validateAgentCodeFormat(agentCode)) {
        return res.status(400).json(error(400, '代理代码格式不正确'));
      }

      // 查询代理
      const validation = await agentService.validateAgentCode(agentCode);

      if (validation.valid) {
        res.json(success({
          agentId: validation.agentId,
          agentType: validation.agentType,
          agentTypeName: validation.agentType === AgentType.TOTAL_AGENT ? '总代理' : '分代理'
        }, '代理代码验证成功'));
      } else {
        res.json(error(400, '代理代码不存在或已被禁用'));
      }

    } catch (err) {
      logger.error('验证代理代码错误:', err);
      res.status(500).json(error(500, '服务器错误'));
    }
  });

  /**
   * GET /api/agent/list
   * 获取代理列表（管理员）
   */
  router.get('/list', async (req: Request, res: Response) => {
    try {
      const { agentType, status, keyword } = req.query;

      const filters: any = {};
      if (agentType) filters.agentType = parseInt(agentType as string);
      if (status) filters.status = parseInt(status as string);
      if (keyword) filters.keyword = keyword as string;

      const agents = await agentService.getAgents(filters);

      res.json(success(agents, '获取代理列表成功'));

    } catch (err) {
      logger.error('获取代理列表错误:', err);
      res.status(500).json(error(500, '服务器错误'));
    }
  });

  /**
   * GET /api/agent/:id
   * 获取代理详情
   */
  router.get('/:id', async (req: Request, res: Response) => {
    try {
      const agentId = parseInt(req.params.id);

      if (isNaN(agentId)) {
        return res.status(400).json(error(400, '代理ID不正确'));
      }

      const agent = await agentService.getAgentDetail(agentId);

      if (!agent) {
        return res.status(404).json(error(404, '代理不存在'));
      }

      res.json(success(agent, '获取代理详情成功'));

    } catch (err) {
      logger.error('获取代理详情错误:', err);
      res.status(500).json(error(500, '服务器错误'));
    }
  });

  /**
   * GET /api/agent/:id/users
   * 获取代理的直属客户列表
   */
  router.get('/:id/users', async (req: Request, res: Response) => {
    try {
      const agentId = parseInt(req.params.id);

      if (isNaN(agentId)) {
        return res.status(400).json(error(400, '代理ID不正确'));
      }

      const users = await agentService.getAgentDirectUsers(agentId);

      res.json(success(users, '获取代理客户成功'));

    } catch (err) {
      logger.error('获取代理客户错误:', err);
      res.status(500).json(error(500, '服务器错误'));
    }
  });

  /**
   * GET /api/agent/:id/users/all
   * 获取代理的所有客户（包括分代理的客户）
   */
  router.get('/:id/users/all', async (req: Request, res: Response) => {
    try {
      const agentId = parseInt(req.params.id);

      if (isNaN(agentId)) {
        return res.status(400).json(error(400, '代理ID不正确'));
      }

      const users = await agentService.getAgentAllUsers(agentId);

      res.json(success(users, '获取所有客户成功'));

    } catch (err) {
      logger.error('获取所有客户错误:', err);
      res.status(500).json(error(500, '服务器错误'));
    }
  });

  /**
   * GET /api/agent/:id/sub-agents
   * 获取代理的分代理列表
   */
  router.get('/:id/sub-agents', async (req: Request, res: Response) => {
    try {
      const agentId = parseInt(req.params.id);

      if (isNaN(agentId)) {
        return res.status(400).json(error(400, '代理ID不正确'));
      }

      const subAgents = await agentService.getSubAgents(agentId);

      res.json(success(subAgents, '获取分代理列表成功'));

    } catch (err) {
      logger.error('获取分代理列表错误:', err);
      res.status(500).json(error(500, '服务器错误'));
    }
  });

  /**
   * GET /api/agent/:id/commission
   * 获取代理分佣记录
   */
  router.get('/:id/commission', async (req: Request, res: Response) => {
    try {
      const agentId = parseInt(req.params.id);
      const { startDate, endDate, status } = req.query;

      if (isNaN(agentId)) {
        return res.status(400).json(error(400, '代理ID不正确'));
      }

      const filters: any = {};
      if (startDate) filters.startDate = new Date(startDate as string);
      if (endDate) filters.endDate = new Date(endDate as string);
      if (status) filters.status = parseInt(status as string);

      const commissions = await agentService.getAgentCommissionRecords(agentId, filters);

      res.json(success(commissions, '获取分佣记录成功'));

    } catch (err) {
      logger.error('获取分佣记录错误:', err);
      res.status(500).json(error(500, '服务器错误'));
    }
  });

  /**
   * GET /api/agent/:id/statistics
   * 获取代理统计数据
   */
  router.get('/:id/statistics', async (req: Request, res: Response) => {
    try {
      const agentId = parseInt(req.params.id);
      const { days = 30 } = req.query;

      if (isNaN(agentId)) {
        return res.status(400).json(error(400, '代理ID不正确'));
      }

      const statistics = await agentService.getAgentStatistics(
        agentId,
        parseInt(days as string)
      );

      res.json(success(statistics, '获取统计数据成功'));

    } catch (err) {
      logger.error('获取统计数据错误:', err);
      res.status(500).json(error(500, '服务器错误'));
    }
  });

  /**
   * POST /api/agent/withdraw
   * 代理申请提现
   */
  router.post('/withdraw', async (req: Request, res: Response) => {
    try {
      const {
        agentId,
        amount,
        bankName,
        bankAccount,
        accountName
      } = req.body;

      // 验证必填字段
      if (!agentId || !amount || !bankName || !bankAccount || !accountName) {
        return res.status(400).json(error(400, '必填字段不能为空'));
      }

      if (amount <= 0) {
        return res.status(400).json(error(400, '提现金额必须大于0'));
      }

      const result = await agentService.requestWithdraw(
        agentId,
        amount,
        { bankName, bankAccount, accountName }
      );

      res.json(success(result, '提现申请成功'));

    } catch (err) {
      logger.error('代理提现错误:', err);
      res.status(500).json(error(500, (err as Error).message || '提现申请失败'));
    }
  });

  /**
   * PUT /api/agent/:id/status
   * 禁用/启用代理（管理员）
   */
  router.put('/:id/status', async (req: Request, res: Response) => {
    try {
      const agentId = parseInt(req.params.id);
      const { status } = req.body;

      if (isNaN(agentId)) {
        return res.status(400).json(error(400, '代理ID不正确'));
      }

      if (![AgentStatus.NORMAL, AgentStatus.DISABLED].includes(status)) {
        return res.status(400).json(error(400, '状态值不正确'));
      }

      await agentService.toggleAgentStatus(agentId, status);

      res.json(success(null, status === AgentStatus.NORMAL ? '代理已启用' : '代理已禁用'));

    } catch (err) {
      logger.error('更新代理状态错误:', err);
      res.status(500).json(error(500, '服务器错误'));
    }
  });

  /**
   * PUT /api/agent/:id/commission-rate
   * 更新代理分佣比例（管理员）
   */
  router.put('/:id/commission-rate', async (req: Request, res: Response) => {
    try {
      const agentId = parseInt(req.params.id);
      const { commissionRate } = req.body;

      if (isNaN(agentId)) {
        return res.status(400).json(error(400, '代理ID不正确'));
      }

      if (typeof commissionRate !== 'number' || commissionRate < 0 || commissionRate > 1) {
        return res.status(400).json(error(400, '分佣比例必须在0到1之间'));
      }

      await agentService.updateCommissionRate(agentId, commissionRate);

      res.json(success(null, '分佣比例已更新'));

    } catch (err) {
      logger.error('更新分佣比例错误:', err);
      res.status(500).json(error(500, '服务器错误'));
    }
  });

  return router;
}
