import express from 'express';
import { MarketDataService } from '../services/MarketDataService';
import logger from '../utils/logger';

const router = express.Router();

// 获取市场数据服务实例（单例）
let marketServiceInstance: MarketDataService | null = null;

function getMarketService(): MarketDataService {
  if (!marketServiceInstance) {
    marketServiceInstance = new MarketDataService();
  }
  return marketServiceInstance;
}

/**
 * GET /free/health - 健康检查和服务状态
 */
router.get('/health', (req: any, res: any) => {
  try {
    const service = getMarketService();
    const status = service.getServiceStatus();

    res.json({
      code: 0,
      message: 'success',
      data: status,
      timestamp: Date.now()
    });
  } catch (error) {
    logger.error('[FreeMarket] 健康检查失败:', error);
    res.status(500).json({
      code: 500,
      message: '服务器内部错误',
      data: null,
      timestamp: Date.now()
    });
  }
});

/**
 * GET /free/quote - 获取单个品种的实时行情
 */
router.get('/quote', (req: any, res: any) => {
  try {
    const { code } = req.query;

    if (!code) {
      return res.json({
        code: 400,
        message: '缺少产品代码参数',
        data: null,
        timestamp: Date.now()
      });
    }

    const marketService = getMarketService();
    const marketData = marketService.getMarketData(code);

    if (!marketData) {
      return res.json({
        code: 404,
        message: '产品不存在',
        data: null,
        timestamp: Date.now()
      });
    }

    res.json({
      code: 0,
      message: 'success',
      data: {
        code: marketData.productCode,
        name: marketData.productName,
        price: marketData.lastPrice,
        open: marketData.openPrice || marketData.lastPrice,
        high: marketData.high24h,
        low: marketData.low24h,
        close: marketData.lastPrice,
        volume: marketData.volume24h,
        change: marketData.change,
        changePercent: marketData.changePercent,
        timestamp: Date.now(),
        datetime: new Date().toISOString()
      },
      timestamp: Date.now()
    });
  } catch (error) {
    logger.error('[FreeMarket] 获取单个行情失败:', error);
    res.status(500).json({
      code: 500,
      message: '服务器内部错误',
      data: null,
      timestamp: Date.now()
    });
  }
});

/**
 * GET /free/batch-quotes - 批量获取多个品种的实时行情
 */
router.get('/batch-quotes', (req: any, res: any) => {
  try {
    const { codes } = req.query;

    // 如果没有传codes参数，返回所有品种的行情
    const marketService = getMarketService();
    const allData = marketService.getAllMarketData();

    if (!codes) {
      const result: Record<string, any> = {};

      allData.forEach(marketData => {
        result[marketData.productCode] = {
          success: true,
          data: {
            code: marketData.productCode,
            name: marketData.productName,
            price: marketData.lastPrice,
            open: marketData.openPrice || marketData.lastPrice,
            high: marketData.high24h,
            low: marketData.low24h,
            close: marketData.lastPrice,
            volume: marketData.volume24h,
            change: marketData.change,
            changePercent: marketData.changePercent,
            timestamp: Date.now(),
            datetime: new Date().toISOString()
          }
        };
      });

      return res.json({
        code: 0,
        message: 'success',
        data: result,
        timestamp: Date.now()
      });
    }

    const symbols = (codes as string).split(',');
    const result: Record<string, any> = {};

    symbols.forEach(symbol => {
      const marketData = marketService.getMarketData(symbol);
      if (marketData) {
        result[symbol] = {
          success: true,
          data: {
            code: marketData.productCode,
            name: marketData.productName,
            price: marketData.lastPrice,
            open: marketData.openPrice || marketData.lastPrice,
            high: marketData.high24h,
            low: marketData.low24h,
            close: marketData.lastPrice,
            volume: marketData.volume24h,
            change: marketData.change,
            changePercent: marketData.changePercent,
            timestamp: Date.now(),
            datetime: new Date().toISOString()
          }
        };
      } else {
        result[symbol] = {
          success: false,
          data: null
        };
      }
    });

    res.json({
      code: 0,
      message: 'success',
      data: result,
      timestamp: Date.now()
    });
  } catch (error) {
    logger.error('[FreeMarket] 批量获取行情失败:', error);
    res.status(500).json({
      code: 500,
      message: '服务器内部错误',
      data: null,
      timestamp: Date.now()
    });
  }
});

export default router;
