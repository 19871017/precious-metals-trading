import { Request, Response, NextFunction } from 'express';
import { systemPriorityController, Priority, SystemLoad } from '../services/SystemPriorityController';
import redis from '../utils/redis';
import logger from '../utils/logger';
import { ErrorCode, createErrorResponse } from '../utils/error-codes';

export interface PriorityRateLimitOptions {
  priority: Priority;
  skipThreshold?: 'WARNING' | 'CRITICAL' | 'EMERGENCY';
}

export interface PriorityCheckResult {
  allowed: boolean;
  reason?: string;
  currentLoad?: SystemLoad;
  estimatedWaitTime?: number;
}

const LOAD_THRESHOLDS = {
  P0_SKIP: 'EMERGENCY' as const,
  P1_SKIP: 'EMERGENCY' as const,
  P2_SKIP: 'CRITICAL' as const,
  P3_SKIP: 'WARNING' as const,
};

/**
 * 获取请求优先级
 */
function getRequestPriority(req: Request): Priority {
  const path = req.path;

  // 强平相关请求 - P0
  if (path.includes('/liquidation') || path.includes('/force-close')) {
    return Priority.P0;
  }

  // 风险计算相关请求 - P1
  if (path.includes('/risk') || path.includes('/calculate') || path.includes('/check')) {
    return Priority.P1;
  }

  // 订单撮合相关请求 - P2
  if (path.includes('/order/create') || path.includes('/order/match') || path.includes('/trade')) {
    return Priority.P2;
  }

  // 其他请求 - P3
  return Priority.P3;
}

/**
 * 计算预估等待时间
 */
function calculateEstimatedWaitTime(priority: Priority, load: SystemLoad): number {
  const queueDepth = load.queueDepths[priority];
  const config = systemPriorityController['getPriorityConfig']?.(priority);
  
  if (!config) {
    return 0;
  }

  const throughputPerSecond = config.concurrency / 100; // 假设平均每个任务 10ms
  const estimatedWaitTime = (queueDepth / throughputPerSecond) * 1000;

  return Math.round(estimatedWaitTime);
}

/**
 * 检查优先级限制
 */
async function checkPriorityLimit(
  priority: Priority,
  currentLoad: SystemLoad
): Promise<PriorityCheckResult> {
  const skipThreshold = LOAD_THRESHOLDS[`P${priority}_SKIP` as keyof typeof LOAD_THRESHOLDS];
  
  // 检查是否应该跳过此优先级
  const shouldSkip = shouldSkipPriority(priority, currentLoad.level);
  
  if (shouldSkip) {
    return {
      allowed: false,
      reason: `系统负载过重（${currentLoad.level}），当前优先级的请求被限流`,
      currentLoad,
      estimatedWaitTime: calculateEstimatedWaitTime(priority, currentLoad),
    };
  }

  // 检查队列深度
  const queueDepth = currentLoad.queueDepths[priority];
  const maxQueueDepth = getMaxQueueDepth(priority, currentLoad.level);
  
  if (queueDepth >= maxQueueDepth) {
    return {
      allowed: false,
      reason: `队列深度达到限制（${queueDepth}/${maxQueueDepth}），请稍后重试`,
      currentLoad,
      estimatedWaitTime: calculateEstimatedWaitTime(priority, currentLoad),
    };
  }

  // 检查活跃任务数
  const activeJobs = currentLoad.activeJobs[priority];
  const maxActiveJobs = getMaxActiveJobs(priority, currentLoad.level);
  
  if (activeJobs >= maxActiveJobs) {
    return {
      allowed: false,
      reason: `活跃任务数达到限制（${activeJobs}/${maxActiveJobs}），请稍后重试`,
      currentLoad,
      estimatedWaitTime: calculateEstimatedWaitTime(priority, currentLoad),
    };
  }

  return {
    allowed: true,
    currentLoad,
    estimatedWaitTime: calculateEstimatedWaitTime(priority, currentLoad),
  };
}

/**
 * 判断是否应该跳过优先级
 */
function shouldSkipPriority(priority: Priority, loadLevel: string): boolean {
  const skipOrder = {
    [Priority.P0]: ['EMERGENCY'],
    [Priority.P1]: ['EMERGENCY'],
    [Priority.P2]: ['CRITICAL', 'EMERGENCY'],
    [Priority.P3]: ['WARNING', 'CRITICAL', 'EMERGENCY'],
  };

  return skipOrder[priority].includes(loadLevel);
}

/**
 * 获取最大队列深度
 */
function getMaxQueueDepth(priority: Priority, loadLevel: string): number {
  const baseDepths = {
    [Priority.P0]: 1000,
    [Priority.P1]: 5000,
    [Priority.P2]: 10000,
    [Priority.P3]: 20000,
  };

  const multipliers = {
    'NORMAL': 1.0,
    'WARNING': 0.7,
    'CRITICAL': 0.4,
    'EMERGENCY': 0.1,
  };

  const multiplier = multipliers[loadLevel as keyof typeof multipliers] || 1.0;

  return Math.floor(baseDepths[priority] * multiplier);
}

/**
 * 获取最大活跃任务数
 */
function getMaxActiveJobs(priority: Priority, loadLevel: string): number {
  const baseActiveJobs = {
    [Priority.P0]: 100,
    [Priority.P1]: 200,
    [Priority.P2]: 300,
    [Priority.P3]: 400,
  };

  const multipliers = {
    'NORMAL': 1.0,
    'WARNING': 0.8,
    'CRITICAL': 0.5,
    'EMERGENCY': 0.2,
  };

  const multiplier = multipliers[loadLevel as keyof typeof multipliers] || 1.0;

  return Math.floor(baseActiveJobs[priority] * multiplier);
}

