import { riskEngineWorkerPool, RiskCheckJobData, RiskCheckResult } from './RiskEngineWorkerPool';
import { riskEngineQueueProducer } from './RiskEngineQueueProducer';
import { riskEngine } from './RiskEngine';
import logger from '../utils/logger';

// ============================================
// Risk Engine Worker Pool Manager
// ============================================

export class RiskEngineWorkerPoolManager {
  private isInitialized = false;

  /**
   * 初始化 Risk Engine Worker Pool
   */
  async initialize(): Promise<void> {
    if (this.isInitialized) {
      logger.warn('[RiskWorkerPoolManager] 已经初始化，跳过重复初始化');
      return;
    }

    try {
      logger.info('[RiskWorkerPoolManager] 初始化 Risk Engine Worker Pool');

      // 初始化队列 Producer
      await riskEngineQueueProducer.initialize();

      // 定义风控检查处理器
      const processor: (job: any) => Promise<RiskCheckResult> = async (job) => {
        const data = job.data as RiskCheckJobData;

        try {
          const result = await riskEngine.validate({
            userId: parseInt(data.userId),
            productCode: data.productCode,
            operation: data.operation,
            quantity: data.quantity,
            leverage: data.leverage,
            price: data.price,
            direction: data.direction,
          });

          return {
            success: true,
            ...result,
          };
        } catch (error) {
          logger.error('[RiskWorkerPoolManager] 风控检查处理失败', {
            userId: data.userId,
            operation: data.operation,
            error: error instanceof Error ? error.message : 'Unknown error',
          });

          return {
            success: false,
            passed: false,
            riskLevel: 'CRITICAL',
            message: '风控检查失败',
            errorCode: 'RISK_CHECK_ERROR',
          };
        }
      };

      // 启动 Worker Pool
      await riskEngineWorkerPool.start(processor);

      this.isInitialized = true;

      logger.info('[RiskWorkerPoolManager] Risk Engine Worker Pool 初始化完成', {
        status: riskEngineWorkerPool.getStatus(),
        queueName: riskEngineQueueProducer.getQueueName(),
      });
    } catch (error) {
      logger.error('[RiskWorkerPoolManager] 初始化 Risk Engine Worker Pool 失败', error);
      throw error;
    }
  }

  /**
   * 停止 Risk Engine Worker Pool
   */
  async stop(): Promise<void> {
    if (!this.isInitialized) {
      logger.warn('[RiskWorkerPoolManager] 未初始化，无需停止');
      return;
    }

    try {
      logger.info('[RiskWorkerPoolManager] 停止 Risk Engine Worker Pool');

      // 停止 Worker Pool
      await riskEngineWorkerPool.stop();

      // 关闭队列 Producer
      await riskEngineQueueProducer.close();

      this.isInitialized = false;

      logger.info('[RiskWorkerPoolManager] Risk Engine Worker Pool 已停止');
    } catch (error) {
      logger.error('[RiskWorkerPoolManager] 停止 Risk Engine Worker Pool 失败', error);
      throw error;
    }
  }

  /**
   * 获取 Worker Pool 状态
   */
  getStatus(): {
    isInitialized: boolean;
    workerPool: any;
    queueStats?: any;
  } {
    const workerPoolStatus = riskEngineWorkerPool.getStatus();

    return {
      isInitialized: this.isInitialized,
      workerPool: workerPoolStatus,
    };
  }

  /**
   * 获取队列统计
   */
  async getQueueStats(): Promise<any> {
    if (!this.isInitialized) {
      throw new Error('Risk Engine Worker Pool 未初始化');
    }

    return await riskEngineQueueProducer.getQueueStats();
  }

  /**
   * 暂停队列
   */
  async pauseQueue(): Promise<void> {
    if (!this.isInitialized) {
      throw new Error('Risk Engine Worker Pool 未初始化');
    }

    await riskEngineQueueProducer.pause();
    logger.info('[RiskWorkerPoolManager] Risk Engine 队列已暂停');
  }

  /**
   * 恢复队列
   */
  async resumeQueue(): Promise<void> {
    if (!this.isInitialized) {
      throw new Error('Risk Engine Worker Pool 未初始化');
    }

    await riskEngineQueueProducer.resume();
    logger.info('[RiskWorkerPoolManager] Risk Engine 队列已恢复');
  }

  /**
   * 清空队列
   */
  async drainQueue(): Promise<void> {
    if (!this.isInitialized) {
      throw new Error('Risk Engine Worker Pool 未初始化');
    }

    await riskEngineQueueProducer.drain();
    logger.info('[RiskWorkerPoolManager] Risk Engine 队列已清空');
  }
}

// ============================================
// 创建默认的 Risk Engine Worker Pool Manager 实例
// ============================================

export const riskEngineWorkerPoolManager = new RiskEngineWorkerPoolManager();
