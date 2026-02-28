import { Queue, Worker, Job } from 'bullmq';
import { QueueConfig, QUEUE_NAMES } from '../config/queue.config';
import logger from '../utils/logger';
import { riskEngine, RiskCheckRequest } from '../services/RiskEngine';

// ============================================
// 强平调度器
// ============================================

export interface LiquidationJobData {
  userId: number;
  positionId: number;
  productCode: string;
  liquidationPrice: number;
  reason: string;
}

export class LiquidationScheduler {
  private liquidationQueue: Queue;
  private liquidationWorker: Worker;
  private isRunning: boolean = false;

  constructor() {
    this.liquidationQueue = new Queue(QUEUE_NAMES.ORDERS + ':liquidation', {
      connection: QueueConfig.connection,
    });

    this.initializeWorker();
  }

  private async initializeWorker() {
    this.liquidationWorker = new Worker(
      QUEUE_NAMES.ORDERS + ':liquidation',
      this.processLiquidation.bind(this),
      {
        connection: QueueConfig.connection,
        concurrency: 5,
      }
    );

    this.liquidationWorker.on('completed', (job: Job) => {
      logger.info(`[LiquidationScheduler] 强平任务完成: ${job.id}`);
    });

    this.liquidationWorker.on('failed', (job: Job | undefined, error: Error) => {
      logger.error(`[LiquidationScheduler] 强平任务失败: ${job?.id}`, error);
    });
  }

  /**
   * 处理强平任务
   */
  private async processLiquidation(job: Job<LiquidationJobData>): Promise<void> {
    const { userId, positionId, productCode, liquidationPrice, reason } = job.data;

    logger.info(
      `[LiquidationScheduler] 开始处理强平: userId=${userId}, positionId=${positionId}`
    );

    try {
      const validateResult = await riskEngine.validate({
        userId,
        productCode,
        operation: 'LIQUIDATE',
      });

      if (!validateResult.passed) {
        logger.warn(
          `[LiquidationScheduler] 强平风控检查未通过: userId=${userId}, positionId=${positionId}`
        );
        return;
      }

      await this.executeLiquidation(userId, positionId, liquidationPrice, reason);

      logger.info(
        `[LiquidationScheduler] 强平执行成功: userId=${userId}, positionId=${positionId}`
      );
    } catch (error) {
      logger.error(
        `[LiquidationScheduler] 强平执行失败: userId=${userId}, positionId=${positionId}`,
        error
      );
      throw error;
    }
  }

  /**
   * 执行强平
   */
  private async executeLiquidation(
    userId: number,
    positionId: number,
    liquidationPrice: number,
    reason: string
  ): Promise<void> {
    const { transaction } = await import('../config/database');

    await transaction(async (client) => {
      const positionResult = await client.query(
        `SELECT * FROM positions WHERE id = $1 FOR UPDATE`,
        [positionId]
      );

      if (!positionResult.rows[0]) {
        throw new Error('持仓不存在');
      }

      const position = positionResult.rows[0];

      if (position.status !== 1) {
        throw new Error('持仓已关闭');
      }

      const unrealizedPnl = this.calculateUnrealizedPnl(
        position,
        liquidationPrice
      );

      await client.query(
        `UPDATE positions
         SET status = 2,
             current_price = $1,
             unrealized_pl = $2,
             realized_pl = $3,
             closed_at = CURRENT_TIMESTAMP
         WHERE id = $4`,
        [liquidationPrice, unrealizedPnl, unrealizedPnl, positionId]
      );

      await client.query(
        `UPDATE accounts
         SET balance = balance + $1,
             available_balance = available_balance + $1 + $2,
             frozen_amount = frozen_amount - $2
         WHERE user_id = $3`,
        [unrealizedPnl, position.margin, userId]
      );

      const { auditLogService } = await import('./AuditLogService');

      await auditLogService.createAuditLog(client, {
        userId,
        operation: 'LIQUIDATION',
        amount: unrealizedPnl,
        beforeBalance: 0,
        afterBalance: unrealizedPnl,
        positionId,
        description: reason,
        createdBy: 'SYSTEM',
      });
    });
  }

