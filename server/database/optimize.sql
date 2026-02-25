-- ====================================================
-- 性能优化脚本 - 添加数据库索引
-- PostgreSQL 14+
-- ====================================================

-- ====================================================
-- 一、订单表索引优化
-- ====================================================

-- 用户ID索引（加速查询用户订单）
CREATE INDEX IF NOT EXISTS idx_orders_user_id ON orders(user_id);

-- 产品代码索引（加速查询产品订单）
CREATE INDEX IF NOT EXISTS idx_orders_product_code ON orders(product_code);

-- 订单状态索引（加速筛选待成交订单）
CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status);

-- 订单类型索引
CREATE INDEX IF NOT EXISTS idx_orders_type ON orders(type);

-- 复合索引：用户+状态（最常用的查询组合）
CREATE INDEX IF NOT EXISTS idx_orders_user_status ON orders(user_id, status);

-- 创建时间索引（用于时间范围查询）
CREATE INDEX IF NOT EXISTS idx_orders_created_at ON orders(created_at);

-- 复合索引：产品+时间（用于查询历史行情）
CREATE INDEX IF NOT EXISTS idx_orders_product_time ON orders(product_code, created_at);

-- ====================================================
-- 二、持仓表索引优化
-- ====================================================

-- 用户ID索引（加速查询用户持仓）
CREATE INDEX IF NOT EXISTS idx_positions_user_id ON positions(user_id);

-- 产品代码索引（加速查询产品持仓）
CREATE INDEX IF NOT EXISTS idx_positions_product_code ON positions(product_code);

-- 持仓状态索引
CREATE INDEX IF NOT EXISTS idx_positions_status ON positions(status);

-- 复合索引：用户+产品（查询特定产品的持仓）
CREATE INDEX IF NOT EXISTS idx_positions_user_product ON positions(user_id, product_code);

-- 复合索引：用户+状态（查询活跃持仓）
CREATE INDEX IF NOT EXISTS idx_positions_user_status ON positions(user_id, status);

-- ====================================================
-- 三、交易记录表索引优化
-- ====================================================

-- 用户ID索引
CREATE INDEX IF NOT EXISTS idx_trades_user_id ON trades(user_id);

-- 订单ID索引（关联查询）
CREATE INDEX IF NOT EXISTS idx_trades_order_id ON trades(order_id);

-- 产品代码索引
CREATE INDEX IF NOT EXISTS idx_trades_product_code ON trades(product_code);

-- 交易时间索引
CREATE INDEX IF NOT EXISTS idx_trades_created_at ON trades(created_at);

-- 复合索引：用户+时间（查询交易历史）
CREATE INDEX IF NOT EXISTS idx_trades_user_time ON trades(user_id, created_at);

-- ====================================================
-- 四、账户表索引优化
-- ====================================================

-- 用户ID索引（唯一索引已在主键中）

-- 账户状态索引（查询活跃账户）
CREATE INDEX IF NOT EXISTS idx_accounts_status ON accounts(status);

-- 更新时间索引
CREATE INDEX IF NOT EXISTS idx_accounts_updated_at ON accounts(updated_at);

-- ====================================================
-- 五、财务记录表索引优化
-- ====================================================

-- 用户ID索引
CREATE INDEX IF NOT EXISTS idx_finance_records_user_id ON finance_records(user_id);

-- 记录类型索引（区分充值、提现等）
CREATE INDEX IF NOT EXISTS idx_finance_records_type ON finance_records(type);

-- 状态索引
CREATE INDEX IF NOT EXISTS idx_finance_records_status ON finance_records(status);

-- 创建时间索引
CREATE INDEX IF NOT EXISTS idx_finance_records_created_at ON finance_records(created_at);

-- 复合索引：用户+类型（查询特定类型的财务记录）
CREATE INDEX IF NOT EXISTS idx_finance_records_user_type ON finance_records(user_id, type);

-- 复合索引：用户+时间（查询财务历史）
CREATE INDEX IF NOT EXISTS idx_finance_records_user_time ON finance_records(user_id, created_at);

