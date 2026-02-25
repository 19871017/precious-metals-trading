import { Router, Request, Response } from 'express';
import { RiskService } from '../../services/risk.service';

const router = Router();
const riskService = new RiskService();

/**
 * 风险评估接口
 * POST /api/v1/risk/assess
 */
router.post('/assess', async (req: Request, res: Response) => {
  try {
    const { portfolioPositions, timeframe } = req.body;

    if (!portfolioPositions || !Array.isArray(portfolioPositions)) {
      return res.status(400).json({
        code: 1001,
        message: '缺少必要参数: portfolioPositions',
        data: null
      });
    }

    const data = await riskService.assessPortfolioRisk({
      positions: portfolioPositions,
      timeframe: timeframe || '1d'
    });

    // 风险数据缓存30秒
    res.set('Cache-Control', 'public, max-age=30');
    res.json({
      code: 0,
      message: 'success',
      data
    });
  } catch (error) {
    console.error('风险评估失败:', error);
    res.status(500).json({
      code: 5000,
      message: '服务器内部错误',
      data: null
    });
  }
});

/**
 * 设置止损止盈
 * POST /api/v1/risk/stop-loss
 */
router.post('/stop-loss', async (req: Request, res: Response) => {
  try {
    const { userId, positions } = req.body;

    if (!userId || !positions || !Array.isArray(positions)) {
      return res.status(400).json({
        code: 1001,
        message: '缺少必要参数: userId, positions',
        data: null
      });
    }

    const data = await riskService.setStopLoss({
      userId,
      positions
    });

    res.json({
      code: 0,
      message: 'success',
      data
    });
  } catch (error) {
    console.error('设置止损止盈失败:', error);
    res.status(500).json({
      code: 5000,
      message: '服务器内部错误',
      data: null
    });
  }
});

/**
 * 获取风险预警历史
 * GET /api/v1/risk/alerts
 */
router.get('/alerts', async (req: Request, res: Response) => {
  try {
    const { userId, severity, startTime, endTime, page, pageSize } = req.query;

    const data = await riskService.getRiskAlerts({
      userId: userId as string,
      severity: severity as 'warning' | 'critical',
      startTime: startTime ? parseInt(startTime as string) : undefined,
      endTime: endTime ? parseInt(endTime as string) : undefined,
      page: page ? parseInt(page as string) : 1,
      pageSize: pageSize ? parseInt(pageSize as string) : 20
    });

    res.json({
      code: 0,
      message: 'success',
      data
    });
  } catch (error) {
    console.error('获取风险预警失败:', error);
    res.status(500).json({
      code: 5000,
      message: '服务器内部错误',
      data: null
    });
  }
});

/**
 * 获取风险敞口分析
 * GET /api/v1/risk/exposure
 */
router.get('/exposure', async (req: Request, res: Response) => {
  try {
    const { userId } = req.query;

    if (!userId) {
      return res.status(400).json({
        code: 1001,
        message: '缺少必要参数: userId',
        data: null
      });
    }

    const data = await riskService.getPortfolioExposure(userId as string);

    // 敞口数据缓存60秒
    res.set('Cache-Control', 'public, max-age=60');
    res.json({
      code: 0,
      message: 'success',
      data
    });
  } catch (error) {
    console.error('获取风险敞口失败:', error);
    res.status(500).json({
      code: 5000,
      message: '服务器内部错误',
      null
    });
  }
});

/**
 * 计算VaR（风险价值）
 * POST /api/v1/risk/var
 */
router.post('/var', async (req: Request, res: Response) => {
  try {
    const { positions, confidenceLevel, timeframe } = req.body;

    if (!positions || !Array.isArray(positions)) {
      return res.status(400).json({
        code: 1001,
        message: '缺少必要参数: positions',
        data: null
      });
    }

    const data = await riskService.calculateVaR({
      positions,
      confidenceLevel: confidenceLevel || 0.95,
      timeframe: timeframe || '1d'
    });

    res.json({
      code: 0,
      message: 'success',
      data
    });
  } catch (error) {
    console.error('计算VaR失败:', error);
    res.status(500).json({
      code: 5000,
      message: '服务器内部错误',
      data: null
    });
  }
});

export default router;
