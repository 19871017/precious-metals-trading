import logger from '../utils/logger';
import { query } from '../config/database';
import redis from '../utils/redis';
import { AuditLogService } from './AuditLogService';

// ============================================
// Watchdog 服务配置
// ============================================

export interface WatchdogConfig {
  checkInterval: number; // 检测间隔 (ms)
  orderProcessingThreshold: number; // 订单处理超时阈值 (ms)
  dbLockWaitThreshold: number; // 数据库锁等待超时阈值 (ms)
  redisLatencyThreshold: number; // Redis 延迟超时阈值 (ms)
  enableAutoUpload: boolean; // 是否自动上传到 Git
}

export const DEFAULT_WATCHDOG_CONFIG: WatchdogConfig = {
  checkInterval: 2000, // 2 秒
  orderProcessingThreshold: 5000, // 5 秒
  dbLockWaitThreshold: 1000, // 1 秒
  redisLatencyThreshold: 100, // 100ms
  enableAutoUpload: false, // 默认不自动上传
};

// ============================================
// 阻塞事件类型
// ============================================

export enum BlockEventType {
  ORDER_PROCESSING_SLOW = 'ORDER_PROCESSING_SLOW',
  DB_LOCK_WAIT = 'DB_LOCK_WAIT',
  REDIS_LATENCY_HIGH = 'REDIS_LATENCY_HIGH',
}

// ============================================
// 阻塞事件数据
// ============================================

export interface BlockEventData {
  eventType: BlockEventType;
  timestamp: number;
  threshold: number;
  actualValue: number;
  severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  details: any;
}

// ============================================
// 订单处理统计
// ============================================

export interface OrderProcessingStats {
  orderId: number;
  startTime: number;
  currentPhase: string;
  elapsed: number;
  userId: number;
  productCode?: string;
}

// ============================================
// 数据库锁等待统计
// ============================================

export interface DBLockWaitStats {
  activeLocks: number;
  waitingLocks: number;
  avgLockWaitTime: number;
  maxLockWaitTime: number;
  blockedQueries: any[];
}

// ============================================
// Redis 延迟统计
// ============================================

export interface RedisLatencyStats {
  minLatency: number;
  maxLatency: number;
  avgLatency: number;
  p95Latency: number;
  p99Latency: number;
  errorCount: number;
}

// ============================================
// Watchdog 服务
// ============================================

export class WatchdogService {
  private config: WatchdogConfig;
  private isRunning: boolean = false;
  private checkTimer?: NodeJS.Timeout;
  private activeOrderProcessing: Map<number, OrderProcessingStats> = new Map();
  private redisLatencyHistory: number[] = [];
  private maxRedisLatencyHistory: number = 100;
  private auditLogService: AuditLogService;

  constructor(config?: Partial<WatchdogConfig>) {
    this.config = {
      ...DEFAULT_WATCHDOG_CONFIG,
      ...config,
    };
    this.auditLogService = new AuditLogService();
  }

  /**
   * 启动 Watchdog 服务
   */
  async start(): Promise<void> {
    if (this.isRunning) {
      logger.warn('[WatchdogService] Watchdog 服务已在运行');
      return;
    }

    try {
      logger.info('[WatchdogService] 启动 Watchdog 服务', {
        checkInterval: this.config.checkInterval,
        thresholds: {
          orderProcessing: this.config.orderProcessingThreshold,
          dbLockWait: this.config.dbLockWaitThreshold,
          redisLatency: this.config.redisLatencyThreshold,
        },
      });

      this.checkTimer = setInterval(async () => {
        await this.checkLoop();
      }, this.config.checkInterval);

      this.isRunning = true;

      logger.info('[WatchdogService] Watchdog 服务启动成功');
    } catch (error) {
      logger.error('[WatchdogService] 启动 Watchdog 服务失败', error);
      throw error;
    }
  }

  /**
   * 停止 Watchdog 服务
   */
  async stop(): Promise<void> {
    if (!this.isRunning) {
      logger.warn('[WatchdogService] Watchdog 服务未运行');
      return;
    }

    try {
      logger.info('[WatchdogService] 停止 Watchdog 服务');

      if (this.checkTimer) {
        clearInterval(this.checkTimer);
        this.checkTimer = undefined;
      }

      this.isRunning = false;

      logger.info('[WatchdogService] Watchdog 服务已停止');
    } catch (error) {
      logger.error('[WatchdogService] 停止 Watchdog 服务失败', error);
      throw error;
    }
  }

