-- ====================================================
-- 数据库索引优化脚本
-- 用于提升查询性能
-- ====================================================

-- ====================================================
-- 用户表索引
-- ====================================================

-- 用户名索引(登录时频繁查询)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_users_username ON users(username);

-- 手机号索引(手机号登录)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_users_phone ON users(phone);

-- 邮箱索引(邮箱登录/找回密码)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_users_email ON users(email);

-- 推荐码索引(注册时查询推荐人)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_users_referral_code ON users(referral_code);

-- 状态索引(查询正常用户)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_users_status ON users(status);

-- 组合索引: 角色和状态(管理后台查询)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_users_role_status ON users(role_id, status);

-- ====================================================
-- 订单表索引
-- ====================================================

-- 用户ID和状态索引(用户查询订单)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_orders_user_status ON orders(user_id, status, created_at DESC);

-- 产品ID和状态索引(系统查询订单)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_orders_product_status ON orders(product_id, status, created_at DESC);

-- 订单号索引(根据订单号查询)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_orders_order_number ON orders(order_number);

-- 创建时间索引(按时间范围查询)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_orders_created_at ON orders(created_at DESC);

-- 组合索引: 用户、产品、状态(特定用户特定产品的订单)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_orders_user_product_status ON orders(user_id, product_id, status);

-- ====================================================
-- 持仓表索引
-- ====================================================

-- 用户ID和状态索引(用户查询持仓)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_positions_user_status ON positions(user_id, status, open_time DESC);

-- 产品ID和状态索引(系统查询持仓)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_positions_product_status ON positions(product_id, status);

-- 持仓号索引
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_positions_position_number ON positions(position_number);

-- 开仓时间索引(按时间查询)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_positions_open_time ON positions(open_time DESC);

-- 组合索引: 用户、方向、状态(查询多头/空头持仓)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_positions_user_direction_status ON positions(user_id, direction, status);

-- ====================================================
-- 成交记录表索引
-- ====================================================

-- 订单ID索引(查询订单的成交记录)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_trades_order_id ON trades(order_id);

-- 用户ID索引(用户查询成交记录)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_trades_user_id ON trades(user_id, timestamp DESC);

-- 产品代码索引(查询特定产品的成交)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_trades_product_code ON trades(product_code, timestamp DESC);

-- 时间戳索引(按时间范围查询)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_trades_timestamp ON trades(timestamp DESC);

-- ====================================================
-- 账户表索引
-- ====================================================

-- 用户ID索引(查询用户账户)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_accounts_user_id ON accounts(user_id);

-- 账户号索引
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_accounts_account_number ON accounts(account_number);

-- ====================================================
-- 充值订单表索引
-- ====================================================

-- 组合索引: 用户、状态、创建时间(分页查询)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_deposit_orders_user_status_created ON deposit_orders(user_id, status, created_at DESC);

-- 订单号索引
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_deposit_orders_order_number ON deposit_orders(order_number);

-- 创建时间索引
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_deposit_orders_created_at ON deposit_orders(created_at DESC);

-- ====================================================
-- 提现订单表索引
-- ====================================================

-- 组合索引: 用户、状态、创建时间(分页查询)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_withdraw_orders_user_status_created ON withdraw_orders(user_id, status, created_at DESC);

-- 订单号索引
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_withdraw_orders_order_number ON withdraw_orders(order_number);

-- 创建时间索引
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_withdraw_orders_created_at ON withdraw_orders(created_at DESC);

-- ====================================================
-- 代理表索引
-- ====================================================

-- 用户ID索引
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_agents_user_id ON agents(user_id);

-- 代理代码索引
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_agents_agent_code ON agents(agent_code);

-- 上级代理ID索引
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_agents_parent_agent_id ON agents(parent_agent_id);

-- 状态索引
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_agents_status ON agents(status);

-- ====================================================
-- 风控规则表索引
-- ====================================================

-- 规则类型索引(查询特定类型的规则)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_risk_rules_rule_type ON risk_rules(rule_type);

-- ====================================================
-- 产品表索引
-- ====================================================

-- 产品代码索引(高频查询)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_products_symbol ON products(symbol);

-- 分类ID索引
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_products_category_id ON products(category_id);

-- 状态索引
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_products_status ON products(status);

-- ====================================================
-- 行情数据表索引
-- ====================================================

-- 产品ID索引(高频查询)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_market_rates_product_id ON market_rates(product_id);

-- 产品ID和时间戳索引(查询历史行情)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_market_rates_product_timestamp ON market_rates(product_id, timestamp DESC);

-- 时间戳索引(清理历史数据)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_market_rates_timestamp ON market_rates(timestamp DESC);

-- ====================================================
-- K线数据表索引
-- ====================================================

-- 产品ID、周期、时间戳索引(查询K线数据)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_klines_product_period_time ON klines(product_id, period, timestamp DESC);

-- 时间戳索引(清理历史数据)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_klines_timestamp ON klines(timestamp DESC);

-- ====================================================
-- AI分析记录表索引
-- ====================================================

-- 用户ID索引
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_ai_analyses_user_id ON ai_analyses(user_id, created_at DESC);

-- 产品ID索引
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_ai_analyses_product_id ON ai_analyses(product_id, created_at DESC);

-- ====================================================
-- 操作日志表索引
-- ====================================================

-- 用户ID索引(查询用户操作)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_operation_logs_user_id ON operation_logs(user_id, created_at DESC);

-- 操作类型索引
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_operation_logs_action ON operation_logs(action, created_at DESC);

-- IP地址索引(安全审计)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_operation_logs_ip ON operation_logs(ip_address, created_at DESC);

-- 创建时间索引(清理历史日志)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_operation_logs_created_at ON operation_logs(created_at DESC);

-- ====================================================
-- 验证码表(如果存在)
-- ====================================================

-- 邮箱索引
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_verification_codes_email ON verification_codes(email, created_at DESC);

-- 创建时间索引(清理过期验证码)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_verification_codes_created_at ON verification_codes(created_at DESC);

-- ====================================================
-- 索引创建完成
-- ====================================================

-- 显示所有创建的索引
SELECT
    schemaname,
    tablename,
    indexname,
    indexdef
FROM pg_indexes
WHERE tablename IN (
    'users', 'orders', 'positions', 'trades', 'accounts',
    'deposit_orders', 'withdraw_orders', 'agents', 'risk_rules',
    'products', 'market_rates', 'klines', 'ai_analyses', 'operation_logs'
)
ORDER BY tablename, indexname;

-- ====================================================
-- 统计信息更新
-- ====================================================

-- 更新所有表的统计信息
ANALYZE users;
ANALYZE orders;
ANALYZE positions;
ANALYZE trades;
ANALYZE accounts;
ANALYZE deposit_orders;
ANALYZE withdraw_orders;
ANALYZE agents;
ANALYZE risk_rules;
ANALYZE products;
ANALYZE market_rates;
ANALYZE klines;
ANALYZE ai_analyses;
ANALYZE operation_logs;
