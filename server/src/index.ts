import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import dotenv from 'dotenv';
import { createServer } from 'http';
import { Server as SocketIOServer } from 'socket.io';
import logger from './utils/logger';
import { ErrorCode, createErrorResponse } from './utils/error-codes';

import { PositionManager, OrderManager } from './core/OrderManager';
import { RiskManager } from './core/RiskManager';
import { MarketDataService } from './services/MarketDataService';
import { stopLossTakeProfitService } from './services/StopLossTakeProfitService';
import { createApiRouter } from './routes/api';
import { createShuhaiRouter } from './routes/shuhai';
import authRouter from './routes/auth';
import adminRouter from './routes/admin';
import aiRouter from './routes/ai';
import portfolioRouter from './routes/portfolio';

dotenv.config();

const app = express();
const httpServer = createServer(app);
const io = new SocketIOServer(httpServer, {
  cors: {
    origin: process.env.CLIENT_URL || 'http://localhost:5173',
    credentials: true
  }
});
const PORT = process.env.PORT || 3001;

// ============================================
// 中间件配置
// ============================================

// 安全头配置 - 生产环境使用严格设置
const helmetConfig = process.env.NODE_ENV === 'production'
  ? {
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          styleSrc: ["'self'", "'unsafe-inline'"],
          scriptSrc: ["'self'"],
          imgSrc: ["'self'", "data:", "https:"],
          connectSrc: ["'self'", "https:"],
          fontSrc: ["'self'"],
          objectSrc: ["'none'"],
          mediaSrc: ["'self'"],
          frameSrc: ["'none'"],
        },
      },
      hsts: {
        maxAge: 31536000,
        includeSubDomains: true,
        preload: true,
      },
      noSniff: true,
      referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
    }
  : {};

app.use(helmet(helmetConfig));

// CORS - 生产环境应使用白名单
const corsOrigins = process.env.CORS_ORIGINS
  ? process.env.CORS_ORIGINS.split(',')
  : [process.env.CLIENT_URL || 'http://localhost:5173'];

app.use(cors({
  origin: corsOrigins,
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}));

// 限流配置
const createLimiter = (windowMs: number, max: number, message: string) => rateLimit({
  windowMs,
  max,
  message: {
    code: 429,
    message,
    data: null,
    timestamp: Date.now()
  },
  standardHeaders: true,
  legacyHeaders: false
});

// 登录接口限流: 5次/15分钟
const loginLimiter = createLimiter(
  15 * 60 * 1000,
  5,
  '登录请求过于频繁,请15分钟后再试'
);

// 认证接口限流: 10次/分钟
const authLimiter = createLimiter(
  60 * 1000,
  10,
  '认证请求过于频繁,请稍后再试'
);

// 交易接口限流: 20次/分钟
const tradingLimiter = createLimiter(
  60 * 1000,
  20,
  '交易请求过于频繁,请稍后再试'
);

// API通用限流: 100次/分钟
const apiLimiter = createLimiter(
  60 * 1000,
  100,
  '请求过于频繁,请稍后再试'
);

// 应用全局限流
app.use(apiLimiter);

// 解析JSON
app.use(express.json());

// ============================================
// 初始化核心服务
// ============================================

const positionManager = new PositionManager();
const orderManager = new OrderManager(positionManager);
const riskManager = new RiskManager(positionManager);
const marketService = new MarketDataService();

// ============================================
// WebSocket 实时推送配置
// ============================================

io.on('connection', (socket) => {
  logger.info(`WebSocket client connected: ${socket.id}`);

  // 订阅行情
  socket.on('subscribe:market', (symbols: string[]) => {
    logger.debug(`Client ${socket.id} subscribed to market: ${symbols.join(', ')}`);
    socket.join('market');

    // 立即发送当前行情数据
    const allMarketData = marketService.getAllMarketData();
    socket.emit('market:data', allMarketData);
  });

  // 取消订阅行情
  socket.on('unsubscribe:market', () => {
    logger.debug(`Client ${socket.id} unsubscribed from market`);
    socket.leave('market');
  });

  // 订阅持仓更新
  socket.on('subscribe:positions', (userId: string) => {
    logger.debug(`Client ${socket.id} subscribed to positions: ${userId}`);
    socket.join(`positions:${userId}`);
  });

  // 断开连接
  socket.on('disconnect', () => {
    logger.debug(`WebSocket client disconnected: ${socket.id}`);
  });
});

// 将 io 实例挂载到 app，供其他模块使用
app.set('io', io);

// 创建演示账户
const demoUserId = 'demo-user';
riskManager.createAccount(demoUserId, 1000000); // 初始资金100万