  /**
   * 检测循环
   */
  private async checkLoop(): Promise<void> {
    try {
      // 1. 检测订单处理耗时
      await this.checkOrderProcessing();

      // 2. 检测数据库锁等待
      await this.checkDBLockWaits();

      // 3. 检测 Redis 延迟
      await this.checkRedisLatency();
    } catch (error) {
      logger.error('[WatchdogService] 检测循环失败', error);
    }
  }

  /**
   * 检测订单处理耗时
   */
  private async checkOrderProcessing(): Promise<void> {
    const now = Date.now();
    const slowOrders: OrderProcessingStats[] = [];

    for (const [orderId, stats] of this.activeOrderProcessing.entries()) {
      stats.elapsed = now - stats.startTime;

      // 检查是否超过阈值
      if (stats.elapsed > this.config.orderProcessingThreshold) {
        const severity = this.calculateSeverity(
          stats.elapsed,
          this.config.orderProcessingThreshold,
          this.config.orderProcessingThreshold * 2
        );

        slowOrders.push(stats);

        logger.warn(
          `[WatchdogService] 订单处理耗时: orderId=${orderId}, elapsed=${stats.elapsed}ms, phase=${stats.currentPhase}, severity=${severity}`
        );

        // 记录阻塞事件
        await this.logBlockEvent({
          eventType: BlockEventType.ORDER_PROCESSING_SLOW,
          timestamp: now,
          threshold: this.config.orderProcessingThreshold,
          actualValue: stats.elapsed,
          severity,
          details: {
            orderId: stats.orderId,
            userId: stats.userId,
            productCode: stats.productCode,
            currentPhase: stats.currentPhase,
            elapsed: stats.elapsed,
          },
        });
      }
    }

    if (slowOrders.length > 0) {
      logger.warn(
        `[WatchdogService] 检测到 ${slowOrders.length} 个慢速订单处理`
      );
    }
  }

  /**
   * 检测数据库锁等待
   */
  private async checkDBLockWaits(): Promise<void> {
    try {
      // 查询 PostgreSQL 锁等待情况
      const lockQuery = `
        SELECT 
          blocked_locks.pid AS blocked_pid,
          blocked_activity.usename AS blocked_user,
          blocking_locks.pid AS blocking_pid,
          blocking_activity.usename AS blocking_user,
          blocked_activity.query AS blocked_statement,
          blocking_activity.query AS current_statement_in_blocking_process,
          blocked_activity.application_name AS blocked_application,
          blocking_activity.application_name AS blocking_application
        FROM pg_catalog.pg_locks blocked_locks
          JOIN pg_catalog.pg_stat_activity blocked_activity ON blocked_activity.pid = blocked_locks.pid
          JOIN pg_catalog.pg_locks blocking_locks 
            ON blocking_locks.locktype = blocked_locks.locktype
            AND blocking_locks.DATABASE IS NOT DISTINCT FROM blocked_locks.DATABASE
            AND blocking_locks.relation IS NOT DISTINCT FROM blocked_locks.relation
            AND blocking_locks.page IS NOT DISTINCT FROM blocked_locks.page
            AND blocking_locks.tuple IS NOT DISTINCT FROM blocked_locks.tuple
            AND blocking_locks.virtualxid IS NOT DISTINCT FROM blocked_locks.virtualxid
            AND blocking_locks.transactionid IS NOT DISTINCT FROM blocked_locks.transactionid
            AND blocking_locks.classid IS NOT DISTINCT FROM blocked_locks.classid
            AND blocking_locks.objid IS NOT DISTINCT FROM blocked_locks.objid
            AND blocking_locks.objsubid IS NOT DISTINCT FROM blocked_locks.objsubid
            AND blocking_locks.pid != blocked_locks.pid
          JOIN pg_catalog.pg_stat_activity blocking_activity ON blocking_activity.pid = blocking_locks.pid
        WHERE NOT blocked_locks.GRANTED
      `;

      const result = await query(lockQuery);
      const blockedQueries = result.rows;

      if (blockedQueries.length === 0) {
        return;
      }

      // 查询锁等待时间
      const lockWaitQuery = `
        SELECT 
          COUNT(*) FILTER (WHERE wait_event_type IS NOT NULL) AS waiting_locks,
          EXTRACT(EPOCH FROM AVG(now() - xact_start)) AS avg_wait_time,
          EXTRACT(EPOCH FROM MAX(now() - xact_start)) AS max_wait_time
        FROM pg_stat_activity 
        WHERE state = 'active'
          AND wait_event_type IS NOT NULL
      `;

      const waitResult = await query(lockWaitQuery);
      const waitStats = waitResult.rows[0];

      const avgWaitTime = waitStats.avg_wait_time ? waitStats.avg_wait_time * 1000 : 0;
      const maxWaitTime = waitStats.max_wait_time ? waitStats.max_wait_time * 1000 : 0;

      // 检查是否超过阈值
      if (maxWaitTime > this.config.dbLockWaitThreshold) {
        const severity = this.calculateSeverity(
          maxWaitTime,
          this.config.dbLockWaitThreshold,
          this.config.dbLockWaitThreshold * 2
        );

        logger.warn(
          `[WatchdogService] 数据库锁等待超时: avg=${avgWaitTime.toFixed(2)}ms, max=${maxWaitTime.toFixed(2)}ms, severity=${severity}`
        );

        // 记录阻塞事件
        await this.logBlockEvent({
          eventType: BlockEventType.DB_LOCK_WAIT,
          timestamp: Date.now(),
          threshold: this.config.dbLockWaitThreshold,
          actualValue: maxWaitTime,
          severity,
          details: {
            avgWaitTime,
            maxWaitTime,
            blockedCount: blockedQueries.length,
            blockedQueries: blockedQueries.slice(0, 5), // 最多记录 5 个
          },
        });
      }
    } catch (error) {
      logger.error('[WatchdogService] 检测数据库锁等待失败', error);
    }
  }

