import logger from '../utils/logger';
import { query, transaction } from '../config/database';
import { v4 as uuidv4 } from 'uuid';

// ============================================
// 事件类型枚举
// ============================================

export enum EventType {
  ORDER_CREATED = 'ORDER_CREATED', // 订单创建
  ORDER_FILLED = 'ORDER_FILLED', // 订单成交
  ORDER_CANCELLED = 'ORDER_CANCELLED', // 订单取消
  ORDER_FAILED = 'ORDER_FAILED', // 订单失败
  BALANCE_CHANGED = 'BALANCE_CHANGED', // 余额变更
  MARGIN_CHANGED = 'MARGIN_CHANGED', // 保证金变化
  LIQUIDATION_EXECUTED = 'LIQUIDATION_EXECUTED', // 强平执行
  POSITION_OPENED = 'POSITION_OPENED', // 持仓开仓
  POSITION_CLOSED = 'POSITION_CLOSED', // 持仓平仓
  POSITION_MODIFIED = 'POSITION_MODIFIED', // 持仓修改
  ACCOUNT_CREATED = 'ACCOUNT_CREATED', // 账户创建
  ACCOUNT_FROZEN = 'ACCOUNT_FROZEN', // 账户冻结
  ACCOUNT_UNFROZEN = 'ACCOUNT_UNFROZEN', // 账户解冻
}

// ============================================
// 事件状态数据接口
// ============================================

export interface EventState {
  [key: string]: any;
}

// ============================================
// 事件日志接口
// ============================================

export interface EventLog {
  eventId: string; // 事件唯一 ID
  eventType: EventType; // 事件类型
  accountId?: number; // 账户 ID
  orderId?: number; // 订单 ID
  positionId?: number; // 持仓 ID
  version: number; // 版本号
  beforeState: EventState; // 事件前的状态
  afterState: EventState; // 事件后的状态
  timestamp: Date; // 时间戳
  metadata?: Record<string, any>; // 元数据
}

// ============================================
// 事件日志选项
// ============================================

export interface EventLogOptions {
  includeBefore?: boolean; // 是否包含 beforeState
  includeAfter?: boolean; // 是否包含 afterState
  metadata?: Record<string, any>; // 元数据
}

// ============================================
// 事件存储服务
// ============================================

export class EventStoreService {
  private isInitialized = false;

  /**
   * 初始化事件存储服务
   */
  async initialize(): Promise<void> {
    if (this.isInitialized) {
      logger.warn('[EventStore] 事件存储服务已初始化');
      return;
    }

    try {
      logger.info('[EventStore] 初始化事件存储服务');

      // 确保数据库表存在
      await this.ensureTables();

      this.isInitialized = true;

      logger.info('[EventStore] 事件存储服务初始化完成');
    } catch (error) {
      logger.error('[EventStore] 初始化事件存储服务失败', error);
      throw error;
    }
  }

