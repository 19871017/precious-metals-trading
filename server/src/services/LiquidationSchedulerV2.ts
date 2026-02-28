import { Queue, Worker, Job } from 'bullmq';
import { QueueConfig, QUEUE_NAMES, LOCK_TIMEOUT } from '../config/queue.config';
import logger from '../utils/logger';
import { query, transaction } from '../config/database';
import redis from '../utils/redis';
import { acquirePositionLock, releaseLock } from '../utils/distributed-lock';
import { auditLogService } from './AuditLogService';

// ============================================
// 自动强平调度系统
// ============================================

export interface LiquidationJobData {
  userId: number;
  positionId: number;
  productCode: string;
  liquidationPrice: number;
  reason: string;
  force?: boolean;
}

export interface RiskAccount {
  userId: number;
  equity: number;
  frozenMargin: number;
  marginUsage: number;
  riskLevel: 'SAFE' | 'WARNING' | 'DANGER' | 'CRITICAL';
  positions: RiskPosition[];
}

export interface RiskPosition {
  positionId: number;
  productCode: string;
  userId: number;
  direction: number;
  lotSize: number;
  entryPrice: number;
  currentPrice: number;
  margin: number;
  liquidationPrice: number;
  unrealizedPnl: number;
  shouldLiquidate: boolean;
}

export class LiquidationScheduler {
  private liquidationQueue: Queue;
  private liquidationWorker: Worker;
  private isRunning: boolean = false;
  private scanInterval: number = 500;
  private scanTimer?: NodeJS.Timeout;