/**
 * 记录优先级检查到 Redis
 */
async function recordPriorityCheck(
  priority: Priority,
  allowed: boolean,
  reason?: string
): Promise<void> {
  try {
    const key = `priority:check:${priority}:${Date.now()}`;
    const data = JSON.stringify({
      priority,
      allowed,
      reason,
      timestamp: Date.now(),
    });

    await redis.set(key, data, 'EX', 3600); // 1小时
  } catch (error) {
    logger.error('[PriorityMiddleware] 记录优先级检查失败', { priority, error });
  }
}

/**
 * 获取优先级统计
 */
export async function getPriorityStats(): Promise<{
  totalChecks: number;
  allowed: number;
  denied: number;
  byPriority: Record<Priority, { allowed: number; denied: number; }>;
}> {
  try {
    const keys = await redis.keys('priority:check:*');
    
    const stats: Record<Priority, { allowed: number; denied: number; }> = {
      [Priority.P0]: { allowed: 0, denied: 0 },
      [Priority.P1]: { allowed: 0, denied: 0 },
      [Priority.P2]: { allowed: 0, denied: 0 },
      [Priority.P3]: { allowed: 0, denied: 0 },
    };

    let totalAllowed = 0;
    let totalDenied = 0;

    for (const key of keys) {
      const data = await redis.get(key);
      if (data) {
        const record = JSON.parse(data);
        const priority = record.priority as Priority;
        
        if (record.allowed) {
          stats[priority].allowed++;
          totalAllowed++;
        } else {
          stats[priority].denied++;
          totalDenied++;
        }
      }
    }

    return {
      totalChecks: totalAllowed + totalDenied,
      allowed: totalAllowed,
      denied: totalDenied,
      byPriority: stats,
    };
  } catch (error) {
    logger.error('[PriorityMiddleware] 获取优先级统计失败', error);
    return {
      totalChecks: 0,
      allowed: 0,
      denied: 0,
      byPriority: {
        [Priority.P0]: { allowed: 0, denied: 0 },
        [Priority.P1]: { allowed: 0, denied: 0 },
        [Priority.P2]: { allowed: 0, denied: 0 },
        [Priority.P3]: { allowed: 0, denied: 0 },
      },
    };
  }
}

/**
 * 优先级限流中间件
 */
export function priorityRateLimit(options?: PriorityRateLimitOptions) {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      // 获取请求优先级
      const priority = options?.priority || getRequestPriority(req);
      
      // P0 强平请求直接通过，不做限制
      if (priority === Priority.P0) {
        logger.debug('[PriorityMiddleware] P0 强平请求直接通过');
        return next();
      }

      // 获取当前负载
      const currentLoad = systemPriorityController.getCurrentLoad();

      // 检查优先级限制
      const checkResult = await checkPriorityLimit(priority, currentLoad);

      // 记录检查结果
      await recordPriorityCheck(priority, checkResult.allowed, checkResult.reason);

      if (!checkResult.allowed) {
        logger.warn('[PriorityMiddleware] 请求被限流', {
          priority,
          reason: checkResult.reason,
          estimatedWaitTime: checkResult.estimatedWaitTime,
          path: req.path,
          userId: (req as any).userId,
        });

        // 返回 429 Too Many Requests
        return res.status(429).json({
          code: ErrorCode.RATE_LIMIT_EXCEEDED,
          message: checkResult.reason || '请求过于频繁，请稍后重试',
          data: {
            priority,
            currentLoadLevel: currentLoad.level,
            estimatedWaitTime: checkResult.estimatedWaitTime,
            retryAfter: Math.ceil((checkResult.estimatedWaitTime || 0) / 1000),
          },
          timestamp: Date.now(),
        });
      }

      // 添加负载信息到请求
      (req as any).priority = priority;
      (req as any).currentLoad = currentLoad;

      // 记录处理时间
      const startTime = Date.now();
      res.on('finish', () => {
        const processingTime = Date.now() - startTime;
        logger.debug('[PriorityMiddleware] 请求处理完成', {
          priority,
          processingTime,
          path: req.path,
        });
      });

      next();
    } catch (error) {
      logger.error('[PriorityMiddleware] 优先级限流检查失败', {
        error,
        path: req.path,
      });
      // 出错时允许通过，避免阻断正常请求
      next();
    }
  };
}

/**
 * 系统负载中间件
 */
export function systemLoadGuard(skipThreshold: 'WARNING' | 'CRITICAL' | 'EMERGENCY' = 'CRITICAL') {
  return (req: Request, res: Response, next: NextFunction) => {
    try {
      const currentLoad = systemPriorityController.getCurrentLoad();

      const skipOrder = ['NORMAL', 'WARNING', 'CRITICAL', 'EMERGENCY'];
      const skipIndex = skipOrder.indexOf(skipThreshold);

      if (currentLoad.level === 'EMERGENCY' && skipIndex < 3) {
        return res.status(503).json({
          code: 'SYSTEM_OVERLOAD',
          message: '系统负载过高，暂时无法处理请求',
          data: {
            currentLoad: currentLoad.level,
            cpu: currentLoad.cpu,
            memory: currentLoad.memory,
          },
          timestamp: Date.now(),
        });
      }

      next();
    } catch (error) {
      logger.error('[PriorityMiddleware] 系统负载检查失败', error);
      next();
    }
  };
}

export default {
  priorityRateLimit,
  systemLoadGuard,
  getPriorityStats,
};