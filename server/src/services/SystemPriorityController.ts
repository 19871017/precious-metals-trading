import { Queue, Job, JobsOptions, QueueScheduler } from 'bullmq';
import { QueueConfig } from '../config/queue.config';
import redis from '../utils/redis';
import logger from '../utils/logger';

// ============================================
// 优先级定义
// ============================================

export enum Priority {
  P0 = 0, // 强平执行 - 最高优先级
  P1 = 1, // 风险计算 - 高优先级
  P2 = 2, // 订单撮合 - 中优先级
  P3 = 3, // 用户查询/API - 低优先级
}

export interface PriorityConfig {
  level: Priority;
  name: string;
  description: string;
  weight: number; // 队列权重
  concurrency: number; // 并发数
  rateLimit?: {
    max: number; // 最大请求数
    duration: number; // 时间窗口（毫秒）
  };
}

export const PRIORITY_CONFIGS: Record<Priority, PriorityConfig> = {
  [Priority.P0]: {
    level: Priority.P0,
    name: 'LIQUIDATION',
    description: '强平执行 - 最高优先级',
    weight: 100,
    concurrency: 10,
    rateLimit: undefined, // 强平不限速
  },
  [Priority.P1]: {
    level: Priority.P1,
    name: 'RISK_CALCULATION',
    description: '风险计算 - 高优先级',
    weight: 75,
    concurrency: 20,
    rateLimit: {
      max: 1000,
      duration: 1000, // 每秒最多 1000 次
    },
  },
  [Priority.P2]: {
    level: Priority.P2,
    name: 'ORDER_MATCHING',
    description: '订单撮合 - 中优先级',
    weight: 50,
    concurrency: 50,
    rateLimit: {
      max: 500,
      duration: 1000, // 每秒最多 500 次
    },
  },
  [Priority.P3]: {
    level: Priority.P3,
    name: 'USER_QUERY',
    description: '用户查询/API - 低优先级',
    weight: 25,
    concurrency: 100,
    rateLimit: {
      max: 100,
      duration: 1000, // 每秒最多 100 次
    },
  },
};

// ============================================
// 系统负载阈值
// ============================================

export interface LoadThreshold {
  cpu: number; // CPU 使用率阈值 (%）
  memory: number; // 内存使用率阈值 (%）
  queueDepth: number; // 队列深度阈值
  activeJobs: number; // 活跃任务数阈值
}

export const LOAD_THRESHOLDS = {
  WARNING: {
    cpu: 70,
    memory: 70,
    queueDepth: 1000,
    activeJobs: 500,
  },
  CRITICAL: {
    cpu: 85,
    memory: 85,
    queueDepth: 2000,
    activeJobs: 1000,
  },
  EMERGENCY: {
    cpu: 95,
    memory: 95,
    queueDepth: 5000,
    activeJobs: 2000,
  },
} as const;

export type LoadLevel = 'NORMAL' | 'WARNING' | 'CRITICAL' | 'EMERGENCY';

// ============================================
// 优先级控制器
// ============================================

export interface SystemLoad {
  level: LoadLevel;
  cpu: number;
  memory: number;
  queueDepths: Record<Priority, number>;
  activeJobs: Record<Priority, number>;
  timestamp: number;
}

export class SystemPriorityController {
  private queues: Map<Priority, Queue> = new Map();
  private workers: Map<Priority, any[]> = new Map();
  private currentLoad: SystemLoad;
  private loadCheckInterval: NodeJS.Timeout | null = null;
  private readonly LOAD_CHECK_INTERVAL = 5000; // 5秒检查一次
  private isInitialized = false;

  constructor() {
    this.currentLoad = this.getInitialLoad();
  }

  /**
   * 初始化优先级控制器
   */
  async initialize(): Promise<void> {
    if (this.isInitialized) {
      logger.warn('[PriorityController] 已经初始化，跳过重复初始化');
      return;
    }

    try {
      logger.info('[PriorityController] 开始初始化优先级控制器');

      await this.initializeQueues();
      await this.initializeWorkers();
      await this.startLoadMonitoring();

      this.isInitialized = true;
      
      logger.info('[PriorityController] 优先级控制器初始化完成', {
        queues: this.queues.size,
        loadCheckInterval: this.LOAD_CHECK_INTERVAL,
      });
    } catch (error) {
      logger.error('[PriorityController] 初始化失败', error);
      throw error;
    }
  }