  constructor(scanInterval: number = 500) {
    this.scanInterval = scanInterval;
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
        concurrency: 10,
        limiter: {
          max: 50,
          duration: 1000,
        },
      }
    );

    this.liquidationWorker.on('completed', (job: Job) => {
      logger.info(`[LiquidationScheduler] 强平任务完成: job=${job.id}, positionId=${job.data.positionId}`);
    });

    this.liquidationWorker.on('failed', (job: Job | undefined, error: Error) => {
      logger.error(`[LiquidationScheduler] 强平任务失败: job=${job?.id}, positionId=${job.data?.positionId}`, error);
    });

    logger.info('[LiquidationScheduler] 强平 Worker 初始化完成');
  }

  /**
   * 扫描所有持仓账户的保证金率
   */
  private async scanAccountsMargin(): Promise<RiskAccount[]> {
    logger.debug('[LiquidationScheduler] 开始扫描账户保证金率...');

    const accounts = await query(`
      SELECT a.id as user_id,
             a.balance,
             a.available_balance,
             a.frozen_amount,
             a.realized_pl
      FROM accounts a
      WHERE a.balance > 0
    `);

    const riskAccounts: RiskAccount[] = [];

    for (const account of accounts.rows) {
      const userId = account.user_id;

      const positions = await query(`
        SELECT p.id as position_id,
               p.product_code,
               p.user_id,
               p.direction,
               p.lot_size,
               p.entry_price,
               p.margin,
               p.liquidation_price,
               pr.symbol as product_symbol
        FROM positions p
        JOIN products pr ON p.product_id = pr.id
        WHERE p.user_id = $1 AND p.status = 1
        ORDER BY p.created_at DESC
      `, [userId]);

      if (positions.rows.length === 0) {
        continue;
      }

      let totalUnrealizedPnl = 0;

      const riskPositions: RiskPosition[] = [];

      for (const position of positions.rows) {
        const marketData = await this.getMarketData(position.product_symbol);

        if (!marketData) {
          logger.warn(
            `[LiquidationScheduler] 未获取到市场数据: product=${position.product_symbol}`
          );
          continue;
        }

        const currentPrice = marketData.last_price;
        const unrealizedPnl = this.calculateUnrealizedPnl(position, currentPrice);

        totalUnrealizedPnl += unrealizedPnl;

        const shouldLiquidate = this.shouldLiquidate(position, currentPrice);

        riskPositions.push({
          positionId: position.position_id,
          productCode: position.product_symbol,
          userId: position.user_id,
          direction: position.direction,
          lotSize: position.lot_size,
          entryPrice: position.entry_price,
          currentPrice,
          margin: position.margin,
          liquidationPrice: position.liquidation_price,
          unrealizedPnl,
          shouldLiquidate,
        });
      }

      const equity = account.balance + totalUnrealizedPnl;
      const marginUsage = equity > 0 ? account.frozen_amount / equity : 1;

      let riskLevel: 'SAFE' | 'WARNING' | 'DANGER' | 'CRITICAL';

      if (equity <= 0 || marginUsage >= 1) {
        riskLevel = 'CRITICAL';
      } else if (marginUsage >= 0.8) {
        riskLevel = 'DANGER';
      } else if (marginUsage >= 0.5) {
        riskLevel = 'WARNING';
      } else {
        riskLevel = 'SAFE';
      }

      riskAccounts.push({
        userId,
        equity,
        frozenMargin: account.frozen_amount,
        marginUsage,
        riskLevel,
        positions: riskPositions,
      });
    }

    logger.debug(
      `[LiquidationScheduler] 扫描完成, 发现 ${riskAccounts.length} 个账户`
    );

    return riskAccounts;
  }

  /**
   * 标记风险账户
   */
  private async markRiskAccounts(riskAccounts: RiskAccount[]): Promise<void> {
    const criticalAccounts = riskAccounts.filter(
      (account) => account.riskLevel === 'CRITICAL'
    );

    const dangerAccounts = riskAccounts.filter(
      (account) => account.riskLevel === 'DANGER'
    );

    logger.info(
      `[LiquidationScheduler] 标记风险账户: CRITICAL=${criticalAccounts.length}, DANGER=${dangerAccounts.length}`
    );

    for (const account of criticalAccounts) {
      await redis.set(
        `risk:account:${account.userId}`,
        JSON.stringify({
          riskLevel: 'CRITICAL',
          marginUsage: account.marginUsage,
          equity: account.equity,
          timestamp: Date.now(),
        }),
        'EX',
        60
      );
    }

    for (const account of dangerAccounts) {
      await redis.set(
        `risk:account:${account.userId}`,
        JSON.stringify({
          riskLevel: 'DANGER',
          marginUsage: account.marginUsage,
          equity: account.equity,
          timestamp: Date.now(),
        }),
        'EX',
        60
      );
    }
  }

  /**
   * 进入强平队列
   */
  private async queueLiquidations(riskAccounts: RiskAccount[]): Promise<number> {
    let queuedCount = 0;

    for (const account of riskAccounts) {
      if (account.riskLevel !== 'CRITICAL') {
        continue;
      }

      for (const position of account.positions) {
        if (!position.shouldLiquidate) {
          continue;
        }

        await this.addLiquidationJob({
          userId: account.userId,
          positionId: position.positionId,
          productCode: position.productCode,
          liquidationPrice: position.currentPrice,
          reason: '保证金不足触发强平',
        });

        queuedCount++;

        logger.info(
          `[LiquidationScheduler] 强平任务已加入队列: userId=${account.userId}, positionId=${position.positionId}, price=${position.currentPrice}`
        );
      }
    }

    logger.info(`[LiquidationScheduler] 已加入 ${queuedCount} 个强平任务到队列`);

    return queuedCount;
  }

  /**
   * 添加强平任务到队列
   */
  async addLiquidationJob(data: LiquidationJobData): Promise<string> {
    const job = await this.liquidationQueue.add('liquidation', data, {
      attempts: 3,
      backoff: {
        type: 'exponential',
        delay: 500,
      },
      removeOnComplete: 1000,
      removeOnFail: 500,
    });

    logger.debug(
      `[LiquidationScheduler] 强平任务已添加: jobId=${job.id}, positionId=${data.positionId}`
    );

    return job.id!;
  }

  /**
   * 处理强平任务
   */
  private async processLiquidation(job: Job<LiquidationJobData>): Promise<void> {
    const { userId, positionId, productCode, liquidationPrice, reason, force } = job.data;

    logger.info(
      `[LiquidationScheduler] 开始处理强平: userId=${userId}, positionId=${positionId}, force=${force}`
    );

    const startTime = Date.now();

    try {
      const lock = await acquirePositionLock(positionId, userId);

      if (!lock) {
        logger.warn(
          `[LiquidationScheduler] 获取持仓锁失败,跳过: positionId=${positionId}`
        );
        return;
      }

      try {
        await this.executeLiquidationInternal(
          userId,
          positionId,
          liquidationPrice,
          reason
        );

        const processingTime = Date.now() - startTime;

        logger.info(
          `[LiquidationScheduler] 强平执行成功: userId=${userId}, positionId=${positionId}, time=${processingTime}ms`
        );
      } finally {
        await releaseLock(lock);
      }
    } catch (error) {
      logger.error(
        `[LiquidationScheduler] 强平执行失败: userId=${userId}, positionId=${positionId}`,
        error
      );
      throw error;
    }
  }

  /**
   * 执行强平(内部实现)
   */
  private async executeLiquidationInternal(
    userId: number,
    positionId: number,
    liquidationPrice: number,
    reason: string
  ): Promise<void> {
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
        logger.warn(
          `[LiquidationScheduler] 持仓已关闭,跳过强平: positionId=${positionId}, status=${position.status}`
        );
        return;
      }

      const unrealizedPnl = this.calculateUnrealizedPnl(position, liquidationPrice);

      const updatePositionResult = await client.query(
        `UPDATE positions
         SET status = 2,
             current_price = $1,
             unrealized_pl = $2,
             realized_pl = $3,
             closed_at = CURRENT_TIMESTAMP
         WHERE id = $4
         RETURNING *`,
        [liquidationPrice, unrealizedPnl, unrealizedPnl, positionId]
      );

      const closedPosition = updatePositionResult.rows[0];

      const marginReleased = position.margin;

      await client.query(
        `UPDATE accounts
         SET balance = balance + $1,
             available_balance = available_balance + $1 + $2,
             frozen_amount = frozen_amount - $2,
             realized_pl = realized_pl + $1
         WHERE user_id = $3`,
        [unrealizedPnl, marginReleased, userId]
      );

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

      const logResult = await client.query(
        `INSERT INTO order_processing_logs
         (order_id, state_from, state_to, processing_time, error_message, metadata)
         VALUES ($1, $2, $3, $4, $5, $6)
         RETURNING *`,
        [
          null,
          'OPEN',
          'LIQUIDATED',
          Date.now() - Date.now(),
          null,
          JSON.stringify({
            positionId,
            liquidationPrice,
            unrealizedPnl,
            marginReleased,
            reason,
          }),
        ]
      );

      logger.info(
        `[LiquidationScheduler] 强平日志已记录: logId=${logResult.rows[0].id}`
      );
    });
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
   * 计算未实现盈亏
   */
  private calculateUnrealizedPnl(position: any, currentPrice: number): number {
    const priceDiff = currentPrice - position.entry_price;

    if (position.direction === 1) {
      return priceDiff * position.lot_size * (position.leverage || 1);
    } else {
      return -priceDiff * position.lot_size * (position.leverage || 1);
    }
  }

  /**
   * 获取市场数据
   */
  private async getMarketData(productCode: string): Promise<any> {
    const result = await query(
      `SELECT * FROM market_quotes
       WHERE product_id = (SELECT id FROM products WHERE symbol = $1)
       ORDER BY timestamp DESC LIMIT 1`,
      [productCode]
    );

    return result.rows[0];
  }

  /**
   * 主扫描循环
   */
  private async scanLoop(): Promise<void> {
    while (this.isRunning) {
      const loopStartTime = Date.now();

      try {
        logger.debug('[LiquidationScheduler] 开始扫描循环...');

        const riskAccounts = await this.scanAccountsMargin();

        await this.markRiskAccounts(riskAccounts);

        const queuedCount = await this.queueLiquidations(riskAccounts);

        if (queuedCount > 0) {
          logger.info(`[LiquidationScheduler] 本轮扫描加入 ${queuedCount} 个强平任务`);
        }

        const loopTime = Date.now() - loopStartTime;

        logger.debug(`[LiquidationScheduler] 扫描循环完成,耗时: ${loopTime}ms`);

        const sleepTime = Math.max(0, this.scanInterval - loopTime);

        if (sleepTime > 0) {
          await new Promise(resolve => setTimeout(resolve, sleepTime));
        }
      } catch (error) {
        logger.error('[LiquidationScheduler] 扫描循环异常:', error);

        await new Promise(resolve => setTimeout(resolve, this.scanInterval));
      }
    }
  }

  /**
   * 启动强平调度器
   */
  async start(): Promise<void> {
    if (this.isRunning) {
      logger.warn('[LiquidationScheduler] 调度器已在运行');
      return;
    }

    this.isRunning = true;

    logger.info(
      `[LiquidationScheduler] 强平调度器已启动, 扫描间隔: ${this.scanInterval}ms`
    );

    this.scanLoop();
  }

  /**
   * 停止强平调度器
   */
  async stop(): Promise<void> {
    if (!this.isRunning) {
      logger.warn('[LiquidationScheduler] 调度器未运行');
      return;
    }

    this.isRunning = false;

    if (this.scanTimer) {
      clearTimeout(this.scanTimer);
      this.scanTimer = undefined;
    }

    await this.liquidationWorker.close();
    await this.liquidationQueue.close();

    logger.info('[LiquidationScheduler] 强平调度器已停止');
  }

  /**
   * 获取队列统计
   */
  async getQueueStats(): Promise<{
    waiting: number;
    active: number;
    completed: number;
    failed: number;
    delayed: number;
  }> {
    const [waiting, active, completed, failed, delayed] = await Promise.all([
      this.liquidationQueue.getWaitingCount(),
      this.liquidationQueue.getActiveCount(),
      this.liquidationQueue.getCompletedCount(),
      this.liquidationQueue.getFailedCount(),
      this.liquidationQueue.getDelayedCount(),
    ]);

    return {
      waiting,
      active,
      completed,
      failed,
      delayed,
    };
  }

  /**
   * 获取风险账户统计
   */
  async getRiskAccountStats(): Promise<{
    totalAccounts: number;
    safeAccounts: number;
    warningAccounts: number;
    dangerAccounts: number;
    criticalAccounts: number;
  }> {
    const riskAccounts = await this.scanAccountsMargin();

    return {
      totalAccounts: riskAccounts.length,
      safeAccounts: riskAccounts.filter((a) => a.riskLevel === 'SAFE').length,
      warningAccounts: riskAccounts.filter((a) => a.riskLevel === 'WARNING').length,
      dangerAccounts: riskAccounts.filter((a) => a.riskLevel === 'DANGER').length,
      criticalAccounts: riskAccounts.filter((a) => a.riskLevel === 'CRITICAL').length,
    };
  }

  /**
   * 手动触发强平
   */
  async forceLiquidate(
    userId: number,
    positionId: number,
    productCode: string,
    currentPrice: number,
    reason: string = '手动强平'
  ): Promise<void> {
    logger.info(
      `[LiquidationScheduler] 手动触发强平: userId=${userId}, positionId=${positionId}`
    );

    await this.addLiquidationJob({
      userId,
      positionId,
      productCode,
      liquidationPrice: currentPrice,
      reason,
      force: true,
    });
  }
}

export const liquidationScheduler = new LiquidationScheduler(500);
