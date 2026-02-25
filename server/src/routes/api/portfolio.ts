import { Router, Request, Response } from 'express';
import { PortfolioService } from '../../services/portfolio.service';

const router = Router();
const portfolioService = new PortfolioService();

/**
 * 获取用户持仓
 * GET /api/v1/portfolio/positions
 */
router.get('/positions', async (req: Request, res: Response) => {
  try {
    const { userId, includeDetails, includePnL } = req.query;

    if (!userId) {
      return res.status(400).json({
        code: 1001,
        message: '缺少必要参数: userId',
        data: null
      });
    }

    const data = await portfolioService.getPositions({
      userId: userId as string,
      includeDetails: includeDetails === 'true',
      includePnL: includePnL === 'true'
    });

    // 持仓数据缓存10秒
    res.set('Cache-Control', 'public, max-age=10');
    res.json({
      code: 0,
      message: 'success',
      data
    });
  } catch (error) {
    console.error('获取持仓失败:', error);
    res.status(500).json({
      code: 5000,
      message: '服务器内部错误',
      data: null
    });
  }
});

/**
 * 获取交易历史
 * GET /api/v1/portfolio/trades
 */
router.get('/trades', async (req: Request, res: Response) => {
  try {
    const { userId, symbol, side, startDate, endDate, page, pageSize } = req.query;

    if (!userId) {
      return res.status(400).json({
        code: 1001,
        message: '缺少必要参数: userId',
        data: null
      });
    }

    const data = await portfolioService.getTradeHistory({
      userId: userId as string,
      symbol: symbol as string,
      side: side as 'buy' | 'sell',
      startDate: startDate ? new Date(startDate as string) : undefined,
      endDate: endDate ? new Date(endDate as string) : undefined,
      page: page ? parseInt(page as string) : 1,
      pageSize: pageSize ? parseInt(pageSize as string) : 20
    });

    res.json({
      code: 0,
      message: 'success',
      data
    });
  } catch (error) {
    console.error('获取交易历史失败:', error);
    res.status(500).json({
      code: 5000,
      message: '服务器内部错误',
      data: null
    });
  }
});

/**
 * 获取投资组合摘要
 * GET /api/v1/portfolio/summary
 */
router.get('/summary', async (req: Request, res: Response) => {
  try {
    const { userId } = req.query;

    if (!userId) {
      return res.status(400).json({
        code: 1001,
        message: '缺少必要参数: userId',
        data: null
      });
    }

    const data = await portfolioService.getPortfolioSummary(userId as string);

    // 摘要数据缓存5秒
    res.set('Cache-Control', 'public, max-age=5');
    res.json({
      code: 0,
      message: 'success',
      data
    });
  } catch (error) {
    console.error('获取投资组合摘要失败:', error);
    res.status(500).json({
      code: 5000,
      message: '服务器内部错误',
      data: null
    });
  }
});

/**
 * 获取风险敞口分析
 * GET /api/v1/portfolio/exposure
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

    const data = await portfolioService.getExposureAnalysis(userId as string);

    // 敞口数据缓存30秒
    res.set('Cache-Control', 'public, max-age=30');
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
      data: null
    });
  }
});

/**
 * 获取绩效分析
 * GET /api/v1/portfolio/performance
 */
router.get('/performance', async (req: Request, res: Response) => {
  try {
    const { userId, startDate, endDate, benchmark } = req.query;

    if (!userId) {
      return res.status(400).json({
        code: 1001,
        message: '缺少必要参数: userId',
        data: null
      });
    }

    const data = await portfolioService.getPerformanceAnalysis({
      userId: userId as string,
      startDate: startDate ? new Date(startDate as string) : undefined,
      endDate: endDate ? new Date(endDate as string) : undefined,
      benchmark: benchmark as string
    });

    // 绩效数据缓存60秒
    res.set('Cache-Control', 'public, max-age=60');
    res.json({
      code: 0,
      message: 'success',
      data
    });
  } catch (error) {
    console.error('获取绩效分析失败:', error);
    res.status(500).json({
      code: 5000,
      message: '服务器内部错误',
      data: null
    });
  }
});

export default router;
