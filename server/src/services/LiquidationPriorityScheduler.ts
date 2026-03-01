import { Queue, Worker, Job } from 'bullmq';
import { QueueConfig } from '../config/queue.config';
import logger from '../utils/logger';
import { query, transaction } from '../config/database';
import redis from '../utils/redis';
import { acquirePositionLock, releaseLock } from '../utils/distributed-lock';
import { auditLogService } from './AuditLogService';

// ============================================
// 强平快速通道 - 优先级队列
// ============================================

export interface PriorityLiquidationJobData {
  userId: number;
  positionId: number;
  productCode: string;
  liquidationPrice: number;
  reason: string;
  marginUsage: number; // 保证金使用率
  priority: number; // 优先级（保证金率越低，优先级越高）
  force?: boolean;
}

export interface RiskAccountPriority {
  userId: number;
  marginUsage: number;
  equity: number;
  frozenMargin: number;
  riskLevel: 'CRITICAL' | 'DANGER';
  positions: PriorityPosition[];
}

export interface PriorityPosition {
  positionId: number;
  productCode: string;
  liquidationPrice: number;
  margin: number;
  shouldLiquidate: boolean;
}

// ============================================
// 强平快速通道调度器
// ============================================

export class LiquidationPriorityScheduler {
  private priorityQueue: Queue;
  private priorityWorker: Worker;
  private isRunning: boolean = false;
  private scanInterval: number = 500;
  private scanTimer?: NodeJS.Timeout;

  constructor(scanInterval: number = 500) {
    this.scanInterval = scanInterval;

    // 创建优先级队列
    this.priorityQueue = new Queue('liquidation:priority', {
      connection: QueueConfig.connection,
      defaultJobOptions: {
        attempts: 3,
        backoff: {
          type: 'exponential',
          delay: 500,
        },
        removeOnComplete: 1000,
        removeOnFail: 500,
      },
    });

    this.initializeWorker();
  }

  private async initializeWorker() {
    this.priorityWorker = new Worker(
      'liquidation:priority',
      this.processPriorityLiquidation.bind(this),
      {
        connection: QueueConfig.connection,
        concurrency: 10, // 高并发处理
        limiter: {
          max: 100, // 更高的限流
          duration: 1000,
        },
      }
    );

    this.priorityWorker.on('completed', (job: Job) => {
      logger.info(
        `[PriorityScheduler] 优先级强平任务完成: job=${job.id}, positionId=${job.data.positionId}, priority=${job.data.priority}`
      );
    });

    this.priorityWorker.on('failed', (job: Job | undefined, error: Error) => {
      logger.error(
        `[PriorityScheduler] 优先级强平任务失败: job=${job?.id}, positionId=${job.data?.positionId}`,
        error
      );
    });

    logger.info('[PriorityScheduler] 优先级强平 Worker 初始化完成');
  }

  /**
   * 启动优先级强平调度器
   */
  async start(): Promise<void> {
    if (this.isRunning) {
      logger.warn('[PriorityScheduler] 优先级强平调度器已在运行');
      return;
    }

    try {
      logger.info('[PriorityScheduler] 启动优先级强平调度器');

      this.scanTimer = setInterval(async () => {
        await this.scanLoop();
      }, this.scanInterval);

      this.isRunning = true;

      logger.info('[PriorityScheduler] 优先级强平调度器启动成功');
    } catch (error) {
      logger.error('[PriorityScheduler] 启动优先级强平调度器失败', error);
      throw error;
    }
  }

  /**
   * 停止优先级强平调度器
   */
  async stop(): Promise<void> {
    if (!this.isRunning) {
      logger.warn('[PriorityScheduler] 优先级强平调度器未运行');
      return;
    }

    try {
      logger.info('[PriorityScheduler] 停止优先级强平调度器');

      if (this.scanTimer) {
        clearInterval(this.scanTimer);
        this.scanTimer = undefined;
      }

      await this.priorityWorker.close();
      await this.priorityQueue.close();

      this.isRunning = false;

      logger.info('[PriorityScheduler] 优先级强平调度器已停止');
    } catch (error) {
      logger.error('[PriorityScheduler] 停止优先级强平调度器失败', error);
      throw error;
    }
  }