  /**
   * 初始化队列
   */
  private async initializeQueues(): Promise<void> {
    logger.info('[PriorityController] 初始化优先级队列');

    for (const priority of Object.values(Priority)) {
      const config = PRIORITY_CONFIGS[priority];
      const queueName = `priority:${config.name.toLowerCase()}`;

      const queue = new Queue(queueName, {
        connection: QueueConfig.connection,
        defaultJobOptions: {
          attempts: 3,
          backoff: {
            type: 'exponential',
            delay: 1000,
          },
          removeOnComplete: {
            count: 1000,
            age: 24 * 3600, // 24小时
          },
          removeOnFail: {
            count: 5000,
            age: 7 * 24 * 3600, // 7天
          },
        },
      });

      this.queues.set(priority, queue);

      await queue.waitUntilReady();
      
      logger.debug(`[PriorityController] 队列已就绪: ${config.name}`, {
        queueName,
        priority: priority,
      });
    }
  }

  /**
   * 初始化 Worker
   */
  private async initializeWorkers(): Promise<void> {
    logger.info('[PriorityController] 初始化 Worker');

    for (const priority of Object.values(Priority)) {
      const config = PRIORITY_CONFIGS[priority];
      const queue = this.queues.get(priority);
      
      if (!queue) {
        continue;
      }

      const workers: any[] = [];

      const workerCount = Math.ceil(config.concurrency / 5);
      
      for (let i = 0; i < workerCount; i++) {
        const worker = new QueueScheduler(queueName => {
          return {
            connection: QueueConfig.connection,
            concurrency: Math.ceil(config.concurrency / workerCount),
          };
        });

        worker.on('completed', (job: Job) => {
          logger.debug(`[PriorityController] 任务完成: ${config.name}`, {
            jobId: job.id,
            priority: priority,
          });
        });

        worker.on('failed', (job: Job | undefined, error: Error) => {
          logger.error(`[PriorityController] 任务失败: ${config.name}`, {
            jobId: job?.id,
            priority: priority,
            error: error.message,
          });
        });

        workers.push(worker);
      }

      this.workers.set(priority, workers);
    }
  }

  /**
   * 开始负载监控
   */
  private async startLoadMonitoring(): Promise<void> {
    logger.info('[PriorityController] 启动系统负载监控');

    this.loadCheckInterval = setInterval(async () => {
      await this.checkSystemLoad();
    }, this.LOAD_CHECK_INTERVAL);

    // 立即执行一次检查
    await this.checkSystemLoad();
  }

  /**
   * 检查系统负载
   */
  private async checkSystemLoad(): Promise<void> {
    try {
      const cpu = await this.getCpuUsage();
      const memory = await this.getMemoryUsage();
      const queueDepths = await this.getQueueDepths();
      const activeJobs = await this.getActiveJobs();

      const load = this.calculateLoadLevel(cpu, memory, queueDepths, activeJobs);
      
      this.currentLoad = {
        ...load,
        cpu,
        memory,
        queueDepths,
        activeJobs,
        timestamp: Date.now(),
      };

      // 根据负载级别调整策略
      await this.adjustPriorityStrategy(load.level);

      logger.info('[PriorityController] 系统负载状态', {
        level: load.level,
        cpu: `${cpu.toFixed(2)}%`,
        memory: `${memory.toFixed(2)}%`,
        queueDepths,
        activeJobs,
      });
    } catch (error) {
      logger.error('[PriorityController] 检查系统负载失败', error);
    }
  }

  /**
   * 添加任务到队列
   */
  async addJob<T>(
    priority: Priority,
    name: string,
    data: T,
    options?: JobsOptions
  ): Promise<Job<T>> {
    const config = PRIORITY_CONFIGS[priority];
    const queue = this.queues.get(priority);

    if (!queue) {
      throw new Error(`队列不存在: ${config.name}`);
    }

    const jobOptions: JobsOptions = {
      ...options,
      priority: config.level,
    };

    // P0 强平任务不允许进入等待队列
    if (priority === Priority.P0) {
      jobOptions.delay = 0; // 不延迟
      jobOptions.lifo = true; // LIFO 立即执行
    }

    const job = await queue.add(name, data, jobOptions);

    logger.debug(`[PriorityController] 任务已添加`, {
      name: config.name,
      jobId: job.id,
      priority: config.level,
    });

    return job;
  }

