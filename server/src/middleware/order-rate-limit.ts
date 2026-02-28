import { Request, Response, NextFunction } from 'express';
import redis from '../utils/redis';
import logger from '../utils/logger';
import { ErrorCode, createErrorResponse } from '../utils/error-codes';

// ============================================
// 订单限流配置
// ============================================

export interface OrderRateLimitConfig {
  maxOrdersPerSecond: number;      // 每秒最大订单数
  burstLimit: number;               // 突发流量限制
  windowMs: number;                 // 时间窗口（毫秒）
  queueMaxLength: number;           // 最大队列长度
  skipCheckHeader?: string;        // 跳过检查的请求头
  enablePriorityBypass?: boolean;   // 是否允许优先级绕过
}

export const DEFAULT_ORDER_RATE_LIMIT_CONFIG: OrderRateLimitConfig = {
  maxOrdersPerSecond: 3,           // 每秒最多 3 个订单
  burstLimit: 5,                   // 突发最多 5 个订单
  windowMs: 1000,                   // 1 秒窗口
  queueMaxLength: 1000,            // 最大队列长度
  skipCheckHeader: 'x-skip-rate-limit',
  enablePriorityBypass: false,
};

export interface OrderRateLimitResult {
  allowed: boolean;
  reason?: string;
  remaining?: number;
  resetTime?: number;
  estimatedWaitTime?: number;
  retryAfter?: number;
}

export interface UserRateLimitInfo {
  userId: string;
  orderCount: number;
  burstCount: number;
  firstOrderTime: number;
  lastOrderTime: number;
}

// ============================================
// 订单限流中间件
// ============================================

/**
 * 获取用户限流键
 */
function getUserLimitKey(userId: string): string {
  return `order:rate:limit:user:${userId}`;
}

/**
 * 获取用户突发流量键
 */
function getUserBurstKey(userId: string): string {
  return `order:rate:burst:user:${userId}`;
}

/**
 * 获取全局队列长度键
 */
function getGlobalQueueKey(): string {
  return 'order:rate:global:queue';
}

/**
 * 获取限流统计键
 */
function getLimitStatsKey(userId: string): string {
  return `order:rate:stats:user:${userId}`;
}

/**
 * 订单限流中间件
 */
export function orderRateLimit(config: Partial<OrderRateLimitConfig> = {}) {
  const finalConfig = {
    ...DEFAULT_ORDER_RATE_LIMIT_CONFIG,
    ...config,
  };

  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      // 检查是否跳过限流
      if (req.headers[finalConfig.skipCheckHeader || 'x-skip-rate-limit']) {
        logger.debug('[OrderRateLimit] 限流检查被跳过', {
          header: finalConfig.skipCheckHeader,
        });
        return next();
      }

      // 优先级绕过检查（可选）
      if (finalConfig.enablePriorityBypass && (req as any).priority === 0) {
        logger.debug('[OrderRateLimit] P0 优先级任务跳过限流');
        return next();
      }

      const userId = (req as any).userId;

      if (!userId) {
        logger.warn('[OrderRateLimit] 未找到用户ID，跳过限流检查');
        return next();
      }

      // 执行限流检查
      const result = await checkOrderRateLimit(userId, finalConfig);

      if (!result.allowed) {
        logger.warn('[OrderRateLimit] 订单请求被限流', {
          userId,
          reason: result.reason,
          remaining: result.remaining,
          retryAfter: result.retryAfter,
          estimatedWaitTime: result.estimatedWaitTime,
          path: req.path,
        });

        // 返回 429 Too Many Requests
        return res.status(429).json({
          code: ErrorCode.RATE_LIMIT_EXCEEDED,
          message: result.reason || '订单请求过于频繁，请稍后重试',
          data: {
            maxOrdersPerSecond: finalConfig.maxOrdersPerSecond,
            burstLimit: finalConfig.burstLimit,
            remaining: result.remaining,
            resetTime: result.resetTime,
            estimatedWaitTime: result.estimatedWaitTime,
            retryAfter: result.retryAfter,
          },
          timestamp: Date.now(),
        });
      }

      // 记录限流检查通过
      await recordLimitCheck(userId, result);

      // 添加限流信息到请求
      (req as any).rateLimitInfo = {
        userId,
        remaining: result.remaining,
        resetTime: result.resetTime,
      };

      next();
    } catch (error) {
      logger.error('[OrderRateLimit] 限流检查失败', {
        error,
        userId: (req as any).userId,
        path: req.path,
      });
      // 出错时允许通过，避免阻断正常请求
      next();
    }
  };
}

/**
 * 检查订单限流
 */
