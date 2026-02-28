import { Queue, QueueOptions } from 'bullmq';
import { QUEUE_CONFIG, QUEUE_NAMES } from '../config/queue.config';
import logger from '../utils/logger';

export interface CreateOrderJobData {
  userId: string;
  productCode: string;
  type: number;
  direction: number;
  quantity: number;
  leverage: number;
  price?: number;
  stopLoss?: number;
  takeProfit?: number;
  orderNumber?: string;
  idempotencyKey?: string;
}

export interface OrderStatusResponse {
  orderId: string;
  state: string;
  status: number;
  filledQuantity?: number;
  filledPrice?: number;
  error?: string;
}

export class OrderQueueProducer {
  private queue: Queue;

  constructor() {
    const options: QueueOptions = {
      ...QUEUE_CONFIG,
      connection: {
        ...QUEUE_CONFIG.connection,
        maxRetriesPerRequest: 3,
      },
    };

    this.queue = new Queue(QUEUE_NAMES.ORDERS, options);

    this.queue.on('error', (error) => {
      logger.error('Order queue error:', error);
    });

    logger.info('Order queue producer initialized');
  }

  async addOrder(data: CreateOrderJobData): Promise<{ orderId: string; jobId: string }> {
    const jobId = data.orderNumber || `order_${Date.now()}_${Math.random()}`;

    const job = await this.queue.add('create-order', data, {
      jobId,
      attempts: QUEUE_CONFIG.defaultJobOptions?.attempts,
      backoff: QUEUE_CONFIG.defaultJobOptions?.backoff,
    });

    logger.info(`Order added to queue: ${jobId}, orderNumber: ${data.orderNumber}`);

    return {
      orderId: jobId,
      jobId: job.id!,
    };
  }

  async getOrderStatus(orderId: string): Promise<OrderStatusResponse | null> {
    const job = await this.queue.getJob(orderId);

    if (!job) {
      return null;
    }

    const jobState = await job.getState();

    return {
      orderId,
      state: jobState || 'unknown',
      status: this.mapJobStateToOrderStatus(jobState),
      error: job.failedReason,
    };
  }

  async cancelOrder(orderId: string): Promise<boolean> {
    const job = await this.queue.getJob(orderId);

    if (!job) {
      logger.warn(`Order not found: ${orderId}`);
      return false;
    }

    const jobState = await job.getState();

    if (jobState === 'completed' || jobState === 'failed') {
      logger.warn(`Cannot cancel ${jobState} order: ${orderId}`);
      return false;
    }

    await job.remove();
    logger.info(`Order cancelled: ${orderId}`);

    return true;
  }

  async getQueueStats(): Promise<{
    waiting: number;
    active: number;
    completed: number;
    failed: number;
    delayed: number;
  }> {
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

  private mapJobStateToOrderStatus(jobState: string | null): number {
    const stateMap: Record<string, number> = {
      waiting: 0,
      delayed: 0,
      active: 1,
      completed: 2,
      failed: 4,
    };

    return stateMap[jobState || 'waiting'] || 0;
  }

  async close(): Promise<void> {
    await this.queue.close();
    logger.info('Order queue producer closed');
  }
}
