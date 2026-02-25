import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import dotenv from 'dotenv';

import authRouter from './routes/auth';
import productRouter from './routes/product';
import commissionRouter from './routes/commission';
import { createShuhaiRouter } from './routes/shuhai';
import { createYahooFinanceRouter } from './routes/yahoo-finance';
import { createFreeMarketRouter } from './routes/free-market-api';
import { createAIAnalysisRouter } from './routes/ai-analysis';
import { createAgentRoutes } from './routes/agent';
import { Pool } from 'pg';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;

// ============================================
// 中间件配置
// ============================================

// 安全头
app.use(helmet());

// CORS - 允许所有来源，包括本地文件
app.use(cors({
  origin: function (origin, callback) {
    // 允许的来源列表
    const allowedOrigins = [
      'http://localhost:5173',
      'http://localhost:3000',
      'null'
    ];
    
    // 如果没有 origin (比如移动应用、本地文件)，也允许
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(null, true); // 允许所有来源进行测试
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'user-id']
}));

// 限流 - 临时禁用用于测试
// const limiter = rateLimit({
//   windowMs: 15 * 60 * 1000, // 15分钟
//   max: 1000, // 每个IP最多1000个请求
//   message: {
//     code: 429,
//     message: '请求过于频繁，请稍后再试',
//     data: null,
//     timestamp: Date.now()
//   }
// });
// app.use(limiter);

// 解析JSON
app.use(express.json());

// ============================================
// 路由配置
// ============================================

// 健康检查
app.get('/health', (req, res) => {
  res.json({
    code: 0,
    message: '服务运行正常',
    data: {
      status: 'ok',
      timestamp: Date.now(),
      uptime: process.uptime()
    }
  });
});

// 认证路由
app.use('/auth', authRouter);

// 产品管理路由
app.use('/products', productRouter);

// 分佣管理路由
app.use('/commission', commissionRouter);

// 数海行情代理路由
app.use('/shuhai', createShuhaiRouter());

// Yahoo Finance 行情代理路由
app.use('/yahoo', createYahooFinanceRouter());

// 免费市场数据 API 路由 (模拟数据)
app.use('/free', createFreeMarketRouter());

// AI分析路由
app.use('/ai', createAIAnalysisRouter());

// 代理路由
const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '5432'),
  database: process.env.DB_NAME || 'precious_metals',
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || '123456'
});

app.use('/api/agent', createAgentRoutes(pool));

// 错误处理
app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error('服务器错误:', err);
  res.status(500).json({
    code: 500,
    message: '服务器内部错误',
    data: null,
    timestamp: Date.now()
  });
});

// ============================================
// 启动服务器
// ============================================

app.listen(PORT, () => {
  console.log(`
╔════════════════════════════════════════════════════════════╗
║                                                              ║
║     贵金属期货交易系统 - 完整版后端服务                        ║
║                                                              ║
╠══════════════════════════════════════════════════════════════╣
║  服务地址: http://localhost:${PORT}                          ║
║  测试账号:                                                   ║
║    • admin / admin123 (管理员)                               ║
║    • user / user123 (普通用户)                               ║
║    • agent001 / agent123 (总代理)                            ║
║    • agent002 / agent123 (分代理)                            ║
║                                                              ║
║  可用API端点:                                               ║
║    • /auth/*      - 认证相关                                  ║
║    • /products/*   - 产品管理                                  ║
║    • /commission/* - 分佣管理                                  ║
║    • /shuhai/*    - 数海行情代理                              ║
║    • /free/*      - 免费市场数据API(推荐)                      ║
║                                                              ║
╚══════════════════════════════════════════════════════════════╝
  `);
});

// 优雅关闭
process.on('SIGTERM', () => {
  console.log('正在关闭服务...');
  process.exit(0);
});

process.on('SIGINT', () => {
  console.log('正在关闭服务...');
  process.exit(0);
});