  /**
   * 计算未实现盈亏
   */
  private calculateUnrealizedPnl(position: any, currentPrice: number): number {
    const priceDiff = currentPrice - position.entry_price;

    if (position.direction === 1) {
      return priceDiff * position.lot_size * position.leverage;
    } else {
      return -priceDiff * position.lot_size * position.leverage;
    }
  }

  /**
   * 添加强平任务
   */
  async addLiquidationJob(data: LiquidationJobData): Promise<string> {
    const job = await this.liquidationQueue.add('liquidation', data, {
      attempts: 3,
      backoff: {
        type: 'exponential',
        delay: 1000,
      },
    });

    logger.info(
      `[LiquidationScheduler] 强平任务已添加: userId=${data.userId}, positionId=${data.positionId}`
    );

    return job.id!;
  }

  /**
   * 批量检查并添加强平任务
   */
  async checkAndQueueLiquidations(): Promise<number> {
    const { query } = await import('../config/database');

    const positions = await query(`
      SELECT p.*, u.id as user_id, u.balance
      FROM positions p
      JOIN accounts u ON p.user_id = u.id
      WHERE p.status = 1
    `);

    let queuedCount = 0;

    for (const position of positions.rows) {
      const marketData = await this.getMarketData(position.product_code);

      if (!marketData) {
        continue;
      }

      const shouldLiquidate = this.shouldLiquidate(
        position,
        marketData.last_price
      );

      if (shouldLiquidate) {
        await this.addLiquidationJob({
          userId: position.user_id,
          positionId: position.id,
          productCode: position.product_code,
          liquidationPrice: marketData.last_price,
          reason: '强平触发',
        });

        queuedCount++;
      }
    }

    logger.info(
      `[LiquidationScheduler] 检查完成,已排队 ${queuedCount} 个强平任务`
    );

    return queuedCount;
  }

  /**
   * 判断是否需要强平
   */
  private shouldLiquidate(position: any, currentPrice: number): boolean {
    if (!position.liquidation_price) {
      return false;
    }

    if (position.direction === 1) {
      return currentPrice <= position.liquidation_price;
    } else {
      return currentPrice >= position.liquidation_price;
    }
  }

  /**
   * 获取市场数据
   */
  private async getMarketData(productCode: string): Promise<any> {
    const { query } = await import('../config/database');

    const result = await query(
      `SELECT * FROM market_quotes
       WHERE product_id = (SELECT id FROM products WHERE symbol = $1)
       ORDER BY timestamp DESC LIMIT 1`,
      [productCode]
    );

    return result.rows[0];
  }

  /**
   * 启动调度器
   */
  async start(intervalMs: number = 5000): Promise<void> {
    if (this.isRunning) {
      logger.warn('[LiquidationScheduler] 调度器已在运行');
      return;
    }

    this.isRunning = true;

    logger.info(`[LiquidationScheduler] 调度器已启动, 检查间隔: ${intervalMs}ms`);

    this.checkLoop(intervalMs);
  }

  /**
   * 检查循环
   */
  private async checkLoop(intervalMs: number): Promise<void> {
    while (this.isRunning) {
      try {
        await this.checkAndQueueLiquidations();
      } catch (error) {
        logger.error('[LiquidationScheduler] 检查循环异常:', error);
      }

      await new Promise(resolve => setTimeout(resolve, intervalMs));
    }
  }

  /**
   * 停止调度器
   */
  async stop(): Promise<void> {
    this.isRunning = false;

    await this.liquidationWorker.close();
    await this.liquidationQueue.close();

    logger.info('[LiquidationScheduler] 调度器已停止');
  }

  /**
   * 获取队列统计
   */
  async getQueueStats(): Promise<{
    waiting: number;
    active: number;
    completed: number;
    failed: number;
  }> {
    const [waiting, active, completed, failed] = await Promise.all([
      this.liquidationQueue.getWaitingCount(),
      this.liquidationQueue.getActiveCount(),
      this.liquidationQueue.getCompletedCount(),
      this.liquidationQueue.getFailedCount(),
    ]);

    return {
      waiting,
      active,
      completed,
      failed,
    };
  }
}

export const liquidationScheduler = new LiquidationScheduler();
