import { v4 as uuidv4 } from 'uuid';
import dayjs from 'dayjs';
import { query, findOne } from '../config/database';
import logger from '../utils/logger';

/**
 * 生成分佣流水号
 */
function generateCommissionRecordNumber(): string {
  return `CMT${dayjs().format('YYYYMMDDHHmmss')}${Math.floor(Math.random() * 10000).toString().padStart(4, '0')}`;
}

/**
 * 生成分佣账本号
 */
function generateLedgerNumber(): string {
  return `LDG${dayjs().format('YYYYMMDDHHmmss')}${Math.floor(Math.random() * 10000).toString().padStart(4, '0')}`;
}

/**
 * 生成分佣（订单成交后调用）
 */
export async function generateCommission(
  client: any,
  userId: number,
  orderId: number,
  productId: number,
  lotSize: number,
  commission: number
): Promise<void> {
  try {
    // 1. 获取用户代理信息
    const user = await client.query(
      `SELECT u.agent_id, u.id, a.user_id as agent_user_id, a.agent_level, a.parent_agent_id
       FROM users u
       LEFT JOIN agents a ON u.agent_id = a.id
       WHERE u.id = $1`,
      [userId]
    );

    if (!user.rows[0] || !user.rows[0].agent_id) {
      // 没有代理，不需要分佣
      return;
    }

    const userData = user.rows[0];

    // 2. 获取分佣配置
    const commissionConfig = await client.query(
      `SELECT * FROM commission_configs
       WHERE (product_id = $1 OR product_id IS NULL)
         AND status = 1
       ORDER BY product_id DESC NULLS LAST LIMIT 1`,
      [productId]
    );

    if (!commissionConfig.rows[0]) {
      logger.warn('No commission config found', { product_id: productId });
      return;
    }

    const config = commissionConfig.rows[0];

    // 3. 计算平台留存
    const platformCommission = commission * (config.platform_rate || 0.5);

    // 4. 计算一级代理分佣
    let agent1Commission = 0;
    if (config.agent_1_rate > 0 && userData.agent_level === 1) {
      agent1Commission = commission * config.agent_1_rate;

      // 生成分佣记录
      await client.query(
        `INSERT INTO commission_records
         (record_number, user_id, agent_id, order_id, product_id, trade_amount, commission, agent_commission, commission_rate, agent_level, profit_user_id, description)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)`,
        [
          generateCommissionRecordNumber(),
          userId,
          userData.agent_id,
          orderId,
          productId,
          lotSize * 100, // 假设合约大小100
          commission,
          agent1Commission,
          config.agent_1_rate,
          1,
          userData.agent_user_id,
          `一级代理分佣`,
        ]
      );

      // 更新代理账本
      await updateAgentLedger(client, userData.agent_id, userId, agent1Commission, orderId);

      // 更新代理统计
      await client.query(
        `UPDATE agents
         SET total_commission = total_commission + $1,
             updated_at = CURRENT_TIMESTAMP
         WHERE id = $2`,
        [agent1Commission, userData.agent_id]
      );

      logger.info('Agent 1 commission generated:', {
        agent_id: userData.agent_id,
        commission: agent1Commission,
      });
    }

    // 5. 计算二级代理分佣
    let agent2Commission = 0;
    if (config.agent_2_rate > 0 && userData.agent_level === 2 && userData.parent_agent_id) {
      agent2Commission = commission * config.agent_2_rate;

      // 获取一级代理信息
      const parentAgent = await client.query(
        `SELECT user_id FROM agents WHERE id = $1`,
        [userData.parent_agent_id]
      );

      if (parentAgent.rows[0]) {
        // 生成分佣记录
        await client.query(
          `INSERT INTO commission_records
           (record_number, user_id, agent_id, order_id, product_id, trade_amount, commission, agent_commission, commission_rate, agent_level, profit_user_id, description)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)`,
          [
            generateCommissionRecordNumber(),
            userId,
            userData.parent_agent_id,
            orderId,
            productId,
            lotSize * 100,
            commission,
            agent2Commission,
            config.agent_2_rate,
            2,
            parentAgent.rows[0].user_id,
            `二级代理分佣`,
          ]
        );

        // 更新代理账本
        await updateAgentLedger(client, userData.parent_agent_id, userId, agent2Commission, orderId);

        // 更新代理统计
        await client.query(
          `UPDATE agents
           SET total_commission = total_commission + $1,
               updated_at = CURRENT_TIMESTAMP
           WHERE id = $2`,
          [agent2Commission, userData.parent_agent_id]
        );

        logger.info('Agent 2 commission generated:', {
          agent_id: userData.parent_agent_id,
          commission: agent2Commission,
        });
      }
    }

    // 6. 更新代理客户汇总
    if (userData.agent_id) {
      const agentCustomer = await client.query(
        `SELECT id FROM agent_customers WHERE agent_id = $1 AND user_id = $2`,
        [userData.agent_id, userId]
      );

      if (agentCustomer.rows.length > 0) {
        await client.query(
          `UPDATE agent_customers
           SET total_commission = total_commission + $1,
               trade_count = trade_count + 1,
               updated_at = CURRENT_TIMESTAMP
           WHERE id = $2`,
          [commission, agentCustomer.rows[0].id]
        );
      } else {
        await client.query(
          `INSERT INTO agent_customers (agent_id, user_id, agent_level, total_commission, trade_count)
           VALUES ($1, $2, $3, $4, $5)`,
          [userData.agent_id, userId, userData.agent_level, commission, 1]
        );
      }
    }
  } catch (error) {
    logger.error('Generate commission failed:', error);
    throw error;
  }
}

