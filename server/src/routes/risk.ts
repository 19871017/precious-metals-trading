import { Router } from 'express';
import { riskEngine, RiskCheckRequest } from '../services/RiskEngine';
import { liquidationScheduler } from '../services/LiquidationScheduler';
import logger from '../utils/logger';

export function createRiskRouter(): Router {
  const router = Router();

  /**
   * GET /risk/engine/config
   * 获取风控配置
   */
  router.get('/engine/config', async (req, res) => {
    try {
      const config = riskEngine.getConfig();

      res.json({
        code: 0,
        message: 'success',
        data: config,
        timestamp: Date.now(),
      });
    } catch (error) {
      logger.error('[RiskAPI] 获取配置失败:', error);

      res.status(500).json({
        code: 500,
        message: '获取配置失败',
        data: null,
        timestamp: Date.now(),
      });
    }
  });

  /**
   * PUT /risk/engine/config
   * 更新风控配置
   */
  router.put('/engine/config', async (req, res) => {
    try {
      const configUpdates = req.body;

      riskEngine.updateConfig(configUpdates);

      logger.info('[RiskAPI] 风控配置已更新:', configUpdates);

      res.json({
        code: 0,
        message: '配置更新成功',
        data: riskEngine.getConfig(),
        timestamp: Date.now(),
      });
    } catch (error) {
      logger.error('[RiskAPI] 更新配置失败:', error);

      res.status(500).json({
        code: 500,
        message: '更新配置失败',
        data: null,
        timestamp: Date.now(),
      });
    }
  });

  /**
   * POST /risk/validate
   * 执行风控检查
   */
  router.post('/validate', async (req, res) => {
    try {
      const request: RiskCheckRequest = req.body;

      const result = await riskEngine.validate(request);

      res.json({
        code: 0,
        message: result.message,
        data: result,
        timestamp: Date.now(),
      });
    } catch (error) {
      logger.error('[RiskAPI] 风控检查失败:', error);

      res.status(500).json({
        code: 500,
        message: '风控检查失败',
        data: null,
        timestamp: Date.now(),
      });
    }
  });

  /**
   * GET /risk/account/:userId/equity
   * 获取账户实时权益
   */
  router.get('/account/:userId/equity', async (req, res) => {
    try {
      const userId = parseInt(req.params.userId);

      const equity = await riskEngine.getAccountEquity(userId);

      res.json({
        code: 0,
        message: 'success',
        data: {
          userId,
          equity,
        },
        timestamp: Date.now(),
      });
    } catch (error) {
      logger.error('[RiskAPI] 获取账户权益失败:', error);

      res.status(500).json({
        code: 500,
        message: error.message || '获取账户权益失败',
        data: null,
        timestamp: Date.now(),
      });
    }
  });

  /**
   * GET /risk/platform/stats
   * 获取平台风险统计
   */
  router.get('/platform/stats', async (req, res) => {
    try {
      const stats = await riskEngine.getPlatformRiskStats();

      res.json({
        code: 0,
        message: 'success',
        data: stats,
        timestamp: Date.now(),
      });
    } catch (error) {
      logger.error('[RiskAPI] 获取平台统计失败:', error);

      res.status(500).json({
        code: 500,
        message: '获取平台统计失败',
        data: null,
        timestamp: Date.now(),
      });
    }
  });

  /**
   * GET /risk/liquidation/stats
   * 获取强平队列统计
   */
  router.get('/liquidation/stats', async (req, res) => {
    try {
      const stats = await liquidationScheduler.getQueueStats();

      res.json({
        code: 0,
        message: 'success',
        data: stats,
        timestamp: Date.now(),
      });
    } catch (error) {
      logger.error('[RiskAPI] 获取强平队列统计失败:', error);

      res.status(500).json({
        code: 500,
        message: '获取强平队列统计失败',
        data: null,
        timestamp: Date.now(),
      });
    }
  });

  /**
   * POST /risk/liquidation/start
   * 启动强平调度器
   */
  router.post('/liquidation/start', async (req, res) => {
    try {
      const { interval } = req.body;

      await liquidationScheduler.start(interval || 5000);

      logger.info('[RiskAPI] 强平调度器已启动');

      res.json({
        code: 0,
        message: '强平调度器已启动',
        data: {
          interval: interval || 5000,
        },
        timestamp: Date.now(),
      });
    } catch (error) {
      logger.error('[RiskAPI] 启动强平调度器失败:', error);

      res.status(500).json({
        code: 500,
        message: '启动强平调度器失败',
        data: null,
        timestamp: Date.now(),
      });
    }
  });

  /**
   * POST /risk/liquidation/stop
   * 停止强平调度器
   */
  router.post('/liquidation/stop', async (req, res) => {
    try {
      await liquidationScheduler.stop();

      logger.info('[RiskAPI] 强平调度器已停止');

      res.json({
        code: 0,
        message: '强平调度器已停止',
        data: null,
        timestamp: Date.now(),
      });
    } catch (error) {
      logger.error('[RiskAPI] 停止强平调度器失败:', error);

      res.status(500).json({
        code: 500,
        message: '停止强平调度器失败',
        data: null,
        timestamp: Date.now(),
      });
    }
  });

  /**
   * POST /risk/liquidation/add
   * 手动添加强平任务
   */
  router.post('/liquidation/add', async (req, res) => {
    try {
      const { userId, positionId, productCode, liquidationPrice, reason } = req.body;

      const jobId = await liquidationScheduler.addLiquidationJob({
        userId,
        positionId,
        productCode,
        liquidationPrice,
        reason: reason || '手动强平',
      });

      logger.info('[RiskAPI] 强平任务已添加:', jobId);

      res.json({
        code: 0,
        message: '强平任务已添加',
        data: {
          jobId,
        },
        timestamp: Date.now(),
      });
    } catch (error) {
      logger.error('[RiskAPI] 添加强平任务失败:', error);

      res.status(500).json({
        code: 500,
        message: '添加强平任务失败',
        data: null,
        timestamp: Date.now(),
      });
    }
  });

  return router;
}
