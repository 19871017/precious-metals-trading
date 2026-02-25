-- 更新代理账号密码
-- 密码: agent123 的哈希值

-- 如果存在 agent001 账号，更新密码
UPDATE agents
SET password_hash = '$2a$10$8qn0qC6HgV22oFq3Mw4KBu.mvQHBfF9UOc5VbGe9IgZnc/.6HOMFO'
WHERE username = 'agent001';

-- 如果不存在，创建 agent001
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
  1,
  NULL,
  'agent001',
  '$2a$10$8qn0qC6HgV22oFq3Mw4KBu.mvQHBfF9UOc5VbGe9IgZnc/.6HOMFO',
  '测试总代理',
  '13800138001',
  'normal',
  0.05,
  10000.00,
  8000.00,
  2000.00
) ON CONFLICT (username) DO NOTHING;

-- 如果存在 agent002 账号，更新密码
UPDATE agents
SET password_hash = '$2a$10$8qn0qC6HgV22oFq3Mw4KBu.mvQHBfF9UOc5VbGe9IgZnc/.6HOMFO',
    parent_id = (SELECT id FROM agents WHERE username = 'agent001')
WHERE username = 'agent002';

-- 如果不存在，创建 agent002
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
  2,
  (SELECT id FROM agents WHERE username = 'agent001'),
  'agent002',
  '$2a$10$8qn0qC6HgV22oFq3Mw4KBu.mvQHBfF9UOc5VbGe9IgZnc/.6HOMFO',
  '测试分代理',
  '13800138002',
  'normal',
  0.03,
  5000.00,
  4500.00,
  500.00
) ON CONFLICT (username) DO NOTHING;

-- 查看所有代理账号
SELECT
  id,
  agent_code,
  agent_type,
  username,
  real_name,
  phone,
  status,
  commission_rate,
  total_balance,
  available_balance
FROM agents
ORDER BY id;
