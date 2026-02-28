-- ====================================================
-- 交易系统重构 - 数据库迁移脚本
-- 执行顺序: 1. 价格快照表 2. 审计日志表 3. 订单处理日志表
--             4. 订单表变更 5. 持仓表变更 6. 账户表变更
-- ====================================================

-- ====================================================
-- 1. 创建价格快照表
-- ====================================================

CREATE TABLE IF NOT EXISTS price_snapshots (
  id BIGSERIAL PRIMARY KEY,
  product_id INTEGER NOT NULL REFERENCES products(id),
  price DECIMAL(20,8) NOT NULL,
  snapshot_time TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  source VARCHAR(50),
  metadata JSONB,
  UNIQUE(product_id, snapshot_time)
);

CREATE INDEX IF NOT EXISTS idx_price_snapshots_product_time
  ON price_snapshots(product_id, snapshot_time DESC);

-- ====================================================
-- 2. 创建审计日志表
-- ====================================================

CREATE TABLE IF NOT EXISTS audit_logs (
  id BIGSERIAL PRIMARY KEY,
  user_id BIGINT NOT NULL REFERENCES users(id),
  operation_type VARCHAR(50) NOT NULL,
  amount DECIMAL(20,8) NOT NULL,
  before_balance DECIMAL(20,8) NOT NULL,
  after_balance DECIMAL(20,8) NOT NULL,
  related_order_id BIGINT REFERENCES orders(id),
  related_position_id BIGINT REFERENCES positions(id),
  description TEXT,
  metadata JSONB,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  created_by VARCHAR(50) DEFAULT 'SYSTEM'
);

CREATE INDEX IF NOT EXISTS idx_audit_logs_user_time
  ON audit_logs(user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_audit_logs_type_time
  ON audit_logs(operation_type, created_at DESC);

-- ====================================================
-- 3. 创建订单处理日志表
-- ====================================================

CREATE TABLE IF NOT EXISTS order_processing_logs (
  id BIGSERIAL PRIMARY KEY,
  order_id BIGINT NOT NULL REFERENCES orders(id),
  job_id VARCHAR(64),
  state_from VARCHAR(20),
  state_to VARCHAR(20),
  processing_time INTEGER,
  error_message TEXT,
  metadata JSONB,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_order_processing_logs_order
  ON order_processing_logs(order_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_order_processing_logs_job
  ON order_processing_logs(job_id, created_at DESC);

-- ====================================================
-- 4. 更新订单表结构
-- ====================================================

-- 添加状态机相关字段
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'orders' AND column_name = 'state'
  ) THEN
    ALTER TABLE orders ADD COLUMN state VARCHAR(20) DEFAULT 'created';
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'orders' AND column_name = 'state_history'
  ) THEN
    ALTER TABLE orders ADD COLUMN state_history JSONB DEFAULT '[]';
  END IF;
END $$;

-- 添加幂等性字段
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'orders' AND column_name = 'idempotency_key'
  ) THEN
    ALTER TABLE orders ADD COLUMN idempotency_key VARCHAR(64) UNIQUE;
  END IF;
END $$;

-- 创建索引
CREATE INDEX IF NOT EXISTS idx_orders_state
  ON orders(state, created_at DESC);

CREATE UNIQUE INDEX IF NOT EXISTS idx_orders_idempotency
  ON orders(idempotency_key) WHERE idempotency_key IS NOT NULL;

-- ====================================================
-- 5. 更新持仓表结构
-- ====================================================

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'positions' AND column_name = 'snapshot_id'
  ) THEN
    ALTER TABLE positions ADD COLUMN snapshot_id BIGINT REFERENCES price_snapshots(id);
  END IF;
END $$;

-- 创建索引
CREATE INDEX IF NOT EXISTS idx_positions_snapshot
  ON positions(snapshot_id);

-- ====================================================
-- 6. 更新账户表结构
-- ====================================================

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'accounts' AND column_name = 'frozen_amount'
  ) THEN
    ALTER TABLE accounts ADD COLUMN frozen_amount DECIMAL(20,8) DEFAULT 0;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'accounts' AND column_name = 'version'
  ) THEN
    ALTER TABLE accounts ADD COLUMN version INTEGER DEFAULT 1;
  END IF;
END $$;

-- 创建索引
CREATE INDEX IF NOT EXISTS idx_accounts_frozen
  ON accounts(user_id, frozen_amount);

-- ====================================================
-- 迁移完成
-- ====================================================

-- 记录迁移完成时间
DO $$
BEGIN
  RAISE NOTICE 'Database migration completed successfully at %', NOW();
END $$;