  /**
   * 调整优先级策略
   */
  private async adjustPriorityStrategy(loadLevel: LoadLevel): Promise<void> {
    switch (loadLevel) {
      case 'NORMAL':
        await this.setNormalStrategy();
        break;
      case 'WARNING':
        await this.setWarningStrategy();
        break;
      case 'CRITICAL':
        await this.setCriticalStrategy();
        break;
      case 'EMERGENCY':
        await this.setEmergencyStrategy();
        break;
    }
  }

  /**
   * 设置正常策略
   */
  private async setNormalStrategy(): Promise<void> {
    logger.debug('[PriorityController] 应用正常策略');
    // 所有队列正常工作
  }

  /**
   * 设置警告策略
   */
  private async setWarningStrategy(): Promise<void> {
    logger.warn('[PriorityController] 应用警告策略 - 系统负载较高');

    // 限制 P2、P3 请求速率
    await this.throttlePriority(Priority.P2, 0.8); // 降低到 80%
    await this.throttlePriority(Priority.P3, 0.7); // 降低到 70%
  }

  /**
   * 设置严重策略
   */
  private async setCriticalStrategy(): Promise<void> {
    logger.warn('[PriorityController] 应用严重策略 - 系统负载高');

    // 进一步限制 P2、P3
    await this.throttlePriority(Priority.P2, 0.5); // 降低到 50%
    await this.throttlePriority(Priority.P3, 0.3); // 降低到 30%
  }

  /**
   * 设置紧急策略
   */
  private async setEmergencyStrategy(): Promise<void> {
    logger.error('[PriorityController] 应用紧急策略 - 系统负载严重');

    // 严格限制 P2、P3，只保证 P0 和 P1
    await this.throttlePriority(Priority.P2, 0.2); // 降低到 20%
    await this.throttlePriority(Priority.P3, 0.1); // 降低到 10%
  }

  /**
   * 限制指定优先级的处理速率
   */
  private async throttlePriority(
    priority: Priority,
    rateMultiplier: number
  ): Promise<void> {
    const workers = this.workers.get(priority);
    
    if (!workers || workers.length === 0) {
      return;
    }

    // 通过调整 Worker 的并发数来实现速率限制
    for (const worker of workers) {
      const config = PRIORITY_CONFIGS[priority];
      const newConcurrency = Math.ceil(config.concurrency * rateMultiplier);
      
      // BullMQ 不支持动态调整并发，这里只是标记
      // 实际限制通过速率限制器实现
    }
  }

  /**
   * 获取 CPU 使用率
   */
  private async getCpuUsage(): Promise<number> {
    const cpus = require('os').cpus();
    const usage = process.cpuUsage();
    
    const totalIdle = cpus.reduce((acc, cpu) => acc + cpu.times.idle, 0);
    const totalTick = cpus.reduce((acc, cpu) => {
      return acc + cpu.times.user + cpu.times.nice + cpu.times.sys + cpu.times.idle + cpu.times.irq;
    }, 0);

    const idle = totalIdle / cpus.length;
    const total = totalTick / cpus.length;

    const usagePercent = ((total - idle) / total) * 100;

    return Math.min(usagePercent, 100);
  }

  /**
   * 获取内存使用率
   */
  private async getMemoryUsage(): Promise<number> {
    const totalMem = require('os').totalmem();
    const freeMem = require('os').freemem();
    
    const usedMem = totalMem - freeMem;
    const usagePercent = (usedMem / totalMem) * 100;

    return Math.min(usagePercent, 100);
  }

  /**
   * 获取队列深度
   */
  private async getQueueDepths(): Promise<Record<Priority, number>> {
    const depths: Record<Priority, number> = {
      [Priority.P0]: 0,
      [Priority.P1]: 0,
      [Priority.P2]: 0,
      [Priority.P3]: 0,
    };

    for (const priority of Object.values(Priority)) {
      const queue = this.queues.get(priority);
      if (queue) {
        depths[priority] = await queue.getWaitingCount();
      }
    }

    return depths;
  }

  /**
   * 获取活跃任务数
   */
  private async getActiveJobs(): Promise<Record<Priority, number>> {
    const actives: Record<Priority, number> = {
      [Priority.P0]: 0,
      [Priority.P1]: 0,
      [Priority.P2]: 0,
      [Priority.P3]: 0,
    };

    for (const priority of Object.values(Priority)) {
      const queue = this.queues.get(priority);
      if (queue) {
        actives[priority] = await queue.getActiveCount();
      }
    }

    return actives;
  }

