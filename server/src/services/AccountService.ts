import { PoolClient } from 'pg';
import { query, transaction } from '../config/database';
import logger from '../utils/logger';
import { acquireBalanceLock, releaseLock } from '../utils/distributed-lock';
import { auditLogService, AuditOperation } from './AuditLogService';

// ============================================
// 账户服务 - 资金一致性强化
// ============================================

export interface BalanceUpdateResult {
  success: boolean;
  userId: number;
  beforeBalance: number;
  afterBalance: number;
  amount: number;
  transactionId: string;
  difference: number;
  timestamp: Date;
}

export interface BalanceUpdateRequest {
  userId: number;
  amount: number;
  operation: string;
  relatedOrderId?: number;
  relatedPositionId?: number;
  description?: string;
  metadata?: any;
  strictMode?: boolean;
}

export class AccountService {
  /**
   * 原子化更新账户余额
   * 所有账户余额更新必须通过此方法
   */
  async updateBalanceAtomic(
    request: BalanceUpdateRequest
  ): Promise<BalanceUpdateResult> {
    const {
      userId,
      amount,
      operation,
      relatedOrderId,
      relatedPositionId,
      description,
      metadata,
      strictMode = true,
    } = request;

    logger.info(
      `[AccountService] 开始原子化更新余额: userId=${userId}, amount=${amount}, operation=${operation}`
    );

    const startTime = Date.now();

    try {
      const lock = await acquireBalanceLock(userId);

      if (!lock) {
        logger.warn(
          `[AccountService] 获取余额锁失败: userId=${userId}`
        );
        throw new Error('获取余额锁失败,请稍后重试');
      }

      try {
        const result = await this.updateBalanceInternal(
          lock,
          userId,
          amount,
          operation,
          relatedOrderId,
          relatedPositionId,
          description,
          metadata,
          strictMode
        );

        const processingTime = Date.now() - startTime;

        logger.info(
          `[AccountService] 余额更新成功: userId=${userId}, time=${processingTime}ms`
        );

        return result;
      } catch (error) {
        logger.error(
          `[AccountService] 余额更新失败: userId=${userId}`,
          error
        );
        throw error;
      } finally {
        await releaseLock(lock);
      }
    } catch (error) {
      logger.error(
        `[AccountService] 原子化余额更新失败: userId=${userId}, operation=${operation}`,
        error
      );
      throw error;
    }
  }

  /**
   * 内部余额更新实现
   */
  private async updateBalanceInternal(
    lock: any,
    userId: number,
    amount: number,
    operation: string,
    relatedOrderId?: number,
    relatedPositionId?: number,
    description?: string,
    metadata?: any,
    strictMode: boolean = true
  ): Promise<BalanceUpdateResult> {
    return await transaction(async (client: PoolClient) => {
      const transactionId = this.generateTransactionId();

      logger.debug(
        `[AccountService] 事务开始: transactionId=${transactionId}, userId=${userId}`
      );

      const beforeAccount = await this.getAccountWithLock(client, userId);

      if (!beforeAccount) {
        throw new Error('账户不存在');
      }

      const beforeBalance = beforeAccount.balance;
      const beforeAvailableBalance = beforeAccount.available_balance;

      const newBalance = beforeBalance + amount;

      if (strictMode && newBalance < 0) {
        throw new Error(
          `余额不足: beforeBalance=${beforeBalance}, amount=${amount}, newBalance=${newBalance}`
        );
      }

      const newAvailableBalance = beforeAvailableBalance + amount;

      await this.updateAccountFields(client, userId, {
        balance: newBalance,
        available_balance: newAvailableBalance,
        updated_at: new Date(),
      });

      const afterAccount = await this.getAccountWithLock(client, userId);
      const afterBalance = afterAccount.balance;

      const difference = afterBalance - newBalance;

      if (strictMode && Math.abs(difference) > 0.01) {
        logger.error(
          `[AccountService] 余额差异超出阈值: userId=${userId}, expected=${newBalance}, actual=${afterBalance}, difference=${difference}`
        );
        throw new Error(
          `余额差异异常: expected=${newBalance}, actual=${afterBalance}, difference=${difference}`
        );
      }

      await auditLogService.createAuditLog(client, {
        userId,
        operation,
        amount,
        beforeBalance: beforeBalance,
        afterBalance: afterBalance,
        orderId: relatedOrderId,
        positionId: relatedPositionId,
        description: description || `余额更新: ${operation}`,
        metadata: {
          ...metadata,
          transactionId,
          beforeAvailableBalance,
          afterAvailableBalance,
          difference,
          processingTime: Date.now() - Date.now(),
        },
        createdBy: 'SYSTEM',
      });

      logger.debug(
        `[AccountService] 事务提交成功: transactionId=${transactionId}`
      );

      return {
        success: true,
        userId,
        beforeBalance,
        afterBalance,
        amount,
        transactionId,
        difference,
        timestamp: new Date(),
      };
    });
  }

