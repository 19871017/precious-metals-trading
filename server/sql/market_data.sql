-- 行情数据表
CREATE TABLE IF NOT EXISTS market_data (
  id SERIAL PRIMARY KEY,
  product_code VARCHAR(20) NOT NULL UNIQUE,
  product_name VARCHAR(50) NOT NULL,
  price DECIMAL(15, 4) NOT NULL DEFAULT 0,
  bid DECIMAL(15, 4) NOT NULL DEFAULT 0,
  ask DECIMAL(15, 4) NOT NULL DEFAULT 0,
  open_price DECIMAL(15, 4) NOT NULL DEFAULT 0,
  high_24h DECIMAL(15, 4) NOT NULL DEFAULT 0,
  low_24h DECIMAL(15, 4) NOT NULL DEFAULT 0,
  last_close DECIMAL(15, 4) NOT NULL DEFAULT 0,
  volume_24h BIGINT NOT NULL DEFAULT 0,
  change_amount DECIMAL(15, 4) NOT NULL DEFAULT 0,
  change_percent DECIMAL(10, 4) NOT NULL DEFAULT 0,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 创建索引以提高查询性能
CREATE INDEX IF NOT EXISTS idx_market_data_product_code ON market_data(product_code);
CREATE INDEX IF NOT EXISTS idx_market_data_updated_at ON market_data(updated_at);

-- 创建更新触发器
CREATE OR REPLACE FUNCTION update_market_data_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER market_data_updated_at
  BEFORE UPDATE ON market_data
  FOR EACH ROW
  EXECUTE FUNCTION update_market_data_timestamp();

-- 插入默认的6个品种
INSERT INTO market_data (product_code, product_name, price, open_price, high_24h, low_24h, last_close, volume_24h, change_amount, change_percent)
VALUES
  ('DAX', '德指', 0, 0, 0, 0, 0, 0, 0, 0),
  ('HSI', '恒指', 0, 0, 0, 0, 0, 0, 0, 0),
  ('NQ', '纳指', 0, 0, 0, 0, 0, 0, 0, 0),
  ('GOLD', '美黄金', 0, 0, 0, 0, 0, 0, 0, 0),
  ('USOIL', '美原油', 0, 0, 0, 0, 0, 0, 0, 0),
  ('XAGUSD', '美白银', 0, 0, 0, 0, 0, 0, 0, 0)
ON CONFLICT (product_code) DO NOTHING;