  /**
   * 扫描循环
   */
  private async scanLoop(): Promise<void> {
    try {
      // 扫描风险账户
      const riskAccounts = await this.scanRiskAccounts();

      // 按保证金率排序（最低优先）
      const sortedAccounts = this.sortAccountsByMarginUsage(riskAccounts);

      // 将需要强平的仓位加入优先级队列
      await this.queuePriorityLiquidations(sortedAccounts);

      logger.debug(
        `[PriorityScheduler] 扫描完成: CRITICAL=${sortedAccounts.filter(a => a.riskLevel === 'CRITICAL').length}, DANGER=${sortedAccounts.filter(a => a.riskLevel === 'DANGER').length}`
      );
    } catch (error) {
      logger.error('[PriorityScheduler] 扫描循环失败', error);
    }
  }

  /**
   * 扫描风险账户
   */
  private async scanRiskAccounts(): Promise<RiskAccountPriority[]> {
    logger.debug('[PriorityScheduler] 开始扫描风险账户...');

    const accounts = await query(`
      SELECT a.id as user_id,
             a.balance,
             a.available_balance,
             a.frozen_amount,
             a.realized_pl
      FROM accounts a
      WHERE a.balance > 0 AND a.frozen_amount > 0
    `);

    const riskAccounts: RiskAccountPriority[] = [];

    for (const account of accounts.rows) {
      const userId = account.user_id;

      const positions = await query(`
        SELECT p.id as position_id,
               p.product_code,
               p.user_id,
               p.margin,
               p.liquidation_price
        FROM positions p
        JOIN products pr ON p.product_id = pr.id
        WHERE p.user_id = $1 AND p.status = 1
        ORDER BY p.margin DESC
      `, [userId]);

      if (positions.rows.length === 0) {
        continue;
      }

      let totalUnrealizedPnl = 0;
      const priorityPositions: PriorityPosition[] = [];

      for (const position of positions.rows) {
        // 获取当前价格
        const marketData = await this.getMarketData(position.product_code);

        if (!marketData) {
          logger.warn(
            `[PriorityScheduler] 未获取到市场数据: product=${position.product_code}`
          );
          continue;
        }

        const currentPrice = marketData.last_price;

        // 计算未实现盈亏
        const position = await query(`
          SELECT * FROM positions WHERE id = $1
        `, [position.position_id]);

        const pos = position.rows[0];
        const unrealizedPnl = this.calculateUnrealizedPnl(pos, currentPrice);
        totalUnrealizedPnl += unrealizedPnl;

        const shouldLiquidate = this.shouldLiquidate(pos, currentPrice);

        priorityPositions.push({
          positionId: position.position_id,
          productCode: position.product_code,
          liquidationPrice: currentPrice,
          margin: position.margin,
          shouldLiquidate,
        });
      }

      const equity = account.balance + totalUnrealizedPnl;
      const marginUsage = equity > 0 ? account.frozen_amount / equity : 1;

      let riskLevel: 'CRITICAL' | 'DANGER';

      if (equity <= 0 || marginUsage >= 1) {
        riskLevel = 'CRITICAL';
      } else if (marginUsage >= 0.8) {
        riskLevel = 'DANGER';
      } else {
        continue; // 跳过安全账户
      }

      riskAccounts.push({
        userId,
        marginUsage,
        equity,
        frozenMargin: account.frozen_amount,
        riskLevel,
        positions: priorityPositions,
      });
    }

    logger.debug(
      `[PriorityScheduler] 扫描完成, 发现 ${riskAccounts.length} 个风险账户`
    );

    return riskAccounts;
  }

  /**
   * 按保证金率排序（最低优先）
   */
  private sortAccountsByMarginUsage(
    accounts: RiskAccountPriority[]
  ): RiskAccountPriority[] {
    // 按保证金率降序排序（保证金率越低，优先级越高）
    return accounts.sort((a, b) => b.marginUsage - a.marginUsage);
  }

