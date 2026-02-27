import logger from './logger';

/**
 * 系统配置
 * 提供全局配置访问,确保配置一致性
 */

/**
 * 获取JWT密钥
 * 如果未配置或强度不足,会抛出错误
 */
export function getJWTSecret(): string {
  const JWT_SECRET = process.env.JWT_SECRET;

  if (!JWT_SECRET) {
    logger.error('JWT_SECRET未配置,请在环境变量中设置强随机密钥(至少64字符)');
    throw new Error('JWT_SECRET_NOT_CONFIGURED');
  }

  if (JWT_SECRET.length < 32) {
    logger.error(`JWT_SECRET长度不足(${JWT_SECRET.length}字符),请至少32字符`);
    throw new Error('JWT_SECRET_TOO_SHORT');
  }

  if (JWT_SECRET.length < 64) {
    logger.warn(`JWT_SECRET长度仅为${JWT_SECRET.length}字符,建议使用64字符以上以增强安全性`);
  }

  return JWT_SECRET;
}

/**
 * JWT Token过期时间配置
 */
export const JWT_CONFIG = {
  ACCESS_TOKEN_EXPIRE: process.env.JWT_ACCESS_TOKEN_EXPIRE || '15m',
  REFRESH_TOKEN_EXPIRE: process.env.JWT_REFRESH_TOKEN_EXPIRE || '7d'
};

/**
 * 数海API配置
 */
export const SHUHAI_CONFIG = {
  USERNAME: process.env.SHUHAI_USERNAME,
  PASSWORD: process.env.SHUHAI_PASSWORD
};

/**
 * 验证数海API配置
 */
export function validateShuhaiConfig(): boolean {
  if (!SHUHAI_CONFIG.USERNAME || !SHUHAI_CONFIG.PASSWORD) {
    logger.warn('数海API配置缺失,行情数据可能无法获取');
    return false;
  }

  if (SHUHAI_CONFIG.USERNAME === 'your_shuhai_username' || 
      SHUHAI_CONFIG.PASSWORD === 'your_shuhai_password') {
    logger.warn('数海API使用默认配置,请修改为实际账号');
    return false;
  }

  return true;
}

/**
 * 验证系统配置
 * 在服务启动时调用
 */
export function validateConfig(): void {
  try {
    // 验证JWT密钥
    getJWTSecret();

    // 验证数海API配置
    validateShuhaiConfig();

    logger.info('系统配置验证通过');
  } catch (error: any) {
    logger.error('系统配置验证失败:', error.message);
    throw error;
  }
}

/**
 * 数据库配置
 */
export const DB_CONFIG = {
  HOST: process.env.DB_HOST || 'localhost',
  PORT: parseInt(process.env.DB_PORT || '5432'),
  NAME: process.env.DB_NAME,
  USER: process.env.DB_USER,
  PASSWORD: process.env.DB_PASSWORD
};

/**
 * Redis配置
 */
export const REDIS_CONFIG = {
  HOST: process.env.REDIS_HOST || 'localhost',
  PORT: parseInt(process.env.REDIS_PORT || '6379'),
  PASSWORD: process.env.REDIS_PASSWORD
};

/**
 * 服务器配置
 */
export const SERVER_CONFIG = {
  PORT: parseInt(process.env.PORT || '3001'),
  NODE_ENV: process.env.NODE_ENV || 'development',
  CLIENT_URL: process.env.CLIENT_URL || 'http://localhost:5173'
};

/**
 * 安全配置
 */
export const SECURITY_CONFIG = {
  MIN_PASSWORD_LENGTH: 6,
  MAX_LOGIN_ATTEMPTS: 3,
  LOGIN_LOCK_TIME: 15 * 60 * 1000, // 15分钟
  VERIFY_CODE_LENGTH: 8,
  VERIFY_CODE_EXPIRE: 5 * 60, // 5分钟
  VERIFY_CODE_LIMIT: 3,
  VERIFY_CODE_WINDOW: 60 // 秒
};

/**
 * 交易配置
 */
export const TRADING_CONFIG = {
  MIN_LEVERAGE: 1,
  MAX_LEVERAGE: 200,
  MIN_LOT_SIZE: 0.01,
  MAX_LOT_SIZE: 10000,
  MIN_DEPOSIT_AMOUNT: 10,
  MIN_WITHDRAW_AMOUNT: 100,
  MAX_DAILY_WITHDRAW: 10000
};

/**
 * 日志配置
 */
export const LOG_CONFIG = {
  LEVEL: process.env.LOG_LEVEL || 'info',
  DIR: process.env.LOG_DIR || './logs'
};