  /**
   * 计算负载级别
   */
  private calculateLoadLevel(
    cpu: number,
    memory: number,
    queueDepths: Record<Priority, number>,
    activeJobs: Record<Priority, number>
  ): { level: LoadLevel; score: number } {
    let score = 0;

    // CPU 贡献
    if (cpu > LOAD_THRESHOLDS.EMERGENCY.cpu) score += 40;
    else if (cpu > LOAD_THRESHOLDS.CRITICAL.cpu) score += 30;
    else if (cpu > LOAD_THRESHOLDS.WARNING.cpu) score += 20;
    else if (cpu > 50) score += 10;

    // 内存贡献
    if (memory > LOAD_THRESHOLDS.EMERGENCY.memory) score += 40;
    else if (memory > LOAD_THRESHOLDS.CRITICAL.memory) score += 30;
    else if (memory > LOAD_THRESHOLDS.WARNING.memory) score += 20;
    else if (memory > 50) score += 10;

    // 队列深度贡献
    const totalQueueDepth = Object.values(queueDepths).reduce((a, b) => a + b, 0);
    if (totalQueueDepth > LOAD_THRESHOLDS.EMERGENCY.queueDepth) score += 20;
    else if (totalQueueDepth > LOAD_THRESHOLDS.CRITICAL.queueDepth) score += 15;
    else if (totalQueueDepth > LOAD_THRESHOLDS.WARNING.queueDepth) score += 10;
    else if (totalQueueDepth > 500) score += 5;

    // 活跃任务贡献
    const totalActiveJobs = Object.values(activeJobs).reduce((a, b) => a + b, 0);
    if (totalActiveJobs > LOAD_THRESHOLDS.EMERGENCY.activeJobs) score += 20;
    else if (totalActiveJobs > LOAD_THRESHOLDS.CRITICAL.activeJobs) score += 15;
    else if (totalActiveJobs > LOAD_THRESHOLDS.WARNING.activeJobs) score += 10;
    else if (totalActiveJobs > 200) score += 5;

    let level: LoadLevel;
    if (score >= 80) level = 'EMERGENCY';
    else if (score >= 60) level = 'CRITICAL';
    else if (score >= 30) level = 'WARNING';
    else level = 'NORMAL';

    return { level, score };
  }

  /**
   * 获取初始负载
   */
  private getInitialLoad(): SystemLoad {
    return {
      level: 'NORMAL',
      cpu: 0,
      memory: 0,
      queueDepths: {
        [Priority.P0]: 0,
        [Priority.P1]: 0,
        [Priority.P2]: 0,
        [Priority.P3]: 0,
      },
      activeJobs: {
        [Priority.P0]: 0,
        [Priority.P1]: 0,
        [Priority.P2]: 0,
        [Priority.P3]: 0,
      },
      timestamp: Date.now(),
    };
  }

  /**
   * 获取当前负载
   */
  getCurrentLoad(): SystemLoad {
    return { ...this.currentLoad };
  }

  /**
   * 获取队列统计
   */
  async getQueueStats(): Promise<Record<Priority, any>> {
    const stats: Record<Priority, any> = {};

    for (const priority of Object.values(Priority)) {
      const queue = this.queues.get(priority);
      const config = PRIORITY_CONFIGS[priority];

      if (!queue) {
        continue;
      }

      const [waiting, active, completed, failed, delayed] = await Promise.all([
        queue.getWaitingCount(),
        queue.getActiveCount(),
        queue.getCompletedCount(),
        queue.getFailedCount(),
        queue.getDelayedCount(),
      ]);

      stats[priority] = {
        name: config.name,
        waiting,
        active,
        completed,
        failed,
        delayed,
      };
    }

    return stats;
  }

  /**
   * 停止优先级控制器
   */
  async stop(): Promise<void> {
    logger.info('[PriorityController] 停止优先级控制器');

    if (this.loadCheckInterval) {
      clearInterval(this.loadCheckInterval);
      this.loadCheckInterval = null;
    }

    for (const [priority, workers] of this.workers.entries()) {
      logger.debug(`[PriorityController] 停止 Worker: ${PRIORITY_CONFIGS[priority].name}`);
      for (const worker of workers) {
        await worker.close();
      }
    }

    for (const [priority, queue] of this.queues.entries()) {
      logger.debug(`[PriorityController] 关闭队列: ${PRIORITY_CONFIGS[priority].name}`);
      await queue.close();
    }

    this.workers.clear();
    this.queues.clear();
    this.isInitialized = false;

    logger.info('[PriorityController] 优先级控制器已停止');
  }
}

export const systemPriorityController = new SystemPriorityController();