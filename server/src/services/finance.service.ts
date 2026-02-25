import { v4 as uuidv4 } from 'uuid';
import dayjs from 'dayjs';
import { query, findOne } from '../config/database';
import logger from '../utils/logger';
import redis from '../utils/redis';
import { generateCommission } from './commission.service';

/**
 * 交易类型
 */
export enum TransactionType {
  DEPOSIT = 1,    // 充值
  WITHDRAW = 2,   // 提现
  DEPOSIT_SUCCESS = 3,   // 入金成功
  WITHDRAW_SUCCESS = 4,  // 出金成功
  COMMISSION = 5, // 手续费
  PROFIT_LOSS = 6, // 盈亏
  SWAP = 7,       // 隔夜利息
}

/**
 * 支付方式
 */
export enum PaymentMethod {
  USDT = 1,       // USDT
  BANK_CARD = 2,  // 银行卡
  THIRD_PARTY = 3, // 第三方支付
}

/**
 * 充值状态
 */
export enum DepositStatus {
  PENDING = 0,    // 待审核
  APPROVED = 1,   // 已审核
  REJECTED = 2,   // 已拒绝
  PROCESSING = 3, // 处理中
}

/**
 * 提现状态
 */
export enum WithdrawStatus {
  PENDING = 0,    // 待审核
  APPROVED = 1,   // 审核通过
  REJECTED = 2,   // 已拒绝
  TRANSFERRED = 3,// 已打款
  FAILED = 4,     // 已失败
}

/**
 * 充值信息接口
 */
export interface CreateDepositData {
  user_id: number;
  amount: number;
  payment_method: PaymentMethod;
  payment_channel?: string;
  transaction_hash?: string;
  bank_account?: string;
}

/**
 * 提现信息接口
 */
export interface CreateWithdrawData {
  user_id: number;
  amount: number;
  payment_method: PaymentMethod;
  withdraw_address?: string;
  bank_account?: string;
  bank_name?: string;
}

/**
 * 生成流水号
 */
function generateTransactionNumber(): string {
  return `TXN${dayjs().format('YYYYMMDDHHmmss')}${Math.floor(Math.random() * 10000).toString().padStart(4, '0')}`;
}

/**
 * 生成订单号
 */
function generateOrderNumber(): string {
  return `ORD${dayjs().format('YYYYMMDDHHmmss')}${Math.floor(Math.random() * 10000).toString().padStart(4, '0')}`;
}

/**
 * 更新账户余额（事务中调用）
 */