  /**
   * 将需要强平的仓位加入优先级队列
   */
  private async queuePriorityLiquidations(
    accounts: RiskAccountPriority[]
  ): Promise<number> {
    let queuedCount = 0;

    for (const account of accounts) {
      if (account.riskLevel !== 'CRITICAL' && account.riskLevel !== 'DANGER') {
        continue;
      }

      // 计算优先级：保证金率越低，优先级越高（数值越小）
      // CRITICAL 账户优先级 0-50
      // DANGER 账户优先级 51-100
      let basePriority: number;

      if (account.riskLevel === 'CRITICAL') {
        // CRITICAL: 0-50 (保证金率越低，优先级越高)
        basePriority = Math.floor(account.marginUsage * 50);
      } else {
        // DANGER: 51-100
        basePriority = 51 + Math.floor(account.marginUsage * 49);
      }

      for (const position of account.positions) {
        if (!position.shouldLiquidate) {
          continue;
        }

        // 禁止 FIFO：将所有需要强平的仓位同时加入队列
        await this.addPriorityLiquidationJob({
          userId: account.userId,
          positionId: position.positionId,
          productCode: position.productCode,
          liquidationPrice: position.liquidationPrice,
          reason: account.riskLevel === 'CRITICAL' 
            ? '保证金率过低触发强平（快速通道）' 
            : '保证金率过高触发强平（快速通道）',
          marginUsage: account.marginUsage,
          priority: basePriority, // 使用优先级
        });

        queuedCount++;

        logger.info(
          `[PriorityScheduler] 优先级强平任务已加入队列: userId=${account.userId}, positionId=${position.positionId}, marginUsage=${account.marginUsage.toFixed(2)}, priority=${basePriority}`
        );
      }
    }

    logger.info(`[PriorityScheduler] 已加入 ${queuedCount} 个优先级强平任务到队列`);

    return queuedCount;
  }

  /**
   * 添加优先级强平任务到队列
   */
  async addPriorityLiquidationJob(
    data: PriorityLiquidationJobData
  ): Promise<string> {
    const job = await this.priorityQueue.add('priority-liquidation', data, {
      priority: data.priority, // 设置优先级
      jobId: `priority_${data.userId}_${data.positionId}_${Date.now()}`, // 唯一 jobId
    });

    logger.debug(
      `[PriorityScheduler] 优先级强平任务已添加: jobId=${job.id}, positionId=${data.positionId}, priority=${data.priority}`
    );

    return job.id!;
  }

  /**
   * 处理优先级强平任务
   */
  private async processPriorityLiquidation(
    job: Job<PriorityLiquidationJobData>
  ): Promise<void> {
    const {
      userId,
      positionId,
      productCode,
      liquidationPrice,
      reason,
      marginUsage,
      priority,
      force,
    } = job.data;

    logger.info(
      `[PriorityScheduler] 开始处理优先级强平: userId=${userId}, positionId=${positionId}, marginUsage=${marginUsage.toFixed(2)}, priority=${priority}`
    );

    const startTime = Date.now();

    try {
      const lock = await acquirePositionLock(positionId, userId);

      if (!lock) {
        logger.warn(
          `[PriorityScheduler] 获取持仓锁失败,跳过: positionId=${positionId}`
        );
        return;
      }

      try {
        await this.executePriorityLiquidationInternal(
          userId,
          positionId,
          liquidationPrice,
          reason
        );

        const processingTime = Date.now() - startTime;

        logger.info(
          `[PriorityScheduler] 优先级强平执行成功: userId=${userId}, positionId=${positionId}, time=${processingTime}ms, priority=${priority}`
        );
      } finally {
        await releaseLock(lock);
      }
    } catch (error) {
      logger.error(
        `[PriorityScheduler] 优先级强平执行失败: userId=${userId}, positionId=${positionId}`,
        error
      );
      throw error;
    }
  }

