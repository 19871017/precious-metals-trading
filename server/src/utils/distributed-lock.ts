import Redis from 'ioredis';
import { QUEUE_CONFIG, LOCK_TIMEOUT, LOCK_RETRY } from '../config/queue.config';
import logger from './logger';

export interface DistributedLockOptions {
  ttl?: number;
  retryTimes?: number;
  retryDelay?: number;
}

export class DistributedLock {
  private redis: Redis;
  private lockKey: string;
  private lockValue: string;
  private locked: boolean = false;

  constructor(redis: Redis, lockKey: string) {
    this.redis = redis;
    this.lockKey = lockKey;
    this.lockValue = `${Date.now()}-${Math.random()}`;
  }

  async acquire(options: DistributedLockOptions = {}): Promise<boolean> {
    const {
      ttl = 10000,
      retryTimes = LOCK_RETRY.TIMES,
      retryDelay = LOCK_RETRY.DELAY,
    } = options;

    for (let i = 0; i < retryTimes; i++) {
      const result = await this.redis.set(
        this.lockKey,
        this.lockValue,
        'PX',
        ttl,
        'NX'
      );

      if (result === 'OK') {
        this.locked = true;
        logger.debug(`Lock acquired: ${this.lockKey}`);
        return true;
      }

      if (i < retryTimes - 1) {
        await new Promise(resolve => setTimeout(resolve, retryDelay));
      }
    }

    logger.warn(`Failed to acquire lock: ${this.lockKey}`);
    return false;
  }

  async release(): Promise<boolean> {
    if (!this.locked) {
      return false;
    }

    const script = `
      if redis.call("get", KEYS[1]) == ARGV[1] then
        return redis.call("del", KEYS[1])
      else
        return 0
      end
    `;

    const result = await this.redis.eval(script, 1, this.lockKey, this.lockValue);

    if (result === 1) {
      this.locked = false;
      logger.debug(`Lock released: ${this.lockKey}`);
      return true;
    }

    logger.warn(`Failed to release lock: ${this.lockKey}`);
    return false;
  }

  isLocked(): boolean {
    return this.locked;
  }

  getLockKey(): string {
    return this.lockKey;
  }
}

export async function acquireLock(
  lockKey: string,
  options: DistributedLockOptions = {}
): Promise<DistributedLock | null> {
  const redis = new Redis({
    host: QUEUE_CONFIG.connection.host,
    port: QUEUE_CONFIG.connection.port,
    username: QUEUE_CONFIG.connection.username,
    password: QUEUE_CONFIG.connection.password,
    db: QUEUE_CONFIG.connection.db,
  });

  const lock = new DistributedLock(redis, lockKey);

  const acquired = await lock.acquire(options);

  if (!acquired) {
    await redis.quit();
    return null;
  }

  return lock;
}

export async function releaseLock(lock: DistributedLock): Promise<boolean> {
  const released = await lock.release();
  const redis = lock['redis'];
  await redis.quit();
  return released;
}

export async function acquirePositionLock(
  positionId: number,
  userId: number
): Promise<DistributedLock | null> {
  return await acquireLock(
    `lock:position:${positionId}:${userId}`,
    {
      ttl: LOCK_TIMEOUT.POSITION_CLOSE,
      retryTimes: LOCK_RETRY.TIMES,
      retryDelay: LOCK_RETRY.DELAY,
    }
  );
}

export async function acquireBalanceLock(
  userId: number
): Promise<DistributedLock | null> {
  return await acquireLock(
    `lock:balance:${userId}`,
    {
      ttl: LOCK_TIMEOUT.BALANCE_UPDATE,
      retryTimes: LOCK_RETRY.TIMES,
      retryDelay: LOCK_RETRY.DELAY,
    }
  );
}
