const { Pool } = require('pg');

const pool = new Pool({
  host: 'localhost',
  port: 5432,
  database: 'precious_metals',
  user: 'postgres',
  password: '123456'
});

async function createTestAgents() {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // 删除已存在的测试代理
    await client.query("DELETE FROM agents WHERE username IN ('agent001', 'agent002')");

    // 总代理账号
    const result1 = await client.query(
      `INSERT INTO agents (
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
      ) VALUES ($1, $2, NULL, $3, $4, $5, $6, 'normal', 0.05, 10000.00, 8000.00, 2000.00)
      RETURNING id, agent_code, username, real_name`,
      ['AG001', 1, 'agent001', '$2a$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWy', '测试总代理', '13800138001']
    );

    // 分代理账号
    const result2 = await client.query(
      `INSERT INTO agents (
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
      ) VALUES ($1, $2, $3, $4, $5, $6, 'normal', 0.03, 5000.00, 4500.00, 500.00)
      RETURNING id, agent_code, username, real_name`,
      ['AG002', 2, result1.rows[0].id, 'agent002', '$2a$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWy', '测试分代理', '13800138002']
    );

    await client.query('COMMIT');

    console.log('==========================================');
    console.log('测试代理账号已创建');
    console.log('==========================================');
    console.log('');
    console.log('【总代理账号】');
    console.log('用户名: agent001');
    console.log('密码: agent123');
    console.log('代理编码: AG001');
    console.log('');
    console.log('【分代理账号】');
    console.log('用户名: agent002');
    console.log('密码: agent123');
    console.log('代理编码: AG002');
    console.log('');
    console.log('==========================================');
  } catch (e) {
    await client.query('ROLLBACK');
    console.error('创建失败:', e.message);
  } finally {
    client.release();
    await pool.end();
  }
}

createTestAgents();