/**
 * 更新代理账本
 */
async function updateAgentLedger(
  client: any,
  agentId: number,
  userId: number,
  amount: number,
  orderId: number
): Promise<void> {
  // 获取当前余额
  const ledgerResult = await client.query(
    `SELECT balance_after FROM agent_ledger WHERE agent_id = $1 ORDER BY created_at DESC LIMIT 1`,
    [agentId]
  );

  const balanceBefore = ledgerResult.rows[0]?.balance_after || 0;
  const balanceAfter = balanceBefore + amount;

  // 插入账本记录
  await client.query(
    `INSERT INTO agent_ledger
     (record_number, agent_id, user_id, type, amount, balance_before, balance_after, related_id, description)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
    [
      generateLedgerNumber(),
      agentId,
      userId,
      1, // 分佣收入
      amount,
      balanceBefore,
      balanceAfter,
      orderId,
      `交易分佣`,
    ]
  );
}

/**
 * 获取分佣记录
 */
export async function getCommissionRecords(
  agentId?: number,
  userId?: number,
  page: number = 1,
  pageSize: number = 20
) {
  let whereClause = 'WHERE 1=1';
  const params: any[] = [];
  let paramIndex = 1;

  if (agentId !== undefined) {
    whereClause += ` AND cr.agent_id = $${paramIndex}`;
    params.push(agentId);
    paramIndex++;
  }

  if (userId !== undefined) {
    whereClause += ` AND cr.user_id = $${paramIndex}`;
    params.push(userId);
    paramIndex++;
  }

  const offset = (page - 1) * pageSize;

  const countResult = await query(
    `SELECT COUNT(*) as total FROM commission_records cr ${whereClause}`,
    params
  );

  const total = parseInt(countResult.rows[0].total);

  const dataResult = await query(
    `SELECT cr.*, u1.username as user_username, u2.username as agent_username, p.symbol
     FROM commission_records cr
     LEFT JOIN users u1 ON cr.user_id = u1.id
     LEFT JOIN users u2 ON cr.profit_user_id = u2.id
     LEFT JOIN products p ON cr.product_id = p.id
     ${whereClause}
     ORDER BY cr.created_at DESC LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`,
    [...params, pageSize, offset]
  );

  return {
    data: dataResult.rows,
    total,
    page,
    pageSize,
    totalPages: Math.ceil(total / pageSize),
  };
}

/**
 * 获取代理账本
 */
export async function getAgentLedger(
  agentId: number,
  page: number = 1,
  pageSize: number = 20
) {
  const offset = (page - 1) * pageSize;

  const countResult = await query(
    `SELECT COUNT(*) as total FROM agent_ledger WHERE agent_id = $1`,
    [agentId]
  );

  const total = parseInt(countResult.rows[0].total);

  const dataResult = await query(
    `SELECT al.*, u.username
     FROM agent_ledger al
     LEFT JOIN users u ON al.user_id = u.id
     WHERE al.agent_id = $1 AND al.is_deleted = false
     ORDER BY al.created_at DESC LIMIT $2 OFFSET $3`,
    [agentId, pageSize, offset]
  );

  return {
    data: dataResult.rows,
    total,
    page,
    pageSize,
    totalPages: Math.ceil(total / pageSize),
  };
}

/**
 * 获取代理客户列表
 */
export async function getAgentCustomers(
  agentId: number,
  page: number = 1,
  pageSize: number = 20
) {
  const offset = (page - 1) * pageSize;

  const countResult = await query(
    `SELECT COUNT(*) as total FROM agent_customers WHERE agent_id = $1`,
    [agentId]
  );

  const total = parseInt(countResult.rows[0].total);

  const dataResult = await query(
    `SELECT ac.*, u.username, u.real_name, u.phone, u.status, a.account_number, a.balance
     FROM agent_customers ac
     LEFT JOIN users u ON ac.user_id = u.id
     LEFT JOIN accounts a ON ac.user_id = a.user_id
     WHERE ac.agent_id = $1
     ORDER BY ac.created_at DESC LIMIT $2 OFFSET $3`,
    [agentId, pageSize, offset]
  );

  return {
    data: dataResult.rows,
    total,
    page,
    pageSize,
    totalPages: Math.ceil(total / pageSize),
  };
}

/**
 * 获取代理统计数据
 */
export async function getAgentStatistics(agentId: number) {
  const result = await findOne(
    `SELECT
        COUNT(DISTINCT u.id) as total_customers,
        COALESCE(SUM(a.total_deposit), 0) as total_deposit,
        COALESCE(SUM(a.total_withdraw), 0) as total_withdraw,
        COALESCE(SUM(ac.total_commission), 0) as total_commission,
        COALESCE(SUM(a.balance), 0) as customer_balance
     FROM agents ag
     LEFT JOIN agent_customers ac ON ag.id = ac.agent_id
     LEFT JOIN users u ON ac.user_id = u.id
     LEFT JOIN accounts a ON u.id = a.user_id
     WHERE ag.id = $1`,
    [agentId]
  );

  return result;
}

/**
 * 获取分佣配置
 */
export async function getCommissionConfigs() {
  const result = await query(
    `SELECT cc.*, p.symbol
     FROM commission_configs cc
     LEFT JOIN products p ON cc.product_id = p.id
     WHERE cc.status = 1
     ORDER BY cc.created_at DESC`
  );

  return result.rows;
}

/**
 * 创建分佣配置
 */
export async function createCommissionConfig(data: {
  name: string;
  agent_1_rate: number;
  agent_2_rate: number;
  platform_rate: number;
  product_id?: number;
}) {
  const result = await query(
    `INSERT INTO commission_configs
     (name, agent_1_rate, agent_2_rate, platform_rate, product_id, status)
     VALUES ($1, $2, $3, $4, $5, 1)
     RETURNING *`,
    [data.name, data.agent_1_rate, data.agent_2_rate, data.platform_rate, data.product_id]
  );

  logger.info('Commission config created:', { config_id: result.rows[0].id, name: data.name });

  return result.rows[0];
}

/**
 * 更新分佣配置
 */
export async function updateCommissionConfig(
  id: number,
  data: {
    name?: string;
    agent_1_rate?: number;
    agent_2_rate?: number;
    platform_rate?: number;
    product_id?: number;
    status?: number;
  }
) {
  const fields: string[] = [];
  const values: any[] = [];
  let paramIndex = 1;

  if (data.name !== undefined) {
    fields.push(`name = $${paramIndex}`);
    values.push(data.name);
    paramIndex++;
  }

  if (data.agent_1_rate !== undefined) {
    fields.push(`agent_1_rate = $${paramIndex}`);
    values.push(data.agent_1_rate);
    paramIndex++;
  }

  if (data.agent_2_rate !== undefined) {
    fields.push(`agent_2_rate = $${paramIndex}`);
    values.push(data.agent_2_rate);
    paramIndex++;
  }

  if (data.platform_rate !== undefined) {
    fields.push(`platform_rate = $${paramIndex}`);
    values.push(data.platform_rate);
    paramIndex++;
  }

  if (data.product_id !== undefined) {
    fields.push(`product_id = $${paramIndex}`);
    values.push(data.product_id);
    paramIndex++;
  }

  if (data.status !== undefined) {
    fields.push(`status = $${paramIndex}`);
    values.push(data.status);
    paramIndex++;
  }

  fields.push(`updated_at = CURRENT_TIMESTAMP`);
  values.push(id);

  const result = await query(
    `UPDATE commission_configs SET ${fields.join(', ')} WHERE id = $${paramIndex} RETURNING *`,
    values
  );

  logger.info('Commission config updated:', { config_id: id });

  return result.rows[0];
}
