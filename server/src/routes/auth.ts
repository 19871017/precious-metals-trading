import express from 'express';
import { v4 as uuidv4 } from 'uuid';
import logger from '../utils/logger';
import redis from '../utils/redis';
import { getJWTSecret, SECURITY_CONFIG } from '../config/app.config';
import { validateCSRF } from '../middleware/csrf';
import {
  register,
  login,
  refreshToken,
  getUserById,
  resetPassword,
  generateReferralCode
} from '../services/auth.service';

const router = express.Router();

// 登录失败次数记录（生产环境应使用Redis）
const loginAttempts = new Map<string, { count: number; lastAttempt: number; lockedUntil?: number }>();

// 验证码请求限制: 同一邮箱1分钟内最多3次
const VERIFY_CODE_LIMIT = SECURITY_CONFIG.VERIFY_CODE_LIMIT;
const VERIFY_CODE_WINDOW = SECURITY_CONFIG.VERIFY_CODE_WINDOW;
const VERIFICATION_CODE_EXPIRE = SECURITY_CONFIG.VERIFY_CODE_EXPIRE;

// 验证码请求次数记录
const verifyCodeAttempts = new Map<string, { count: number; firstAttempt: number }>();

// 检查IP是否被锁定
function isIpLocked(ip: string): boolean {
  const attempt = loginAttempts.get(ip);
  if (!attempt) return false;

  // 检查是否在锁定时间内
  if (attempt.lockedUntil && Date.now() < attempt.lockedUntil) {
    return true;
  }

  // 超过15分钟,重置计数
  if (Date.now() - attempt.lastAttempt > 15 * 60 * 1000) {
    loginAttempts.delete(ip);
    return false;
  }

  return false;
}

// 记录登录失败
function recordFailedAttempt(ip: string) {
  const attempt = loginAttempts.get(ip) || { count: 0, lastAttempt: 0 };

  attempt.count++;
  attempt.lastAttempt = Date.now();

  // 失败3次锁定15分钟
  if (attempt.count >= 3) {
    attempt.lockedUntil = Date.now() + 15 * 60 * 1000;
    logger.warn(`[Auth] IP ${ip} 已被锁定15分钟`);
  }

  loginAttempts.set(ip, attempt);

  return {
    remainingAttempts: Math.max(0, 3 - attempt.count),
    lockedUntil: attempt.lockedUntil
  };
}

// 清除登录失败记录
function clearLoginAttempts(ip: string) {
  loginAttempts.delete(ip);
}

// 用户登录
router.post('/login', validateCSRF, async (req: express.Request, res: express.Response) => {
  try {
    const { username, password } = req.body;

    // 获取客户端IP
    const clientIp = (req.headers['x-forwarded-for'] as string) || req.socket.remoteAddress || 'unknown';

    if (!username || !password) {
      return res.json({
        code: 400,
        message: '用户名和密码不能为空',
        data: null,
        timestamp: Date.now()
      });
    }

    // 检查IP是否被锁定
    if (isIpLocked(clientIp)) {
      const attempt = loginAttempts.get(clientIp);
      const remainingTime = Math.ceil((attempt!.lockedUntil! - Date.now()) / 60000);
      return res.status(429).json({
        code: 429,
        message: `登录失败次数过多,请${remainingTime}分钟后再试`,
        data: {
          locked: true,
          remainingTime
        },
        timestamp: Date.now()
      });
    }

    // 调用认证服务
    const result = await login({
      username,
      password,
      ip_address: clientIp,
      user_agent: req.headers['user-agent']
    });

    // 清除登录失败记录
    clearLoginAttempts(clientIp);

    logger.info(`用户登录成功: ${username} from ${clientIp}`);

    res.json({
      code: 0,
      message: '登录成功',
      data: {
        access_token: result.access_token,
        refresh_token: result.refresh_token,
        expires_in: result.expires_in,
        user: result.user
      },
      timestamp: Date.now()
    });
  } catch (error: any) {
    const clientIp = (req.headers['x-forwarded-for'] as string) || req.socket.remoteAddress || 'unknown';

    // 记录登录失败
    const attempt = recordFailedAttempt(clientIp);
    const remainingAttempts = attempt.remainingAttempts;
    const isLocked = attempt.lockedUntil && attempt.lockedUntil > Date.now();

    logger.error('[Auth] 登录错误:', error.message);

    if (isLocked) {
      const remainingTime = Math.ceil((attempt.lockedUntil! - Date.now()) / 60000);
      return res.status(429).json({
        code: 429,
        message: `登录失败次数过多,请${remainingTime}分钟后再试`,
        data: {
          locked: true,
          remainingTime
        },
        timestamp: Date.now()
      });
    }

    return res.status(401).json({
      code: 401,
      message: error.message || '用户名或密码错误',
      data: {
        remainingAttempts
      },
      timestamp: Date.now()
    });
  }
});