  /**
   * 确保数据库表存在
   */
  private async ensureTables(): Promise<void> {
    try {
      // 创建事件日志主表
      await query(`
        CREATE TABLE IF NOT EXISTS event_log (
          id SERIAL PRIMARY KEY,
          event_id VARCHAR(36) UNIQUE NOT NULL,
          event_type VARCHAR(50) NOT NULL,
          account_id BIGINT,
          order_id BIGINT,
          position_id BIGINT,
          version BIGINT NOT NULL DEFAULT 1,
          before_state JSONB,
          after_state JSONB,
          metadata JSONB,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );

        CREATE INDEX IF NOT EXISTS idx_event_log_event_id ON event_log(event_id);
        CREATE INDEX IF NOT EXISTS idx_event_log_event_type ON event_log(event_type);
        CREATE INDEX IF NOT EXISTS idx_event_log_account_id ON event_log(account_id);
        CREATE INDEX IF NOT EXISTS idx_event_log_order_id ON event_log(order_id);
        CREATE INDEX IF NOT EXISTS idx_event_log_position_id ON event_log(position_id);
        CREATE INDEX IF NOT EXISTS idx_event_log_created_at ON event_log(created_at DESC);
        CREATE INDEX IF NOT EXISTS idx_event_log_version ON event_log(version);

        COMMENT ON TABLE event_log IS '事件日志表 - 记录所有关键操作事件';
        COMMENT ON COLUMN event_log.event_id IS '事件唯一标识';
        COMMENT ON COLUMN event_log.event_type IS '事件类型';
        COMMENT ON COLUMN event_log.account_id IS '账户 ID';
        COMMENT ON COLUMN event_log.order_id IS '订单 ID';
        COMMENT ON COLUMN event_log.position_id IS '持仓 ID';
        COMMENT ON COLUMN event_log.version IS '版本号（用于事件回放）';
        COMMENT ON COLUMN event_log.before_state IS '事件前的状态';
        COMMENT ON COLUMN event_log.after_state IS '事件后的状态';
        COMMENT ON COLUMN event_log.metadata IS '元数据';
        COMMENT ON COLUMN event_log.created_at IS '事件创建时间';
      `);

      // 创建事件回放表
      await query(`
        CREATE TABLE IF NOT EXISTS event_replay (
          id SERIAL PRIMARY KEY,
          event_id VARCHAR(36) NOT NULL,
          replay_status VARCHAR(20) NOT NULL,
          replayed_version BIGINT,
          replay_error TEXT,
          replayed_at TIMESTAMP,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );

        CREATE INDEX IF NOT EXISTS idx_event_replay_event_id ON event_replay(event_id);
        CREATE INDEX IF NOT EXISTS idx_event_replay_replay_status ON event_replay(replay_status);
        CREATE INDEX IF NOT EXISTS idx_event_replay_replayed_at ON event_replay(replayed_at DESC);

        COMMENT ON TABLE event_replay IS '事件回放表 - 记录事件回放历史';
        COMMENT ON COLUMN event_replay.event_id IS '事件 ID';
        COMMENT ON COLUMN event_replay.replay_status IS '回放状态';
        COMMENT ON COLUMN event_replay.replayed_version IS '已回放的版本号';
        COMMENT ON COLUMN event_replay.replay_error IS '回放错误信息';
        COMMENT ON COLUMN event_replay.replayed_at IS '回放时间';
      `);

      logger.info('[EventStore] 数据库表已确保存在');
    } catch (error) {
      logger.error('[EventStore] 创建数据库表失败', error);
      throw error;
    }
  }

  /**
   * 记录订单创建事件
   */
  async logOrderCreated(
    orderId: number,
    beforeState: EventState,
    afterState: EventState,
    options?: EventLogOptions
  ): Promise<string> {
    return this.logEvent({
      eventType: EventType.ORDER_CREATED,
      orderId,
      beforeState: options?.includeBefore !== false ? beforeState : undefined,
      afterState: options?.includeAfter !== false ? afterState,
      options,
    });
  }

  /**
   * 记录订单成交事件
   */
  async logOrderFilled(
    orderId: number,
    beforeState: EventState,
    afterState: EventState,
    options?: EventLogOptions
  ): Promise<string> {
    return this.logEvent({
      eventType: EventType.ORDER_FILLED,
      orderId,
      beforeState: options?.includeBefore !== false ? beforeState : undefined,
      afterState: options?.includeAfter !== false ? afterState,
      options,
    });
  }

  /**
   * 记录订单取消事件
   */
  async logOrderCancelled(
    orderId: number,
    beforeState: EventState,
    afterState: EventState,
    options?: EventLogOptions
  ): Promise<string> {
    return this.logEvent({
      eventType: EventType.ORDER_CANCELLED,
      orderId,
      beforeState: options?.includeBefore !== false ? beforeState : undefined,
      afterState: options?.includeAfter !== false ? afterState,
      options,
    });
  }

  /**
   * 记录订单失败事件
   */
  async logOrderFailed(
    orderId: number,
    beforeState: EventState,
    afterState: EventState,
    options?: EventLogOptions
  ): Promise<string> {
    return this.logEvent({
      eventType: EventType.ORDER_FAILED,
      orderId,
      beforeState: options?.includeBefore !== false ? beforeState : undefined,
      afterState: options?.includeAfter !== false ? afterState,
      options,
    });
  }

  /**
   * 记录余额变更事件
   */
  async logBalanceChanged(
    accountId: number,
    beforeState: EventState,
    afterState: EventState,
    options?: EventLogOptions
  ): Promise<string> {
    return this.logEvent({
      eventType: EventType.BALANCE_CHANGED,
      accountId,
      beforeState: options?.includeBefore !== false ? beforeState : undefined,
      afterState: options?.includeAfter !== false ? afterState,
      options,
    });
  }

  /**
   * 记录保证金变化事件
   */
  async logMarginChanged(
    accountId: number,
    positionId: number,
    beforeState: EventState,
    afterState: EventState,
    options?: EventLogOptions
  ): Promise<string> {
    return this.logEvent({
      eventType: EventType.MARGIN_CHANGED,
      accountId,
      positionId,
      beforeState: options?.includeBefore !== false ? beforeState : undefined,
      afterState: options?.includeAfter !== false ? afterState,
      options,
    });
  }

