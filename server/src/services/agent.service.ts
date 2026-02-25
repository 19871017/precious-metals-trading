import { Pool } from 'pg';
import bcrypt from 'bcryptjs';
import { generateAgentCode, calculateCommission } from '../utils/helpers';

// 代理类型
export enum AgentType {
  TOTAL_AGENT = 1,    // 总代理
  SUB_AGENT = 2         // 分代理
}

// 代理状态
export enum AgentStatus {
  DISABLED = 0,         // 禁用
  NORMAL = 1,           // 正常
  PENDING = 2            // 审核中
}

// 分佣类型
export enum CommissionType {
  TRADE_FEE = 1,       // 交易手续费分佣
  PROFIT_SHARE = 2       // 盈亏分成
}

// 创建代理请求
export interface CreateAgentRequest {
  agentType: AgentType;
  parentAgentId?: number;
  username: string;
  password: string;
  realName: string;
  phone: string;
  email?: string;
  idCard?: string;
  bankName?: string;
  bankAccount?: string;
  bankAccountName?: string;
}

// 代理信息
export interface AgentInfo {
  id: number;
  agentCode: string;
  agentType: AgentType;
  parentAgentId: number | null;
  username: string;
  realName: string;
  phone: string;
  email: string | null;
  status: AgentStatus;
  commissionRate: number;
  totalBalance: number;
  availableBalance: number;
  frozenBalance: number;
  totalUsers: number;
  totalSubAgents: number;
  totalTradingVolume: number;
  registerTime: Date;
}

// 客户注册请求（必须包含代理ID）
export interface UserRegisterRequest {
  username: string;
  password: string;
  realName: string;
  phone: string;
  email?: string;
  agentCode: string;  // 必须填写代理代码
  avatar?: string;
}

export class AgentService {
  private pool: Pool;

  constructor(pool: Pool) {
    this.pool = pool;
  }

  /**
   * 验证代理代码是否存在
   */
  async validateAgentCode(agentCode: string): Promise<{
    valid: boolean;
    agentId?: number;
    agentType?: AgentType;
    parentAgentId?: number;
  }> {
    const result = await this.pool.query(
      'SELECT id, agent_type, parent_agent_id FROM agents WHERE agent_code = $1 AND status = $2',
      [agentCode, AgentStatus.NORMAL]
    );

    if (result.rows.length === 0) {
      return { valid: false };
    }

    const agent = result.rows[0];
    return {
      valid: true,
      agentId: agent.id,
      agentType: agent.agent_type,
      parentAgentId: agent.parent_agent_id
    };
  }