export async function updateAccountBalance(
  client: any,
  userId: number,
  amount: number,
  type: TransactionType,
  relatedId?: number,
  description?: string
): Promise<void> {
  // 获取当前余额
  const accountResult = await client.query(
    `SELECT balance, available_balance, realized_pl, total_commission FROM accounts WHERE user_id = $1`,
    [userId]
  );

  if (!accountResult.rows[0]) {
    throw new Error('Account not found');
  }

  const account = accountResult.rows[0];
  const balanceBefore = account.balance;
  const balanceAfter = balanceBefore + amount;

  // 更新账户
  if (type === TransactionType.COMMISSION) {
    await client.query(
      `UPDATE accounts
       SET balance = balance + $1,
           available_balance = available_balance + $1,
           total_commission = total_commission + $2,
           updated_at = CURRENT_TIMESTAMP
       WHERE user_id = $3`,
      [amount, Math.abs(amount), userId]
    );
  } else if (type === TransactionType.PROFIT_LOSS) {
    await client.query(
      `UPDATE accounts
       SET balance = balance + $1,
           available_balance = available_balance + $1,
           realized_pl = realized_pl + $1,
           updated_at = CURRENT_TIMESTAMP
       WHERE user_id = $2`,
      [amount, userId]
    );
  } else {
    await client.query(
      `UPDATE accounts
       SET balance = balance + $1,
           available_balance = available_balance + $1,
           updated_at = CURRENT_TIMESTAMP
       WHERE user_id = $2`,
      [amount, userId]
    );
  }

  // 创建资金流水
  await client.query(
    `INSERT INTO transactions
     (transaction_number, user_id, type, amount, balance_before, balance_after, related_id, description, status)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
    [
      generateTransactionNumber(),
      userId,
      type,
      amount,
      balanceBefore,
      balanceAfter,
      relatedId,
      description,
      1, // 成功
    ]
  );

  // 更新 Redis 缓存
  const updatedAccount = await client.query(
    `SELECT * FROM accounts WHERE user_id = $1`,
    [userId]
  );

  await redis.set(`user:${userId}:account`, JSON.stringify(updatedAccount.rows[0]), 300);
}

/**
 * 获取账户信息
 */
export async function getAccount(userId: number) {
  // 先从 Redis 获取
  const cached = await redis.get(`user:${userId}:account`);

  if (cached) {
    return JSON.parse(cached);
  }

  // 从数据库获取
  const account = await findOne(
    `SELECT a.*, u.username, u.real_name
     FROM accounts a
     JOIN users u ON a.user_id = u.id
     WHERE a.user_id = $1`,
    [userId]
  );

  if (account) {
    // 缓存到 Redis
    await redis.set(`user:${userId}:account`, JSON.stringify(account), 300);
  }

  return account;
}

/**
 * 创建充值订单
 */
export async function createDeposit(data: CreateDepositData) {
  // 检查最小充值金额
  const minDeposit = await getSystemConfig('MIN_DEPOSIT', 100);

  if (data.amount < parseFloat(minDeposit)) {
    throw new Error(`Minimum deposit amount is ${minDeposit}`);
  }

  // 创建充值订单
  const result = await query(
    `INSERT INTO deposit_orders
     (order_number, user_id, amount, payment_method, payment_channel, transaction_hash, bank_account, status)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
     RETURNING *`,
    [
      generateOrderNumber(),
      data.user_id,
      data.amount,
      data.payment_method,
      data.payment_channel,
      data.transaction_hash,
      data.bank_account,
      DepositStatus.PENDING,
    ]
  );

  logger.info('Deposit order created:', {
    order_id: result.rows[0].id,
    order_number: result.rows[0].order_number,
    user_id: data.user_id,
    amount: data.amount,
  });

  return result.rows[0];
}

/**
 * 审核充值
 */
export async function approveDeposit(orderId: number, approved: boolean, adminId: number, remark?: string) {
  return await query(async (client: any) => {
    // 获取充值订单
    const order = await client.query(
      `SELECT * FROM deposit_orders WHERE id = $1 AND status = 0`,
      [orderId]
    );

    if (!order.rows[0]) {
      throw new Error('Deposit order not found or already processed');
    }

    const depositOrder = order.rows[0];

    if (approved) {
      // 通过审核
      // 更新订单状态
      await client.query(
        `UPDATE deposit_orders
         SET status = $1,
             approved_by = $2,
             approved_at = CURRENT_TIMESTAMP,
             remark = $3,
             updated_at = CURRENT_TIMESTAMP
         WHERE id = $4`,
        [DepositStatus.APPROVED, adminId, remark, orderId]
      );

      // 入账
      await updateAccountBalance(client, depositOrder.user_id, depositOrder.amount, TransactionType.DEPOSIT_SUCCESS, depositOrder.id, '充值入账');

      // 更新账户统计
      await client.query(
        `UPDATE accounts
         SET total_deposit = total_deposit + $1
         WHERE user_id = $2`,
        [depositOrder.amount, depositOrder.user_id]
      );

      logger.info('Deposit approved:', { order_id: orderId, user_id: depositOrder.user_id, amount: depositOrder.amount });
    } else {
      // 拒绝审核
      await client.query(
        `UPDATE deposit_orders
         SET status = $1,
             approved_by = $2,
             approved_at = CURRENT_TIMESTAMP,
             remark = $3,
             updated_at = CURRENT_TIMESTAMP
         WHERE id = $4`,
        [DepositStatus.REJECTED, adminId, remark, orderId]
      );

      logger.info('Deposit rejected:', { order_id: orderId, user_id: depositOrder.user_id, amount: depositOrder.amount });
    }

    return order.rows[0];
  });
}

/**
 * 创建提现申请
 */
export async function createWithdraw(data: CreateWithdrawData) {
  // 检查最小提现金额
  const minWithdraw = await getSystemConfig('MIN_WITHDRAW', 100);

  if (data.amount < parseFloat(minWithdraw)) {
    throw new Error(`Minimum withdraw amount is ${minWithdraw}`);
  }

  // 获取账户信息
  const account = await findOne(
    `SELECT available_balance FROM accounts WHERE user_id = $1`,
    [data.user_id]
  );

  if (!account || account.available_balance < data.amount) {
    throw new Error('Insufficient balance');
  }

  // 计算手续费
  const feeRate = await getSystemConfig('WITHDRAW_FEE_RATE', '0.005');
  const fee = data.amount * parseFloat(feeRate);
  const actualAmount = data.amount - fee;

  // 创建提现订单
  const result = await query(
    `INSERT INTO withdraw_orders
     (order_number, user_id, amount, fee, actual_amount, payment_method, withdraw_address, bank_account, bank_name, status)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
     RETURNING *`,
    [
      generateOrderNumber(),
      data.user_id,
      data.amount,
      fee,
      actualAmount,
      data.payment_method,
      data.withdraw_address,
      data.bank_account,
      data.bank_name,
      WithdrawStatus.PENDING,
    ]
  );

  logger.info('Withdraw order created:', {
    order_id: result.rows[0].id,
    order_number: result.rows[0].order_number,
    user_id: data.user_id,
    amount: data.amount,
  });

  return result.rows[0];
}

/**
 * 审核提现
 */
export async function approveWithdraw(orderId: number, approved: boolean, adminId: number, remark?: string) {
  return await query(async (client: any) => {
    // 获取提现订单
    const order = await client.query(
      `SELECT * FROM withdraw_orders WHERE id = $1 AND status = 0`,
      [orderId]
    );

    if (!order.rows[0]) {
      throw new Error('Withdraw order not found or already processed');
    }

    const withdrawOrder = order.rows[0];

    if (approved) {
      // 通过审核
      // 更新订单状态
      await client.query(
        `UPDATE withdraw_orders
         SET status = $1,
             approved_by = $2,
             approved_at = CURRENT_TIMESTAMP,
             remark = $3,
             updated_at = CURRENT_TIMESTAMP
         WHERE id = $4`,
        [WithdrawStatus.APPROVED, adminId, remark, orderId]
      );

      // 扣除余额
      await updateAccountBalance(client, withdrawOrder.user_id, -withdrawOrder.amount, TransactionType.WITHDRAW_SUCCESS, withdrawOrder.id, '提现出账');

      // 更新账户统计
      await client.query(
        `UPDATE accounts
         SET total_withdraw = total_withdraw + $1
         WHERE user_id = $2`,
        [withdrawOrder.amount, withdrawOrder.user_id]
      );

      logger.info('Withdraw approved:', { order_id: orderId, user_id: withdrawOrder.user_id, amount: withdrawOrder.amount });
    } else {
      // 拒绝审核
      await client.query(
        `UPDATE withdraw_orders
         SET status = $1,
             approved_by = $2,
             approved_at = CURRENT_TIMESTAMP,
             remark = $3,
             updated_at = CURRENT_TIMESTAMP
         WHERE id = $4`,
        [WithdrawStatus.REJECTED, adminId, remark, orderId]
      );

      logger.info('Withdraw rejected:', { order_id: orderId, user_id: withdrawOrder.user_id, amount: withdrawOrder.amount });
    }

    return order.rows[0];
  });
}

/**
 * 获取资金流水
 */
export async function getTransactions(
  userId: number,
  page: number = 1,
  pageSize: number = 20,
  type?: TransactionType
) {
  let whereClause = 'WHERE user_id = $1';
  const params: any[] = [userId];

  if (type !== undefined) {
    whereClause += ' AND type = $2';
    params.push(type);
  }

  const offset = (page - 1) * pageSize;

  // 获取总数
  const countResult = await query(
    `SELECT COUNT(*) as total FROM transactions ${whereClause}`,
    params
  );

  const total = parseInt(countResult.rows[0].total);

  // 获取数据
  const dataResult = await query(
    `SELECT * FROM transactions ${whereClause} ORDER BY created_at DESC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
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
 * 获取系统配置
 */
async function getSystemConfig(key: string, defaultValue: string = ''): Promise<string> {
  const config = await findOne(
    'SELECT config_value FROM system_configs WHERE config_key = $1',
    [key]
  );

  return config?.config_value || defaultValue;
}

/**
 * 获取充值列表
 */
export async function getDeposits(
  page: number = 1,
  pageSize: number = 20,
  status?: DepositStatus,
  userId?: number
) {
  let whereClause = 'WHERE 1=1';
  const params: any[] = [];
  let paramIndex = 1;

  if (status !== undefined) {
    whereClause += ` AND status = $${paramIndex}`;
    params.push(status);
    paramIndex++;
  }

  if (userId !== undefined) {
    whereClause += ` AND user_id = $${paramIndex}`;
    params.push(userId);
    paramIndex++;
  }

  const offset = (page - 1) * pageSize;

  const countResult = await query(
    `SELECT COUNT(*) as total FROM deposit_orders ${whereClause}`,
    params
  );

  const total = parseInt(countResult.rows[0].total);

  const dataResult = await query(
    `SELECT d.*, u.username, u.real_name
     FROM deposit_orders d
     LEFT JOIN users u ON d.user_id = u.id
     ${whereClause}
     ORDER BY d.created_at DESC LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`,
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
 * 获取提现列表
 */
export async function getWithdraws(
  page: number = 1,
  pageSize: number = 20,
  status?: WithdrawStatus,
  userId?: number
) {
  let whereClause = 'WHERE 1=1';
  const params: any[] = [];
  let paramIndex = 1;

  if (status !== undefined) {
    whereClause += ` AND status = $${paramIndex}`;
    params.push(status);
    paramIndex++;
  }

  if (userId !== undefined) {
    whereClause += ` AND user_id = $${paramIndex}`;
    params.push(userId);
    paramIndex++;
  }

  const offset = (page - 1) * pageSize;

  const countResult = await query(
    `SELECT COUNT(*) as total FROM withdraw_orders ${whereClause}`,
    params
  );

  const total = parseInt(countResult.rows[0].total);

  const dataResult = await query(
    `SELECT w.*, u.username, u.real_name
     FROM withdraw_orders w
     LEFT JOIN users u ON w.user_id = u.id
     ${whereClause}
     ORDER BY w.created_at DESC LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`,
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
