import logger from '../utils/logger';
import { query } from '../config/database';
import redis from '../utils/redis';
import { systemPriorityController } from './SystemPriorityController';

// ============================================
// 系统降级机制配置
// ============================================

export interface DegradationConfig {
  cpuThreshold: number; // CPU 阈值 (%）
  orderLatencyThreshold: number; // 订单延迟阈值 (ms)
  checkInterval: number; // 检测间隔 (ms)
  degradedInterfaces: string[]; // 降级接口列表
  criticalInterfaces: string[]; // 核心接口列表（不降级）
}

export const DEFAULT_DEGRADATION_CONFIG: DegradationConfig = {
  cpuThreshold: 80, // CPU > 80% 触发降级
  orderLatencyThreshold: 300, // 订单延迟 > 300ms 触发降级
  checkInterval: 5000, // 每 5 秒检测一次
  degradedInterfaces: [
    // 历史记录查询
    '/api/order/history',
    '/api/position/history',
    '/api/trade/history',
    // 资产统计刷新
    '/api/account/balance',
    '/api/account/equity',
    '/api/account/assets',
    '/portfolio',
    // 代理报表
    '/api/agent/reports',
    '/api/agent/statistics',
    '/api/agent/performance',
  ],
  criticalInterfaces: [
    // 核心交易接口
    '/api/order/create',
    '/api/order/close',
    '/api/order/modify',
    '/api/order/cancel',
    // 风控接口
    '/risk',
    '/liquidation',
    // 系统监控接口
    '/health',
    '/system/load',
  ],
};

// ============================================
// 降级状态
// ============================================

export enum DegradationLevel {
  NORMAL = 'NORMAL', // 正常
  DEGRADED = 'DEGRADED', // 已降级
  CRITICAL = 'CRITICAL', // 严重
}

// ============================================
// 系统降级机制服务
// ============================================

export class DegradationService {
  private config: DegradationConfig;
  private isRunning: boolean = false;
  private currentLevel: DegradationLevel = DegradationLevel.NORMAL;
  private checkTimer?: NodeJS.Timeout;
  private interfaceStatus: Map<string, boolean> = new Map();
  private startTime?: number;

  constructor(config?: Partial<DegradationConfig>) {
    this.config = {
      ...DEFAULT_DEGRADATION_CONFIG,
      ...config,
    };
  }

  /**
   * 启动系统降级机制
   */
  async start(): Promise<void> {
    if (this.isRunning) {
      logger.warn('[DegradationService] 系统降级机制已在运行');
      return;
    }

    try {
      logger.info('[DegradationService] 启动系统降级机制', {
        cpuThreshold: this.config.cpuThreshold,
        orderLatencyThreshold: this.config.orderLatencyThreshold,
        checkInterval: this.config.checkInterval,
      });

      // 初始化接口状态
      this.initializeInterfaceStatus();

      // 启动检测循环
      this.checkTimer = setInterval(async () => {
        await this.checkLoop();
      }, this.config.checkInterval);

      this.isRunning = true;

      logger.info('[DegradationService] 系统降级机制启动成功');
    } catch (error) {
      logger.error('[DegradationService] 启动系统降级机制失败', error);
      throw error;
    }
  }

  /**
   * 停止系统降级机制
   */
  async stop(): Promise<void> {
    if (!this.isRunning) {
      logger.warn('[DegradationService] 系统降级机制未运行');
      return;
    }

    try {
      logger.info('[DegradationService] 停止系统降级机制');

      // 恢复所有接口
      await this.recoverAllInterfaces();

      if (this.checkTimer) {
        clearInterval(this.checkTimer);
        this.checkTimer = undefined;
      }

      this.isRunning = false;
      this.currentLevel = DegradationLevel.NORMAL;

      logger.info('[DegradationService] 系统降级机制已停止');
    } catch (error) {
      logger.error('[DegradationService] 停止系统降级机制失败', error);
      throw error;
    }
  }

  /**
   * 初始化接口状态
   */
  private initializeInterfaceStatus(): void {
    this.config.degradedInterfaces.forEach((interfacePath) => {
      this.interfaceStatus.set(interfacePath, true); // true = 正常，false = 降级
    });

    logger.debug(
      `[DegradationService] 接口状态已初始化: ${this.interfaceStatus.size} 个接口`
    );
  }

  /**
   * 检测循环
   */
  private async checkLoop(): Promise<void> {
    try {
      // 1. 获取 CPU 使用率
      const cpuUsage = await this.getCPUUsage();

      // 2. 获取订单延迟
      const orderLatency = await this.getOrderLatency();

      // 3. 判断是否触发降级
      const shouldDegrade =
        cpuUsage > this.config.cpuThreshold ||
        orderLatency > this.config.orderLatencyThreshold;

      logger.debug(
        `[DegradationService] 检测结果: CPU=${cpuUsage.toFixed(2)}%, OrderLatency=${orderLatency.toFixed(2)}ms, ShouldDegrade=${shouldDegrade}`
      );

      if (shouldDegrade && this.currentLevel === DegradationLevel.NORMAL) {
        // 触发降级
        await this.triggerDegradation(cpuUsage, orderLatency);
      } else if (
        !shouldDegrade &&
        this.currentLevel === DegradationLevel.DEGRADED
      ) {
        // 恢复正常
        await this.recoverFromDegradation();
      }

      // 记录当前状态到 Redis
      await this.recordStatusToRedis(cpuUsage, orderLatency);
    } catch (error) {
      logger.error('[DegradationService] 检测循环失败', error);
    }
  }