  /**
   * 创建新代理（管理员或总代理创建）
   */
  async createAgent(
    request: CreateAgentRequest,
    createdBy: string
  ): Promise<{ success: boolean; agentCode?: string; message?: string }> {
    const client = await this.pool.connect();

    try {
      await client.query('BEGIN');

      // 生成唯一代理代码
      const agentCode = await generateAgentCode();

      // 密码加密
      const passwordHash = await bcrypt.hash(request.password, 10);

      // 验证总代理只能创建分代理，分代理不能再创建下级
      if (request.agentType === AgentType.SUB_AGENT && !request.parentAgentId) {
        throw new Error('分代理必须指定上级总代理');
      }

      // 验证上级代理是否存在且是总代理
      if (request.parentAgentId) {
        const parentResult = await client.query(
          'SELECT agent_type FROM agents WHERE id = $1 AND status = $2',
          [request.parentAgentId, AgentStatus.NORMAL]
        );

        if (parentResult.rows.length === 0) {
          throw new Error('上级代理不存在或已被禁用');
        }

        if (parentResult.rows[0].agent_type !== AgentType.TOTAL_AGENT) {
          throw new Error('只有总代理可以创建分代理');
        }
      }

      // 插入代理记录
      const insertResult = await client.query(
        `INSERT INTO agents (
          agent_code, agent_type, parent_agent_id, username, password_hash,
          real_name, phone, email, id_card, bank_name,
          bank_account, bank_account_name, status
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
        RETURNING id, agent_code`,
        [
          agentCode,
          request.agentType,
          request.parentAgentId || null,
          request.username,
          passwordHash,
          request.realName,
          request.phone,
          request.email || null,
          request.idCard || null,
          request.bankName || null,
          request.bankAccount || null,
          request.bankAccountName || null,
          AgentStatus.PENDING  // 新代理需要审核
        ]
      );

      await client.query('COMMIT');

      return {
        success: true,
        agentCode: insertResult.rows[0].agent_code
      };

    } catch (error: any) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * 审核代理（管理员操作）
   */
  async reviewAgent(
    agentId: number,
    approved: boolean,
    remark?: string
  ): Promise<{ success: boolean; message?: string }> {
    const status = approved ? AgentStatus.NORMAL : AgentStatus.DISABLED;

    await this.pool.query(
      'UPDATE agents SET status = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2',
      [status, agentId]
    );

    return { success: true, message: approved ? '代理审核通过' : '代理已拒绝' };
  }

  /**
   * 客户注册（必须填写代理代码）
   */
  async registerUser(
    request: UserRegisterRequest
  ): Promise<{ success: boolean; userId?: number; message?: string }> {
    const client = await this.pool.connect();

    try {
      await client.query('BEGIN');

      // 验证代理代码
      const agentValidation = await this.validateAgentCode(request.agentCode);
      if (!agentValidation.valid) {
        throw new Error('代理代码不存在或已被禁用');
      }

      // 检查用户名和手机号是否已存在
      const checkResult = await client.query(
        'SELECT id FROM users WHERE username = $1 OR phone = $2',
        [request.username, request.phone]
      );

      if (checkResult.rows.length > 0) {
        throw new Error('用户名或手机号已被注册');
      }

      // 密码加密
      const passwordHash = await bcrypt.hash(request.password, 10);

      // 插入用户记录（自动绑定代理）
      const insertResult = await client.query(
        `INSERT INTO users (
          username, password_hash, real_name, phone, email,
          agent_id, agent_type, parent_agent_id, avatar
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
        RETURNING id`,
        [
          request.username,
          passwordHash,
          request.realName,
          request.phone,
          request.email || null,
          agentValidation.agentId,
          agentValidation.agentType,
          agentValidation.parentAgentId || null,
          request.avatar || null
        ]
      );

      // 更新代理的客户数统计（触发器会自动处理，这里仅作备份）
      await client.query(
        'UPDATE agents SET total_users = total_users + 1 WHERE id = $1',
        [agentValidation.agentId]
      );

      // 如果是分代理，也更新总代理的统计
      if (agentValidation.parentAgentId) {
        await client.query(
          'UPDATE agents SET total_users = total_users + 1 WHERE id = $1',
          [agentValidation.parentAgentId]
        );
      }

      await client.query('COMMIT');

      return {
        success: true,
        userId: insertResult.rows[0].id
      };

    } catch (error: any) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * 获取代理列表（管理员）
   */
  async getAgents(filters?: {
    agentType?: AgentType;
    status?: AgentStatus;
    keyword?: string;
  }): Promise<AgentInfo[]> {
    let query = 'SELECT * FROM v_agent_full_info WHERE 1=1';
    const params: any[] = [];
    let paramIndex = 1;

    if (filters?.agentType) {
      query += ` AND agent_type = $${paramIndex++}`;
      params.push(filters.agentType);
    }

    if (filters?.status) {
      query += ` AND status = $${paramIndex++}`;
      params.push(filters.status);
    }

    if (filters?.keyword) {
      query += ` AND (username ILIKE $${paramIndex++} OR real_name ILIKE $${paramIndex++} OR agent_code ILIKE $${paramIndex++})`;
      params.push(`%${filters.keyword}%`, `%${filters.keyword}%`, `%${filters.keyword}%`);
    }

    query += ' ORDER BY id DESC';

    const result = await this.pool.query(query, params);
    return result.rows;
  }

  /**
   * 获取代理详情
   */
  async getAgentDetail(agentId: number): Promise<AgentInfo | null> {
    const result = await this.pool.query(
      'SELECT * FROM v_agent_full_info WHERE id = $1',
      [agentId]
    );

    return result.rows.length > 0 ? result.rows[0] : null;
  }

  /**
   * 获取代理的直属客户列表
   */
  async getAgentDirectUsers(agentId: number): Promise<any[]> {
    const result = await this.pool.query(
      `SELECT * FROM v_user_full_info WHERE agent_id = $1
       ORDER BY register_time DESC`,
      [agentId]
    );

    return result.rows;
  }

  /**
   * 获取代理的所有客户（包括分代理的客户）
   */
  async getAgentAllUsers(agentId: number): Promise<any[]> {
    const result = await this.pool.query(
      'SELECT * FROM get_agent_all_users($1) ORDER BY is_direct DESC, register_time DESC',
      [agentId]
    );

    return result.rows;
  }

  /**
   * 获取代理的分代理列表
   */
  async getSubAgents(agentId: number): Promise<AgentInfo[]> {
    const result = await this.pool.query(
      'SELECT * FROM v_agent_full_info WHERE parent_agent_id = $1 ORDER BY register_time DESC',
      [agentId]
    );

    return result.rows;
  }

  /**
   * 计算并记录分佣（客户交易后调用）
   */
  async calculateAndRecordCommission(
    userId: number,
    orderId: number,
    tradeAmount: number,
    fee: number
  ): Promise<void> {
    const client = await this.pool.connect();

    try {
      await client.query('BEGIN');

      // 获取用户及其代理信息
      const userResult = await client.query(
        `SELECT u.agent_id, u.agent_type, u.parent_agent_id,
                a.commission_rate as direct_rate,
                p.commission_rate as parent_rate
         FROM users u
         JOIN agents a ON u.agent_id = a.id
         LEFT JOIN agents p ON u.parent_agent_id = p.id
         WHERE u.id = $1`,
        [userId]
      );

      if (userResult.rows.length === 0) {
        throw new Error('用户不存在');
      }

      const user = userResult.rows[0];

      // 直接代理分佣
      const directCommission = fee * user.direct_rate;
      if (directCommission > 0) {
        await client.query(
          `INSERT INTO agent_commission (
            agent_id, user_id, order_id, commission_type,
            commission_amount, commission_rate, commission_from
          ) VALUES ($1, $2, $3, $4, $5, $6, $7)`,
          [
            user.agent_id,
            userId,
            orderId,
            CommissionType.TRADE_FEE,
            directCommission,
            user.direct_rate,
            fee
          ]
        );

        // 更新代理累计分佣
        await client.query(
          'UPDATE agents SET total_balance = total_balance + $1 WHERE id = $2',
          [directCommission, user.agent_id]
        );
      }

      // 如果是分代理，还需要给上级总代理分佣
      if (user.parent_agent_id && user.parent_rate) {
        const parentCommission = fee * user.parent_rate;

        await client.query(
          `INSERT INTO agent_commission (
            agent_id, user_id, order_id, commission_type,
            commission_amount, commission_rate, commission_from
          ) VALUES ($1, $2, $3, $4, $5, $6, $7)`,
          [
            user.parent_agent_id,
            userId,
            orderId,
            CommissionType.TRADE_FEE,
            parentCommission,
            user.parent_rate,
            fee
          ]
        );

        // 更新总代理累计分佣
        await client.query(
          'UPDATE agents SET total_balance = total_balance + $1 WHERE id = $2',
          [parentCommission, user.parent_agent_id]
        );
      }

      await client.query('COMMIT');

    } catch (error: any) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * 获取代理分佣记录
   */
  async getAgentCommissionRecords(
    agentId: number,
    filters?: {
      startDate?: Date;
      endDate?: Date;
      status?: number;
    }
  ): Promise<any[]> {
    let query = `
      SELECT ac.*,
             u.username as user_name,
             o.order_code
      FROM agent_commission ac
      LEFT JOIN users u ON ac.user_id = u.id
      LEFT JOIN orders o ON ac.order_id = o.id
      WHERE ac.agent_id = $1
    `;
    const params: any[] = [agentId];
    let paramIndex = 2;

    if (filters?.startDate) {
      query += ` AND ac.created_at >= $${paramIndex++}`;
      params.push(filters.startDate);
    }

    if (filters?.endDate) {
      query += ` AND ac.created_at <= $${paramIndex++}`;
      params.push(filters.endDate);
    }

    if (filters?.status !== undefined) {
      query += ` AND ac.status = $${paramIndex++}`;
      params.push(filters.status);
    }

    query += ' ORDER BY ac.created_at DESC';

    const result = await this.pool.query(query, params);
    return result.rows;
  }

  /**
   * 代理申请提现
   */
  async requestWithdraw(
    agentId: number,
    amount: number,
    bankInfo: {
      bankName: string;
      bankAccount: string;
      accountName: string;
    }
  ): Promise<{ success: boolean; withdrawId?: number; message?: string }> {
    const client = await this.pool.connect();

    try {
      await client.query('BEGIN');

      // 检查代理可用余额
      const agentResult = await client.query(
        'SELECT available_balance FROM agents WHERE id = $1 FOR UPDATE',
        [agentId]
      );

      if (agentResult.rows.length === 0) {
        throw new Error('代理不存在');
      }

      const availableBalance = parseFloat(agentResult.rows[0].available_balance);

      if (amount > availableBalance) {
        throw new Error('可用余额不足');
      }

      // 冻结金额
      await client.query(
        `UPDATE agents
         SET available_balance = available_balance - $1,
             frozen_balance = frozen_balance + $1
         WHERE id = $2`,
        [amount, agentId]
      );

      // 插入提现记录
      const insertResult = await client.query(
        `INSERT INTO agent_withdraw (
          agent_id, withdraw_amount, bank_name, bank_account,
          account_name, actual_amount, status
        ) VALUES ($1, $2, $3, $4, $5, $6, $7)
        RETURNING id`,
        [agentId, amount, bankInfo.bankName, bankInfo.bankAccount, bankInfo.accountName, amount, 0]
      );

      await client.query('COMMIT');

      return {
        success: true,
        withdrawId: insertResult.rows[0].id
      };

    } catch (error: any) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * 审核代理提现（管理员）
   */
  async reviewWithdraw(
    withdrawId: number,
    approved: boolean,
    approvedBy: number,
    remark?: string
  ): Promise<void> {
    const client = await this.pool.connect();

    try {
      await client.query('BEGIN');

      // 获取提现记录
      const withdrawResult = await client.query(
        'SELECT agent_id, withdraw_amount, frozen_amount, status FROM agent_withdraw WHERE id = $1 FOR UPDATE',
        [withdrawId]
      );

      if (withdrawResult.rows.length === 0) {
        throw new Error('提现记录不存在');
      }

      const withdraw = withdrawResult.rows[0];

      if (withdraw.status !== 0) {
        throw new Error('该提现已处理');
      }

      const newStatus = approved ? 1 : 2; // 1:已通过, 2:已拒绝

      if (approved) {
        // 通过：减少冻结余额
        await client.query(
          `UPDATE agents
           SET frozen_balance = frozen_balance - $1,
               updated_at = CURRENT_TIMESTAMP
           WHERE id = $2`,
          [withdraw.withdraw_amount, withdraw.agent_id]
        );
      } else {
        // 拒绝：返还可用余额
        await client.query(
          `UPDATE agents
           SET available_balance = available_balance + $1,
               frozen_balance = frozen_balance - $1,
               updated_at = CURRENT_TIMESTAMP
           WHERE id = $2`,
          [withdraw.withdraw_amount, withdraw.agent_id]
        );
      }

      // 更新提现记录状态
      await client.query(
        `UPDATE agent_withdraw
         SET status = $1, approved_by = $2, approved_time = CURRENT_TIMESTAMP, remark = $3
         WHERE id = $4`,
        [newStatus, approvedBy, remark || '', withdrawId]
      );

      await client.query('COMMIT');

    } catch (error: any) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * 获取代理统计数据
   */
  async getAgentStatistics(agentId: number, days: number = 30): Promise<{
    totalUsers: number;
    directUsers: number;
    subAgentCount: number;
    totalTrades: number;
    totalVolume: number;
    totalCommission: number;
  }> {
    const result = await this.pool.query(
      `
      SELECT
        (SELECT COUNT(*) FROM users WHERE agent_id = $1) as direct_users,
        (SELECT COUNT(*) FROM users WHERE parent_agent_id = $1) as indirect_users,
        (SELECT COUNT(*) FROM agents WHERE parent_agent_id = $1) as sub_agent_count,
        COALESCE((SELECT SUM(total_trades) FROM agent_statistics
                  WHERE agent_id = $1 AND stat_date >= CURRENT_DATE - INTERVAL '1 day' * $2), 0) as total_trades,
        COALESCE((SELECT SUM(total_volume) FROM agent_statistics
                  WHERE agent_id = $1 AND stat_date >= CURRENT_DATE - INTERVAL '1 day' * $2), 0) as total_volume,
        COALESCE((SELECT SUM(total_commission) FROM agent_commission
                  WHERE agent_id = $1 AND created_at >= CURRENT_TIMESTAMP - INTERVAL '1 day' * $2), 0) as total_commission
      `,
      [agentId, days]
    );

    const stats = result.rows[0];
    return {
      totalUsers: stats.direct_users + stats.indirect_users,
      directUsers: stats.direct_users,
      subAgentCount: stats.sub_agent_count,
      totalTrades: stats.total_trades,
      totalVolume: stats.total_volume,
      totalCommission: stats.total_commission
    };
  }

  /**
   * 禁用/启用代理
   */
  async toggleAgentStatus(agentId: number, status: AgentStatus): Promise<void> {
    await this.pool.query(
      'UPDATE agents SET status = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2',
      [status, agentId]
    );
  }

  /**
   * 更新代理分佣比例
   */
  async updateCommissionRate(
    agentId: number,
    newRate: number
  ): Promise<void> {
    // 验证分佣比例范围
    if (newRate < 0 || newRate > 1) {
      throw new Error('分佣比例必须在 0 到 1 之间');
    }

    await this.pool.query(
      'UPDATE agents SET commission_rate = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2',
      [newRate, agentId]
    );
  }
}