// 用户注册
router.post('/register', validateCSRF, async (req: express.Request, res: express.Response) => {
  try {
    const { username, password, phone, email, referral_code } = req.body;

    if (!username || !password) {
      return res.json({
        code: 400,
        message: '用户名和密码不能为空',
        data: null,
        timestamp: Date.now()
      });
    }

    if (username.length < 3) {
      return res.json({
        code: 400,
        message: '用户名至少3个字符',
        data: null,
        timestamp: Date.now()
      });
    }

    if (password.length < SECURITY_CONFIG.MIN_PASSWORD_LENGTH) {
      return res.json({
        code: 400,
        message: `密码至少${SECURITY_CONFIG.MIN_PASSWORD_LENGTH}个字符`,
        data: null,
        timestamp: Date.now()
      });
    }

    // 调用认证服务注册
    const user = await register({
      username,
      password,
      phone,
      email,
      referral_code
    });

    logger.info(`新用户注册: ${username}`);

    res.json({
      code: 0,
      message: '注册成功',
      data: {
        id: user.id,
        username: user.username
      },
      timestamp: Date.now()
    });
  } catch (error: any) {
    logger.error('[Auth] 注册错误:', error.message);
    res.status(400).json({
      code: 400,
      message: error.message || '注册失败',
      data: null,
      timestamp: Date.now()
    });
  }
});

// 获取当前用户信息
router.get('/me', async (req: express.Request, res: express.Response) => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.json({
        code: 401,
        message: '未授权',
        data: null,
        timestamp: Date.now()
      });
    }

    const token = authHeader.substring(7);

    // 验证JWT Token
    const jwt = require('jsonwebtoken');
    const JWT_SECRET = getJWTSecret();

    const decoded = jwt.verify(token, JWT_SECRET) as any;

    if (!decoded.user_id) {
      return res.json({
        code: 404,
        message: '用户不存在',
        data: null,
        timestamp: Date.now()
      });
    }

    const user = await getUserById(decoded.user_id);

    if (!user) {
      return res.json({
        code: 404,
        message: '用户不存在',
        data: null,
        timestamp: Date.now()
      });
    }

    res.json({
      code: 0,
      message: '获取成功',
      data: user,
      timestamp: Date.now()
    });
  } catch (error: any) {
    logger.error('[Auth] 获取用户信息错误:', error.message);
    res.json({
      code: 401,
      message: error.name === 'TokenExpiredError' ? 'Token已过期' : 'Token无效',
      data: null,
      timestamp: Date.now()
    });
  }
});

// 刷新Token
router.post('/refresh', async (req: express.Request, res: express.Response) => {
  try {
    const { refresh_token } = req.body;

    if (!refresh_token) {
      return res.json({
        code: 400,
        message: 'Refresh Token不能为空',
        data: null,
        timestamp: Date.now()
      });
    }

    const result = await refreshToken(refresh_token);

    res.json({
      code: 0,
      message: '刷新成功',
      data: {
        access_token: result.access_token,
        refresh_token: result.refresh_token,
        expires_in: result.expires_in,
        user: result.user
      },
      timestamp: Date.now()
    });
  } catch (error: any) {
    logger.error('[Auth] 刷新Token错误:', error.message);
    res.json({
      code: 401,
      message: error.message || 'Token无效或已过期',
      data: null,
      timestamp: Date.now()
    });
  }
});

// 登出
router.post('/logout', (req: express.Request, res: express.Response) => {
  res.json({
    code: 0,
    message: '退出成功',
    data: null,
    timestamp: Date.now()
  });
});