// 配置 Socket.IO 到行情服务
marketService.setSocketIO(io);

// ============================================
// 风控监控循环
// ============================================

// 每5秒执行一次风控检查
setInterval(() => {
  const accounts = riskManager.getAllAccounts();
  const marketData = marketService.getAllMarketDataMap();

  for (const account of accounts) {
    // 更新账户权益
    riskManager.updateAccountEquity(account.userId, marketData);

    // 检查强平
    const liquidations = riskManager.checkAndLiquidate(account.userId, marketData);

    if (liquidations.length > 0) {
      logger.warn(`User ${account.userId} triggered liquidation:`,
        liquidations.map(l => `${l.productCode} @ ${l.liquidationPrice}`).join(', ')
      );
    }
  }
}, 5000);

// 启动止盈止损服务
stopLossTakeProfitService.start();

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

// 认证路由(应用登录限流)
app.use('/auth/login', loginLimiter);
app.use('/auth', authLimiter, authRouter);

// 管理员路由
app.use('/admin', adminRouter);

// AI分析路由
app.use('/ai', apiLimiter, aiRouter);

// 投资组合路由
app.use('/portfolio', apiLimiter, portfolioRouter);

// API路由(交易接口应用限流)
app.use('/api/order', tradingLimiter);
app.use('/api/position', tradingLimiter);
app.use('/api', apiLimiter, createApiRouter(orderManager, positionManager, riskManager, marketService));

// 数海行情代理路由
app.use('/shuhai', createShuhaiRouter());

// 错误处理中间件
app.use((err: Error, req: express.Request, res: express.Response, next: express.NextFunction) => {
  logger.error('Global error handler:', {
    error: err.message,
    stack: err.stack,
    url: req.url,
    method: req.method,
    ip: req.ip
  });

  // 处理已知错误
  if (err.code && Object.values(ErrorCode).includes(err.code)) {
    return res.status(err.statusCode || 400).json(createErrorResponse(err.code, err.message));
  }

  // 处理JWT错误
  if (err.name === 'JsonWebTokenError') {
    return res.status(401).json(createErrorResponse(ErrorCode.TOKEN_INVALID));
  }

  if (err.name === 'TokenExpiredError') {
    return res.status(401).json(createErrorResponse(ErrorCode.TOKEN_EXPIRED));
  }

  // 处理其他错误
  const statusCode = err.statusCode || 500;
  const errorCode = statusCode >= 500 ? ErrorCode.INTERNAL_ERROR : ErrorCode.INVALID_PARAM;

  res.status(statusCode).json(createErrorResponse(errorCode, process.env.NODE_ENV === 'production' ? '系统内部错误' : err.message));
});

// 404处理
app.use((req: express.Request, res: express.Response) => {
  res.status(404).json(createErrorResponse(ErrorCode.RESOURCE_NOT_FOUND, '接口不存在'));
});

// ============================================
// 启动服务器
// ============================================

httpServer.listen(PORT, () => {
  console.log(`
╔══════════════════════════════════════════════════════════════╗
║                                                              ║
║     贵金属期货交易系统 - 交易撮合引擎 + 风控系统              ║
║                                                              ║
╠══════════════════════════════════════════════════════════════╣
║  服务地址: http://localhost:${PORT}                          ║
║  API文档: http://localhost:${PORT}/api/...                   ║
║                                                              ║
║  演示账户: demo-user                                         ║
║  初始资金: ¥1,000,000                                        ║
║                                                              ║
║  可用产品 (6个):                                             ║
║    • DAX    - 德指      (CEDAXA0)                            ║
║    • HSI    - 恒指      (HIHHI01)                            ║
║    • NQ     - 小纳指    (CENQA0)                             ║
║    • MHSI   - 小恒指    (HIMCH01)                            ║
║    • GOLD   - 黄金      (CMGCA0)                             ║
║    • USOIL  - 原油      (NECLA0)                             ║
║                                                              ║
║  数据来源: 数海API (http://ds.cnshuhai.com)               ║
║  更新频率: 30秒自动更新                                        ║
║                                                              ║
╚══════════════════════════════════════════════════════════════╝
  `);
});

// 优雅关闭
process.on('SIGTERM', () => {
  logger.info('Shutting down gracefully...');
  marketService.stop();
  stopLossTakeProfitService.stop();
  process.exit(0);
});

process.on('SIGINT', () => {
  logger.info('Shutting down gracefully...');
  marketService.stop();
  stopLossTakeProfitService.stop();
  process.exit(0);
});
