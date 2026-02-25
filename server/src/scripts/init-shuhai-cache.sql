-- ============================================
-- 数海API数据缓存表
-- ============================================

-- 1. 实时行情缓存表
CREATE TABLE IF NOT EXISTS shuhai_quote_cache (
  id SERIAL PRIMARY KEY,
  symbol VARCHAR(20) NOT NULL UNIQUE,          -- 品种代码 (DAX, GOLD, etc.)
  shuhai_code VARCHAR(20) NOT NULL,           -- 数海代码
  price DECIMAL(20, 6) DEFAULT 0,              -- 最新价
  open DECIMAL(20, 6) DEFAULT 0,               -- 开盘价
  high DECIMAL(20, 6) DEFAULT 0,               -- 最高价
  low DECIMAL(20, 6) DEFAULT 0,                -- 最低价
  close DECIMAL(20, 6) DEFAULT 0,              -- 收盘价
  volume BIGINT DEFAULT 0,                     -- 成交量
  amount BIGINT DEFAULT 0,                     -- 成交额
  last_close DECIMAL(20, 6) DEFAULT 0,          -- 昨收价
  change DECIMAL(20, 6) DEFAULT 0,              -- 涨跌额
  change_percent DECIMAL(10, 4) DEFAULT 0,      -- 涨跌幅(%)
  bid_price DECIMAL(20, 6) DEFAULT 0,          -- 买一价
  ask_price DECIMAL(20, 6) DEFAULT 0,          -- 卖一价
  quote_time TIMESTAMP,                         -- 行情时间
  cached_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 创建索引
CREATE INDEX IF NOT EXISTS idx_shuhai_quote_symbol ON shuhai_quote_cache(symbol);
CREATE INDEX IF NOT EXISTS idx_shuhai_quote_cached_at ON shuhai_quote_cache(cached_at);

-- 2. K线数据缓存表
CREATE TABLE IF NOT EXISTS shuhai_kline_cache (
  id SERIAL PRIMARY KEY,
  symbol VARCHAR(20) NOT NULL,                  -- 品种代码
  shuhai_code VARCHAR(20) NOT NULL,            -- 数海代码
  period INTEGER NOT NULL,                      -- 周期 (分钟): 1, 5, 15, 30, 60, 240, 1440, 10080
  kline_time TIMESTAMP NOT NULL,                -- K线时间
  open DECIMAL(20, 6) DEFAULT 0,               -- 开盘价
  close DECIMAL(20, 6) DEFAULT 0,              -- 收盘价
  high DECIMAL(20, 6) DEFAULT 0,               -- 最高价
  low DECIMAL(20, 6) DEFAULT 0,                -- 最低价
  volume BIGINT DEFAULT 0,                      -- 成交量
  amount BIGINT DEFAULT 0,                      -- 成交额
  cached_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(symbol, period, kline_time)
);

-- 创建索引
CREATE INDEX IF NOT EXISTS idx_shuhai_kline_symbol_period ON shuhai_kline_cache(symbol, period);
CREATE INDEX IF NOT EXISTS idx_shuhai_kline_time ON shuhai_kline_cache(kline_time);
CREATE INDEX IF NOT EXISTS idx_shuhai_kline_cached_at ON shuhai_kline_cache(cached_at);

-- 3. 更新触发器
CREATE OR REPLACE FUNCTION update_shuhai_quote_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_shuhai_quote_timestamp
  BEFORE UPDATE ON shuhai_quote_cache
  FOR EACH ROW
  EXECUTE FUNCTION update_shuhai_quote_timestamp();

-- 注释
COMMENT ON TABLE shuhai_quote_cache IS '数海API实时行情缓存';
COMMENT ON TABLE shuhai_kline_cache IS '数海API K线数据缓存';
