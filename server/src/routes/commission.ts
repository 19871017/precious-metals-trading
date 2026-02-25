import { Router, Request, Response } from 'express';
import { verifyToken } from '../services/auth.service';
import { query, findOne, transaction } from '../config/database';
import { ErrorCode, createErrorResponse, createSuccessResponse } from '../utils/error-codes';
import logger from '../utils/logger';

const router = Router();

/**
 * 获取分佣记录列表
 */
router.get('/records', verifyToken, async (req: Request, res: Response) => {
  try {
    const { agentId, userId, status, startDate, endDate, page = 1, pageSize = 20 } = req.query;

    let whereClause = 'WHERE 1=1';
    const params: any[] = [];
    let paramIndex = 1;

    if (agentId) {
      whereClause += ` AND agent_id = $${paramIndex}`;
      params.push(agentId);
      paramIndex++;
    }

    if (userId) {
      whereClause += ` AND user_id = $${paramIndex}`;
      params.push(userId);
      paramIndex++;
    }

    if (status) {
      whereClause += ` AND status = $${paramIndex}`;
      params.push(status);
      paramIndex++;
    }

    if (startDate) {
      whereClause += ` AND created_at >= $${paramIndex}`;
      params.push(startDate);
      paramIndex++;
    }

    if (endDate) {
      whereClause += ` AND created_at <= $${paramIndex}`;
      params.push(endDate);
      paramIndex++;
    }

    const pageNum = parseInt(page as string);
    const pageSizeNum = parseInt(pageSize as string);
    const offset = (pageNum - 1) * pageSizeNum;

    // 获取总数
    const countResult = await query(
      `SELECT COUNT(*) as total FROM commission_records ${whereClause}`,
      params
    );

    const total = parseInt(countResult.rows[0].total);

    // 获取数据
    const dataResult = await query(
      `SELECT * FROM commission_records ${whereClause} ORDER BY created_at DESC LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`,
      [...params, pageSizeNum, offset]
    );

    res.json(createSuccessResponse({
      records: dataResult.rows,
      pagination: {
        total,
        page: pageNum,
        pageSize: pageSizeNum,
        totalPages: Math.ceil(total / pageSizeNum)
      }
    }, '获取成功'));
  } catch (error: any) {
    logger.error('[Commission] 获取分佣记录错误:', error);
    res.status(500).json(createErrorResponse(ErrorCode.INTERNAL_ERROR, '服务器内部错误'));
  }
});

/**
 * 获取分佣统计
 */
router.get('/stats', verifyToken, async (req: Request, res: Response) => {
  try {
    const { agentId, period } = req.query;

    let whereClause = 'WHERE 1=1';
    const params: any[] = [];
    let paramIndex = 1;

    if (agentId) {
      whereClause += ` AND agent_id = $${paramIndex}`;
      params.push(agentId);
      paramIndex++;
    }

    // 时间范围
    const now = new Date();
    let startTime: Date;

    switch (period) {
      case 'today':
        startTime = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        break;
      case 'week':
        startTime = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        break;
      case 'month':
        startTime = new Date(now.getFullYear(), now.getMonth(), 1);
        break;
      default:
        startTime = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    }

    whereClause += ` AND created_at >= $${paramIndex}`;
    params.push(startTime);

    // 获取统计数据
    const statsResult = await query(
      `SELECT
         COALESCE(SUM(commission), 0) as total_commission,
         COALESCE(SUM(volume), 0) as total_volume,
         COUNT(*) as record_count,
         COUNT(DISTINCT agent_id) as agent_count,
         SUM(CASE WHEN status = 'settled' THEN 1 ELSE 0 END) as settled_count,
         SUM(CASE WHEN status = 'pending' THEN 1 ELSE 0 END) as pending_count
       FROM commission_records ${whereClause}`,
      params
    );

    const stats = statsResult.rows[0];

    res.json(createSuccessResponse({
      totalCommission: parseFloat(stats.total_commission),
      totalVolume: parseFloat(stats.total_volume),
      recordCount: parseInt(stats.record_count),
      agentCount: parseInt(stats.agent_count),
      settledCount: parseInt(stats.settled_count),
      pendingCount: parseInt(stats.pending_count)
    }, '获取成功'));
  } catch (error: any) {
    logger.error('[Commission] 获取分佣统计错误:', error);
    res.status(500).json(createErrorResponse(ErrorCode.INTERNAL_ERROR, '服务器内部错误'));
  }
});

/**
 * 获取代理分佣比例配置
 */
