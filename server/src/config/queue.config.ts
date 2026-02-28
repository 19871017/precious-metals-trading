import { QueueOptions } from 'bullmq';

export const QUEUE_CONFIG: QueueOptions = {
  connection: {
    host: process.env.REDIS_HOST || 'localhost',
    port: parseInt(process.env.REDIS_PORT || '6379'),
    username: process.env.REDIS_USERNAME,
    password: process.env.REDIS_PASSWORD,
    db: parseInt(process.env.REDIS_DB || '0'),
  },
  defaultJobOptions: {
    attempts: 3,
    backoff: {
      type: 'exponential',
      delay: 1000,
    },
    removeOnComplete: 1000,
    removeOnFail: 5000,
  },
};

export const QUEUE_NAMES = {
  ORDERS: 'orders:queue',
  ORDERS_DELAYED: 'orders:delayed',
  ORDERS_FAILED: 'orders:failed',
  LIQUIDATION: 'liquidation:queue',
  RISK_CALCULATION: 'risk:calculation:queue',
  ORDER_MATCHING: 'order:matching:queue',
  USER_QUERY: 'user:query:queue',
} as const;

export const LOCK_TIMEOUT = {
  ORDER_PROCESSING: 30000,
  POSITION_CLOSE: 30000,
  BALANCE_UPDATE: 10000,
  LIQUIDATION: 10000,
} as const;

export const LOCK_RETRY = {
  TIMES: 3,
  DELAY: 100,
} as const;

// ============================================
// 优先级队列配置
// ============================================

export const PRIORITY_QUEUE_CONFIG = {
  P0: {
    name: 'priority:p0:liquidation',
    concurrency: 10,
    maxRetries: 1,
    retryDelay: 1000,
  },
  P1: {
    name: 'priority:p1:risk',
    concurrency: 20,
    maxRetries: 2,
    retryDelay: 2000,
  },
  P2: {
    name: 'priority:p2:order-matching',
    concurrency: 50,
    maxRetries: 3,
    retryDelay: 1000,
  },
  P3: {
    name: 'priority:p3:user-query',
    concurrency: 100,
    maxRetries: 1,
    retryDelay: 500,
  },
} as const;