  /**
   * 检测 Redis 延迟
   */
  private async checkRedisLatency(): Promise<void> {
    try {
      const start = Date.now();

      // 执行 PING 命令测试延迟
      await redis.ping();

      const latency = Date.now() - start;

      // 更新延迟历史
      this.redisLatencyHistory.push(latency);
      if (this.redisLatencyHistory.length > this.maxRedisLatencyHistory) {
        this.redisLatencyHistory.shift();
      }

      // 计算统计信息
      const stats = this.calculateRedisLatencyStats();

      // 检查是否超过阈值
      if (stats.maxLatency > this.config.redisLatencyThreshold) {
        const severity = this.calculateSeverity(
          stats.maxLatency,
          this.config.redisLatencyThreshold,
          this.config.redisLatencyThreshold * 2
        );

        logger.warn(
          `[WatchdogService] Redis 延迟过高: min=${stats.minLatency}ms, max=${stats.maxLatency}ms, avg=${stats.avgLatency.toFixed(2)}ms, p95=${stats.p95Latency.toFixed(2)}ms, severity=${severity}`
        );

        // 记录阻塞事件
        await this.logBlockEvent({
          eventType: BlockEventType.REDIS_LATENCY_HIGH,
          timestamp: Date.now(),
          threshold: this.config.redisLatencyThreshold,
          actualValue: stats.maxLatency,
          severity,
          details: stats,
        });
      }
    } catch (error) {
      logger.error('[WatchdogService] 检测 Redis 延迟失败', error);

      // 记录错误
      this.redisLatencyHistory.push(999999); // 标记为错误
    }
  }

  /**
   * 计算 Redis 延迟统计
   */
  private calculateRedisLatencyStats(): RedisLatencyStats {
    if (this.redisLatencyHistory.length === 0) {
      return {
        minLatency: 0,
        maxLatency: 0,
        avgLatency: 0,
        p95Latency: 0,
        p99Latency: 0,
        errorCount: 0,
      };
    }

    const sorted = [...this.redisLatencyHistory].sort((a, b) => a - b);
    const sum = sorted.reduce((a, b) => a + b, 0);
    const avg = sum / sorted.length;
    const errorCount = sorted.filter((v) => v > 1000).length; // 超过 1 秒视为错误

    return {
      minLatency: sorted[0],
      maxLatency: sorted[sorted.length - 1],
      avgLatency: avg,
      p95Latency: sorted[Math.floor(sorted.length * 0.95)],
      p99Latency: sorted[Math.floor(sorted.length * 0.99)],
      errorCount,
    };
  }