router.get('/config/:agentId', verifyToken, async (req: Request, res: Response) => {
  try {
    const agentId = parseInt(req.params.agentId);

    // 从数据库获取代理分佣配置
    const config = await findOne(
      `SELECT * FROM agent_commission_configs WHERE agent_id = $1`,
      [agentId]
    );

    if (config) {
      res.json(createSuccessResponse(config, '获取成功'));
    } else {
      // 返回默认配置
      const defaultConfig = {
        agentId,
        commissionRate: 0.0015, // 0.15%
        levels: [
          { level: 1, commissionRate: 0.0015 },
          { level: 2, commissionRate: 0.002 },
          { level: 3, commissionRate: 0.0025 }
        ],
        settlementPeriod: 'daily', // daily, weekly, monthly
        minWithdraw: 100, // 最小提现金额
        withdrawFee: 0 // 提现手续费
      };

      res.json(createSuccessResponse(defaultConfig, '获取成功（使用默认配置）'));
    }
  } catch (error: any) {
    logger.error('[Commission] 获取分佣配置错误:', error);
    res.status(500).json(createErrorResponse(ErrorCode.INTERNAL_ERROR, '服务器内部错误'));
  }
});

/**
 * 更新代理分佣比例
 */
router.put('/config/:agentId', verifyToken, async (req: Request, res: Response) => {
  try {
    const agentId = parseInt(req.params.agentId);
    const { commissionRate, settlementPeriod, minWithdraw, withdrawFee } = req.body;

    // 更新数据库中的配置
    await query(
      `INSERT INTO agent_commission_configs
       (agent_id, commission_rate, settlement_period, min_withdraw, withdraw_fee, updated_at)
       VALUES ($1, $2, $3, $4, $5, CURRENT_TIMESTAMP)
       ON CONFLICT (agent_id)
       DO UPDATE SET
         commission_rate = EXCLUDED.commission_rate,
         settlement_period = EXCLUDED.settlement_period,
         min_withdraw = EXCLUDED.min_withdraw,
         withdraw_fee = EXCLUDED.withdraw_fee,
         updated_at = CURRENT_TIMESTAMP`,
      [
        agentId,
        commissionRate,
        settlementPeriod,
        minWithdraw,
        withdrawFee || 0,
      ]
    );

    logger.info('[Commission] 更新代理分佣配置:', agentId, { commissionRate, settlementPeriod, minWithdraw });

    res.json(createSuccessResponse({
      agentId,
      commissionRate,
      settlementPeriod,
      minWithdraw
    }, '更新成功'));
  } catch (error: any) {
    logger.error('[Commission] 更新分佣配置错误:', error);
    res.status(500).json(createErrorResponse(ErrorCode.INTERNAL_ERROR, '服务器内部错误'));
  }
});

/**
 * 处理代理提现申请
 */
router.post('/withdraw', verifyToken, async (req: Request, res: Response) => {
  try {
    const { agentId, amount, bankAccount, bankName, accountName } = req.body;

    // 验证代理余额是否足够
    const agent = await findOne(
      `SELECT a.*, u.username, u.real_name
       FROM agents a
       JOIN users u ON a.user_id = u.id
       WHERE a.id = $1`,
      [agentId]
    );

    if (!agent) {
      return res.status(404).json(createErrorResponse(ErrorCode.AGENT_NOT_FOUND, '代理不存在'));
    }

    if (agent.status !== 'active') {
      return res.status(400).json(createErrorResponse(ErrorCode.AGENT_DISABLED, '代理已被禁用'));
    }

    if (agent.available_balance < parseFloat(amount)) {
      logger.warn(`[Commission] 代理提现余额不足: 代理${agentId}, 申请金额${amount}, 可用余额${agent.available_balance}`);
      return res.status(400).json(createErrorResponse(ErrorCode.INSUFFICIENT_FUNDS, '代理可提现余额不足'));
    }

    // 检查最小提现金额
    const minWithdraw = await getAgentWithdrawConfig(agentId);
    if (parseFloat(amount) < minWithdraw) {
      return res.status(400).json(createErrorResponse(ErrorCode.WITHDRAW_TOO_HIGH, `提现金额不能低于${minWithdraw}`));
    }

    // 创建提现记录
    const withdrawResult = await query(
      `INSERT INTO agent_withdrawal_requests
       (request_number, agent_id, amount, bank_account, bank_name, account_name, status, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, CURRENT_TIMESTAMP)
       RETURNING id, request_number`,
      [
        generateRequestNumber(),
        agentId,
        parseFloat(amount),
        bankAccount,
        bankName,
        accountName,
        'pending',
      ]
    );

    const withdrawId = withdrawResult.rows[0].id;

    // 冻结提现金额
    await query(
      `UPDATE agents
       SET frozen_balance = frozen_balance + $1,
           available_balance = available_balance - $1,
           updated_at = CURRENT_TIMESTAMP
       WHERE id = $2`,
      [parseFloat(amount), agentId]
    );

    logger.info('[Commission] 代理提现申请创建:', withdrawId, agentId, amount);

    res.json(createSuccessResponse({
      id: withdrawId,
      request_number: withdrawResult.rows[0].request_number,
      agentId,
      amount: parseFloat(amount),
      status: 'pending'
    }, '提现申请成功'));
  } catch (error: any) {
    logger.error('[Commission] 处理提现申请错误:', error);
    res.status(500).json(createErrorResponse(ErrorCode.INTERNAL_ERROR, '服务器内部错误'));
  }
});

/**
 * 审核提现申请
 */
