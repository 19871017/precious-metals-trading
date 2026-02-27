import { Request, Response, NextFunction } from 'express';
import crypto from 'crypto';
import logger from '../utils/logger';
import { SECURITY_CONFIG } from '../config/app.config';

/**
 * 扩展Express Request类型,添加csrfToken属性
 */
declare global {
  namespace Express {
    interface Request {
      csrfToken?: string;
    }
  }
}

/**
 * CSRF Token存储
 * 生产环境应使用Redis
 */
const csrfTokens = new Map<string, { token: string; createdAt: number }>();

/**
 * Token有效期(2小时)
 */
const CSRF_TOKEN_EXPIRE = 2 * 60 * 60 * 1000;

/**
 * 生成CSRF Token
 */
function generateToken(): string {
  return crypto.randomBytes(32).toString('hex');
}

/**
 * 生成Session ID
 */
function generateSessionId(): string {
  return crypto.randomBytes(16).toString('hex');
}

/**
 * 获取客户端Session ID
 */
function getSessionId(req: Request): string {
  // 优先使用Cookie中的session_id
  let sessionId = req.cookies?.csrf_session_id;

  // 如果没有,使用User-Agent + IP生成
  if (!sessionId) {
    const ua = req.headers['user-agent'] || '';
    const ip = req.ip || req.socket.remoteAddress || '';
    const hash = crypto.createHash('sha256').update(ua + ip).digest('hex');
    sessionId = hash.substring(0, 32);
  }

  return sessionId;
}

/**
 * CSRF防护中间件 - 生成Token
 */
export function csrfProtection(req: Request, res: Response, next: NextFunction) {
  const sessionId = getSessionId(req);
  const now = Date.now();

  // 检查是否已有有效Token
  const existing = csrfTokens.get(sessionId);
  let token: string;

  if (existing && (now - existing.createdAt < CSRF_TOKEN_EXPIRE)) {
    // Token仍然有效
    token = existing.token;
  } else {
    // 生成新Token
    token = generateToken();
    csrfTokens.set(sessionId, { token, createdAt: now });
  }

  // 将Token附加到request
  req.csrfToken = token;

  // 在响应头中返回Token
  res.setHeader('X-CSRF-Token', token);

  // 清理过期Token(定期执行)
  if (Math.random() < 0.1) {
    cleanupExpiredTokens(now);
  }

  next();
}

/**
 * CSRF验证中间件 - 验证Token
 */
export function validateCSRF(req: Request, res: Response, next: NextFunction) {
  const sessionId = getSessionId(req);
  const receivedToken = req.headers['x-csrf-token'] || req.body?.csrfToken;

  if (!receivedToken) {
    logger.warn('[CSRF] 缺少CSRF Token', { path: req.path, ip: req.ip });
    return res.status(403).json({
      code: 403,
      message: '缺少CSRF Token',
      data: null,
      timestamp: Date.now()
    });
  }

  const stored = csrfTokens.get(sessionId);

  if (!stored) {
    logger.warn('[CSRF] 未找到CSRF Token', { path: req.path, ip: req.ip });
    return res.status(403).json({
      code: 403,
      message: 'CSRF Token无效',
      data: null,
      timestamp: Date.now()
    });
  }

  // 验证Token
  if (stored.token !== receivedToken) {
    logger.warn('[CSRF] CSRF Token不匹配', { path: req.path, ip: req.ip });
    return res.status(403).json({
      code: 403,
      message: 'CSRF Token无效',
      data: null,
      timestamp: Date.now()
    });
  }

  next();
}

/**
 * 清理过期Token
 */
function cleanupExpiredTokens(now: number) {
  const expireTime = now - CSRF_TOKEN_EXPIRE;
  let cleaned = 0;

  for (const [sessionId, data] of csrfTokens.entries()) {
    if (data.createdAt < expireTime) {
      csrfTokens.delete(sessionId);
      cleaned++;
    }
  }

  if (cleaned > 0) {
    logger.debug(`[CSRF] 清理了${cleaned}个过期Token`);
  }
}

/**
 * 获取CSRF Token (API端点)
 */
export function getCSRFToken(req: Request, res: Response) {
  const sessionId = getSessionId(req);
  const now = Date.now();

  let token: string;
  const existing = csrfTokens.get(sessionId);

  if (existing && (now - existing.createdAt < CSRF_TOKEN_EXPIRE)) {
    token = existing.token;
  } else {
    token = generateToken();
    csrfTokens.set(sessionId, { token, createdAt: now });
  }

  res.setHeader('X-CSRF-Token', token);

  res.json({
    code: 0,
    message: '获取成功',
    data: { csrfToken: token },
    timestamp: Date.now()
  });
}

/**
 * 需要CSRF保护的方法
 */
export const CSRF_PROTECTED_METHODS = ['POST', 'PUT', 'DELETE', 'PATCH'];

/**
 * 判断请求是否需要CSRF保护
 */
export function needsCSRFProtection(req: Request): boolean {
  return CSRF_PROTECTED_METHODS.includes(req.method.toUpperCase());
}
