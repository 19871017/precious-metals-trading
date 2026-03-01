import { Request, Response, NextFunction } from 'express';
import logger from '../utils/logger';
import { degradationService } from '../services/DegradationService';
import { createErrorResponse, ErrorCode } from '../utils/error-codes';

// ============================================
// 接口降级中间件
// ============================================

/**
 * 接口降级检查中间件
 * @param interfacePath 接口路径
 */
export function checkDegradation(interfacePath: string) {
  return (req: Request, res: Response, next: NextFunction) => {
    try {
      // 检查接口是否降级
      const isDegraded = degradationService.isInterfaceDegraded(
        interfacePath
      );

      if (isDegraded) {
        logger.warn(
          `[DegradationMiddleware] 接口已降级: ${interfacePath}`
        );

        // 返回降级响应
        return res.status(503).json({
          code: 'SERVICE_DEGRADED',
          message: '服务暂时降级，请稍后再试',
          data: {
            interface: interfacePath,
            reason: '系统负载过高，该接口已暂时降级',
          },
          timestamp: Date.now(),
        });
      }

      // 接口正常，继续处理
      next();
    } catch (error) {
      logger.error(
        `[DegradationMiddleware] 检查接口降级失败: ${interfacePath}`,
        error
      );
      next();
    }
  };
}

// ============================================
// 降级响应辅助函数
// ============================================

/**
 * 返回降级响应
 */
export function sendDegradedResponse(
  res: Response,
  interfacePath: string
): void {
  res.status(503).json({
    code: 'SERVICE_DEGRADED',
    message: '服务暂时降级，请稍后再试',
    data: {
      interface: interfacePath,
      reason: '系统负载过高，该接口已暂时降级',
    },
    timestamp: Date.now(),
  });
}

/**
 * 返回核心接口正常响应
 */
export function sendCriticalInterfaceResponse(
  res: Response,
  data: any,
  message: string = 'success'
): void {
  res.json({
    code: 0,
    message,
    data,
    timestamp: Date.now(),
  });
}
