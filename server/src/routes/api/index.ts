import { Router } from 'express';
import marketRoutes from './market';
import fundamentalRoutes from './fundamental';
import riskRoutes from './risk';
import aiRoutes from './ai';
import portfolioRoutes from './portfolio';

const router = Router();

// 注册所有API路由
router.use('/market', marketRoutes);
router.use('/fundamental', fundamentalRoutes);
router.use('/risk', riskRoutes);
router.use('/ai', aiRoutes);
router.use('/portfolio', portfolioRoutes);

// API信息
router.get('/', (req, res) => {
  res.json({
    name: '贵金属期货交易系统 API',
    version: '1.0.0',
    endpoints: {
      market: '/api/v1/market',
      fundamental: '/api/v1/fundamental',
      risk: '/api/v1/risk',
      ai: '/api/v1/ai',
      portfolio: '/api/v1/portfolio'
    },
    documentation: '/api/v1/docs'
  });
});

export default router;