// 发送邮箱验证码
router.post('/send-code', async (req: express.Request, res: express.Response) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.json({
        code: 400,
        message: '邮箱不能为空',
        data: null,
        timestamp: Date.now()
      });
    }

    // 验证邮箱格式
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.json({
        code: 400,
        message: '邮箱格式不正确',
        data: null,
        timestamp: Date.now()
      });
    }

    // 检查请求频率
    const now = Date.now();
    const attempt = verifyCodeAttempts.get(email);

    if (attempt) {
      if (now - attempt.firstAttempt < VERIFY_CODE_WINDOW * 1000) {
        if (attempt.count >= VERIFY_CODE_LIMIT) {
          return res.json({
            code: 429,
            message: `验证码请求过于频繁,请${Math.ceil((VERIFY_CODE_WINDOW - (now - attempt.firstAttempt) / 1000))}秒后再试`,
            data: null,
            timestamp: Date.now()
          });
        }
        attempt.count++;
      } else {
        // 超过时间窗口,重置计数
        attempt.count = 1;
        attempt.firstAttempt = now;
      }
    } else {
      verifyCodeAttempts.set(email, { count: 1, firstAttempt: now });
    }

    // 生成8位验证码(数字+字母)
    const chars = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ';
    let code = '';
    for (let i = 0; i < SECURITY_CONFIG.VERIFY_CODE_LENGTH; i++) {
      code += chars.charAt(Math.floor(Math.random() * chars.length));
    }

    // 存储到Redis(5分钟过期)
    const key = `verify_code:${email}`;
    try {
      await redis.set(key, code, 'EX', VERIFICATION_CODE_EXPIRE);
    } catch (redisError) {
      logger.error('[Auth] Redis存储验证码失败:', redisError);
    }

    // 生产环境应该发送实际邮件
    logger.info(`[Auth] 验证码已发送到 ${email}: ${code}`);

    res.json({
      code: 0,
      message: '验证码已发送',
      data: {
        email,
        expiresIn: VERIFICATION_CODE_EXPIRE
      },
      timestamp: Date.now()
    });
  } catch (error: any) {
    logger.error('[Auth] 发送验证码失败:', error.message);
    res.json({
      code: 500,
      message: '发送验证码失败',
      data: null,
      timestamp: Date.now()
    });
  }
});

// 重置密码
router.post('/reset-password', validateCSRF, async (req: express.Request, res: express.Response) => {
  try {
    const { email, code, newPassword } = req.body;

    if (!email || !code || !newPassword) {
      return res.json({
        code: 400,
        message: '邮箱、验证码和新密码不能为空',
        data: null,
        timestamp: Date.now()
      });
    }

    // 验证密码强度
    if (newPassword.length < SECURITY_CONFIG.MIN_PASSWORD_LENGTH) {
      return res.json({
        code: 400,
        message: `密码长度至少${SECURITY_CONFIG.MIN_PASSWORD_LENGTH}位`,
        data: null,
        timestamp: Date.now()
      });
    }

    // 从Redis获取验证码
    const key = `verify_code:${email}`;
    let storedCode: string | null = null;

    try {
      storedCode = await redis.get(key);
    } catch (redisError) {
      logger.error('[Auth] Redis获取验证码失败:', redisError);
    }

    if (!storedCode) {
      return res.json({
        code: 400,
        message: '验证码已过期或不存在',
        data: null,
        timestamp: Date.now()
      });
    }

    if (storedCode !== code) {
      return res.json({
        code: 400,
        message: '验证码错误',
        data: null,
        timestamp: Date.now()
      });
    }

    // 查找用户
    const { query } = await import('../config/database');
    const userResult = await query(
      'SELECT username FROM users WHERE email = $1',
      [email]
    );

    if (userResult.rows.length === 0) {
      return res.json({
        code: 404,
        message: '用户不存在',
        data: null,
        timestamp: Date.now()
      });
    }

    const username = userResult.rows[0].username;

    // 重置密码
    await resetPassword(username, newPassword);

    // 清除验证码
    try {
      await redis.del(key);
    } catch (redisError) {
      logger.error('[Auth] Redis删除验证码失败:', redisError);
    }

    // 清除请求次数记录
    verifyCodeAttempts.delete(email);

    logger.info(`密码重置成功: ${username}`);

    res.json({
      code: 0,
      message: '密码重置成功',
      data: null,
      timestamp: Date.now()
    });
  } catch (error: any) {
    logger.error('[Auth] 重置密码失败:', error.message);
    res.json({
      code: 500,
      message: error.message || '重置密码失败',
      data: null,
      timestamp: Date.now()
    });
  }
});

// 获取CSRF Token
router.get('/csrf-token', (req: express.Request, res: express.Response) => {
  const { getCSRFToken } = require('../middleware/csrf');
  getCSRFToken(req, res);
});

// 生成推荐码
router.post('/generate-referral', async (req: express.Request, res: express.Response) => {
  try {
    const code = generateReferralCode();

    res.json({
      code: 0,
      message: '生成成功',
      data: { code },
      timestamp: Date.now()
    });
  } catch (error: any) {
    logger.error('[Auth] 生成推荐码失败:', error.message);
    res.json({
      code: 500,
      message: '生成推荐码失败',
      data: null,
      timestamp: Date.now()
    });
  }
});

export default router;
