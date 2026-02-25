import { Router, Request, Response } from 'express';
import { MarketService } from '../../services/market.service';

const router = Router();
const marketService = new MarketService();

/**
 * 获取实时行情数据
 * GET /api/v1/market/realtime
 */
router.get('/realtime', async (req: Request, res: Response) => {
  try {
    const { symbols, fields, includePreMarket } = req.query;

    if (!symbols || typeof symbols !== 'string') {
      return res.status(400).json({
        code: 1001,
        message: '缺少必要参数: symbols',
        data: null
      });
    }

    const symbolList = (symbols as string).split(',');
    const fieldList = fields ? (fields as string).split(',') : undefined;

    const data = await marketService.getRealTimeData({
      symbols: symbolList,
      fields: fieldList,
      includePreMarket: includePreMarket === 'true'
    });

    res.json({
      code: 0,
      message: 'success',
      data
    });
  } catch (error) {
    console.error('获取实时行情失败:', error);
    res.status(500).json({
      code: 5000,
      message: '服务器内部错误',
      data: null
    });
  }
});

/**
 * 获取K线数据
 * GET /api/v1/market/kline
 */
router.get('/kline', async (req: Request, res: Response) => {
  try {
    const { symbol, interval, startTime, endTime, limit } = req.query;

    if (!symbol || !interval) {
      return res.status(400).json({
        code: 1001,
        message: '缺少必要参数: symbol, interval',
        data: null
      });
    }

    const data = await marketService.getKlineData({
      symbol: symbol as string,
      interval: interval as any,
      startTime: startTime ? parseInt(startTime as string) : undefined,
      endTime: endTime ? parseInt(endTime as string) : undefined,
      limit: limit ? parseInt(limit as string) : 1000
    });

    res.json({
      code: 0,
      message: 'success',
      data
    });
  } catch (error) {
    console.error('获取K线数据失败:', error);
    res.status(500).json({
      code: 5000,
      message: '服务器内部错误',
      data: null
    });
  }
});

/**
 * 获取市场深度
 * GET /api/v1/market/depth
 */
router.get('/depth', async (req: Request, res: Response) => {
  try {
    const { symbol, limit } = req.query;

    if (!symbol) {
      return res.status(400).json({
        code: 1001,
        message: '缺少必要参数: symbol',
        data: null
      });
    }

    const data = await marketService.getMarketDepth({
      symbol: symbol as string,
      limit: limit ? parseInt(limit as string) : 20
    });

    res.json({
      code: 0,
      message: 'success',
      data
    });
  } catch (error) {
    console.error('获取市场深度失败:', error);
    res.status(500).json({
      code: 5000,
      message: '服务器内部错误',
      data: null
    });
  }
});

/**
 * 获取成交明细
 * GET /api/v1/market/trades
 */
router.get('/trades', async (req: Request, res: Response) => {
  try {
    const { symbol, limit } = req.query;

    if (!symbol) {
      return res.status(400).json({
        code: 1001,
        message: '缺少必要参数: symbol',
        data: null
      });
    }

    const data = await marketService.getTrades({
      symbol: symbol as string,
      limit: limit ? parseInt(limit as string) : 100
    });

    res.json({
      code: 0,
      message: 'success',
      data
    });
  } catch (error) {
    console.error('获取成交明细失败:', error);
    res.status(500).json({
      code: 5000,
      message: '服务器内部错误',
      data: null
    });
  }
});

export default router;