  /**
   * 记录阻塞事件
   */
  private async logBlockEvent(event: BlockEventData): Promise<void> {
    try {
      // 记录到数据库
      await query(`
        INSERT INTO block_event_log (event_type, timestamp, threshold, actual_value, severity, details)
        VALUES ($1, $2, $3, $4, $5, $6)
      `, [
        event.eventType,
        new Date(event.timestamp),
        event.threshold,
        event.actualValue,
        event.severity,
        JSON.stringify(event.details),
      ]);

      logger.info(
        `[WatchdogService] 阻塞事件已记录: type=${event.eventType}, severity=${event.severity}, value=${event.actualValue}`
      );

      // 如果启用了自动上传，上传到 Git
      if (this.config.enableAutoUpload) {
        await this.uploadToGit(event);
      }
    } catch (error) {
      logger.error('[WatchdogService] 记录阻塞事件失败', error);
    }
  }

  /**
   * 上传到 Git
   */
  private async uploadToGit(event: BlockEventData): Promise<void> {
    try {
      // TODO: 实现 Git 上传逻辑
      logger.info(
        `[WatchdogService] 上传阻塞事件到 Git: type=${event.eventType}, severity=${event.severity}`
      );
    } catch (error) {
      logger.error('[WatchdogService] 上传到 Git 失败', error);
    }
  }

