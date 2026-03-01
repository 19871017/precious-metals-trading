import { Worker, Job, JobsOptions } from 'bullmq';
import { QueueConfig } from '../config/queue.config';
import logger from '../utils/logger';
import os from 'os';

// ============================================
// Risk Engine Worker Pool 配置
// ============================================

export interface RiskWorkerPoolConfig {
  workerCount: number; // Worker 数量
  concurrency: number; // 每个 Worker 的并发数
  queueName: string; // 队列名称
  maxRetries: number; // 最大重试次数
  retryDelay: number; // 重试延迟 (ms)
}

export const DEFAULT_RISK_WORKER_POOL_CONFIG: RiskWorkerPoolConfig = {
  workerCount: Math.ceil(os.cpus().length / 2), // CPU核心数 / 2
  concurrency: 5, // 每个 Worker 并发处理 5 个任务
  queueName: 'risk-engine:queue',
  maxRetries: 3,
  retryDelay: 1000,
};

// ============================================
// 风险检查任务数据
// ============================================

export interface RiskCheckJobData {
  userId: string;
  productCode: string;
  operation: 'OPEN' | 'ADD' | 'CLOSE' | 'LIQUIDATE';
  quantity?: number;
  leverage?: number;
  price?: number;
  direction?: 'LONG' | 'SHORT';
  priority?: number; // 任务优先级 (0-10, 0 最高)
}

export interface RiskCheckResult {
  success: boolean;
  passed: boolean;
  riskLevel: 'SAFE' | 'WARNING' | 'DANGER' | 'CRITICAL';
  message: string;
  errorCode?: string;
  data?: any;
}

// ============================================
// 风险检查处理器
// ============================================

export interface RiskCheckProcessor {
  (job: Job<RiskCheckJobData>): Promise<RiskCheckResult>;
}

// ============================================
// Risk Engine Worker Pool
// ============================================

export class RiskEngineWorkerPool {
  private workers: Worker[] = [];
  private config: RiskWorkerPoolConfig;
  private processor: RiskCheckProcessor | null = null;
  private isRunning = false;

  constructor(config?: Partial<RiskWorkerPoolConfig>) {
    this.config = {
      ...DEFAULT_RISK_WORKER_POOL_CONFIG,
      ...config,
    };
  }

  /**
   * 启动 Worker Pool
   */
  async start(processor: RiskCheckProcessor): Promise<void> {
    if (this.isRunning) {
      logger.warn('[RiskWorkerPool] Worker Pool 已经在运行中');
      return;
    }

    this.processor = processor;

    try {
      logger.info('[RiskWorkerPool] 启动 Risk Engine Worker Pool', {
        workerCount: this.config.workerCount,
        concurrency: this.config.concurrency,
        queueName: this.config.queueName,
      });

      for (let i = 0; i < this.config.workerCount; i++) {
        await this.createWorker(i);
      }

      this.isRunning = true;

      logger.info('[RiskWorkerPool] Risk Engine Worker Pool 启动完成', {
        totalWorkers: this.workers.length,
      });
    } catch (error) {
      logger.error('[RiskWorkerPool] 启动 Worker Pool 失败', error);
      throw error;
    }
  }

  /**
   * 创建单个 Worker
   */
  private async createWorker(index: number): Promise<void> {
    try {
      const worker = new Worker<RiskCheckJobData, RiskCheckResult>(
        this.config.queueName,
        async (job: Job<RiskCheckJobData>) => {
          if (!this.processor) {
            throw new Error('Risk check processor not set');
          }

          logger.debug(`[RiskWorkerPool] Worker ${index} 处理任务`, {
            jobId: job.id,
            userId: job.data.userId,
            operation: job.data.operation,
          });

          try {
            const result = await this.processor!(job);
            
            logger.debug(`[RiskWorkerPool] Worker ${index} 任务完成`, {
              jobId: job.id,
              success: result.success,
              passed: result.passed,
            });

            return result;
          } catch (error) {
            logger.error(`[RiskWorkerPool] Worker ${index} 任务处理失败`, {
              jobId: job.id,
              error: error instanceof Error ? error.message : 'Unknown error',
            });
            throw error;
          }
        },
        {
          connection: QueueConfig.connection,
          concurrency: this.config.concurrency,
        }
      );

      worker.on('completed', (job: Job<RiskCheckJobData>, result: RiskCheckResult) => {
        logger.debug(`[RiskWorkerPool] Worker ${index} 任务完成`, {
          jobId: job.id,
          passed: result.passed,
          riskLevel: result.riskLevel,
        });
      });

      worker.on('failed', (job: Job<RiskCheckJobData> | undefined, error: Error) => {
        logger.error(`[RiskWorkerPool] Worker ${index} 任务失败`, {
          jobId: job?.id,
          error: error.message,
        });
      });

      worker.on('error', (error: Error) => {
        logger.error(`[RiskWorkerPool] Worker ${index} 发生错误`, {
          error: error.message,
        });
      });

      this.workers.push(worker);

      logger.debug(`[RiskWorkerPool] Worker ${index} 创建成功`, {
        concurrency: this.config.concurrency,
      });
    } catch (error) {
      logger.error(`[RiskWorkerPool] 创建 Worker ${index} 失败`, error);
      throw error;
    }
  }

  /**
   * 停止 Worker Pool
   */
  async stop(): Promise<void> {
    if (!this.isRunning) {
      logger.warn('[RiskWorkerPool] Worker Pool 未运行');
      return;
    }

    try {
      logger.info('[RiskWorkerPool] 停止 Risk Engine Worker Pool', {
        workerCount: this.workers.length,
      });

      for (let i = 0; i < this.workers.length; i++) {
        const worker = this.workers[i];
        
        logger.debug(`[RiskWorkerPool] 停止 Worker ${i}`);
        await worker.close();
      }

      this.workers = [];
      this.isRunning = false;

      logger.info('[RiskWorkerPool] Risk Engine Worker Pool 已停止');
    } catch (error) {
      logger.error('[RiskWorkerPool] 停止 Worker Pool 失败', error);
      throw error;
    }
  }

  /**
   * 获取 Worker Pool 状态
   */
  getStatus(): {
    isRunning: boolean;
    workerCount: number;
    config: RiskWorkerPoolConfig;
  } {
    return {
      isRunning: this.isRunning,
      workerCount: this.workers.length,
      config: { ...this.config },
    };
  }

  /**
   * 更新配置
   */
  updateConfig(config: Partial<RiskWorkerPoolConfig>): void {
    this.config = {
      ...this.config,
      ...config,
    };

    logger.info('[RiskWorkerPool] 配置已更新', {
      newConfig: this.config,
    });

    if (this.isRunning) {
      logger.warn('[RiskWorkerPool] 配置更新需要重启 Worker Pool 才能生效');
    }
  }

  /**
   * 重启 Worker Pool
   */
  async restart(processor?: RiskCheckProcessor): Promise<void> {
    if (this.isRunning) {
      await this.stop();
    }

    if (processor) {
      await this.start(processor);
    } else if (this.processor) {
      await this.start(this.processor);
    }
  }
}

// ============================================
// 创建默认的 Risk Engine Worker Pool 实例
// ============================================

export const riskEngineWorkerPool = new RiskEngineWorkerPool();
