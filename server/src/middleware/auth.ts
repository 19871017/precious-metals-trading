import jwt from 'jsonwebtoken';
import logger from '../utils/logger';
import { ErrorCode, createErrorResponse } from '../utils/error-codes';
import { getJWTSecret } from '../config/app.config';

/**
 * 获取用户ID的辅助函数
 * 支持从JWT token中提取的多种可能字段
 */
export function getUserIdFromToken(decoded: any): number {
  // 支持多种可能的userId字段名
  return decoded.userId || decoded.id || decoded.user_id;
}

/**
 * JWT认证中间件工厂函数
 * 验证用户身份并提取用户信息到请求对象
 */
export function createAuthMiddleware(options: { required?: boolean } = {}) {
  const { required = true } = options;
  const JWT_SECRET = getJWTSecret();

  return (req: any, res: any, next: any) => {
    try {
      const authHeader = req.headers.authorization;

      if (!authHeader || !authHeader.startsWith('Bearer ')) {
        if (!required) {
          next();
          return;
        }
        return res.status(401).json(createErrorResponse(ErrorCode.TOKEN_MISSING));
      }

      const token = authHeader.substring(7);

      if (!JWT_SECRET) {
        logger.error('[AuthMiddleware] JWT_SECRET未配置');
        return res.status(500).json(createErrorResponse(ErrorCode.INTERNAL_ERROR, '服务器配置错误'));
      }

      try {
        const decoded = jwt.verify(token, JWT_SECRET) as any;
        // 统一设置userId和user对象
        req.userId = getUserIdFromToken(decoded);
        req.user = decoded;
        next();
      } catch (jwtError) {
        const errorMessage = jwtError instanceof Error ? jwtError.message : '验证失败';
        logger.warn(`[AuthMiddleware] JWT验证失败: ${errorMessage}`);
        const isExpired = (jwtError as any).name === 'TokenExpiredError';
        return res.status(401).json(
          createErrorResponse(isExpired ? ErrorCode.TOKEN_EXPIRED : ErrorCode.TOKEN_INVALID)
        );
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : '认证失败';
      logger.error('[AuthMiddleware] 认证中间件错误:', errorMessage);
      return res.status(500).json(createErrorResponse(ErrorCode.INTERNAL_ERROR, errorMessage));
    }
  };
}

/**
 * 默认认证中间件（必须认证）
 */
export const authenticateUser = createAuthMiddleware({ required: true });

/**
 * 可选认证中间件（可选认证）
 */
export const optionalAuth = createAuthMiddleware({ required: false });

/**
 * 扩展Express类型
 */
declare global {
  namespace Express {
    interface Request {
      userId?: number;
      user?: any;
    }
  }
}
