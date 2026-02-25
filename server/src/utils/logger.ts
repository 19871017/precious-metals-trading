export enum LogLevel {
  DEBUG = 0,
  INFO = 1,
  WARN = 2,
  ERROR = 3,
  FATAL = 4
}

export class Logger {
  private level: LogLevel;
  private name: string;

  constructor(name: string, level: LogLevel = LogLevel.INFO) {
    this.name = name;
    this.level = level;
  }

  setLevel(level: LogLevel) {
    this.level = level;
  }

  private formatMessage(level: string, message: string): string {
    const timestamp = new Date().toISOString();
    return `[${timestamp}] [${level}] [${this.name}] ${message}`;
  }

  debug(message: string, ...args: any[]) {
    if (this.level <= LogLevel.DEBUG) {
      console.debug(this.formatMessage('DEBUG', message), ...args);
    }
  }

  info(message: string, ...args: any[]) {
    if (this.level <= LogLevel.INFO) {
      console.info(this.formatMessage('INFO', message), ...args);
    }
  }

  warn(message: string, ...args: any[]) {
    if (this.level <= LogLevel.WARN) {
      console.warn(this.formatMessage('WARN', message), ...args);
    }
  }

  error(message: string, error?: Error, ...args: any[]) {
    if (this.level <= LogLevel.ERROR) {
      if (error) {
        console.error(this.formatMessage('ERROR', message), error.stack, ...args);
      } else {
        console.error(this.formatMessage('ERROR', message), ...args);
      }
    }
  }

  fatal(message: string, error?: Error, ...args: any[]) {
    if (this.level <= LogLevel.FATAL) {
      if (error) {
        console.error(this.formatMessage('FATAL', message), error.stack, ...args);
      } else {
        console.error(this.formatMessage('FATAL', message), ...args);
      }
    }
  }
}

// 创建全局日志实例
export const globalLogger = new Logger('App', LogLevel.INFO);

// 默认导出，方便使用
export default new Logger('App', LogLevel.INFO);
