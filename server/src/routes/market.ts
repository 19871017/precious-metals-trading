import { Router } from 'express';
import { MarketDataServiceV2 } from '../services/MarketDataServiceV2';
import { TradingService, TradeRequest } from '../services/TradingService';
import { tradingService } from '../services/TradingService';
import { marketDataServiceV2 } from '../services/MarketDataServiceV2';
import logger from '../utils/logger';

export function createMarketRouterV2(): Router {
  const router = Router();

  /**
   * POST /market/update
   * 更新单个行情
   */
  router.post('/update', async (req, res) => {
    try {
      const { productCode, price, bid, ask, high24h, low24h, volume24h, change, changePercent } = req.body;

      if (!productCode || price === undefined) {
        return res.status(400).json({
          code: 400,
          message: 'productCode和price是必需的',
          data: null,
          timestamp: Date.now(),
        });
      }

      await marketDataServiceV2.updateMarketData({
        productCode,
        price: parseFloat(price),
        bid: bid ? parseFloat(bid) : parseFloat(price),
        ask: ask ? parseFloat(ask) : parseFloat(price),
        high24h: high24h ? parseFloat(high24h) : 0,
        low24h: low24h ? parseFloat(low24h) : 0,
        volume24h: volume24h ? parseFloat(volume24h) : 0,
        change: change ? parseFloat(change) : 0,
        changePercent: changePercent ? parseFloat(changePercent) : 0,
        timestamp: req.body.timestamp ? new Date(req.body.timestamp) : Date.now(),
      });

      res.json({
        code: 0,
        message: '行情更新成功',
        data: {
          productCode,
          price: parseFloat(price),
          timestamp: Date.now(),
        },
        timestamp: Date.now(),
      });
    } catch (error) {
      logger.error('[MarketAPI] 更新行情失败:', error);

      res.status(500).json({
        code: 500,
        message: '更新行情失败',
        data: null,
        timestamp: Date.now(),
      });
    }
  });

  /**
   * POST /market/batch-update
   * 批量更新行情
   */
  router.post('/batch-update', async (req, res) => {
    try {
      const { updates } = req.body;

      if (!Array.isArray(updates) || updates.length === 0) {
        return res.status(400).json({
          code: 400,
          message: 'updates必须是非空数组',
          data: null,
          timestamp: Date.now(),
        });
      }

      await marketDataServiceV2.batchUpdateMarketData(updates);

      res.json({
        code: 0,
        message: '批量更新行情成功',
        data: {
          total: updates.length,
        timestamp: Date.now(),
        },
        timestamp: Date.now(),
      });
    } catch (error) {
      logger.error('[MarketAPI] 批量更新行情失败:', error);

      res.status(500).json({
        code: 500,
        message: '批量更新行情失败',
        data: null,
        timestamp: Date.now(),
      });
    }
  });

  /**
   * GET /market/cache/:productCode
   * 获取行情缓存
   */
  router.get('/cache/:productCode', async (req, res) => {
    try {
      const productCode = req.params.productCode;

      const cache = await marketDataServiceV2.getMarketCache(productCode);

      if (!cache) {
        return res.status(404).json({
          code: 404,
          message: '行情缓存不存在',
          data: null,
          timestamp: Date.now(),
        });
      }

      res.json({
        code: 0,
        message: 'success',
        data: cache,
        timestamp: Date.now(),
      });
    } catch (error) {
      logger.error('[MarketAPI] 获取行情缓存失败:', error);

      res.status(500).json({
        code: 500,
        message: '获取行情缓存失败',
        data: null,
        timestamp: Date.now(),
      });
    }
  });

  /**
   * GET /market/cache/all
   * 获取所有行情缓存
   */
  router.get('/cache/all', async (req, res) => {
    try {
      const caches = await marketDataServiceV2.getAllMarketCache();

      res.json({
        code: 0,
        message: 'success',
        data: caches,
        timestamp: Date.now(),
      });
    } catch (error) {
      logger.error('[MarketAPI] 获取所有行情缓存失败:', error);

      res.status(500).json({
        code: 500,
        message: '获取所有行情缓存失败',
        data: null,
        timestamp: Date.now(),
      });
    }
  });

  /**
   * GET /market/snapshot/:productCode
   * 获取行情快照
   */
  router.get('/snapshot/:productCode', async (req, res) => {
    try {
      const productCode = req.params.productCode;

      const snapshot = await marketDataServiceV2.getMarketSnapshot(productCode);

      if (!snapshot) {
        return res.status(404).json({
          code: 404,
          message: '行情快照不存在',
          data: null,
          timestamp: Date.now(),
        });
      }

      res.json({
        code: 0,
        message: 'success',
        data: snapshot,
        timestamp: Date.now(),
      });
    } catch (error) {
      logger.error('[MarketAPI] 获取行情快照失败:', error);

      res.status(500).json({
        code: 500,
        message: '获取行情快照失败',
        data: null,
        timestamp: Date.now(),
      });
    }
  });

  /**
   * POST /trade/market
   * 市价撮合
   */
  router.post('/market', async (req, res) => {
    try {
      const { userId, productCode, direction, quantity, leverage } = req.body;

      const request: TradeRequest = {
        userId,
        productCode,
        type: 'MARKET',
        direction,
        quantity,
        leverage,
      };

      const result = await tradingService.executeMarketOrder(request);

      res.json({
        code: result.success ? 0 : 400,
        message: result.message,
        data: result,
        timestamp: Date.now(),
      });
    } catch (error) {
      logger.error('[TradeAPI] 市价撮合失败:', error);

      res.status(500).json({
        code: 500,
        message: '市价撮合失败',
        data: null,
        timestamp: Date.now(),
      });
    }
  });

  /**
   * POST /trade/limit
   * 限价撮合
   */
  router.post('/limit', async (req, res) => {
    try {
      const { userId, productCode, direction, quantity, leverage, price } = req.body;

      const request: TradeRequest = {
        userId,
        productCode,
        type: 'LIMIT',
        direction,
        quantity,
        leverage,
        price,
      };

      const result = await tradingService.executeLimitOrder(request);

      res.json({
        code: result.success ? 0 : 400,
        message: result.message,
        data: result,
        timestamp: Date.now(),
      });
    } catch (error) {
      logger.error('[TradeAPI] 限价撮合失败:', error);

      res.status(500).json({
        code: 500,
        message: '限价撮合失败',
        data: null,
        timestamp: Date.now(),
      });
    }
  });

  /**
   * GET /market/is-stale/:productCode
   * 检查行情是否过期
   */
  router.get('/is-stale/:productCode', async (req, res) => {
    try {
      const productCode = req.params.productCode;
      const { maxAge } = req.query;

      const isStale = await marketDataServiceV2.isMarketStale(
        productCode,
        maxAge ? parseInt(maxAge as string) : 5000
      );

      res.json({
        code: 0,
        message: 'success',
        data: {
          isStale,
          productCode,
          maxAge: maxAge ? parseInt(maxAge as string) : 5000,
        },
        timestamp: Date.now(),
      });
    } catch (error) {
      logger.error('[MarketAPI] 检查行情过期失败:', error);

      res.status(500).json({
        code: 500,
        message: '检查行情过期失败',
        data: null,
        timestamp: Date.now(),
      });
    }
  });

  /**
   * POST /market/validate-version
   * 验证行情版本
   */
  router.post('/validate-version', async (req, res) => {
    try {
      const { productCode, version } = req.body;

      if (!productCode || version === undefined) {
        return res.status(400).json({
          code: 400,
          message: 'productCode和version是必需的',
          data: null,
          timestamp: Date.now(),
        });
      }

      const isValid = await marketDataServiceV2.validateMarketVersion(
        productCode,
        version
      );

      res.json({
        code: 0,
        message: 'success',
        data: {
          isValid,
          productCode,
          version,
        },
        timestamp: Date.now(),
      });
    } catch (error) {
      logger.error('[MarketAPI] 验证行情版本失败:', error);

      res.status(500).json({
        code: 500,
        message: '验证行情版本失败',
        data: null,
        timestamp: Date.now(),
      });
    }
  });

  /**
   * GET /market/cache/stats
   * 获取缓存统计
   */
  router.get('/cache/stats', async (req, res) => {
    try {
      const stats = await marketDataServiceV2.getCacheStats();

      res.json({
        code: 0,
        message: 'success',
        data: stats,
        timestamp: Date.now(),
      });
    } catch (error) {
      logger.error('[MarketAPI] 获取缓存统计失败:', error);

      res.status(500).json({
        code: 500,
        message: '获取缓存统计失败',
        data: null,
        timestamp: Date.now(),
      });
    }
  });

  /**
   * DELETE /market/cache
   * 清空行情缓存
   */
  router.delete('/cache', async (req, res) => {
    try {
      await marketDataServiceV2.clearMarketCache();

      res.json({
        code: 0,
        message: '行情缓存已清空',
        data: null,
        timestamp: Date.now(),
      });
    } catch (error) {
      logger.error('[MarketAPI] 清空行情缓存失败:', error);

      res.status(500).json({
        code: 500,
        message: '清空行情缓存失败',
        data: null,
        timestamp: Date.now(),
      });
    }
  });

  return router;
}
