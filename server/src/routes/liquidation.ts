import { Router } from 'express';
import { liquidationScheduler } from '../services/LiquidationSchedulerV2';
import logger from '../utils/logger';

export function createLiquidationRouter(): Router {
  const router = Router();

  /**
   * GET /liquidation/queue/stats
   * 获取强平队列统计
   */
  router.get('/queue/stats', async (req, res) => {
    try {
      const stats = await liquidationScheduler.getQueueStats();

      res.json({
        code: 0,
        message: 'success',
        data: stats,
        timestamp: Date.now(),
      });
    } catch (error) {
      logger.error('[LiquidationAPI] 获取队列统计失败:', error);

      res.status(500).json({
        code: 500,
        message: '获取队列统计失败',
        data: null,
        timestamp: Date.now(),
      });
    }
  });

  /**
   * GET /liquidation/risk/stats
   * 获取风险账户统计
   */
  router.get('/risk/stats', async (req, res) => {
    try {
      const stats = await liquidationScheduler.getRiskAccountStats();

      res.json({
        code: 0,
        message: 'success',
        data: stats,
        timestamp: Date.now(),
      });
    } catch (error) {
      logger.error('[LiquidationAPI] 获取风险统计失败:', error);

      res.status(500).json({
        code: 500,
        message: '获取风险统计失败',
        data: null,
        timestamp: Date.now(),
      });
    }
  });

  /**
   * POST /liquidation/start
   * 启动强平调度器
   */
  router.post('/start', async (req, res) => {
    try {
      const { interval } = req.body;

      if (interval && (interval < 100 || interval > 10000)) {
        return res.status(400).json({
          code: 400,
          message: '扫描间隔必须在100ms-10000ms之间',
          data: null,
          timestamp: Date.now(),
        });
      }

      await liquidationScheduler.start();

      logger.info(
        `[LiquidationAPI] 强平调度器已启动, 间隔: ${interval || 500}ms`
      );

      res.json({
        code: 0,
        message: '强平调度器已启动',
        data: {
          interval: interval || 500,
        },
        timestamp: Date.now(),
      });
    } catch (error) {
      logger.error('[LiquidationAPI] 启动调度器失败:', error);

      res.status(500).json({
        code: 500,
        message: '启动调度器失败',
        data: null,
        timestamp: Date.now(),
      });
    }
  });

  /**
   * POST /liquidation/stop
   * 停止强平调度器
   */
  router.post('/stop', async (req, res) => {
    try {
      await liquidationScheduler.stop();

      logger.info('[LiquidationAPI] 强平调度器已停止');

      res.json({
        code: 0,
        message: '强平调度器已停止',
        data: null,
        timestamp: Date.now(),
      });
    } catch (error) {
      logger.error('[LiquidationAPI] 停止调度器失败:', error);

      res.status(500).json({
        code: 500,
        message: '停止调度器失败',
        data: null,
        timestamp: Date.now(),
      });
    }
  });

  /**
   * POST /liquidation/force
   * 手动触发强平
   */
  router.post('/force', async (req, res) => {
    try {
      const { userId, positionId, productCode, currentPrice, reason } = req.body;

      if (!userId || !positionId || !productCode || !currentPrice) {
        return res.status(400).json({
          code: 400,
          message: '参数不完整',
          data: null,
          timestamp: Date.now(),
        });
      }

      await liquidationScheduler.forceLiquidate(
        userId,
        positionId,
        productCode,
        currentPrice,
        reason || '手动强平'
      );

      logger.info(
        `[LiquidationAPI] 手动强平已触发: userId=${userId}, positionId=${positionId}, price=${currentPrice}`
      );

      res.json({
        code: 0,
        message: '手动强平已触发',
        data: {
          userId,
          positionId,
          currentPrice,
        },
        timestamp: Date.now(),
      });
    } catch (error) {
      logger.error('[LiquidationAPI] 手动强平失败:', error);

      res.status(500).json({
        code: 500,
        message: '手动强平失败',
        data: null,
        timestamp: Date.now(),
      });
    }
  });

  /**
   * GET /liquidation/status
   * 获取调度器状态
   */
  router.get('/status', async (req, res) => {
    try {
      const [queueStats, riskStats] = await Promise.all([
        liquidationScheduler.getQueueStats(),
        liquidationScheduler.getRiskAccountStats(),
      ]);

      res.json({
        code: 0,
        message: 'success',
        data: {
          queue: queueStats,
          risk: riskStats,
        },
        timestamp: Date.now(),
      });
    } catch (error) {
      logger.error('[LiquidationAPI] 获取状态失败:', error);

      res.status(500).json({
        code: 500,
        message: '获取状态失败',
        data: null,
        timestamp: Date.now(),
      });
    }
  });

  return router;
}
