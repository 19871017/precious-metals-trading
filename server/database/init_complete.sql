-- 后端数据库完整初始化脚本
-- 用于确保所有必要的表、初始数据和配置都存在

-- ============================================
-- 1. 角色表
-- ============================================
CREATE TABLE IF NOT EXISTS roles (
  id SERIAL PRIMARY KEY,
  name VARCHAR(50) NOT NULL UNIQUE,
  description TEXT,
  permissions TEXT[] DEFAULT '{}',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 插入默认角色
INSERT INTO roles (name, description, permissions) VALUES
('super_admin', '超级管理员', ARRAY['all']),
('admin', '管理员', ARRAY['user:view', 'user:update', 'order:view', 'position:view', 'finance:view', 'finance:approve', 'agent:view', 'config:view', 'config:update', 'risk:view', 'risk:config']),
('agent', '代理', ARRAY['order:view', 'position:view', 'finance:view']),
('user', '普通用户', ARRAY['order:view', 'position:view', 'finance:view'])
ON CONFLICT (name) DO NOTHING;

-- ============================================
-- 2. 用户表
-- ============================================
CREATE TABLE IF NOT EXISTS users (
  id SERIAL PRIMARY KEY,
  username VARCHAR(50) NOT NULL UNIQUE,
  password VARCHAR(255),
  real_name VARCHAR(50),
  phone VARCHAR(20),
  email VARCHAR(100),
  role_id INTEGER REFERENCES roles(id) DEFAULT 4,
  agent_id INTEGER,
  kyc_status INTEGER DEFAULT 0,
  status INTEGER DEFAULT 1,
  last_login_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ============================================
-- 3. 账户表
-- ============================================
CREATE TABLE IF NOT EXISTS accounts (
  id SERIAL PRIMARY KEY,
  user_id INTEGER UNIQUE REFERENCES users(id) ON DELETE CASCADE,
  balance DECIMAL(20, 8) DEFAULT 0,
  available_balance DECIMAL(20, 8) DEFAULT 0,
  frozen_margin DECIMAL(20, 8) DEFAULT 0,
  frozen_withdraw DECIMAL(20, 8) DEFAULT 0,
  unrealized_pnl DECIMAL(20, 8) DEFAULT 0,
  realized_pnl DECIMAL(20, 8) DEFAULT 0,
  total_deposit DECIMAL(20, 8) DEFAULT 0,
  total_withdraw DECIMAL(20, 8) DEFAULT 0,
  equity DECIMAL(20, 8) DEFAULT 0,
  margin_level DECIMAL(10, 2),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ============================================
-- 4. 代理表
-- ============================================
CREATE TABLE IF NOT EXISTS agents (
  id SERIAL PRIMARY KEY,
  user_id INTEGER UNIQUE REFERENCES users(id) ON DELETE CASCADE,
  agent_code VARCHAR(20) NOT NULL UNIQUE,
  agent_level INTEGER DEFAULT 1,
  parent_agent_id INTEGER REFERENCES agents(id),
  commission_rate DECIMAL(5, 4) DEFAULT 0.0001,
  total_commission DECIMAL(20, 8) DEFAULT 0,
  available_commission DECIMAL(20, 8) DEFAULT 0,
  status INTEGER DEFAULT 1,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ============================================
-- 5. 代理客户关系表
-- ============================================
CREATE TABLE IF NOT EXISTS agent_customers (
  id SERIAL PRIMARY KEY,
  agent_id INTEGER REFERENCES agents(id) ON DELETE CASCADE,
  user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
  level INTEGER DEFAULT 1,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(agent_id, user_id)
);

-- ============================================
-- 6. 产品表
-- ============================================
CREATE TABLE IF NOT EXISTS products (
  id SERIAL PRIMARY KEY,
  symbol VARCHAR(20) NOT NULL UNIQUE,
  name VARCHAR(50) NOT NULL,
  category VARCHAR(20),
  description TEXT,
  min_lot_size DECIMAL(10, 2) DEFAULT 0.01,
  max_lot_size DECIMAL(10, 2) DEFAULT 100,
  leverage_min INTEGER DEFAULT 1,
  leverage_max INTEGER DEFAULT 100,
  spread DECIMAL(10, 2) DEFAULT 0,
  swap_long DECIMAL(10, 4) DEFAULT 0,
  swap_short DECIMAL(10, 4) DEFAULT 0,
  contract_size DECIMAL(10, 2) DEFAULT 1,
  status INTEGER DEFAULT 1,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 插入默认产品
INSERT INTO products (symbol, name, category, description, min_lot_size, max_lot_size, leverage_min, leverage_max, spread, contract_size) VALUES
('XAUUSD', '国际黄金', 'FOREX', '国际现货黄金交易', 0.01, 50, 1, 100, 0.3, 100),
('XAGUSD', '国际白银', 'FOREX', '国际现货白银交易', 0.01, 500, 1, 100, 0.02, 5000),
('XPTUSD', '国际铂金', 'FOREX', '国际现货铂金交易', 0.01, 100, 1, 50, 0.5, 50),
('XPDUSD', '国际钯金', 'FOREX', '国际现货钯金交易', 0.01, 100, 1, 50, 1, 100),
('AU2406', '沪金主力', 'FUTURES', '上海期货交易所黄金主力合约', 0.01, 100, 1, 20, 0.2, 1000),
('AG2406', '沪银主力', 'FUTURES', '上海期货交易所白银主力合约', 0.01, 1000, 1, 20, 2, 15000)
ON CONFLICT (symbol) DO NOTHING;

-- ============================================
-- 7. 订单表
-- ============================================
CREATE TABLE IF NOT EXISTS orders (
  id SERIAL PRIMARY KEY,
  order_id VARCHAR(50) NOT NULL UNIQUE,
  user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
  symbol VARCHAR(20) REFERENCES products(symbol),
  type VARCHAR(20),
  direction VARCHAR(10),
  volume DECIMAL(15, 5),
  price DECIMAL(20, 8),
  leverage INTEGER,
  margin DECIMAL(20, 8),
  stop_loss DECIMAL(20, 8),
  take_profit DECIMAL(20, 8),
  status INTEGER DEFAULT 0,
  filled_price DECIMAL(20, 8),
  filled_volume DECIMAL(15, 5),
  profit DECIMAL(20, 8),
  commission DECIMAL(20, 8),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP,
  filled_at TIMESTAMP,
  closed_at TIMESTAMP
);

-- ============================================
-- 8. 持仓表
-- ============================================
CREATE TABLE IF NOT EXISTS positions (
  id SERIAL PRIMARY KEY,
  position_id VARCHAR(50) NOT NULL UNIQUE,
  user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
  symbol VARCHAR(20) REFERENCES products(symbol),
  direction VARCHAR(10),
  lot_size DECIMAL(15, 5),
  open_price DECIMAL(20, 8),
  leverage INTEGER,
  margin_used DECIMAL(20, 8),
  stop_loss DECIMAL(20, 8),
  take_profit DECIMAL(20, 8),
  liquidation_price DECIMAL(20, 8),
  floating_pl DECIMAL(20, 8) DEFAULT 0,
  realized_pl DECIMAL(20, 8) DEFAULT 0,
  status INTEGER DEFAULT 1,
  open_reason VARCHAR(50),
  close_reason VARCHAR(50),
  close_price DECIMAL(20, 8),
  opened_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  closed_at TIMESTAMP
);

-- ============================================
-- 9. 财务记录表
-- ============================================
CREATE TABLE IF NOT EXISTS financial_records (
  id SERIAL PRIMARY KEY,
  record_id VARCHAR(50) NOT NULL UNIQUE,
  user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
  type VARCHAR(20),
  amount DECIMAL(20, 8),
  method VARCHAR(20),
  status VARCHAR(20) DEFAULT 'pending',
  transaction_hash VARCHAR(100),
  bank_account VARCHAR(100),
  bank_name VARCHAR(100),
  reject_reason TEXT,
  processed_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ============================================
-- 10. 分佣记录表
-- ============================================
CREATE TABLE IF NOT EXISTS commission_records (
  id SERIAL PRIMARY KEY,
  record_id VARCHAR(50) NOT NULL UNIQUE,
  agent_id INTEGER REFERENCES agents(id) ON DELETE CASCADE,
  user_id INTEGER REFERENCES users(id),
  order_id VARCHAR(50) REFERENCES orders(order_id),
  amount DECIMAL(20, 8),
  commission_rate DECIMAL(5, 4),
  level INTEGER DEFAULT 1,
  status VARCHAR(20) DEFAULT 'pending',
  settle_period VARCHAR(20),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  settled_at TIMESTAMP
);

-- ============================================
-- 11. 提现申请表
-- ============================================
CREATE TABLE IF NOT EXISTS withdrawal_requests (
  id SERIAL PRIMARY KEY,
  request_id VARCHAR(50) NOT NULL UNIQUE,
  agent_id INTEGER REFERENCES agents(id) ON DELETE CASCADE,
  amount DECIMAL(20, 8),
  bank_account VARCHAR(100),
  bank_name VARCHAR(100),
  account_name VARCHAR(50),
  status VARCHAR(20) DEFAULT 'pending',
  reject_reason TEXT,
  processed_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ============================================
-- 12. 系统配置表
-- ============================================
CREATE TABLE IF NOT EXISTS system_configs (
  id SERIAL PRIMARY KEY,
  config_key VARCHAR(100) NOT NULL UNIQUE,
  config_value TEXT,
  config_type VARCHAR(20) DEFAULT 'string',
  description TEXT,
  is_active BOOLEAN DEFAULT true,
  is_public BOOLEAN DEFAULT false,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_by INTEGER
);

-- 插入系统配置
INSERT INTO system_configs (config_key, config_value, config_type, description, is_public) VALUES
-- 系统配置
('system_name', '贵金属期货交易系统', 'string', '系统名称', true),
('system_version', '1.0.0', 'string', '系统版本', true),
('maintenance_mode', 'false', 'boolean', '维护模式', false),

-- 交易配置
('min_deposit', '100', 'number', '最小充值金额', true),
('min_withdraw', '100', 'number', '最小提现金额', true),
('max_leverage', '100', 'number', '最大杠杆倍数', true),
('default_leverage', '10', 'number', '默认杠杆倍数', true),

-- 手续费配置
('fee_open_rate', '0.002', 'decimal', '开仓手续费率（小数，0.002=0.2%）', false),
('fee_close_rate', '0.002', 'decimal', '平仓手续费率（小数，0.002=0.2%）', false),
('fee_min_amount', '5', 'numeric', '最小手续费金额（美元）', false),
('fee_swap_long', '0.5', 'decimal', '多头隔夜费（美元/手/天）', false),
('fee_swap_short', '-0.3', 'decimal', '空头隔夜费（美元/手/天）', false),

-- 风控配置
('risk_max_margin_level', '100', 'number', '最大保证金比例（警告）', false),
('risk_liquidation_level', '80', 'number', '强平保证金比例', false),
('risk_force_close_enabled', 'true', 'boolean', '启用强制平仓', false),

-- 分佣配置
('commission_level_1_rate', '0.0001', 'number', '一级代理分佣比例', false),
('commission_level_2_rate', '0.00005', 'number', '二级代理分佣比例', false),
('commission_min_withdraw', '100', 'number', '分佣最小提现金额', false),
('commission_settlement_period', 'weekly', 'string', '分佣结算周期', false),

-- API配置
('api_rate_limit', '1000', 'number', 'API请求限流（每15分钟）', false),
('api_timeout', '30000', 'number', 'API超时时间（毫秒）', false)
ON CONFLICT (config_key) DO NOTHING;

-- ============================================
-- 13. 行情数据表
-- ============================================
CREATE TABLE IF NOT EXISTS market_data (
  id SERIAL PRIMARY KEY,
  symbol VARCHAR(20) NOT NULL UNIQUE,
  bid_price DECIMAL(20, 8),
  ask_price DECIMAL(20, 8),
  last_price DECIMAL(20, 8),
  change_percent DECIMAL(10, 4),
  volume DECIMAL(20, 2),
  high_24h DECIMAL(20, 8),
  low_24h DECIMAL(20, 8),
  open_24h DECIMAL(20, 8),
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 插入初始行情数据
INSERT INTO market_data (symbol, bid_price, ask_price, last_price, high_24h, low_24h, open_24h, volume) VALUES
('XAUUSD', 2345.50, 2346.20, 2345.85, 2360.00, 2335.00, 2340.00, 1250000),
('XAGUSD', 22.85, 22.90, 22.87, 23.20, 22.50, 22.80, 850000),
('XPTUSD', 1015.50, 1016.80, 1016.15, 1025.00, 1010.00, 1015.00, 45000),
('XPDUSD', 1850.20, 1852.50, 1851.35, 1870.00, 1840.00, 1855.00, 25000),
('AU2406', 505.80, 506.40, 506.10, 510.00, 502.00, 505.00, 850000),
('AG2406', 5680.00, 5690.00, 5685.00, 5720.00, 5640.00, 5670.00, 420000)
ON CONFLICT (symbol) DO NOTHING;

-- ============================================
-- 14. 创建默认管理员账户
-- ============================================
-- 密码: admin123 (需要在实际使用时修改)
-- 先创建用户
INSERT INTO users (username, password, real_name, phone, email, role_id, status)
VALUES ('admin', '$2a$10$YourHashedPasswordHere', '系统管理员', '13800000000', 'admin@example.com', 1, 1)
ON CONFLICT (username) DO NOTHING;

-- 为管理员创建账户
INSERT INTO accounts (user_id, balance, available_balance)
SELECT id, 1000000, 1000000 FROM users WHERE username = 'admin'
ON CONFLICT (user_id) DO NOTHING;

-- ============================================
-- 15. 创建索引
-- ============================================
CREATE INDEX IF NOT EXISTS idx_users_username ON users(username);
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_phone ON users(phone);
CREATE INDEX IF NOT EXISTS idx_users_agent_id ON users(agent_id);
CREATE INDEX IF NOT EXISTS idx_users_status ON users(status);

CREATE INDEX IF NOT EXISTS idx_accounts_user_id ON accounts(user_id);

CREATE INDEX IF NOT EXISTS idx_agents_user_id ON agents(user_id);
CREATE INDEX IF NOT EXISTS idx_agents_parent_agent_id ON agents(parent_agent_id);
CREATE INDEX IF NOT EXISTS idx_agents_agent_code ON agents(agent_code);
CREATE INDEX IF NOT EXISTS idx_agents_status ON agents(status);

CREATE INDEX IF NOT EXISTS idx_orders_user_id ON orders(user_id);
CREATE INDEX IF NOT EXISTS idx_orders_symbol ON orders(symbol);
CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status);
CREATE INDEX IF NOT EXISTS idx_orders_created_at ON orders(created_at);

CREATE INDEX IF NOT EXISTS idx_positions_user_id ON positions(user_id);
CREATE INDEX IF NOT EXISTS idx_positions_symbol ON positions(symbol);
CREATE INDEX IF NOT EXISTS idx_positions_status ON positions(status);
CREATE INDEX IF NOT EXISTS idx_positions_liquidation_price ON positions(liquidation_price);

CREATE INDEX IF NOT EXISTS idx_financial_records_user_id ON financial_records(user_id);
CREATE INDEX IF NOT EXISTS idx_financial_records_type ON financial_records(type);
CREATE INDEX IF NOT EXISTS idx_financial_records_status ON financial_records(status);
CREATE INDEX IF NOT EXISTS idx_financial_records_created_at ON financial_records(created_at);

CREATE INDEX IF NOT EXISTS idx_commission_records_agent_id ON commission_records(agent_id);
CREATE INDEX IF NOT EXISTS idx_commission_records_status ON commission_records(status);
CREATE INDEX IF NOT EXISTS idx_commission_records_created_at ON commission_records(created_at);

CREATE INDEX IF NOT EXISTS idx_market_data_symbol ON market_data(symbol);
CREATE INDEX IF NOT EXISTS idx_market_data_updated_at ON market_data(updated_at);

-- ============================================
-- 完成初始化
-- ============================================
-- 数据库初始化完成