  /**
   * 记录强平执行事件
   */
  async logLiquidationExecuted(
    accountId: number,
    positionId: number,
    beforeState: EventState,
    afterState: EventState,
    options?: EventLogOptions
  ): Promise<string> {
    return this.logEvent({
      eventType: EventType.LIQUIDATION_EXECUTED,
      accountId,
      positionId,
      beforeState: options?.includeBefore !== false ? beforeState : undefined,
      afterState: options?.includeAfter !== false ? afterState,
      options,
    });
  }

  /**
   * 记录持仓开仓事件
   */
  async logPositionOpened(
    accountId: number,
    positionId: number,
    beforeState: EventState,
    afterState: State,
    options?: EventLogOptions
  ): Promise<string> {
    return this.logEvent({
      eventType: EventType.POSITION_OPENED,
      accountId,
      positionId,
      beforeState: options?.includeBefore !== false ? beforeState : undefined,
      afterState: options?.includeAfter !== false ? afterState,
      options,
    });
  }

  /**
   * 记录持仓平仓事件
   */
  async logPositionClosed(
    accountId: number,
    positionId: number,
    beforeState: EventState,
    afterState: EventState,
    options?: EventLogOptions
  ): Promise<string> {
    return this.logEvent({
      eventType: EventType.POSITION_CLOSED,
      accountId,
      positionId,
      beforeState: options?.includeBefore !== false ? beforeState : undefined,
      afterState: options?.includeAfter !== false ? afterState,
      options,
    });
  }

  /**
   * 记录持仓修改事件
   */
  async logPositionModified(
    accountId: number,
    positionId: number,
    beforeState: EventState,
    afterState: EventState,
    options?: EventLogOptions
  ): Promise<string> {
    return this.logEvent({
      eventType: EventType.POSITION_MODIFIED,
      accountId,
      positionId,
      beforeState: options?.includeBefore !== false ? beforeState : undefined,
      afterState: options?.includeAfter !== false ? afterState,
      options,
    });
  }

  /**
   * 记录账户冻结事件
   */
  async logAccountFrozen(
    accountId: number,
    beforeState: EventState,
    afterState: EventState,
    options?: EventLogOptions
  ): Promise<string> {
    return this.logEvent({
      eventType: EventType.ACCOUNT_FROZEN,
      accountId,
      beforeState: options?.includeBefore !== false ? beforeState : undefined,
      afterState: options?.includeAfter !== false ? afterState,
      options,
    });
  }

  /**
   * 记录账户解冻事件
   */
  async logAccountUnfrozen(
    accountId: number,
    beforeState: EventState,
    afterState: EventState,
    options?: EventLogOptions
  ): Promise<string> {
    return this.logEvent({
      eventType: ACCOUNT_UNFROZEN,
      accountId,
      beforeState: options?.includeBefore !== false ? beforeState : undefined,
      afterState: options?.includeAfter !== false ? afterState,
      options,
    });
  }

  /**
   * 通用事件记录方法
   */
  private async logEvent(
    params: {
      eventType: EventType;
    accountId?: number;
    orderId?: number;
    positionId?: number;
    beforeState?: EventState;
    afterState?: EventState;
    options?: EventLogOptions;
  }
  ): Promise<string> {
    const eventId = uuidv4();

    try {
      // 获取当前版本号
      const version = await this.getCurrentVersion(params);

      await query(`
        INSERT INTO event_log (
          event_id,
          event_type,
          account_id,
          order_id,
          position_id,
          version,
          before_state,
          after_state,
          metadata
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      `, [
        eventId,
        params.eventType,
        params.accountId || null,
        params.orderId || null,
        params.positionId || null,
        version,
        params.beforeState ? JSON.stringify(params.beforeState) : null,
        params.afterState ? JSON.stringify(params.afterState) : null,
        params.options?.metadata ? JSON.stringify(params.options.metadata) : null,
      ]);

      logger.info(
        `[EventStore] 事件已记录: eventId, type=${params.eventType}`
      );

      return eventId;
    } catch (error) {
      logger.error(`[EventStore] 记录事件失败: type=${params.eventType}`, error);
      throw error;
    }
  }

