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
import { liquidationScheduler } from './services/LiquidationSchedulerV2';
import { liquidationPriorityScheduler } from './services/LiquidationPriorityScheduler';
import { watchdogService } from './services/WatchdogService';
import { degradationService } from './services/DegradationService';
import { createApiRouter } from './routes/api';
import { createShuhaiRouter } from './routes/shuhai';
import authRouter from './routes/auth';
import adminRouter from './routes/admin';
import aiRouter from './routes/ai';
import portfolioRouter from './routes/portfolio';
import riskWorkerPoolRouter from './routes/risk-worker-pool';
import liquidationRouter from './routes/liquidation-priority';
import watchdogRouter from './routes/watchdog';
import degradationRouter from './routes/degradation';
import { systemPriorityController, Priority } from './services/SystemPriorityController';
import { priorityRateLimit, systemLoadGuard } from './middleware/priority-rate-limit';
import { orderRateLimit, getGlobalQueueStatus, resetUserRateLimit, resetGlobalQueue } from './middleware/order-rate-limit';
import { riskEngineWorkerPoolManager } from './services/RiskEngineWorkerPoolManager';

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

// 安全头
app.use(helmet());

// CORS
app.use(cors({
  origin: process.env.CLIENT_URL || 'http://localhost:5173',
  credentials: true
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

// 系统负载保护（紧急时限制所有请求）
app.use(systemLoadGuard('EMERGENCY'));

// 优先级限流中间件
app.use(priorityRateLimit());

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
// 初始化优先级控制器
// ============================================

(async () => {
  try {
    logger.info('[Main] 初始化优先级控制器');
    await systemPriorityController.initialize();
    logger.info('[Main] 优先级控制器初始化成功');

    logger.info('[Main] 初始化 Risk Engine Worker Pool');
    await riskEngineWorkerPoolManager.initialize();
    logger.info('[Main] Risk Engine Worker Pool 初始化成功');
  } catch (error) {
    logger.error('[Main] 初始化失败', error);
  }
})();

// ============================================
// WebSocket 实时推送配置
// ============================================

io.on('connection', (socket) => {
  console.log(`[WebSocket] Client connected: ${socket.id}`);

  // 订阅行情
  socket.on('subscribe:market', (symbols: string[]) => {
    console.log(`[WebSocket] Client ${socket.id} subscribed to market: ${symbols.join(', ')}`);
    socket.join('market');

    // 立即发送当前行情数据
    const allMarketData = marketService.getAllMarketData();
    socket.emit('market:data', allMarketData);
  });

  // 取消订阅行情
  socket.on('unsubscribe:market', () => {
    console.log(`[WebSocket] Client ${socket.id} unsubscribed from market`);
    socket.leave('market');
  });

  // 订阅持仓更新
  socket.on('subscribe:positions', (userId: string) => {
    console.log(`[WebSocket] Client ${socket.id} subscribed to positions: ${userId}`);
    socket.join(`positions:${userId}`);
  });

  // 断开连接
  socket.on('disconnect', () => {
    console.log(`[WebSocket] Client disconnected: ${socket.id}`);
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
      console.log(`[${new Date().toISOString()}] 用户 ${account.userId} 触发强平:`,
        liquidations.map(l => `${l.productCode} @ ${l.liquidationPrice}`).join(', ')
      );
    }
  }
}, 5000);

// 启动止盈止损服务
stopLossTakeProfitService.start();

// ============================================
// 启动 Watchdog 服务
// ============================================

(async () => {
  try {
    logger.info('[Main] 启动 Watchdog 服务');
    await watchdogService.start();
    logger.info('[Main] Watchdog 服务启动成功');

    logger.info('[Main] 启动系统降级机制');
    await degradationService.start();
    logger.info('[Main] 系统降级机制启动成功');
  } catch (error) {
    logger.error('[Main] 启动 Watchdog 服务失败', error);
  }
})();

// ============================================
// 启动强平调度系统
// ============================================

(async () => {
  try {
    logger.info('[Main] 启动自动强平调度系统');
    await liquidationScheduler.start();
    logger.info('[Main] 自动强平调度系统启动成功');

    logger.info('[Main] 启动优先级强平调度系统');
    await liquidationPriorityScheduler.start();
    logger.info('[Main] 优先级强平调度系统启动成功');
  } catch (error) {
    logger.error('[Main] 启动强平调度系统失败', error);
  }
})();

// ============================================
// 路由配置
// ============================================

// 健康检查
app.get('/health', (req, res) => {
  const currentLoad = systemPriorityController.getCurrentLoad();
  
  res.json({
    code: 0,
    message: '服务运行正常',
    data: {
      status: 'ok',
      timestamp: Date.now(),
      uptime: process.uptime(),
      load: {
        level: currentLoad.level,
        cpu: `${currentLoad.cpu.toFixed(2)}%`,
        memory: `${currentLoad.memory.toFixed(2)}%`,
        queueDepths: currentLoad.queueDepths,
        activeJobs: currentLoad.activeJobs,
      },
    },
  });
});

// 系统负载统计
app.get('/system/load', async (req, res) => {
  try {
    const currentLoad = systemPriorityController.getCurrentLoad();
    const queueStats = await systemPriorityController.getQueueStats();
    const globalQueueStatus = await getGlobalQueueStatus();
    
    res.json({
      code: 0,
      message: '系统负载统计',
      data: {
        load: currentLoad,
        queues: queueStats,
        orderQueue: globalQueueStatus,
        timestamp: Date.now(),
      },
    });
  } catch (error) {
    logger.error('[Main] 获取系统负载统计失败', error);
    res.status(500).json({
      code: 'INTERNAL_ERROR',
      message: '获取系统负载统计失败',
    });
  }
});

// 订单限流统计
app.get('/system/order-rate-limit', async (req, res) => {
  try {
    const { userId } = req.query;
    
    if (!userId) {
      return res.status(400).json({
        code: 'MISSING_PARAM',
        message: '缺少用户ID',
      });
    }

    const userStats = await getUserRateLimitStats(userId as string);
    
    res.json({
      code: 0,
      message: '订单限流统计',
      data: {
        userId,
        ...userStats,
        timestamp: Date.now(),
      },
    });
  } catch (error) {
    logger.error('[Main] 获取订单限流统计失败', error);
    res.status(500).json({
      code: 'INTERNAL_ERROR',
      message: '获取订单限流统计失败',
    });
  }
});

// 全局队列状态
app.get('/system/queue-status', async (req, res) => {
  try {
    const queueStatus = await getGlobalQueueStatus();
    
    res.json({
      code: 0,
      message: '全局队列状态',
      data: queueStatus,
    });
  } catch (error) {
    logger.error('[Main] 获取全局队列状态失败', error);
    res.status(500).json({
      code: 'INTERNAL_ERROR',
      message: '获取全局队列状态失败',
    });
  }
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

// Risk Engine Worker Pool 管理路由
app.use('/risk', riskWorkerPoolRouter);

// 优先级强平队列管理路由
app.use('/liquidation', liquidationRouter);

// Watchdog 服务管理路由
app.use('/system', watchdogRouter);

// 系统降级机制管理路由
app.use('/system', degradationRouter);

// API路由(交易接口应用限流)
app.use('/api/order', tradingLimiter);
app.use('/api/position', tradingLimiter);
app.use('/api', apiLimiter, createApiRouter(orderManager, positionManager, riskManager, marketService));

// 数海行情代理路由
app.use('/shuhai', createShuhaiRouter());

// 错误处理中间件
app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  logger.error('全局错误处理:', {
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
const gracefulShutdown = async (signal: string) => {
  console.log(`[${signal}] 收到信号，开始优雅关闭...`);
  
  try {
    // 停止优先级控制器
    console.log('[Shutdown] 停止优先级控制器...');
    await systemPriorityController.stop();
    
    // 停止 Risk Engine Worker Pool
    console.log('[Shutdown] 停止 Risk Engine Worker Pool...');
    await riskEngineWorkerPoolManager.stop();
    
    // 停止优先级强平调度系统
    console.log('[Shutdown] 停止优先级强平调度系统...');
    await liquidationPriorityScheduler.stop();
    
    // 停止自动强平调度系统
    console.log('[Shutdown] 停止自动强平调度系统...');
    await liquidationScheduler.stop();
    
     // 停止 Watchdog 服务
    console.log('[Shutdown] 停止 Watchdog 服务...');
    await watchdogService.stop();
    
    // 停止系统降级机制
    console.log('[Shutdown] 停止系统降级机制...');
    await degradationService.stop();
    
    // 停止行情服务
    console.log('[Shutdown] 停止行情服务...');
    marketService.stop();
    
    // 停止止盈止损服务
    console.log('[Shutdown] 停止止盈止损服务...');
    stopLossTakeProfitService.stop();
    
    // 关闭 HTTP 服务器
    console.log('[Shutdown] 关闭 HTTP 服务器...');
    httpServer.close(() => {
      console.log('[Shutdown] HTTP 服务器已关闭');
      process.exit(0);
    });
    
    // 强制超时
    setTimeout(() => {
      console.error('[Shutdown] 优雅关闭超时，强制退出');
      process.exit(1);
    }, 10000); // 10秒超时
  } catch (error) {
    console.error('[Shutdown] 优雅关闭失败:', error);
    process.exit(1);
  }
};

process.on('SIGTERM', () => {
  gracefulShutdown('SIGTERM');
});

process.on('SIGINT', () => {
  gracefulShutdown('SIGINT');
});
  } catch (error) {
    console.error('[Shutdown] 优雅关闭失败:', error);
    process.exit(1);
  }
};

process.on('SIGTERM', () => {
  gracefulShutdown('SIGTERM');
});

process.on('SIGINT', () => {
  gracefulShutdown('SIGINT');
});
  console.log('正在关闭服务...');
  marketService.stop();
  stopLossTakeProfitService.stop();
  process.exit(0);
});
