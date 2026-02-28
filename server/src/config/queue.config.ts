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
} as const;

export const LOCK_TIMEOUT = {
  ORDER_PROCESSING: 30000,
  POSITION_CLOSE: 30000,
  BALANCE_UPDATE: 10000,
} as const;

export const LOCK_RETRY = {
  TIMES: 3,
  DELAY: 100,
} as const;