  /**
   * 获取账户(使用行级锁)
   */
  private async getAccountWithLock(
    client: PoolClient,
    userId: number
  ): Promise<any> {
    const result = await client.query(
      `SELECT * FROM accounts WHERE user_id = $1 FOR UPDATE`,
      [userId]
    );

    if (!result.rows[0]) {
      return null;
    }

    return result.rows[0];
  }

  /**
   * 更新账户字段
   */
  private async updateAccountFields(
    client: PoolClient,
    userId: number,
    fields: any
  ): Promise<void> {
    const setClauses = [];
    const values = [];
    let paramIndex = 1;

    for (const [key, value] of Object.entries(fields)) {
      setClauses.push(`${key} = $${paramIndex}`);
      values.push(value);
      paramIndex++;
    }

    values.push(userId);

    const sql = `
      UPDATE accounts
      SET ${setClauses.join(', ')}
      WHERE user_id = $${paramIndex}
    `;

    await client.query(sql, values);
  }

  /**
   * 批量原子化更新账户余额
   */
  async batchUpdateBalanceAtomic(
    requests: BalanceUpdateRequest[]
  ): Promise<BalanceUpdateResult[]> {
    logger.info(
      `[AccountService] 开始批量更新余额: count=${requests.length}`
    );

    const results: BalanceUpdateResult[] = [];

    for (const request of requests) {
      try {
        const result = await this.updateBalanceAtomic(request);
        results.push(result);
      } catch (error) {
        logger.error(
          `[AccountService] 批量更新失败: userId=${request.userId}`,
          error
        );
        results.push({
          success: false,
          userId: request.userId,
          beforeBalance: 0,
          afterBalance: 0,
          amount: request.amount,
          transactionId: '',
          difference: 0,
          timestamp: new Date(),
        } as BalanceUpdateResult);
      }
    }

    const successCount = results.filter((r) => r.success).length;

    logger.info(
      `[AccountService] 批量更新完成: success=${successCount}/${results.length}`
    );

    return results;
  }

  /**
   * 冻结资金
   */
  async freezeBalanceAtomic(
    userId: number,
    amount: number,
    reason: string,
    relatedOrderId?: number,
    relatedPositionId?: number
  ): Promise<BalanceUpdateResult> {
    logger.info(
      `[AccountService] 开始冻结资金: userId=${userId}, amount=${amount}`
    );

    const lock = await acquireBalanceLock(userId);

    if (!lock) {
      throw new Error('获取余额锁失败,请稍后重试');
    }

    try {
      const result = await transaction(async (client: PoolClient) => {
        const account = await this.getAccountWithLock(client, userId);

        if (!account) {
          throw new Error('账户不存在');
        }

        if (account.available_balance < amount) {
          throw new Error(
            `可用余额不足: available_balance=${account.available_balance}, amount=${amount}`
          );
        }

        const beforeBalance = account.balance;
        const beforeAvailableBalance = account.available_balance;
        const beforeFrozenAmount = account.frozen_amount || 0;

        const newAvailableBalance = beforeAvailableBalance - amount;
        const newFrozenAmount = beforeFrozenAmount + amount;

        await this.updateAccountFields(client, userId, {
          available_balance: newAvailableBalance,
          frozen_amount: newFrozenAmount,
          updated_at: new Date(),
        });

        const afterAccount = await this.getAccountWithLock(client, userId);

        await auditLogService.createAuditLog(client, {
          userId,
          operation: 'FREEZE',
          amount,
          beforeBalance: beforeBalance,
          afterBalance: afterAccount.balance,
          orderId: relatedOrderId,
          positionId: relatedPositionId,
          description: reason || '资金冻结',
          metadata: {
            beforeAvailableBalance,
            afterAvailableBalance,
            beforeFrozenAmount,
            afterFrozenAmount: afterAccount.frozen_amount,
          },
          createdBy: 'SYSTEM',
        });

        return {
          success: true,
          userId,
          beforeBalance,
          afterBalance: afterAccount.balance,
          amount,
          transactionId: this.generateTransactionId(),
          difference: 0,
          timestamp: new Date(),
        };
      });

      return result;
    } finally {
      await releaseLock(lock);
    }
  }

