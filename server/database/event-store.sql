-- ============================================
-- 事件日志系统数据库表
-- ============================================

-- 事件日志主表
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

-- 创建索引
CREATE INDEX IF NOT EXISTS idx_event_log_event_id ON event_log(event_id);
CREATE INDEX IF NOT EXISTS idx_event_log_event_type ON event_log(event_type);
CREATE INDEX IF NOT EXISTS idx_event_log_account_id ON event_log(account_id);
CREATE INDEX IF NOT EXISTS idx_event_log_order_id ON event_log(order_id);
CREATE INDEX IF NOT EXISTS idx_event_log_position_id ON event_log(position_id);
CREATE INDEX IF NOT EXISTS idx_event_log_version ON event_log(version);
CREATE INDEX IF NOT EXISTS idx_event_log_created_at ON event_log(created_at DESC);

-- 添加注释
COMMENT ON TABLE event_log IS '事件日志主表 - 记录所有关键操作事件';
COMMENT ON COLUMN event_log.event_id IS '事件唯一标识，用于事件回放';
COMMENT ON COLUMN event_log.event_type IS '事件类型: ORDER_CREATED, ORDER_FILLED, ORDER_CANCELLED, ORDER_FAILED, BALANCE_CHANGED, MARGIN_CHANGED, LIQUIDATION_EXECUTED, POSITION_OPENED, POSITION_CLOSED, POSITION_MODIFIED, ACCOUNT_CREATED, ACCOUNT_FROZEN, ACCOUNT_UNFROZEN';
COMMENT ON COLUMN event_log.account_id IS '账户 ID';
COMMENT ON COLUMN event_log.order_id IS '订单 ID';
COMMENT ON COLUMN event_log.position_id IS '持仓 ID';
COMMENT ON COLUMN event_log.version IS '版本号（用于事件回放）';
COMMENT ON COLUMN event_log.before_state IS '事件前的状态（仅对最终结果）';
COMMENT ON COLUMN event_log.after_state IS '事件后的状态（仅对最终结果）';
COMMENT ON COLUMN event_log.metadata IS '事件元数据（JSON 格式）';
COMMENT ON COLUMN event_log.created_at IS '事件创建时间';

-- 事件回放表
CREATE TABLE IF NOT EXISTS event_replay (
  id SERIAL PRIMARY KEY,
  event_id VARCHAR(36) NOT NULL,
  replay_status VARCHAR(20) NOT NULL,
  replayed_version BIGINT,
  replay_error TEXT,
  replayed_at TIMESTAMP
);

-- 创建索引
CREATE INDEX IF NOT EXISTS idx_event_replay_event_id ON event_replay(event_id);
CREATE INDEX IF NOT EXISTS idx_event_replay_replay_status ON event_replay(replay_status);
CREATE INDEX IF NOT EXISTS idx_event_replay_replayed_at ON event_replay(replayed_at DESC);

-- 添加注释
COMMENT ON TABLE event_replay IS '事件回放表 - 记录事件回放历史';
COMMENT ON COLUMN event_replay.event_id IS '事件 ID';
COMMENT ON COLUMN event_replay.replay_status IS '回放状态: STARTED, SUCCESS, FAILED';
COMMENT ON COLUMN event_replay.replayed_version IS '已回放的版本号';
COMMENT ON COLUMN event_replay.replay_error IS '回放错误信息';
COMMENT ON COLUMN event_replay.replayed_at IS '事件回放时间';

-- ============================================
-- 完成提示
-- ============================================

DO $$
BEGIN
  RAISE NOTICE '=================================';
  RAISE NOTICE '事件日志系统数据库表已创建';
  RAISE NOTICE '=================================';
  RAISE NOTICE '表名: event_log, event_replay';
  RAISE NOTICE '索引: 8 个';
  RAISE NOTICE '=================================';
END $$;