async function checkOrderRateLimit(
  userId: string,
  config: OrderRateLimitConfig
): Promise<OrderRateLimitResult> {
  const now = Date.now();
  const windowStart = now - config.windowMs;

  // 1. 检查每秒订单数限制
  const userLimitKey = getUserLimitKey(userId);
  const limitResult = await checkUserLimit(userId, config);

  if (!limitResult.allowed) {
    return limitResult;
  }

  // 2. 检查突发流量限制
  const burstResult = await checkBurstLimit(userId, config);

  if (!burstResult.allowed) {
    return burstResult;
  }

  // 3. 检查全局队列长度限制
  const queueResult = await checkGlobalQueueLimit(config);

  if (!queueResult.allowed) {
    return queueResult;
  }

  // 4. 所有限流检查通过，更新计数
  await updateLimitCounters(userId, config);

  return {
    allowed: true,
    remaining: limitResult.remaining,
    resetTime: windowStart + config.windowMs,
  };
}

/**
 * 检查用户每秒订单数限制
 */
async function checkUserLimit(
  userId: string,
  config: OrderRateLimitConfig
): Promise<OrderRateLimitResult> {
  const now = Date.now();
  const windowStart = now - config.windowMs;
  const userLimitKey = getUserLimitKey(userId);

  try {
    // 获取当前窗口内的订单计数
    const count = await redis.incr(userLimitKey);

    if (count === 1) {
      // 第一次请求，设置过期时间
      await redis.expire(userLimitKey, Math.ceil(config.windowMs / 1000) + 1);
    }

    if (count > config.maxOrdersPerSecond) {
      // 超过限制，计算重置时间
      const ttl = await redis.pttl(userLimitKey);
      const resetTime = now + ttl;

      return {
        allowed: false,
        reason: `每秒订单数超过限制 (${config.maxOrdersPerSecond})`,
        remaining: 0,
        resetTime,
        retryAfter: Math.ceil(ttl / 1000),
      };
    }

    // 计算剩余配额
    const remaining = config.maxOrdersPerSecond - count;

    return {
      allowed: true,
      remaining,
    };
  } catch (error) {
    logger.error('[OrderRateLimit] 检查用户限流失败', { userId, error });
    // Redis 错误时允许通过
    return {
      allowed: true,
      remaining: config.maxOrdersPerSecond,
    };
  }
}

/**
 * 检查突发流量限制
 */
async function checkBurstLimit(
  userId: string,
  config: OrderRateLimitConfig
): Promise<OrderRateLimitResult> {
  const now = Date.now();
  const burstWindowMs = 500; // 500ms 突发窗口
  const burstWindowStart = now - burstWindowMs;
  const userBurstKey = getUserBurstKey(userId);

  try {
    // 获取突发流量计数
    const count = await redis.incr(userBurstKey);

    if (count === 1) {
      await redis.expire(userBurstKey, 1); // 1 秒过期
    }

    if (count > config.burstLimit) {
      const ttl = await redis.pttl(userBurstKey);
      const resetTime = now + ttl;

      return {
        allowed: false,
        reason: `突发流量超过限制 (${config.burstLimit}次/${burstWindowMs}ms)`,
        remaining: 0,
        resetTime,
        retryAfter: Math.ceil(ttl / 1000),
      };
    }

    return {
      allowed: true,
      remaining: config.burstLimit - count,
    };
  } catch (error) {
    logger.error('[OrderRateLimit] 检查突发流量失败', { userId, error });
    return {
      allowed: true,
      remaining: config.burstLimit,
    };
  }
}

/**
 * 检查全局队列长度限制
 */
async function checkGlobalQueueLimit(
  config: OrderRateLimitConfig
): Promise<OrderRateLimitResult> {
  try {
    const queueKey = getGlobalQueueKey();

    // 获取当前队列长度
    const queueLength = await redis.incr(queueKey);

    if (queueLength === 1) {
      // 第一次请求，设置过期时间
      await redis.expire(queueKey, 60); // 60 秒过期
    }

    if (queueLength > config.queueMaxLength) {
      // 计算预估等待时间
      const estimatedWaitTime = calculateWaitTime(queueLength, config);

      return {
        allowed: false,
        reason: `订单队列已满 (${config.queueMaxLength})，请稍后重试`,
        remaining: 0,
        estimatedWaitTime,
      };
    }

    // 队列长度正常，减少计数（订单完成后）
    // 这里只是暂存，实际减少在订单完成回调中
    await redis.expire(queueKey, 60);

    return {
      allowed: true,
      remaining: config.queueMaxLength - queueLength,
      estimatedWaitTime: 0,
    };
  } catch (error) {
    logger.error('[OrderRateLimit] 检查全局队列失败', { error });
    return {
      allowed: true,
      remaining: config.queueMaxLength,
    };
  }
}

/**
 * 更新限流计数器
 */
