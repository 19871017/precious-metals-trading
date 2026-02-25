/**
 * 前端日志工具
 * 生产环境禁用debug级别日志
 */

const isProduction = import.meta.env.MODE === 'production';

interface Logger {
  debug: (...args: any[]) => void;
  info: (...args: any[]) => void;
  warn: (...args: any[]) => void;
  error: (...args: any[]) => void;
}

const logger: Logger = {
  /**
   * 调试日志 - 生产环境不输出
   */
  debug: (...args: any[]) => {
    if (!isProduction) {
      console.log('[DEBUG]', ...args);
    }
  },

  /**
   * 信息日志 - 生产环境输出
   */
  info: (...args: any[]) => {
    console.info('[INFO]', ...args);
  },

  /**
   * 警告日志 - 始终输出
   */
  warn: (...args: any[]) => {
    console.warn('[WARN]', ...args);
  },

  /**
   * 错误日志 - 始终输出并上报到错误追踪系统
   */
  error: (...args: any[]) => {
    console.error('[ERROR]', ...args);
    // TODO: 生产环境上报到Sentry等错误追踪系统
  },
};

export default logger;
