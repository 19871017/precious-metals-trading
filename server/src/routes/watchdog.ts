import { Router, Request, Response } from 'express';
import logger from '../utils/logger';
import {
  watchdogService,
  BlockEventType,
  WatchdogConfig,
} from '../services/WatchdogService';
import { ErrorCode, createErrorResponse } from '../utils/error-codes';

const router = Router();

// ============================================
// Watchdog 服务管理路由
// ============================================

/**
 * 获取 Watchdog 服务状态
 */
router.get('/watchdog/status', async (req: Request, res: Response) => {
  try {
    const status = watchdogService.getStatus();

    res.json({
      code: 0,
      message: '获取 Watchdog 服务状态成功',
      data: status,
      timestamp: Date.now(),
    });
  } catch (error) {
    logger.error('[WatchdogAPI] 获取 Watchdog 服务状态失败', error);

    res.status(500).json({
      code: ErrorCode.INTERNAL_ERROR,
      message: '获取 Watchdog 服务状态失败',
      timestamp: Date.now(),
    });
  }
});

/**
 * 启动 Watchdog 服务
 */
router.post('/watchdog/start', async (req: Request, res: Response) => {
  try {
    await watchdogService.start();

    res.json({
      code: 0,
      message: 'Watchdog 服务已启动',
      data: null,
      timestamp: Date.now(),
    });
  } catch (error) {
    logger.error('[WatchdogAPI] 启动 Watchdog 服务失败', error);

    res.status(500).json({
      code: ErrorCode.INTERNAL_ERROR,
      message: '启动 Watchdog 服务失败',
      timestamp: Date.now(),
    });
  }
});

/**
 * 停止 Watchdog 服务
 */
router.post('/watchdog/stop', async (req: Request, res: Response) => {
  try {
    await watchdogService.stop();

    res.json({
      code: 0,
      message: 'Watchdog 服务已停止',
      data: null,
      timestamp: Date.now(),
    });
  } catch (error) {
    logger.error('[WatchdogAPI] 停止 Watchdog 服务失败', error);

    res.status(500).json({
      code: ErrorCode.INTERNAL_ERROR,
      message: '停止 Watchdog 服务失败',
      timestamp: Date.now(),
    });
  }
});

/**
 * 更新 Watchdog 配置
 */
router.put('/watchdog/config', async (req: Request, res: Response) => {
  try {
    const config: Partial<WatchdogConfig> = req.body;

    watchdogService.updateConfig(config);

    res.json({
      code: 0,
      message: 'Watchdog 配置已更新',
      data: watchdogService.getStatus().config,
      timestamp: Date.now(),
    });
  } catch (error) {
    logger.error('[WatchdogAPI] 更新 Watchdog 配置失败', error);

    res.status(500).json({
      code: ErrorCode.INTERNAL_ERROR,
      message: '更新 Watchdog 配置失败',
      timestamp: Date.now(),
    });
  }
});

/**
 * 获取阻塞事件历史
 */
router.get('/watchdog/events', async (req: Request, res: Response) => {
  try {
    const { eventType, limit } = req.query;

    const events = await watchdogService.getBlockEventHistory(
      eventType as BlockEventType,
      limit ? parseInt(limit as string) : 100
    );

    res.json({
      code: 0,
      message: '获取阻塞事件历史成功',
      data: {
        events,
        count: events.length,
      },
      timestamp: Date.now(),
    });
  } catch (error) {
    logger.error('[WatchdogAPI] 获取阻塞事件历史失败', error);

    res.status(500).json({
      code: ErrorCode.INTERNAL_ERROR,
      message: '获取阻塞事件历史失败',
      timestamp: Date.now(),
    });
  }
});

/**
 * 生成阻塞事件报告
 */
router.get('/watchdog/report', async (req: Request, res: Response) => {
  try {
    const { startDate, endDate } = req.query;

    const report = await watchdogService.generateBlockEventReport(
      startDate ? new Date(startDate as string) : undefined,
      endDate ? new Date(endDate as string) : undefined
    );

    res.json({
      code: 0,
      message: '生成阻塞事件报告成功',
      data: report,
      timestamp: Date.now(),
    });
  } catch (error) {
    logger.error('[WatchdogAPI] 生成阻塞事件报告失败', error);

    res.status(500).json({
      code: ErrorCode.INTERNAL_ERROR,
      message: '生成阻塞事件报告失败',
      timestamp: Date.now(),
    });
  }
});

/**
 * 手动记录阻塞事件
 */
router.post('/watchdog/events', async (req: Request, res: Response) => {
  try {
    const { eventType, threshold, actualValue, details } = req.body;

    if (!eventType || !threshold || actualValue === undefined) {
      return res.status(400).json({
        code: 'MISSING_PARAMS',
        message: '缺少必要参数',
        timestamp: Date.now(),
      });
    }

    // 通过内部方法记录事件
    await watchdogService['logBlockEvent']({
      eventType,
      timestamp: Date.now(),
      threshold,
      actualValue,
      severity: watchdogService['calculateSeverity'](
        actualValue,
        threshold,
        threshold * 2
      ),
      details,
    });

    res.json({
      code: 0,
      message: '阻塞事件已记录',
      data: null,
      timestamp: Date.now(),
    });
  } catch (error) {
    logger.error('[WatchdogAPI] 手动记录阻塞事件失败', error);

    res.status(500).json({
      code: ErrorCode.INTERNAL_ERROR,
      message: '手动记录阻塞事件失败',
      timestamp: Date.now(),
    });
  }
});

export default router;