async function updateLimitCounters(
  userId: string,
  config: OrderRateLimitConfig
): Promise<void> {
  try {
    const statsKey = getLimitStatsKey(userId);
    const now = Date.now();

    const stats = {
      lastCheck: now,
      limitCount: config.maxOrdersPerSecond,
      burstLimit: config.burstLimit,
      queueLimit: config.queueMaxLength,
    };

    await redis.set(statsKey, JSON.stringify(stats), 'EX', 3600); // 1 小时过期
  } catch (error) {
    logger.error('[OrderRateLimit] 更新限流统计失败', { userId, error });
  }
}

/**
 * 记录限流检查
 */
async function recordLimitCheck(
  userId: string,
  result: OrderRateLimitResult
): Promise<void> {
  try {
    const statsKey = getLimitStatsKey(userId);
    const now = Date.now();

    const stats = await redis.get(statsKey);
    let limitStats = stats ? JSON.parse(stats) : { checks: 0, allowed: 0, denied: 0, lastDenied: null };

    limitStats.checks++;
    if (result.allowed) {
      limitStats.allowed++;
    } else {
      limitStats.denied++;
      limitStats.lastDenied = {
        reason: result.reason,
        timestamp: now,
      };
    }

    await redis.set(statsKey, JSON.stringify(limitStats), 'EX', 86400); // 24 小时过期
  } catch (error) {
    logger.error('[OrderRateLimit] 记录限流检查失败', { userId, error });
  }
}

/**
 * 计算预估等待时间
 */
function calculateWaitTime(queueLength: number, config: OrderRateLimitConfig): number {
  // 假设平均每个订单处理时间为 50ms
  const avgProcessTime = 50;
  const totalWaitTime = queueLength * avgProcessTime;

  return totalWaitTime;
}

/**
 * 订单完成后的回调
 */
export async function onOrderCompleted(userId: string): Promise<void> {
  try {
    // 减少全局队列计数
    const queueKey = getGlobalQueueKey();
    await redis.decr(queueKey);

    logger.debug('[OrderRateLimit] 订单完成，减少队列计数', { userId });
  } catch (error) {
    logger.error('[OrderRateLimit] 订单完成回调失败', { userId, error });
  }
}

/**
 * 获取用户限流统计
 */
export async function getUserRateLimitStats(userId: string): Promise<{
  limitConfig: OrderRateLimitConfig;
  stats: {
    checks: number;
    allowed: number;
    denied: number;
    lastDenied?: {
      reason: string;
      timestamp: number;
    };
  };
}> {
  try {
    const statsKey = getLimitStatsKey(userId);
    const stats = await redis.get(statsKey);

    return {
      limitConfig: DEFAULT_ORDER_RATE_LIMIT_CONFIG,
      stats: stats ? JSON.parse(stats) : { checks: 0, allowed: 0, denied: 0 },
    };
  } catch (error) {
    logger.error('[OrderRateLimit] 获取用户限流统计失败', { userId, error });
    return {
      limitConfig: DEFAULT_ORDER_RATE_LIMIT_CONFIG,
      stats: { checks: 0, allowed: 0, denied: 0 },
    };
  }
}

/**
 * 获取全局队列状态
 */
export async function getGlobalQueueStatus(): Promise<{
  queueLength: number;
  maxQueueLength: number;
  utilizationRate: number;
}> {
  try {
    const queueKey = getGlobalQueueKey();
    const queueLength = await redis.get(queueKey);

    const length = parseInt(queueLength || '0');
    const maxQueueLength = DEFAULT_ORDER_RATE_LIMIT_CONFIG.queueMaxLength;
    const utilizationRate = (length / maxQueueLength) * 100;

    return {
      queueLength: length,
      maxQueueLength,
      utilizationRate,
    };
  } catch (error) {
    logger.error('[OrderRateLimit] 获取全局队列状态失败', error);
    return {
      queueLength: 0,
      maxQueueLength: DEFAULT_ORDER_RATE_LIMIT_CONFIG.queueMaxLength,
      utilizationRate: 0,
    };
  }
}

/**
 * 重置用户限流计数
 */
export async function resetUserRateLimit(userId: string): Promise<void> {
  try {
    const keys = [
      getUserLimitKey(userId),
      getUserBurstKey(userId),
    ];

    await redis.del(...keys);

    logger.info('[OrderRateLimit] 用户限流计数已重置', { userId });
  } catch (error) {
    logger.error('[OrderRateLimit] 重置用户限流失败', { userId, error });
  }
}

/**
 * 重置全局队列计数
 */
export async function resetGlobalQueue(): Promise<void> {
  try {
    const queueKey = getGlobalQueueKey();
    await redis.del(queueKey);

    logger.info('[OrderRateLimit] 全局队列计数已重置');
  } catch (error) {
    logger.error('[OrderRateLimit] 重置全局队列失败', error);
  }
}

export default {
  orderRateLimit,
  onOrderCompleted,
  getUserRateLimitStats,
  getGlobalQueueStatus,
  resetUserRateLimit,
  resetGlobalQueue,
};