/**
 * 初始化数海API缓存表
 */
import pg from 'pg';
import fs from 'fs';
import path from 'path';

const { Pool } = pg;

const dbConfig = {
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '5432'),
  database: process.env.DB_NAME || 'precious_metals_trading',
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || '',
};

async function initDatabase() {
  const pool = new Pool(dbConfig);

  try {
    console.log('正在连接数据库...');
    const client = await pool.connect();

    console.log('读取SQL脚本...');
    const sqlPath = path.join(__dirname, 'init-shuhai-cache.sql');
    const sql = fs.readFileSync(sqlPath, 'utf8');

    console.log('执行SQL脚本...');
    await client.query(sql);

    console.log('✅ 数海API缓存表初始化完成!');

    // 验证表是否创建成功
    const tables = await client.query(`
      SELECT tablename FROM pg_tables
      WHERE schemaname = 'public'
      AND tablename LIKE 'shuhai_%'
    `);

    console.log('创建的表:', tables.rows.map((r: any) => r.tablename));

    client.release();
  } catch (error) {
    console.error('❌ 数据库初始化失败:', error);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

initDatabase();