  /**
   * 解冻资金
   */
  async unfreezeBalanceAtomic(
    userId: number,
    amount: number,
    reason: string,
    relatedOrderId?: number,
    relatedPositionId?: number
  ): Promise<BalanceUpdateResult> {
    logger.info(
      `[AccountService] 开始解冻资金: userId=${userId}, amount=${amount}`
    );

    const lock = await acquireBalanceLock(userId);

    if (!lock) {
      throw new Error('获取余额锁失败,请稍后重试');
    }

    try {
      const result = await transaction(async (client: PoolClient) => {
        const account = await this.getAccountWithLock(client, userId);

        if (!account) {
          throw new Error('账户不存在');
        }

        const beforeBalance = account.balance;
        const beforeAvailableBalance = account.available_balance;
        const beforeFrozenAmount = account.frozen_amount || 0;

        if (beforeFrozenAmount < amount) {
          throw new Error(
            `冻结资金不足: frozen_amount=${beforeFrozenAmount}, amount=${amount}`
          );
        }

        const newAvailableBalance = beforeAvailableBalance + amount;
        const newFrozenAmount = beforeFrozenAmount - amount;

        await this.updateAccountFields(client, userId, {
          available_balance: newAvailableBalance,
          frozen_amount: newFrozenAmount,
          updated_at: new Date(),
        });

        const afterAccount = await this.getAccountWithLock(client, userId);

        await auditLogService.createAuditLog(client, {
          userId,
          operation: 'UNFREEZE',
          amount,
          beforeBalance: beforeBalance,
          afterBalance: afterAccount.balance,
          orderId: relatedOrderId,
          positionId: relatedPositionId,
          description: reason || '资金解冻',
          metadata: {
            beforeAvailableBalance,
            afterAvailableBalance,
            beforeFrozenAmount,
            afterFrozenAmount: afterAccount.frozen_amount,
          },
          createdBy: 'SYSTEM',
        });

        return {
          success: true,
          userId,
          beforeBalance,
          afterBalance: afterAccount.balance,
          amount,
          transactionId: this.generateTransactionId(),
          difference: 0,
          timestamp: new Date(),
        };
      });

      return result;
    } finally {
      await releaseLock(lock);
    }
  }

  /**
   * 转账(原子化)
   */
  async transferBalanceAtomic(
    fromUserId: number,
    toUserId: number,
    amount: number,
    reason: string
  ): Promise<{
    fromResult: BalanceUpdateResult;
    toResult: BalanceUpdateResult;
  }> {
    logger.info(
      `[AccountService] 开始转账: from=${fromUserId}, to=${toUserId}, amount=${amount}`
    );

    return await transaction(async (client: PoolClient) => {
      const fromLock = await this.getAccountWithLock(client, fromUserId);
      const toLock = await this.getAccountWithLock(client, toUserId);

      if (!fromLock || !toLock) {
        throw new Error('账户不存在');
      }

      if (fromLock.available_balance < amount) {
        throw new Error(
          `余额不足: available_balance=${fromLock.available_balance}, amount=${amount}`
        );
      }

      const fromResult = await this.updateBalanceInternal(
        null,
        fromUserId,
        -amount,
        'TRANSFER_OUT',
        undefined,
        undefined,
        reason,
        { toUserId },
        true
      );

      const toResult = await this.updateBalanceInternal(
        null,
        toUserId,
        amount,
        'TRANSFER_IN',
        undefined,
        undefined,
        reason,
        { fromUserId },
        true
      );

      logger.info(
        `[AccountService] 转账完成: from=${fromUserId}, to=${toUserId}, amount=${amount}`
      );

      return { fromResult, toResult };
    });
  }

  /**
   * 检查账户余额
   */
  async checkBalance(
    userId: number,
    amount: number
  ): Promise<{
    sufficient: boolean;
    currentBalance: number;
    availableBalance: number;
    frozenAmount: number;
  }> {
    const account = await query(
      `SELECT balance, available_balance, frozen_amount FROM accounts WHERE user_id = $1`,
      [userId]
    );

    if (!account.rows[0]) {
      throw new Error('账户不存在');
    }

    const accountData = account.rows[0];

    return {
      sufficient: accountData.available_balance >= amount,
      currentBalance: accountData.balance,
      availableBalance: accountData.available_balance,
      frozenAmount: accountData.frozen_amount || 0,
    };
  }

  /**
   * 获取账户信息
   */
  async getAccountInfo(userId: number): Promise<any> {
    const account = await query(
      `SELECT * FROM accounts WHERE user_id = $1`,
      [userId]
    );

    if (!account.rows[0]) {
      throw new Error('账户不存在');
    }

    return account.rows[0];
  }

  /**
   * 验证余额一致性
   */
  async verifyBalanceConsistency(userId: number): Promise<{
    consistent: boolean;
    dbBalance: number;
    calculatedBalance: number;
    difference: number;
  }> {
    const account = await query(
      `SELECT balance, realized_pl, frozen_amount FROM accounts WHERE user_id = $1`,
      [userId]
    );

    if (!account.rows[0]) {
      throw new Error('账户不存在');
    }

    const dbBalance = account.rows[0].balance;
    const realizedPl = account.rows[0].realized_pl || 0;
    const frozenAmount = account.rows[0].frozen_amount || 0;

    const transactions = await query(
      `SELECT SUM(amount) as total_amount FROM audit_logs WHERE user_id = $1`,
      [userId]
    );

    const calculatedBalance = (transactions.rows[0].total_amount || 0) + realizedPl;
    const difference = Math.abs(dbBalance - calculatedBalance);

    return {
      consistent: difference < 0.01,
      dbBalance,
      calculatedBalance,
      difference,
    };
  }

  /**
   * 生成事务ID
   */
  private generateTransactionId(): string {
    return `TXN${Date.now()}${Math.random().toString(36).substring(2, 9)}`;
  }
}

export const accountService = new AccountService();