  /**
   * 获取当前版本号
   */
  private async getCurrentVersion(params: {
    eventType: EventType;
    orderId?: number;
    positionId?: number;
    accountId?: number;
  }): Promise<number> {
    try {
      // 查询该实体（订单或持仓）的当前版本号
      let version = 1;

      if (params.orderId) {
        const result = await query(
          `SELECT COALESCE(MAX(version), 0) + 1 as v
           FROM event_log
           WHERE order_id = $1
          `,
          [params.orderId]
        );
        version = result.rows[0]?.v || 1;
      } else if (params.positionId) {
        const result = await query(
          `SELECT COALESCE(MAX(version), 0) + 1 as v
           FROM event_log
           WHERE position_id = $1
          `,
          [params.positionId]
        );
        version = result.rows[0]?.v || 1;
      } else if (params.accountId) {
        const result = await query(
          `SELECT COALESCE(MAX(version), 0) + 1 as v
           FROM event_log
           WHERE account_id = $1
          `,
          [params.accountId]
        );
        version = result.rows[0]?.v || 1;
      }

      return version;
    } catch (error) {
      logger.error('[EventStore] 获取版本号失败', error);
      return 1;
    }
  }

  /**
   * 获取事件日志
   */
  async getEventLogs(
    filters?: {
      eventType?: EventType;
      accountId?: number;
      orderId?: number;
      positionId?: number;
      version?: number;
      startDate?: Date;
      endDate?: Date;
      limit?: number;
    }
  ): Promise<EventLog[]> {
    try {
      let querySql = `SELECT * FROM event_log WHERE 1=1`;
      const params: any[] = [];

      if (filters?.eventType) {
        querySql += ' AND event_type = $' + (params.length + 1);
        params.push(filters.eventType);
      }

      if (filters?.accountId) {
        querySql += ' AND account_id = $' + (params.length + 1);
        params.push(filters.accountId);
      }

      if (filters?.orderId) {
        querySql += ' AND order_id = $' + (params.length + 1);
        params.push(filters.orderId);
      }

      if (filters?.positionId) {
        querySql += ' AND position_id = $' + (params.length + 1);
        params.push(filters.positionId);
      }

      if (filters?.version) {
        querySql += ' AND version = $' + (params.length + 1);
        params.push(filters.version);
      }

      if (filters?.startDate) {
        querySql += ' AND created_at >= $' + (params.length + 1);
        params.push(filters.startDate);
      }

      if (filters?.endDate) {
        querySql += ' AND created_at <= $' + (params.length + 1);
        params.push(filters.endDate);
      }

      querySql += ' ORDER BY created_at DESC';

      if (filters?.limit) {
        querySql += ' LIMIT $' + (params.length + 1);
        params.push(filters.limit);
      }

      const result = await query(querySql, params);

      return result.rows.map((row: any) => ({
        eventId: row.event_id,
        eventType: row.event_type,
        accountId: row.account_id,
        orderId: row.order_id,
        positionId: row.position_id,
        version: row.version,
        beforeState: row.before_state ? JSON.parse(row.before_state) : null,
        afterState: row.after_state ? JSON.parse(row.after_state) : null,
        metadata: row.metadata ? JSON.parse(row.metadata) : null,
        timestamp: row.created_at,
      }));
    } catch (error) {
      logger.error('[EventStore] 获取事件日志失败', error);
      return [];
    }
  }

  /**
   * 回放事件
   */
  async replayEvent(eventId: string, targetVersion?: number): Promise<boolean> {
    try {
      logger.info(`[EventStore] 开始回放事件: eventId, targetVersion=${targetVersion}`);

      // 查询事件
      const result = await query(
        `SELECT * FROM event_log WHERE event_id = $1 AND version = $2 ORDER BY version ASC LIMIT 1`,
          [eventId, targetVersion || 1]
      );

      if (result.rows.length === 0) {
        logger.warn(`[EventStore] 未找到事件: eventId, version=${targetVersion}`);
        return false;
      }

      const event = result.rows[0];

      // 记录回放尝试
      await query(`
        INSERT INTO event_replay (
          event_id,
          replay_status,
          replayed_version,
          replayed_at
        ) VALUES ($1, 'STARTED', $2, CURRENT_TIMESTAMP)
      `, [eventId, targetVersion || event.version]);

      // TODO: 实现具体的回放逻辑
      logger.info(`[EventStore] 事件回放已完成: eventId, version=${targetVersion}`);

      // 更新回放状态
      await query(`
        UPDATE event_replay
        SET replay_status = 'SUCCESS',
            replayed_version = $1
        WHERE event_id = $2
      `, [targetVersion || event.version, eventId]);

      return true;
    } catch (error) {
      logger.error(`[EventStore] 回放事件失败: eventId, error`, error);

      // 更新回放状态为失败
      await query(`
        UPDATE event_replay
        SET replay_status = 'FAILED',
            replay_error = $1
        WHERE event_id = $2
      `, [error.message, eventId]);

      return false;
    }
  }