  /**
   * 触发降级
   */
  private async triggerDegradation(
    cpuUsage: number,
    orderLatency: number
  ): Promise<void> {
    try {
      logger.warn(
        `[DegradationService] 触发系统降级: CPU=${cpuUsage.toFixed(2)}%, OrderLatency=${orderLatency.toFixed(2)}ms`
      );

      // 更新降级级别
      const newLevel =
        cpuUsage > 90 || orderLatency > 500
          ? DegradationLevel.CRITICAL
          : DegradationLevel.DEGRADED;

      this.currentLevel = newLevel;
      this.startTime = Date.now();

      // 暂停非必要接口
      await this.degradeInterfaces();

      // 记录降级事件
      await this.logDegradationEvent('DEGRADATION_TRIGGERED', {
        cpuUsage,
        orderLatency,
        level: newLevel,
        reason: this.getDegradationReason(cpuUsage, orderLatency),
      });

      logger.warn(
        `[DegradationService] 系统已降级: Level=${newLevel}`
      );
    } catch (error) {
      logger.error('[DegradationService] 触发降级失败', error);
    }
  }

  /**
   * 从降级中恢复
   */
  private async recoverFromDegradation(): Promise<void> {
    try {
      logger.info('[DegradationService] 从降级中恢复');

      // 恢复所有接口
      await this.recoverAllInterfaces();

      // 更新降级级别
      const oldLevel = this.currentLevel;
      this.currentLevel = DegradationLevel.NORMAL;
      const duration = this.startTime
        ? Date.now() - this.startTime
        : 0;

      // 记录恢复事件
      await this.logDegradationEvent('DEGRADATION_RECOVERED', {
        previousLevel: oldLevel,
        duration,
      });

      this.startTime = undefined;

      logger.info(
        `[DegradationService] 系统已恢复: PreviousLevel=${oldLevel}, Duration=${duration}ms`
      );
    } catch (error) {
      logger.error('[DegradationService] 从降级中恢复失败', error);
    }
  }

  /**
   * 降级接口
   */
  private async degradeInterfaces(): Promise<void> {
    try {
      logger.info(
        `[DegradationService] 开始降级接口: ${this.config.degradedInterfaces.length} 个接口`
      );

      for (const interfacePath of this.config.degradedInterfaces) {
        // 设置接口为降级状态
        this.interfaceStatus.set(interfacePath, false);

        // 记录到 Redis
        await redis.set(
          `degradation:interface:${interfacePath}`,
          JSON.stringify({
            degraded: true,
            timestamp: Date.now(),
          }),
          'EX',
          300 // 5 分钟过期
        );

        logger.debug(
          `[DegradationService] 接口已降级: ${interfacePath}`
        );
      }

      logger.info(
        `[DegradationService] 所有接口已降级: ${this.config.degradedInterfaces.length} 个`
      );
    } catch (error) {
      logger.error('[DegradationService] 降级接口失败', error);
    }
  }

  /**
   * 恢复所有接口
   */
  private async recoverAllInterfaces(): Promise<void> {
    try {
      logger.info(
        `[DegradationService] 开始恢复所有接口: ${this.interfaceStatus.size} 个接口`
      );

      for (const [interfacePath] of this.interfaceStatus.entries()) {
        // 设置接口为正常状态
        this.interfaceStatus.set(interfacePath, true);

        // 从 Redis 删除
        await redis.del(`degradation:interface:${interfacePath}`);

        logger.debug(
          `[DegradationService] 接口已恢复: ${interfacePath}`
        );
      }

      logger.info(
        `[DegradationService] 所有接口已恢复: ${this.interfaceStatus.size} 个`
      );
    } catch (error) {
      logger.error('[DegradationService] 恢复接口失败', error);
    }
  }

  /**
   * 检查接口是否降级
   */
  isInterfaceDegraded(interfacePath: string): boolean {
    // 检查是否在降级接口列表中
    const isDegraded = this.config.degradedInterfaces.includes(interfacePath);
    if (!isDegraded) {
      return false;
    }

    // 检查当前状态
    const status = this.interfaceStatus.get(interfacePath);
    return status === false;
  }

  /**
   * 获取 CPU 使用率
   */
  private async getCPUUsage(): Promise<number> {
    try {
      // 从系统优先级控制器获取
      const currentLoad = systemPriorityController.getCurrentLoad();
      return currentLoad.cpu;
    } catch (error) {
      logger.error('[DegradationService] 获取 CPU 使用率失败', error);
      return 0;
    }
  }