-- ====================================================
-- 六、用户表索引优化
-- ====================================================

-- 用户名索引（唯一索引已在表定义中）

-- 邮箱索引（唯一索引已在表定义中）

-- 手机号索引（唯一索引已在表定义中）

-- 角色ID索引（查询同角色用户）
CREATE INDEX IF NOT EXISTS idx_users_role_id ON users(role_id);

-- 代理ID索引（查询代理下的用户）
CREATE INDEX IF NOT EXISTS idx_users_agent_id ON users(agent_id);

-- 用户状态索引
CREATE INDEX IF NOT EXISTS idx_users_status ON users(status);

-- 注册时间索引
CREATE INDEX IF NOT EXISTS idx_users_created_at ON users(created_at);

-- ====================================================
-- 七、代理表索引优化
-- ====================================================

-- 用户ID索引（已在表定义中）

-- 代理代码索引（已在表定义中）

-- 代理等级索引
CREATE INDEX IF NOT EXISTS idx_agents_agent_level ON agents(agent_level);

-- 上级代理ID索引
CREATE INDEX IF NOT EXISTS idx_agents_parent_agent_id ON agents(parent_agent_id);

-- 代理状态索引
CREATE INDEX IF NOT EXISTS idx_agents_status ON agents(status);

-- ====================================================
-- 八、产品表索引优化
-- ====================================================

-- 产品代码索引（已在表定义中）

-- 分类ID索引
CREATE INDEX IF NOT EXISTS idx_products_category_id ON products(category_id);

-- 产品状态索引
CREATE INDEX IF NOT EXISTS idx_products_status ON products(status);

-- ====================================================
-- 九、统计视图（可选，用于加速复杂查询）
-- ====================================================

-- 用户账户汇总视图
CREATE OR REPLACE VIEW v_user_account_summary AS
SELECT
    u.id as user_id,
    u.username,
    u.status,
    a.total_balance,
    a.available_balance,
    a.frozen_margin,
    a.realized_pnl,
    a.unrealized_pnl,
    a.risk_level,
    a.updated_at
FROM users u
LEFT JOIN accounts a ON u.id = a.user_id
WHERE u.deleted_at IS NULL;

-- 用户订单统计视图
CREATE OR REPLACE VIEW v_user_order_stats AS
SELECT
    user_id,
    COUNT(*) as total_orders,
    COUNT(CASE WHEN status = 'FILLED' THEN 1 END) as filled_orders,
    COUNT(CASE WHEN status = 'PENDING' THEN 1 END) as pending_orders,
    COUNT(CASE WHEN status = 'CANCELLED' THEN 1 END) as cancelled_orders,
    SUM(CASE WHEN status = 'FILLED' THEN quantity ELSE 0 END) as total_filled_quantity,
    MAX(created_at) as last_order_time
FROM orders
GROUP BY user_id;

-- 产品交易统计视图
CREATE OR REPLACE VIEW v_product_trade_stats AS
SELECT
    product_code,
    COUNT(*) as total_trades,
    SUM(quantity) as total_quantity,
    AVG(price) as avg_price,
    MAX(price) as max_price,
    MIN(price) as min_price,
    MAX(created_at) as last_trade_time
FROM trades
GROUP BY product_code;

-- ====================================================
-- 十、索引维护建议
-- ====================================================

-- 定期重建索引（建议每周执行一次）
-- REINDEX TABLE orders;
-- REINDEX TABLE positions;
-- REINDEX TABLE trades;
-- REINDEX TABLE finance_records;

-- 分析统计信息（建议每天执行一次）
-- ANALYZE orders;
-- ANALYZE positions;
-- ANALYZE trades;
-- ANALYZE finance_records;

-- ====================================================
-- 注意事项
-- ====================================================

-- 1. 索引会占用额外存储空间，但能显著提升查询性能
-- 2. 写入操作时索引会略微降低性能，但对于交易系统读多写少的场景非常有利
-- 3. 建议在业务低峰期执行索引创建操作
-- 4. 执行此脚本前请确保数据库有足够的存储空间
-- 5. 可以根据实际查询模式调整或添加额外的索引