  /**
   * 执行优先级强平（内部实现）
   */
  private async executePriorityLiquidationInternal(
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
          `[PriorityScheduler] 持仓已关闭,跳过强平: positionId=${positionId}, status=${position.status}`
        );
        return;
      }

      const unrealizedPnl = this.calculateUnrealizedPnl(position, liquidationPrice);

      // 更新持仓状态
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

      // 更新账户余额
      await client.query(
        `UPDATE accounts
         SET balance = balance + $1,
             available_balance = available_balance + $1 + $2,
             frozen_amount = frozen_amount - $2,
             realized_pl = realized_pl + $1
         WHERE user_id = $3`,
        [unrealizedPnl, marginReleased, userId]
      );

      // 记录审计日志
      await auditLogService.log({
        userId,
        action: 'LIQUIDATION',
        entityType: 'POSITION',
        entityId: positionId,
        oldData: JSON.stringify(position),
        newData: JSON.stringify(closedPosition),
        metadata: JSON.stringify({
          reason,
          liquidationPrice,
          unrealizedPnl,
          marginReleased,
          priority: true,
        }),
      });

      logger.info(
        `[PriorityScheduler] 优先级强平完成: userId=${userId}, positionId=${positionId}, unrealizedPnl=${unrealizedPnl.toFixed(2)}, marginReleased=${marginReleased.toFixed(2)}`
      );
    });
  }

  /**
   * 手动触发优先级强平
   */
  async forcePriorityLiquidate(
    userId: number,
    positionId: number,
    productCode: string,
    currentPrice: number,
    reason: string = '手动优先级强平'
  ): Promise<void> {
    logger.info(
      `[PriorityScheduler] 手动触发优先级强平: userId=${userId}, positionId=${positionId}`
    );

    await this.addPriorityLiquidationJob({
      userId,
      positionId,
      productCode,
      liquidationPrice: currentPrice,
      reason,
      marginUsage: 1.0,
      priority: 0, // 最高优先级
      force: true,
    });
  }

  /**
   * 获取优先级队列统计
   */
  async getQueueStats(): Promise<{
    waiting: number;
    active: number;
    completed: number;
    failed: number;
    delayed: number;
  }> {
    const [waiting, active, completed, failed, delayed] = await Promise.all([
      this.priorityQueue.getWaitingCount(),
      this.priorityQueue.getActiveCount(),
      this.priorityQueue.getCompletedCount(),
      this.priorityQueue.getFailedCount(),
      this.priorityQueue.getDelayedCount(),
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
   * 暂停队列
   */
  async pauseQueue(): Promise<void> {
    await this.priorityQueue.pause();
    logger.info('[PriorityScheduler] 优先级队列已暂停');
  }

  /**
   * 恢复队列
   */
  async resumeQueue(): Promise<void> {
    await this.priorityQueue.resume();
    logger.info('[PriorityScheduler] 优先级队列已恢复');
  }

  /**
   * 清空队列
   */
  async drainQueue(): Promise<void> {
    await this.priorityQueue.drain();
    logger.info('[PriorityScheduler] 优先级队列已清空');
  }

  /**
   * 获取市场数据
   */
  private async getMarketData(productCode: string): Promise<any> {
    try {
      const data = await redis.get(`market:${productCode}`);
      return data ? JSON.parse(data) : null;
    } catch (error) {
      logger.error(`[PriorityScheduler] 获取市场数据失败: ${productCode}`, error);
      return null;
    }
  }

  /**
   * 计算未实现盈亏
   */
  private calculateUnrealizedPnl(position: any, currentPrice: number): number {
    const direction = position.direction; // 1: LONG, 2: SHORT
    const entryPrice = position.entry_price;
    const lotSize = position.lot_size;

    if (direction === 1) {
      return (currentPrice - entryPrice) * lotSize;
    } else {
      return (entryPrice - currentPrice) * lotSize;
    }
  }

  /**
   * 判断是否需要强平
   */
  private shouldLiquidate(position: any, currentPrice: number): boolean {
    if (!position.liquidation_price) {
      return false;
    }

    const direction = position.direction; // 1: LONG, 2: SHORT

    if (direction === 1) {
      // 多头：当前价格 <= 强平价格
      return currentPrice <= position.liquidation_price;
    } else {
      // 空头：当前价格 >= 强平价格
      return currentPrice >= position.liquidation_price;
    }
  }
}

// ============================================
// 创建默认实例
// ============================================

export const liquidationPriorityScheduler = new LiquidationPriorityScheduler();