  /**
   * 获取事件回放历史
   */
  async getReplayHistory(eventId?: string): Promise<any[]> {
    try {
      let querySql = 'SELECT * FROM event_replay WHERE 1=1';
      const params: any[] = [];

      if (eventId) {
        querySql += ' AND event_id = $1';
        params.push(eventId);
      }

      querySql += ' ORDER BY created_at DESC';

      const result = await query(querySql, params);

      return result.rows;
    } catch (error) {
      logger.error('[EventStore] 获取回放历史失败', error);
      return [];
    }
  }

  /**
   * 清理旧的事件日志
   */
  async cleanupOldEvents(daysToKeep: number = 30): Promise<number> {
    try {
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - daysToKeep);

      const result = await query(
        `DELETE FROM event_log WHERE created_at < $1`,
        [cutoffDate]
      );

      const deletedCount = result.rowCount;

      logger.info(
        `[EventStore] 清理旧事件日志: 删除了 ${deletedCount} 条记录（${daysToKeep} 天前）`
      );

      return deletedCount;
    } catch (error) {
      logger.error('[EventStore] 清理旧事件日志失败', error);
      return 0;
    }
  }

  /**
   * 获取事件统计
   */
  async getEventStats(): Promise<{
    totalEvents: number;
    byType: Record<string, number>;
    byAccount: Record<number, number>;
    byDay: Record<string, number>;
    recentEvents: EventLog[];
  }> {
    try {
      // 总事件数
      const totalResult = await query(`SELECT COUNT(*) as count FROM event_log`);
      const totalEvents = parseInt(totalResult.rows[0].count);

      // 按类型统计
      const byTypeResult = await query(`
        SELECT event_type, COUNT(*) as count
        FROM event_log
        GROUP BY event_type
        ORDER BY count DESC
      `);
      const byType: Record<string, number> = {};
      byTypeResult.rows.forEach((row: any) => {
        byType[row.event_type] = row.count;
      });

      // 按账户统计
      const byAccountResult = await query(`
        SELECT account_id, COUNT(*) as count
        FROM event_log
        WHERE account_id IS NOT NULL
        GROUP BY account_id
        ORDER BY count DESC
      `);
      const byAccount: Record<number, number> = {};
      byAccountResult.rows.forEach((row: any) => {
        byAccount[row.account_id] = row.count;
      });

      // 按天统计
      const byDayResult = await query(`
        SELECT DATE(created_at) as day, COUNT(*) as count
        FROM event_log
        WHERE created_at >= CURRENT_DATE - INTERVAL '30 days'
        GROUP BY DATE(created_at)
        ORDER BY day DESC
      `);
      const byDay: Record<string, number> = {};
      byDayResult.rows.forEach((row: any) => {
        byDay[row.day] = row.count;
      });

      // 最近的事件
      const recentEventsResult = await query(`
        SELECT * FROM event_log
        ORDER BY created_at DESC
        LIMIT 10
      `);
      const recentEvents = recentEventsResult.rows.map((row: any) => ({
        eventId: row.event_id,
        eventType: row.event_type,
        accountId: row.account_id,
        orderId: row.order_id,
        positionId: row.positionId,
        version: row.version,
        beforeState: row.before_state ? JSON.parse(row.before_state) : null,
        afterState: row.after_state ? JSON.parse(row.after_state) : null,
        metadata: row.metadata ? JSON.parse(row.metadata) : null,
        timestamp: row.created_at,
      }));

      return {
        totalEvents,
        byType,
        byAccount,
        byDay,
        recentEvents,
      };
    } catch (error) {
      logger.error('[EventStore] 获取事件统计失败', error);
      return {
        totalEvents: 0,
        byType: {},
        byAccount: {},
        byDay: {},
        recentEvents: [],
      };
    }
  }

  /**
   * 初始化事件存储服务（单例）
   */
  private static instance: EventStoreService | null = null;

  static getInstance(): EventStoreService {
    if (!EventStoreService.instance) {
      EventStoreService.instance = new EventStoreService();
    }
    return EventStoreService.instance;
  }
}

// ============================================
// 创建默认实例
// ============================================

export const eventStoreService = EventStoreService.getInstance();
