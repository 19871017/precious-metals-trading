import { PoolClient, QueryResult } from 'pg';
import { pool } from './database';
import logger from '../utils/logger';

// ============================================
// 数据库事务封装层
// ============================================

export interface TransactionOptions {
  isolationLevel?: 'READ UNCOMMITTED' | 'READ COMMITTED' | 'REPEATABLE READ' | 'SERIALIZABLE';
  timeout?: number;
  retryTimes?: number;
  retryDelay?: number;
}

export interface TransactionResult<T> {
  success: boolean;
  data?: T;
  error?: Error;
  transactionId: string;
  duration: number;
}

export class TransactionManager {
  private static generateTransactionId(): string {
    return `TXN${Date.now()}${Math.random().toString(36).substring(2, 9)}`;
  }

  /**
   * 执行事务(增强版)
   */
  static async executeTransaction<T>(
    callback: (client: PoolClient) => Promise<T>,
    options?: TransactionOptions
  ): Promise<TransactionResult<T>> {
    const {
      isolationLevel = 'READ COMMITTED',
      timeout = 30000,
      retryTimes = 3,
      retryDelay = 100,
    } = options || {};

    const transactionId = this.generateTransactionId();
    const startTime = Date.now();

    logger.debug(
      `[TransactionManager] 事务开始: transactionId=${transactionId}, isolationLevel=${isolationLevel}`
    );

    let attempt = 0;

    while (attempt < retryTimes) {
      attempt++;
      const client = await pool.connect();

      try {
        await client.query(`BEGIN ISOLATION LEVEL ${isolationLevel}`);

        const timeoutTimer = setTimeout(async () => {
          logger.error(
            `[TransactionManager] 事务超时: transactionId=${transactionId}, timeout=${timeout}ms`
          );
          await client.query('ROLLBACK');
        }, timeout);

        const result = await callback(client);

        clearTimeout(timeoutTimer);

        await client.query('COMMIT');

        const duration = Date.now() - startTime;

        logger.debug(
          `[TransactionManager] 事务提交成功: transactionId=${transactionId}, attempt=${attempt}, duration=${duration}ms`
        );

        return {
          success: true,
          data: result,
          transactionId,
          duration,
        };
      } catch (error) {
        await client.query('ROLLBACK');

        logger.error(
          `[TransactionManager] 事务失败: transactionId=${transactionId}, attempt=${attempt}`,
          error
        );

        if (attempt < retryTimes) {
          logger.debug(
            `[TransactionManager] 准备重试: transactionId=${transactionId}, attempt=${attempt + 1}`
          );
          await new Promise(resolve => setTimeout(resolve, retryDelay));
        } else {
          const duration = Date.now() - startTime;

          logger.error(
            `[TransactionManager] 事务最终失败: transactionId=${transactionId}, duration=${duration}ms`
          );

          return {
            success: false,
            error: error as Error,
            transactionId,
            duration,
          };
        }
      } finally {
        client.release();
      }
    }

    const duration = Date.now() - startTime;

    return {
      success: false,
      error: new Error('Unknown error'),
      transactionId,
      duration,
    };
  }

  /**
   * 执行只读事务
   */
  static async executeReadOnlyTransaction<T>(
    callback: (client: PoolClient) => Promise<T>,
    options?: TransactionOptions
  ): Promise<TransactionResult<T>> {
    return await this.executeTransaction(
      callback,
      {
        ...options,
        isolationLevel: 'READ COMMITTED',
      }
    );
  }

  /**
   * 批量执行事务
   */
  static async executeBatchTransactions<T>(
    callbacks: Array<(client: PoolClient) => Promise<T>>,
    options?: TransactionOptions
  ): Promise<TransactionResult<T[]>[]> {
    const results: TransactionResult<T[]>[] = [];

    for (let i = 0; i < callbacks.length; i++) {
      const result = await this.executeTransaction(callbacks[i], options);
      results.push(result);

      if (!result.success) {
        logger.error(
          `[TransactionManager] 批量事务失败: index=${i}/${callbacks.length}`
        );
      }
    }

    return results;
  }

  /**
   * 带回滚的事务
   */
  static async executeWithRollback<T>(
    callback: (client: PoolClient, rollback: () => void) => Promise<T>,
    options?: TransactionOptions
  ): Promise<TransactionResult<T>> {
    return await this.executeTransaction(async (client) => {
      let hasRolledBack = false;

      const rollback = () => {
        if (!hasRolledBack) {
          hasRolledBack = true;
          logger.debug('[TransactionManager] 执行回滚操作');
        }
      };

      return await callback(client, rollback);
    }, options);
  }

  /**
   * 事务包装器(装饰器模式)
   */
  static transaction<T>(
    options?: TransactionOptions
  ) {
    return function (
      target: any,
      propertyKey: string,
      descriptor: PropertyDescriptor
    ) {
      const originalMethod = descriptor.value;

      descriptor.value = async function (...args: any[]) {
        const result = await TransactionManager.executeTransaction(
          (client: PoolClient) => originalMethod.apply(this, [client, ...args]),
          options
        );

        if (!result.success) {
          throw result.error;
        }

        return result.data;
      };

      return descriptor;
    };
  }
}

export const transactionManager = TransactionManager;

/**
 * 便捷的事务执行函数
 */
export async function executeTransaction<T>(
  callback: (client: PoolClient) => Promise<T>,
  options?: TransactionOptions
): Promise<T> {
  const result = await TransactionManager.executeTransaction(callback, options);

  if (!result.success) {
    throw result.error;
  }

  return result.data;
}

/**
 * 便捷的只读事务执行函数
 */
export async function executeReadOnlyTransaction<T>(
  callback: (client: PoolClient) => Promise<T>,
  options?: TransactionOptions
): Promise<T> {
  const result = await TransactionManager.executeReadOnlyTransaction(
    callback,
    options
  );

  if (!result.success) {
    throw result.error;
  }

  return result.data;
}