  /**
   * 计算严重程度
   */
  private calculateSeverity(
    value: number,
    threshold: number,
    criticalThreshold: number
  ): 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL' {
    if (value >= criticalThreshold) {
      return 'CRITICAL';
    } else if (value >= threshold * 1.5) {
      return 'HIGH';
    } else if (value >= threshold) {
      return 'MEDIUM';
    } else {
      return 'LOW';
    }
  }

  /**
   * 开始跟踪订单处理
   */
  startTrackingOrder(orderId: number, userId: number, productCode?: string): void {
    const stats: OrderProcessingStats = {
      orderId,
      startTime: Date.now(),
      currentPhase: 'INIT',
      elapsed: 0,
      userId,
      productCode,
    };

    this.activeOrderProcessing.set(orderId, stats);

    logger.debug(
      `[WatchdogService] 开始跟踪订单: orderId=${orderId}, userId=${userId}`
    );
  }

  /**
   * 更新订单处理阶段
   */
  updateOrderPhase(orderId: number, phase: string): void {
    const stats = this.activeOrderProcessing.get(orderId);
    if (stats) {
      stats.currentPhase = phase;
      stats.elapsed = Date.now() - stats.startTime;

      logger.debug(
        `[WatchdogService] 更新订单阶段: orderId=${orderId}, phase=${phase}, elapsed=${stats.elapsed}ms`
      );
    }
  }

  /**
   * 停止跟踪订单处理
   */
  stopTrackingOrder(orderId: number): void {
    const stats = this.activeOrderProcessing.get(orderId);
    if (stats) {
      const elapsed = Date.now() - stats.startTime;

      logger.debug(
        `[WatchdogService] 停止跟踪订单: orderId=${orderId}, elapsed=${elapsed}ms`
      );

      this.activeOrderProcessing.delete(orderId);
    }
  }

  /**
   * 获取 Watchdog 状态
   */
  getStatus(): {
    isRunning: boolean;
    config: WatchdogConfig;
    activeOrders: number;
    redisLatencyStats: RedisLatencyStats;
  } {
    return {
      isRunning: this.isRunning,
      config: { ...this.config },
      activeOrders: this.activeOrderProcessing.size,
      redisLatencyStats: this.calculateRedisLatencyStats(),
    };
  }

  /**
   * 获取阻塞事件历史
   */
  async getBlockEventHistory(
    eventType?: BlockEventType,
    limit: number = 100
  ): Promise<any[]> {
    try {
      let querySql = `
        SELECT * FROM block_event_log
      `;
      const params: any[] = [];

      if (eventType) {
        querySql += ' WHERE event_type = $1';
        params.push(eventType);
      }

      querySql += `
        ORDER BY timestamp DESC
        LIMIT $${params.length + 1}
      `;
      params.push(limit);

      const result = await query(querySql, params);
      return result.rows;
    } catch (error) {
      logger.error('[WatchdogService] 获取阻塞事件历史失败', error);
      return [];
    }
  }

  /**
   * 生成阻塞事件报告
   */
  async generateBlockEventReport(
    startDate?: Date,
    endDate?: Date
  ): Promise<{
    summary: any;
    byType: any;
    bySeverity: any;
    recentEvents: any[];
  }> {
    try {
      let querySql = `
        SELECT 
          COUNT(*) as total_events,
          COUNT(*) FILTER (WHERE severity = 'CRITICAL') as critical_count,
          COUNT(*) FILTER (WHERE severity = 'HIGH') as high_count,
          COUNT(*) FILTER (WHERE severity = 'MEDIUM') as medium_count,
          COUNT(*) FILTER (WHERE severity = 'LOW') as low_count
        FROM block_event_log
      `;
      const params: any[] = [];

      if (startDate) {
        querySql += ' WHERE timestamp >= $1';
        params.push(startDate);
      }

      if (endDate) {
        querySql += params.length === 0 ? ' WHERE' : ' AND';
        querySql += ` timestamp <= $${params.length + 1}`;
        params.push(endDate);
      }

      const summaryResult = await query(querySql, params);
      const summary = summaryResult.rows[0];

      // 按类型统计
      const byTypeResult = await query(`
        SELECT 
          event_type,
          COUNT(*) as count,
          AVG(actual_value) as avg_value,
          MAX(actual_value) as max_value
        FROM block_event_log
        GROUP BY event_type
        ORDER BY count DESC
      `);

      // 按严重程度统计
      const bySeverityResult = await query(`
        SELECT 
          severity,
          COUNT(*) as count
        FROM block_event_log
        GROUP BY severity
        ORDER BY 
          CASE severity
            WHEN 'CRITICAL' THEN 1
            WHEN 'HIGH' THEN 2
            WHEN 'MEDIUM' THEN 3
            WHEN 'LOW' THEN 4
          END
      `);

      // 最近的事件
      const recentResult = await query(`
        SELECT * FROM block_event_log
        ORDER BY timestamp DESC
        LIMIT 10
      `);

      return {
        summary,
        byType: byTypeResult.rows,
        bySeverity: bySeverityResult.rows,
        recentEvents: recentResult.rows,
      };
    } catch (error) {
      logger.error('[WatchdogService] 生成阻塞事件报告失败', error);
      throw error;
    }
  }

  /**
   * 更新配置
   */
  updateConfig(config: Partial<WatchdogConfig>): void {
    this.config = {
      ...this.config,
      ...config,
    };

    logger.info('[WatchdogService] 配置已更新', {
      newConfig: this.config,
    });

    // 如果配置了自动上传，确保数据库表存在
    if (this.config.enableAutoUpload) {
      this.ensureBlockEventTable();
    }
  }

  /**
   * 确保 block_event_log 表存在
   */
  private async ensureBlockEventTable(): Promise<void> {
    try {
      await query(`
        CREATE TABLE IF NOT EXISTS block_event_log (
          id SERIAL PRIMARY KEY,
          event_type VARCHAR(50) NOT NULL,
          timestamp TIMESTAMP NOT NULL,
          threshold NUMERIC NOT NULL,
          actual_value NUMERIC NOT NULL,
          severity VARCHAR(20) NOT NULL,
          details JSONB,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );

        CREATE INDEX IF NOT EXISTS idx_block_event_log_timestamp ON block_event_log(timestamp);
        CREATE INDEX IF NOT EXISTS idx_block_event_log_type ON block_event_log(event_type);
        CREATE INDEX IF NOT EXISTS idx_block_event_log_severity ON block_event_log(severity);
      `);

      logger.info('[WatchdogService] block_event_log 表已确保存在');
    } catch (error) {
      logger.error('[WatchdogService] 创建 block_event_log 表失败', error);
    }
  }
}

// ============================================
// 创建默认实例
// ============================================

export const watchdogService = new WatchdogService();