  /**
   * 获取订单延迟
   */
  private async getOrderLatency(): Promise<number> {
    try {
      // 从 Redis 获取最近的订单延迟
      const latency = await redis.get('order:latency:avg');
      return latency ? parseFloat(latency) : 0;
    } catch (error) {
      logger.error('[DegradationService] 获取订单延迟失败', error);
      return 0;
    }
  }

  /**
   * 记录状态到 Redis
   */
  private async recordStatusToRedis(
    cpuUsage: number,
    orderLatency: number
  ): Promise<void> {
    try {
      const status = {
        level: this.currentLevel,
        cpuUsage,
        orderLatency,
        degradedInterfaces: Array.from(this.interfaceStatus.entries())
          .filter(([_, status]) => !status)
          .map(([path]) => path),
        timestamp: Date.now(),
      };

      await redis.setex(
        'degradation:status',
        60, // 1 分钟过期
        JSON.stringify(status)
      );
    } catch (error) {
      logger.error('[DegradationService] 记录状态到 Redis 失败', error);
    }
  }

  /**
   * 记录降级事件
   */
  private async logDegradationEvent(
    eventType: string,
    details: any
  ): Promise<void> {
    try {
      // 记录到数据库
      await query(`
        INSERT INTO degradation_log (event_type, level, details, created_at)
        VALUES ($1, $2, $3, CURRENT_TIMESTAMP)
      `, [eventType, this.currentLevel, JSON.stringify(details)]);

      logger.info(
        `[DegradationService] 降级事件已记录: type=${eventType}, level=${this.currentLevel}`
      );
    } catch (error) {
      logger.error('[DegradationService] 记录降级事件失败', error);
    }
  }

  /**
   * 获取降级原因
   */
  private getDegradationReason(
    cpuUsage: number,
    orderLatency: number
  ): string {
    const reasons: string[] = [];

    if (cpuUsage > this.config.cpuThreshold) {
      reasons.push(`CPU过高 (${cpuUsage.toFixed(2)}%)`);
    }

    if (orderLatency > this.config.orderLatencyThreshold) {
      reasons.push(`订单延迟过高 (${orderLatency.toFixed(2)}ms)`);
    }

    return reasons.join(', ');
  }

  /**
   * 获取降级服务状态
   */
  getStatus(): {
    isRunning: boolean;
    currentLevel: DegradationLevel;
    config: DegradationConfig;
    degradedInterfaces: string[];
    startTime?: number;
    duration?: number;
  } {
    return {
      isRunning: this.isRunning,
      currentLevel: this.currentLevel,
      config: { ...this.config },
      degradedInterfaces: Array.from(this.interfaceStatus.entries())
        .filter(([_, status]) => !status)
        .map(([path]) => path),
      startTime: this.startTime,
      duration: this.startTime ? Date.now() - this.startTime : undefined,
    };
  }

  /**
   * 获取降级事件历史
   */
  async getDegradationHistory(limit: number = 100): Promise<any[]> {
    try {
      const result = await query(`
        SELECT * FROM degradation_log
        ORDER BY created_at DESC
        LIMIT $1
      `, [limit]);

      return result.rows;
    } catch (error) {
      logger.error('[DegradationService] 获取降级事件历史失败', error);
      return [];
    }
  }

  /**
   * 手动触发降级
   */
  async manualTrigger(reason: string): Promise<void> {
    try {
      logger.warn(
        `[DegradationService] 手动触发降级: reason=${reason}`
      );

      await this.triggerDegradation(100, 1000); // 设置为严重值
    } catch (error) {
      logger.error('[DegradationService] 手动触发降级失败', error);
      throw error;
    }
  }

  /**
   * 手动恢复
   */
  async manualRecover(): Promise<void> {
    try {
      logger.info('[DegradationService] 手动恢复');

      await this.recoverFromDegradation();
    } catch (error) {
      logger.error('[DegradationService] 手动恢复失败', error);
      throw error;
    }
  }

  /**
   * 更新配置
   */
  updateConfig(config: Partial<DegradationConfig>): void {
    this.config = {
      ...this.config,
      ...config,
    };

    logger.info('[DegradationService] 配置已更新', {
      newConfig: this.config,
    });
  }

  /**
   * 确保降级日志表存在
   */
  private async ensureDegradationLogTable(): Promise<void> {
    try {
      await query(`
        CREATE TABLE IF NOT EXISTS degradation_log (
          id SERIAL PRIMARY KEY,
          event_type VARCHAR(50) NOT NULL,
          level VARCHAR(20) NOT NULL,
          details JSONB,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );

        CREATE INDEX IF NOT EXISTS idx_degradation_log_created_at ON degradation_log(created_at DESC);
        CREATE INDEX IF NOT EXISTS idx_degradation_log_level ON degradation_log(level);
      `);

      logger.info('[DegradationService] degradation_log 表已确保存在');
    } catch (error) {
      logger.error('[DegradationService] 创建 degradation_log 表失败', error);
    }
  }
}

// ============================================
// 创建默认实例
// ============================================

export const degradationService = new DegradationService();
