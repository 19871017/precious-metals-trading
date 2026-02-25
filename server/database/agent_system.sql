-- 贵金属期货交易系统 - 代理分级管理数据库设计
-- 包含：管理员、总代理、分代理、客户四级账号体系

-- ============================================
-- 1. 管理员表 (super_admin)
-- ============================================
CREATE TABLE super_admin (
    id BIGSERIAL PRIMARY KEY,
    username VARCHAR(50) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    real_name VARCHAR(50),
    email VARCHAR(100),
    phone VARCHAR(20),
    status SMALLINT DEFAULT 1, -- 1:正常, 0:禁用
    last_login_time TIMESTAMP,
    last_login_ip VARCHAR(50),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

COMMENT ON TABLE super_admin IS '超级管理员表';
COMMENT ON COLUMN super_admin.username IS '管理员用户名';
COMMENT ON COLUMN super_admin.password_hash IS '密码哈希值';
COMMENT ON COLUMN super_admin.status IS '状态:1-正常,0-禁用';

-- ============================================
-- 2. 代理表 (agents) - 统一管理总代理和分代理
-- ============================================
CREATE TABLE agents (
    id BIGSERIAL PRIMARY KEY,
    agent_code VARCHAR(20) UNIQUE NOT NULL, -- 代理唯一ID，用于前端注册识别
    agent_type SMALLINT NOT NULL, -- 1:总代理, 2:分代理
    parent_agent_id BIGINT, -- 上级代理ID（分代理必填，总代理为NULL）
    username VARCHAR(50) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    real_name VARCHAR(50),
    phone VARCHAR(20) UNIQUE NOT NULL,
    email VARCHAR(100),
    id_card VARCHAR(18), -- 身份证号（实名认证）
    id_card_front VARCHAR(255), -- 身份证正面照片
    id_card_back VARCHAR(255), -- 身份证背面照片
    bank_name VARCHAR(50), -- 开户银行
    bank_account VARCHAR(50), -- 银行账号
    bank_account_name VARCHAR(50), -- 开户人姓名
    status SMALLINT DEFAULT 1, -- 1:正常, 0:禁用, 2:审核中
    commission_rate DECIMAL(5,4) DEFAULT 0.0000, -- 分佣比例 (0.0000 ~ 1.0000)
    total_balance DECIMAL(20,2) DEFAULT 0.00, -- 累计分佣金额
    available_balance DECIMAL(20,2) DEFAULT 0.00, -- 可提现分佣金额
    frozen_balance DECIMAL(20,2) DEFAULT 0.00, -- 冻结金额
    total_users INTEGER DEFAULT 0, -- 直属客户数
    total_sub_agents INTEGER DEFAULT 0, -- 直属分代理数
    total_trading_volume DECIMAL(20,2) DEFAULT 0.00, -- 累计交易量
    register_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT fk_agent_parent FOREIGN KEY (parent_agent_id) REFERENCES agents(id) ON DELETE SET NULL
);

COMMENT ON TABLE agents IS '代理表（总代理+分代理）';
COMMENT ON COLUMN agents.agent_code IS '代理唯一代码，用于前端注册识别';
COMMENT ON COLUMN agents.agent_type IS '代理类型:1-总代理,2-分代理';
COMMENT ON COLUMN agents.parent_agent_id IS '上级代理ID（分代理关联总代理）';
COMMENT ON COLUMN agents.status IS '状态:1-正常,0-禁用,2-审核中';
COMMENT ON COLUMN agents.commission_rate IS '分佣比例';
COMMENT ON COLUMN agents.total_balance IS '累计分佣总金额';

-- 代理表索引
CREATE INDEX idx_agents_agent_code ON agents(agent_code);
CREATE INDEX idx_agents_type ON agents(agent_type);
CREATE INDEX idx_agents_parent ON agents(parent_agent_id);
CREATE INDEX idx_agents_status ON agents(status);

-- ============================================
-- 3. 客户表 (users)
-- ============================================
CREATE TABLE users (
    id BIGSERIAL PRIMARY KEY,
    username VARCHAR(50) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    real_name VARCHAR(50),
    phone VARCHAR(20) UNIQUE NOT NULL,
    email VARCHAR(100),
    agent_id BIGINT NOT NULL, -- 归属代理ID
    agent_type SMALLINT, -- 代理类型（冗余字段，便于查询）：1-总代理, 2-分代理
    parent_agent_id BIGINT, -- 总代理ID（如果代理是分代理，记录其总代理）
    avatar VARCHAR(255),
    status SMALLINT DEFAULT 1, -- 1:正常, 0:禁用
    risk_level SMALLINT DEFAULT 1, -- 风险等级:1-低,2-中,3-高
    leverage_limit SMALLINT DEFAULT 100, -- 杠杆限制
    daily_loss_limit DECIMAL(20,2) DEFAULT 10000.00, -- 单日最大亏损
    total_balance DECIMAL(20,2) DEFAULT 10000.00, -- 总资产
    available_funds DECIMAL(20,2) DEFAULT 10000.00, -- 可用资金
    frozen_margin DECIMAL(20,2) DEFAULT 0.00, -- 冻结保证金
    floating_profit DECIMAL(20,2) DEFAULT 0.00, -- 浮动盈亏
    realized_profit DECIMAL(20,2) DEFAULT 0.00, -- 已实现盈亏
    total_deposit DECIMAL(20,2) DEFAULT 0.00, -- 累计充值
    total_withdraw DECIMAL(20,2) DEFAULT 0.00, -- 累计提现
    register_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    last_login_time TIMESTAMP,
    last_login_ip VARCHAR(50),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT fk_user_agent FOREIGN KEY (agent_id) REFERENCES agents(id) ON DELETE RESTRICT
);

COMMENT ON TABLE users IS '客户表';
COMMENT ON COLUMN users.agent_id IS '归属代理ID';
COMMENT ON COLUMN users.agent_type IS '代理类型:1-总代理,2-分代理';
COMMENT ON COLUMN users.parent_agent_id IS '总代理ID（如果代理是分代理）';

-- 用户表索引
CREATE INDEX idx_users_agent_id ON users(agent_id);
CREATE INDEX idx_users_parent_agent ON users(parent_agent_id);
CREATE INDEX idx_users_phone ON users(phone);
CREATE INDEX idx_users_status ON users(status);

-- ============================================
-- 4. 代理关系层级表 (agent_hierarchy) - 记录完整的代理层级
-- ============================================
CREATE TABLE agent_hierarchy (
    id BIGSERIAL PRIMARY KEY,
    agent_id BIGINT NOT NULL, -- 代理ID
    ancestor_agent_id BIGINT NOT NULL, -- 祖先代理ID（包括自身）
    ancestor_type SMALLINT NOT NULL, -- 祖先类型:1-总代理,2-分代理
    level SMALLINT NOT NULL, -- 层级:0-自身,1-直属上级,2-上上级
    path VARCHAR(255), -- 完整路径: /1/2/3/
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT fk_hierarchy_agent FOREIGN KEY (agent_id) REFERENCES agents(id) ON DELETE CASCADE,
    CONSTRAINT fk_hierarchy_ancestor FOREIGN KEY (ancestor_agent_id) REFERENCES agents(id) ON DELETE CASCADE
);

COMMENT ON TABLE agent_hierarchy IS '代理关系层级表';
COMMENT ON COLUMN agent_hierarchy.level IS '层级:0-自身,1-直属上级,2-上上级';
COMMENT ON COLUMN agent_hierarchy.path IS '完整路径: /1/2/3/';

-- 层级表索引
CREATE INDEX idx_hierarchy_agent ON agent_hierarchy(agent_id);
CREATE INDEX idx_hierarchy_ancestor ON agent_hierarchy(ancestor_agent_id);
CREATE INDEX idx_hierarchy_path ON agent_hierarchy(path);

-- ============================================
-- 5. 代理分佣表 (agent_commission)
-- ============================================
CREATE TABLE agent_commission (
    id BIGSERIAL PRIMARY KEY,
    agent_id BIGINT NOT NULL, -- 获佣代理ID
    user_id BIGINT NOT NULL, -- 产生分佣的客户ID
    order_id BIGINT, -- 关联订单ID
    transaction_id BIGINT, -- 关联交易ID
    commission_type SMALLINT NOT NULL, -- 分佣类型:1-交易手续费,2-客户盈亏分成
    commission_amount DECIMAL(20,2) NOT NULL, -- 分佣金额
    commission_rate DECIMAL(5,4) NOT NULL, -- 分佣比例
    commission_from DECIMAL(20,2), -- 分佣来源金额
    status SMALLINT DEFAULT 0, -- 0-待结算,1-已结算,2-已提现
    settle_time TIMESTAMP, -- 结算时间
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT fk_commission_agent FOREIGN KEY (agent_id) REFERENCES agents(id) ON DELETE RESTRICT,
    CONSTRAINT fk_commission_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

COMMENT ON TABLE agent_commission IS '代理分佣记录表';
COMMENT ON COLUMN agent_commission.commission_type IS '分佣类型:1-交易手续费,2-客户盈亏分成';
COMMENT ON COLUMN agent_commission.status IS '状态:0-待结算,1-已结算,2-已提现';

-- 分佣表索引
CREATE INDEX idx_commission_agent ON agent_commission(agent_id);
CREATE INDEX idx_commission_user ON agent_commission(user_id);
CREATE INDEX idx_commission_status ON agent_commission(status);

-- ============================================
-- 6. 代理提现表 (agent_withdraw)
-- ============================================
CREATE TABLE agent_withdraw (
    id BIGSERIAL PRIMARY KEY,
    agent_id BIGINT NOT NULL,
    withdraw_amount DECIMAL(20,2) NOT NULL,
    fee DECIMAL(20,2) DEFAULT 0.00,
    actual_amount DECIMAL(20,2) NOT NULL,
    bank_name VARCHAR(50),
    bank_account VARCHAR(50),
    account_name VARCHAR(50),
    status SMALLINT DEFAULT 0, -- 0-待审核,1-已通过,2-已拒绝,3-处理中
    remark VARCHAR(255),
    approved_by BIGINT, -- 审核人
    approved_time TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT fk_withdraw_agent FOREIGN KEY (agent_id) REFERENCES agents(id) ON DELETE RESTRICT
);

COMMENT ON TABLE agent_withdraw IS '代理提现记录表';
COMMENT ON COLUMN agent_withdraw.status IS '状态:0-待审核,1-已通过,2-已拒绝,3-处理中';

-- ============================================
-- 7. 代理统计表 (agent_statistics) - 每日统计
-- ============================================
CREATE TABLE agent_statistics (
    id BIGSERIAL PRIMARY KEY,
    agent_id BIGINT NOT NULL,
    stat_date DATE NOT NULL,
    new_users INTEGER DEFAULT 0, -- 新增客户数
    total_users INTEGER DEFAULT 0, -- 总客户数
    active_users INTEGER DEFAULT 0, -- 活跃客户数
    total_trades INTEGER DEFAULT 0, -- 总交易笔数
    total_volume DECIMAL(20,2) DEFAULT 0.00, -- 总交易量
    total_commission DECIMAL(20,2) DEFAULT 0.00, -- 分佣总额
    commission_withdraw DECIMAL(20,2) DEFAULT 0.00, -- 分佣提现
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT fk_stat_agent FOREIGN KEY (agent_id) REFERENCES agents(id) ON DELETE RESTRICT,
    CONSTRAINT uk_agent_date UNIQUE (agent_id, stat_date)
);

COMMENT ON TABLE agent_statistics IS '代理每日统计表';

-- ============================================
-- 触发器：自动维护代理层级关系
-- ============================================
CREATE OR REPLACE FUNCTION update_agent_hierarchy()
RETURNS TRIGGER AS $$
BEGIN
    -- 新增代理时，创建层级记录
    IF TG_OP = 'INSERT' THEN
        -- 插入自身记录
        INSERT INTO agent_hierarchy (agent_id, ancestor_agent_id, ancestor_type, level, path)
        VALUES (NEW.id, NEW.id, NEW.agent_type, 0, '/' || NEW.id || '/');

        -- 如果有上级代理，复制上级的所有祖先
        IF NEW.parent_agent_id IS NOT NULL THEN
            INSERT INTO agent_hierarchy (agent_id, ancestor_agent_id, ancestor_type, level, path)
            SELECT
                NEW.id,
                ah.ancestor_agent_id,
                ah.ancestor_type,
                ah.level + 1,
                ah.path || NEW.id || '/'
            FROM agent_hierarchy ah
            WHERE ah.agent_id = NEW.parent_agent_id;
        END IF;

    -- 更新代理时
    ELSIF TG_OP = 'UPDATE' THEN
        -- 如果上级代理改变，重建层级关系
        IF OLD.parent_agent_id IS DISTINCT FROM NEW.parent_agent_id THEN
            -- 删除旧层级
            DELETE FROM agent_hierarchy WHERE agent_id = NEW.id;

            -- 重建层级
            INSERT INTO agent_hierarchy (agent_id, ancestor_agent_id, ancestor_type, level, path)
            VALUES (NEW.id, NEW.id, NEW.agent_type, 0, '/' || NEW.id || '/');

            IF NEW.parent_agent_id IS NOT NULL THEN
                INSERT INTO agent_hierarchy (agent_id, ancestor_agent_id, ancestor_type, level, path)
                SELECT
                    NEW.id,
                    ah.ancestor_agent_id,
                    ah.ancestor_type,
                    ah.level + 1,
                    ah.path || NEW.id || '/'
                FROM agent_hierarchy ah
                WHERE ah.agent_id = NEW.parent_agent_id;
            END IF;
        END IF;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_agent_hierarchy
AFTER INSERT OR UPDATE ON agents
FOR EACH ROW EXECUTE FUNCTION update_agent_hierarchy();

-- ============================================
-- 触发器：更新代理统计数据
-- ============================================
CREATE OR REPLACE FUNCTION update_agent_stats()
RETURNS TRIGGER AS $$
BEGIN
    -- 更新上级代理的客户数统计
    IF NEW.agent_id IS NOT NULL THEN
        UPDATE agents
        SET total_users = total_users + 1
        WHERE id = NEW.agent_id;

        -- 如果代理是分代理，也更新总代理的统计
        IF NEW.parent_agent_id IS NOT NULL THEN
            UPDATE agents
            SET total_users = total_users + 1
            WHERE id = NEW.parent_agent_id;
        END IF;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_update_agent_stats
AFTER INSERT ON users
FOR EACH ROW EXECUTE FUNCTION update_agent_stats();

-- ============================================
-- 视图：代理完整信息
-- ============================================
CREATE OR REPLACE VIEW v_agent_full_info AS
SELECT
    a.*,
    CASE
        WHEN a.agent_type = 1 THEN '总代理'
        WHEN a.agent_type = 2 THEN '分代理'
        ELSE '未知'
    END as agent_type_name,
    CASE
        WHEN a.status = 1 THEN '正常'
        WHEN a.status = 0 THEN '禁用'
        WHEN a.status = 2 THEN '审核中'
        ELSE '未知'
    END as status_name,
    p.username as parent_agent_name,
    p.agent_code as parent_agent_code,
    (SELECT COUNT(*) FROM users WHERE agent_id = a.id) as direct_users_count,
    (SELECT COUNT(*) FROM agents WHERE parent_agent_id = a.id) as direct_sub_agents_count,
    (SELECT COUNT(*) FROM users WHERE parent_agent_id = a.id) as indirect_users_count
FROM agents a
LEFT JOIN agents p ON a.parent_agent_id = p.id;

-- ============================================
-- 视图：客户完整信息（包含代理信息）
-- ============================================
CREATE OR REPLACE VIEW v_user_full_info AS
SELECT
    u.*,
    a.agent_code,
    a.agent_type,
    a.real_name as agent_name,
    a.phone as agent_phone,
    CASE
        WHEN u.agent_type = 1 THEN '总代理'
        WHEN u.agent_type = 2 THEN '分代理'
        ELSE '未知'
    END as agent_type_name,
    p.agent_code as parent_agent_code,
    p.real_name as parent_agent_name
FROM users u
JOIN agents a ON u.agent_id = a.id
LEFT JOIN agents p ON u.parent_agent_id = p.id;

-- ============================================
-- 函数：查询代理下的所有客户（包括分代理的客户）
-- ============================================
CREATE OR REPLACE FUNCTION get_agent_all_users(p_agent_id BIGINT)
RETURNS TABLE (
    user_id BIGINT,
    username VARCHAR(50),
    real_name VARCHAR(50),
    phone VARCHAR(20),
    agent_id BIGINT,
    is_direct BOOLEAN
) AS $$
BEGIN
    RETURN QUERY
    SELECT
        u.id,
        u.username,
        u.real_name,
        u.phone,
        u.agent_id,
        (u.agent_id = p_agent_id) as is_direct
    FROM users u
    JOIN agent_hierarchy ah ON ah.agent_id = u.agent_id
    WHERE ah.ancestor_agent_id = p_agent_id AND ah.level > 0;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- 初始化测试数据
-- ============================================

-- 创建超级管理员（密码: admin123）
INSERT INTO super_admin (username, password_hash, real_name, email, phone)
VALUES ('admin', '$2a$10$Y8q5N5sW9yK9yK9yK9yK9e', '系统管理员', 'admin@example.com', '13800000000');

-- 创建总代理（代理代码: AGENT001, 密码: agent001）
INSERT INTO agents (agent_code, agent_type, parent_agent_id, username, password_hash, real_name, phone, email, commission_rate)
VALUES ('AGENT001', 1, NULL, 'agent001', '$2a$10$agent001hash', '张总代', '13800001001', 'agent001@example.com', 0.0030);

-- 创建分代理（代理代码: AGENT002, 密码: agent002）
INSERT INTO agents (agent_code, agent_type, parent_agent_id, username, password_hash, real_name, phone, email, commission_rate)
VALUES ('AGENT002', 2, 1, 'agent002', '$2a$10$agent002hash', '李分代', '13800001002', 'agent002@example.com', 0.0015);

-- 创建另一个总代理
INSERT INTO agents (agent_code, agent_type, parent_agent_id, username, password_hash, real_name, phone, email, commission_rate)
VALUES ('AGENT003', 1, NULL, 'agent003', '$2a$10$agent003hash', '王总代', '13800001003', 'agent003@example.com', 0.0030);

-- 创建测试客户（归属于代理001）
INSERT INTO users (username, password_hash, real_name, phone, email, agent_id, agent_type, total_balance, available_funds)
VALUES
    ('user001', '$2a$10$user001hash', '客户一', '13800002001', 'user001@example.com', 1, 1, 10000.00, 10000.00),
    ('user002', '$2a$10$user002hash', '客户二', '13800002002', 'user002@example.com', 1, 1, 15000.00, 15000.00);

-- 创建测试客户（归属于分代理002）
INSERT INTO users (username, password_hash, real_name, phone, email, agent_id, agent_type, parent_agent_id, total_balance, available_funds)
VALUES
    ('user003', '$2a$10$user003hash', '客户三', '13800002003', 'user003@example.com', 2, 2, 20000.00, 20000.00),
    ('user004', '$2a$10$user004hash', '客户四', '13800002004', 'user004@example.com', 2, 2, 25000.00, 25000.00);

-- ============================================
-- 查询示例
-- ============================================

-- 1. 查看所有代理及其层级关系
-- SELECT * FROM v_agent_full_info ORDER BY agent_type, id;

-- 2. 查看某代理的所有直属客户
-- SELECT * FROM users WHERE agent_id = 1;

-- 3. 查看某代理下的所有客户（包括分代理的客户）
-- SELECT * FROM get_agent_all_users(1);

-- 4. 查看客户及其代理信息
-- SELECT * FROM v_user_full_info WHERE id = 1;

-- 5. 查询某总代理的所有分代理
-- SELECT * FROM agents WHERE parent_agent_id = 1;

-- 6. 统计各代理的客户数和分佣金额
-- SELECT a.*, COUNT(u.id) as user_count, COALESCE(SUM(ac.commission_amount), 0) as total_commission
-- FROM agents a
-- LEFT JOIN users u ON a.id = u.agent_id
-- LEFT JOIN agent_commission ac ON a.id = ac.agent_id
-- GROUP BY a.id
-- ORDER BY a.id;
