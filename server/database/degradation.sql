-- ============================================
-- 系统降级机制数据库表
-- ============================================

-- 降级事件日志表
CREATE TABLE IF NOT EXISTS degradation_log (
  id SERIAL PRIMARY KEY,
  event_type VARCHAR(50) NOT NULL,
  level VARCHAR(20) NOT NULL,
  details JSONB,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 创建索引
CREATE INDEX IF NOT EXISTS idx_degradation_log_created_at ON degradation_log(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_degradation_log_level ON degradation_log(level);
CREATE INDEX IF NOT EXISTS idx_degradation_log_event_type ON degradation_log(event_type);

-- 添加注释
COMMENT ON TABLE degradation_log IS '降级事件日志表 - 系统降级机制';
COMMENT ON COLUMN degradation_log.event_type IS '事件类型: DEGRADATION_TRIGGERED, DEGRADATION_RECOVERED';
COMMENT ON COLUMN degradation_log.level IS '降级级别: NORMAL, DEGRADED, CRITICAL';
COMMENT ON COLUMN degradation_log.details IS '详细数据 (JSON)';
COMMENT ON COLUMN degradation_log.created_at IS '记录创建时间';

-- ============================================
-- 完成提示
-- ============================================

DO $$
BEGIN
  RAISE NOTICE '=================================';
  RAISE NOTICE '系统降级机制数据库表已创建';
  RAISE NOTICE '=================================';
  RAISE NOTICE '表名: degradation_log';
  RAISE NOTICE '索引: 3 个';
  RAISE NOTICE '=================================';
END $$;
