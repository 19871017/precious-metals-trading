-- 创建测试代理账号

-- 删除已存在的测试代理（可选）
DELETE FROM agents WHERE username IN ('agent001', 'agent002');

-- 总代理账号
INSERT INTO agents (
  agent_code,
  agent_type,
  parent_id,
  username,
  password_hash,
  real_name,
  phone,
  status,
  commission_rate,
  total_balance,
  available_balance,
  total_withdraw
) VALUES (
  'AG001',
  1, -- 总代理
  NULL,
  'agent001',
  '$2a$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWy', -- agent123
  '测试总代理',
  '13800138001',
  'normal',
  0.05,
  10000.00,
  8000.00,
  2000.00
) ON CONFLICT (username) DO NOTHING;

-- 分代理账号
INSERT INTO agents (
  agent_code,
  agent_type,
  parent_id,
  username,
  password_hash,
  real_name,
  phone,
  status,
  commission_rate,
  total_balance,
  available_balance,
  total_withdraw
) VALUES (
  'AG002',
  2, -- 分代理
  (SELECT id FROM agents WHERE username = 'agent001'),
  'agent002',
  '$2a$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWy', -- agent123
  '测试分代理',
  '13800138002',
  'normal',
  0.03,
  5000.00,
  4500.00,
  500.00
) ON CONFLICT (username) DO NOTHING;

-- 输出测试账号信息
\echo '=========================================='
\echo '测试代理账号已创建'
\echo '=========================================='
\echo ''
\echo '【总代理账号】'
\echo '用户名: agent001'
\echo '密码: agent123'
\echo '代理编码: AG001'
\echo ''
\echo '【分代理账号】'
\echo '用户名: agent002'
\echo '密码: agent123'
\echo '代理编码: AG002'
\echo ''
\echo '=========================================='
