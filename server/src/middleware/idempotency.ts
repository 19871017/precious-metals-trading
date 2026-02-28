import { Request, Response, NextFunction } from 'express';
import redis from '../utils/redis';
import logger from '../utils/logger';
import { ErrorCode, createErrorResponse } from '../utils/error-codes';

export interface IdempotencyOptions {
  keyGenerator?: (req: Request) => string;
  ttl?: number; // 幂等键的过期时间（秒）
  skipHeader?: string; // 跳过幂等检查的请求头
}

export interface IdempotencyResult {
  success: boolean;
  cachedResponse?: any;
  key?: string;
}

const DEFAULT_TTL = 3600; // 1小时

/**
 * 生成幂等性键
 */
function generateIdempotencyKey(req: Request): string {
  const idempotencyKey = req.headers['idempotency-key'] as string;
  
  if (idempotencyKey) {
    return `idempotency:${req.userId || 'anonymous'}:${idempotencyKey}`;
  }
  
  const method = req.method;
  const path = req.path;
  const userId = (req as any).userId || 'anonymous';
  const bodyHash = JSON.stringify(req.body || {});
  
  return `idempotency:${userId}:${method}:${path}:${Buffer.from(bodyHash).toString('base64')}`;
}

/**
 * 幂等性中间件
 */
export function idempotency(options: IdempotencyOptions = {}) {
  const {
    keyGenerator,
    ttl = DEFAULT_TTL,
    skipHeader = 'x-skip-idempotency',
  } = options;

  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      const skip = req.headers[skipHeader];
      if (skip) {
        logger.debug('[Idempotency] 幂等性检查被跳过', { skipHeader });
        return next();
      }

      const key = keyGenerator ? keyGenerator(req) : generateIdempotencyKey(req);
      
      logger.debug('[Idempotency] 检查幂等性键', { key });

      const cachedResult = await redis.get(key);

      if (cachedResult) {
        logger.info('[Idempotency] 命中缓存，返回已存储的响应', { key });
        
        const cachedData = JSON.parse(cachedResult);
        
        return res.status(cachedData.statusCode || 200).json(cachedData.body);
      }

      const originalJson = res.json.bind(res);
      const originalSend = res.send.bind(res);
      const originalStatus = res.status.bind(res);
      let responseData: any;
      let statusCode: number = 200;

      res.json = function (data: any) {
        responseData = data;
        return originalJson(data);
      };

      res.send = function (data: any) {
        responseData = data;
        return originalSend(data);
      };

      res.status = function (code: number) {
        statusCode = code;
        return originalStatus(code);
      };

      res.on('finish', async () => {
        if (responseData && statusCode >= 200 && statusCode < 300) {
          try {
            const cacheData = {
              statusCode,
              body: responseData,
              timestamp: Date.now(),
            };

            await redis.set(key, JSON.stringify(cacheData), 'EX', ttl);
            
            logger.debug('[Idempotency] 响应已缓存', { key, ttl });
          } catch (error) {
            logger.error('[Idempotency] 缓存响应失败', { key, error });
          }
        }
      });

      next();
    } catch (error) {
      logger.error('[Idempotency] 中间件错误', { error });
      next();
    }
  };
}

/**
 * 保存幂等性结果
 */
export async function saveIdempotencyResult(
  key: string,
  response: any,
  ttl: number = DEFAULT_TTL
): Promise<void> {
  try {
    const cacheData = {
      statusCode: 200,
      body: response,
      timestamp: Date.now(),
    };

    await redis.set(key, JSON.stringify(cacheData), 'EX', ttl);
    
    logger.debug('[Idempotency] 结果已保存', { key, ttl });
  } catch (error) {
    logger.error('[Idempotency] 保存结果失败', { key, error });
    throw error;
  }
}

/**
 * 检查幂等性
 */
export async function checkIdempotency(
  key: string
): Promise<IdempotencyResult> {
  try {
    const cachedResult = await redis.get(key);

    if (cachedResult) {
      logger.debug('[Idempotency] 命中缓存', { key });
      
      return {
        success: false,
        cachedResponse: JSON.parse(cachedResult),
        key,
      };
    }

    return {
      success: true,
      key,
    };
  } catch (error) {
    logger.error('[Idempotency] 检查失败', { key, error });
    throw error;
  }
}

/**
 * 删除幂等性缓存
 */
export async function clearIdempotency(key: string): Promise<void> {
  try {
    await redis.del(key);
    logger.debug('[Idempotency] 缓存已清除', { key });
  } catch (error) {
    logger.error('[Idempotency] 清除缓存失败', { key, error });
    throw error;
  }
}

/**
 * 生成业务ID
 */
export function generateBusinessId(prefix: string = 'BIZ'): string {
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).substring(2, 11);
  return `${prefix}${timestamp}${random}`.toUpperCase();
}