-- ============================================
-- Watchdog 服务数据库表
-- ============================================

-- 阻塞事件日志表
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

-- 创建索引
CREATE INDEX IF NOT EXISTS idx_block_event_log_timestamp ON block_event_log(timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_block_event_log_type ON block_event_log(event_type);
CREATE INDEX IF NOT EXISTS idx_block_event_log_severity ON block_event_log(severity);
CREATE INDEX IF NOT EXISTS idx_block_event_log_created_at ON block_event_log(created_at DESC);

-- 添加注释
COMMENT ON TABLE block_event_log IS '阻塞事件日志表 - Watchdog 服务记录';
COMMENT ON COLUMN block_event_log.event_type IS '事件类型: ORDER_PROCESSING_SLOW, DB_LOCK_WAIT, REDIS_LATENCY_HIGH';
COMMENT ON COLUMN block_event_log.timestamp IS '事件发生时间';
COMMENT ON COLUMN block_event_log.threshold IS '阈值';
COMMENT ON COLUMN block_event_log.actual_value IS '实际值';
COMMENT ON COLUMN block_event_log.severity IS '严重程度: LOW, MEDIUM, HIGH, CRITICAL';
COMMENT ON COLUMN block_event_log.details IS '详细数据 (JSON)';
COMMENT ON COLUMN block_event_log.created_at IS '记录创建时间';

-- ============================================
-- 完成提示
-- ============================================

DO $$
BEGIN
  RAISE NOTICE '=================================';
  RAISE NOTICE 'Watchdog 服务数据库表已创建';
  RAISE NOTICE '=================================';
  RAISE NOTICE '表名: block_event_log';
  RAISE NOTICE '索引: 4 个';
  RAISE NOTICE '=================================';
END $$;
