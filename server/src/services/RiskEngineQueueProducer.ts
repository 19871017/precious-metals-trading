import { Queue, Job, JobsOptions } from 'bullmq';
import { QueueConfig } from '../config/queue.config';
import logger from '../utils/logger';
import {
  RiskCheckJobData,
  RiskCheckResult,
  RiskEngineWorkerPoolConfig,
} from './RiskEngineWorkerPool';

// ============================================
// Risk Engine Queue Producer
// ============================================

export class RiskEngineQueueProducer {
  private queue: Queue | null = null;
  private config: RiskEngineWorkerPoolConfig;

  constructor(config?: Partial<RiskEngineWorkerPoolConfig>) {
    this.config = {
      queueName: 'risk-engine:queue',
      ...config,
    };
  }

  /**
   * 初始化队列
   */
  async initialize(): Promise<void> {
    if (this.queue) {
      logger.warn('[RiskQueueProducer] 队列已经初始化');
      return;
    }

    try {
      logger.info('[RiskQueueProducer] 初始化 Risk Engine 队列', {
        queueName: this.config.queueName,
      });

      this.queue = new Queue<RiskCheckJobData, RiskCheckResult>(
        this.config.queueName,
        {
          connection: QueueConfig.connection,
          defaultJobOptions: {
            attempts: this.config.maxRetries || 3,
            backoff: {
              type: 'exponential',
              delay: this.config.retryDelay || 1000,
            },
            removeOnComplete: {
              count: 1000,
              age: 3600, // 1小时
            },
            removeOnFail: {
              count: 5000,
              age: 7 * 24 * 3600, // 7天
            },
          },
        }
      );

      await this.queue.waitUntilReady();

      logger.info('[RiskQueueProducer] Risk Engine 队列初始化完成');
    } catch (error) {
      logger.error('[RiskQueueProducer] 队列初始化失败', error);
      throw error;
    }
  }

  /**
   * 提交风险检查任务
   */
  async submitRiskCheck(
    data: RiskCheckJobData,
    options?: JobsOptions
  ): Promise<Job<RiskCheckJobData, RiskCheckResult>> {
    if (!this.queue) {
      throw new Error('Risk Engine 队列未初始化');
    }

    try {
      const jobOptions: JobsOptions = {
        ...options,
        priority: data.priority || 5, // 默认优先级 5
      };

      const job = await this.queue.add('risk-check', data, jobOptions);

      logger.debug('[RiskQueueProducer] 风险检查任务已提交', {
        jobId: job.id,
        userId: data.userId,
        operation: data.operation,
        productCode: data.productCode,
      });

      return job;
    } catch (error) {
      logger.error('[RiskQueueProducer] 提交风险检查任务失败', {
        userId: data.userId,
        operation: data.operation,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw error;
    }
  }

  /**
   * 批量提交风险检查任务
   */
  async submitBatchRiskChecks(
    dataList: RiskCheckJobData[],
    options?: JobsOptions
  ): Promise<Job<RiskCheckJobData, RiskCheckResult>[]> {
    if (!this.queue) {
      throw new Error('Risk Engine 队列未初始化');
    }

    try {
      const jobs = await Promise.all(
        dataList.map((data) => this.submitRiskCheck(data, options))
      );

      logger.info('[RiskQueueProducer] 批量风险检查任务已提交', {
        count: jobs.length,
      });

      return jobs;
    } catch (error) {
      logger.error('[RiskQueueProducer] 批量提交风险检查任务失败', error);
      throw error;
    }
  }

  /**
   * 等待任务完成
   */
  async waitForResult(
    jobId: string,
    timeout?: number
  ): Promise<RiskCheckResult> {
    if (!this.queue) {
      throw new Error('Risk Engine 队列未初始化');
    }

    try {
      const job = await this.queue.getJob(jobId);
      
      if (!job) {
        throw new Error(`任务不存在: ${jobId}`);
      }

      const result = await job.waitUntilFinished(
        this.queue.events,
        timeout
      );

      logger.debug('[RiskQueueProducer] 任务完成', {
        jobId,
        result,
      });

      return result as RiskCheckResult;
    } catch (error) {
      logger.error('[RiskQueueProducer] 等待任务完成失败', {
        jobId,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw error;
    }
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
    if (!this.queue) {
      throw new Error('Risk Engine 队列未初始化');
    }

    const [waiting, active, completed, failed, delayed] = await Promise.all([
      this.queue.getWaitingCount(),
      this.queue.getActiveCount(),
      this.queue.getCompletedCount(),
      this.queue.getFailedCount(),
      this.queue.getDelayedCount(),
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
   * 获取队列名称
   */
  getQueueName(): string {
    return this.config.queueName;
  }

  /**
   * 关闭队列
   */
  async close(): Promise<void> {
    if (!this.queue) {
      logger.warn('[RiskQueueProducer] 队列未初始化');
      return;
    }

    try {
      logger.info('[RiskQueueProducer] 关闭 Risk Engine 队列');
      
      await this.queue.close();
      this.queue = null;

      logger.info('[RiskQueueProducer] Risk Engine 队列已关闭');
    } catch (error) {
      logger.error('[RiskQueueProducer] 关闭队列失败', error);
      throw error;
    }
  }

  /**
   * 清空队列
   */
  async drain(): Promise<void> {
    if (!this.queue) {
      throw new Error('Risk Engine 队列未初始化');
    }

    try {
      logger.info('[RiskQueueProducer] 清空 Risk Engine 队列');
      
      await this.queue.drain();

      logger.info('[RiskQueueProducer] Risk Engine 队列已清空');
    } catch (error) {
      logger.error('[RiskQueueProducer] 清空队列失败', error);
      throw error;
    }
  }

  /**
   * 暂停队列
   */
  async pause(): Promise<void> {
    if (!this.queue) {
      throw new Error('Risk Engine 队列未初始化');
    }

    try {
      logger.info('[RiskQueueProducer] 暂停 Risk Engine 队列');
      
      await this.queue.pause();

      logger.info('[RiskQueueProducer] Risk Engine 队列已暂停');
    } catch (error) {
      logger.error('[RiskQueueProducer] 暂停队列失败', error);
      throw error;
    }
  }

  /**
   * 恢复队列
   */
  async resume(): Promise<void> {
    if (!this.queue) {
      throw new Error('Risk Engine 队列未初始化');
    }

    try {
      logger.info('[RiskQueueProducer] 恢复 Risk Engine 队列');
      
      await this.queue.resume();

      logger.info('[RiskQueueProducer] Risk Engine 队列已恢复');
    } catch (error) {
      logger.error('[RiskQueueProducer] 恢复队列失败', error);
      throw error;
    }
  }
}

// ============================================
// 创建默认的 Risk Engine Queue Producer 实例
// ============================================

export const riskEngineQueueProducer = new RiskEngineQueueProducer();