router.put('/withdraw/:id/approve', verifyToken, async (req: Request, res: Response) => {
  try {
    const withdrawId = parseInt(req.params.id);
    const { approved, remark } = req.body;

    await transaction(async (client) => {
      // 获取提现记录
      const withdrawResult = await client.query(
        `SELECT * FROM agent_withdrawal_requests WHERE id = $1 AND status = 'pending'`,
        [withdrawId]
      );

      if (!withdrawResult.rows[0]) {
        throw new Error('提现申请不存在或已处理');
      }

      const withdrawRequest = withdrawResult.rows[0];

      if (approved) {
        // 审核通过
        // 1. 更新提现记录状态
        await client.query(
          `UPDATE agent_withdrawal_requests
           SET status = 'approved',
               approved_at = CURRENT_TIMESTAMP,
               remark = $1,
               updated_at = CURRENT_TIMESTAMP
           WHERE id = $2`,
          [remark || null, withdrawId]
        );

        // 2. 扣减代理余额
        await client.query(
          `UPDATE agents
           SET balance = balance - $1,
               frozen_balance = frozen_balance - $1,
               total_withdraw = total_withdraw + $1,
               updated_at = CURRENT_TIMESTAMP
           WHERE id = $2`,
          [withdrawRequest.amount, withdrawRequest.agent_id]
        );

        // 3. 完成实际转账（TODO: 集成支付系统）
        logger.info('[Commission] 代理提现审核通过:', withdrawId, withdrawRequest.agent_id, withdrawRequest.amount);
        // transferToBank(withdrawRequest);
      } else {
        // 审核拒绝
        // 1. 更新提现记录状态
        await client.query(
          `UPDATE agent_withdrawal_requests
           SET status = 'rejected',
               approved_at = CURRENT_TIMESTAMP,
               remark = $1,
               updated_at = CURRENT_TIMESTAMP
           WHERE id = $2`,
          [remark || null, withdrawId]
        );

        // 2. 解冻金额
        await client.query(
          `UPDATE agents
           SET frozen_balance = frozen_balance - $1,
               available_balance = available_balance + $1,
               updated_at = CURRENT_TIMESTAMP
           WHERE id = $2`,
          [withdrawRequest.amount, withdrawRequest.agent_id]
        );

        logger.info('[Commission] 代理提现审核拒绝:', withdrawId, withdrawRequest.agent_id, withdrawRequest.amount);
      }
    });

    res.json(createSuccessResponse(null, approved ? '审核通过' : '审核拒绝'));
  } catch (error: any) {
    logger.error('[Commission] 审核提现错误:', error);
    res.status(500).json(createErrorResponse(ErrorCode.INTERNAL_ERROR, '服务器内部错误'));
  }
});

/**
 * 获取代理提现请求列表
 */
router.get('/withdrawals', verifyToken, async (req: Request, res: Response) => {
  try {
    const { agentId, status, page = 1, pageSize = 20 } = req.query;

    let whereClause = 'WHERE 1=1';
    const params: any[] = [];
    let paramIndex = 1;

    if (agentId) {
      whereClause += ` AND agent_id = $${paramIndex}`;
      params.push(agentId);
      paramIndex++;
    }

    if (status) {
      whereClause += ` AND status = $${paramIndex}`;
      params.push(status);
      paramIndex++;
    }

    const pageNum = parseInt(page as string);
    const pageSizeNum = parseInt(pageSize as string);
    const offset = (pageNum - 1) * pageSizeNum;

    // 获取总数
    const countResult = await query(
      `SELECT COUNT(*) as total FROM agent_withdrawal_requests ${whereClause}`,
      params
    );

    const total = parseInt(countResult.rows[0].total);

    // 获取数据
    const dataResult = await query(
      `SELECT w.*, a.agent_code, u.username, u.real_name
       FROM agent_withdrawal_requests w
       LEFT JOIN agents a ON w.agent_id = a.id
       LEFT JOIN users u ON a.user_id = u.id
       ${whereClause}
       ORDER BY w.created_at DESC LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`,
      [...params, pageSizeNum, offset]
    );

    res.json(createSuccessResponse({
      list: dataResult.rows,
      total,
      page: pageNum,
      pageSize: pageSizeNum,
      totalPages: Math.ceil(total / pageSizeNum)
    }, '获取成功'));
  } catch (error: any) {
    logger.error('[Commission] 获取提现列表错误:', error);
    res.status(500).json(createErrorResponse(ErrorCode.INTERNAL_ERROR, '服务器内部错误'));
  }
});

/**
 * 生成请求号
 */
function generateRequestNumber(): string {
  const timestamp = Date.now();
  const random = Math.floor(Math.random() * 10000).toString().padStart(4, '0');
  return `AWR${timestamp}${random}`;
}

/**
 * 获取代理提现配置
 */
async function getAgentWithdrawConfig(agentId: number): Promise<number> {
  const config = await findOne(
    `SELECT min_withdraw FROM agent_commission_configs WHERE agent_id = $1`,
    [agentId]
  );

  return config?.min_withdraw || 100; // 默认100
}

export default router;
