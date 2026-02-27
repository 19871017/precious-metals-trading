-- ====================================================
-- 创建默认管理员账户
-- 密码: admin123 (生产环境请修改)
-- ====================================================

-- 生成密码哈希 (bcrypt cost factor 10)
-- admin123 -> $2a$10$rJvKzR8v5eL9zV5Z8v5ZeG8v8v8v8v8v8v8v8v8v8v8v8v8v8v8
-- 注意: 实际使用时请通过bcrypt库生成哈希

-- 创建管理员账户
INSERT INTO users (username, password_hash, phone, email, real_name, status, kyc_status, role_id, referral_code, created_at)
VALUES (
    'admin',
    '$2a$10$rJvKzR8v5eL9zV5Z8v5ZeG8v8v8v8v8v8v8v8v8v8v8v8v8v8v8', -- admin123
    '13800000000',
    'admin@system.com',
    '系统管理员',
    1, -- status: 正常
    1, -- kyc_status: 已认证
    1, -- role_id: 超级管理员
    'ADMIN001',
    CURRENT_TIMESTAMP
)
ON CONFLICT (username) DO NOTHING;

-- 创建测试用户账户
INSERT INTO users (username, password_hash, phone, email, real_name, status, kyc_status, role_id, referral_code, created_at)
VALUES (
    'testuser',
    '$2a$10$rJvKzR8v5eL9zV5Z8v5ZeG8v8v8v8v8v8v8v8v8v8v8v8v8v8v8', -- admin123 (测试账户)
    '13900000000',
    'test@system.com',
    '测试用户',
    1, -- status: 正常
    0, -- kyc_status: 未认证
    4, -- role_id: 普通用户
    'TEST001',
    CURRENT_TIMESTAMP
)
ON CONFLICT (username) DO NOTHING;

-- 为测试用户创建账户
INSERT INTO accounts (user_id, account_number, balance, available_balance, frozen_margin, floating_pl, realized_pl, created_at)
SELECT
    u.id,
    'ACC' || u.id || LPAD(FLOOR(RANDOM() * 10000)::TEXT, 4, '0'),
    100000, -- 初始资金10万
    100000,
    0,
    0,
    0,
    CURRENT_TIMESTAMP
FROM users u
WHERE u.username = 'testuser'
AND NOT EXISTS (SELECT 1 FROM accounts a WHERE a.user_id = u.id);

-- ====================================================
-- 完成
-- ====================================================
