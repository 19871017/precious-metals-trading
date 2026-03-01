import { Router, Request, Response } from 'express';
import logger from '../utils/logger';
import {
  eventStoreService,
  EventType,
  EventLog,
  EventLogOptions,
} from '../services/EventStoreService';
import { ErrorCode, createErrorResponse } from '../utils/error-codes';

const router = Router();

// ============================================
// 事件日志系统管理路由
// ============================================

/**
 * 获取事件统计
 */
router.get('/events/stats', async (req: Request, res: Response) => {
  try {
    const stats = await eventStoreService.getEventStats();

    res.json({
      code: 0,
      message: '获取事件统计成功',
      data: stats,
      timestamp: Date.now(),
    });
  } catch (error) {
    logger.error('[EventAPI] 获取事件统计失败', error);

    res.status(500).json({
      code: ErrorCode.INTERNAL_ERROR,
      message: '获取事件统计失败',
      timestamp: Date.now(),
    });
  }
});

/**
 * 获取事件日志
 */
router.get('/events', async (req: Request, res: Response) => {
  try {
    const {
      eventType,
      accountId,
      orderId,
      positionId,
      version,
      startDate,
      endDate,
      limit,
    } = req.query;

    const events = await eventStoreService.getEventLogs({
      eventType: eventType as EventType,
      accountId: accountId ? parseInt(accountId as string) : undefined,
      orderId: orderId ? parseInt(orderId as string) : undefined,
      positionId: positionId ? parseInt(positionId as string) : undefined,
      version: version ? parseInt(version as string) : undefined,
      startDate: startDate ? new Date(startDate as string) : undefined,
      endDate: endDate ? new Date(endDate as string) : undefined,
      limit: limit ? parseInt(limit as string) : 100,
    });

    res.json({
      code: 0,
      message: '获取事件日志成功',
      data: {
        events,
        count: events.length,
      },
      timestamp: Date.now(),
    });
  } catch (error) {
    logger.error('[EventAPI] 获取事件日志失败', error);

    res.status(500).json({
      code: ErrorCode.INTERNAL_ERROR,
      message: '获取事件日志失败',
      timestamp: Date.now(),
    });
  }
});

/**
 * 获取单个事件
 */
router.get('/events/:eventId', async (req: Request, res: Response) => {
  try {
    const { eventId } = req.params;

    const events = await eventStoreService.getEventLogs({ eventId });

    if (events.length === 0) {
      return res.status(404).json({
        code: 'EVENT_NOT_FOUND',
        message: '事件不存在',
        timestamp: Date.now(),
      });
    }

    const event = events[0];

    res.json({
      code: 0,
      message: '获取事件成功',
      data: event,
      timestamp: Date.now(),
    });
  } catch (error) {
    logger.error('[EventAPI] 获取事件失败', error);

    res.status(500).json({
      code: ErrorCode.INTERNAL_ERROR,
      message: '获取事件失败',
      timestamp: Date.now(),
    });
  }
});

/**
 * 创建事件日志
 */
router.post('/events', async (req: Request, res: Response) => {
  try {
    const {
      eventType,
      accountId,
      orderId,
      positionId,
      beforeState,
      afterState,
      metadata,
    } = req.body;

    const eventId = await eventStoreService.logEvent({
      eventType: eventType as EventType,
      accountId,
      orderId,
      positionId,
      beforeState,
      afterState,
      metadata,
    });

    res.json({
      code: 0,
      message: '事件已记录',
      data: {
        eventId,
      eventType,
      timestamp: Date.now(),
      },
      timestamp: Date.now(),
    });
  } catch (error) {
    logger.error('[EventAPI] 创建事件日志失败', error);

    res.status(500).json({
      code: ErrorCode.INTERNAL_ERROR,
      message: '创建事件日志失败',
      timestamp: Date.now(),
    });
  }
});

/**
 * 回放事件
 */
router.post('/events/replay/:eventId', async (req: Request, res: Response) => {
  try {
    const { eventId } = req.params;
    const { targetVersion } = req.body;

    const success = await eventStoreService.replayEvent(eventId, targetVersion);

    res.json({
      code: 0,
      message: success ? '事件已回放' : '事件回放失败',
      data: {
        eventId,
        targetVersion,
      },
      timestamp: Date.now(),
    });
  } catch (error) {
    logger.error('[EventAPI] 回放事件失败', error);

    res.status(500).json({
      code: ErrorCode.INTERNAL_ERROR,
      message: '事件回放失败',
      timestamp: Date.now(),
    });
  }
});

/**
 * 获取回放历史
 */
router.get('/events/replay/:eventId/history', async (req: Request, res: Response) => {
  try {
    const { eventId } = req.params;

    const history = await eventStoreService.getReplayHistory(eventId);

    res.json({
      code: 0,
      message: '获取回放历史成功',
      data: {
        eventId,
        history,
        count: history.length,
      },
      timestamp: Date.now(),
    });
  } catch (error) {
    logger.error('[EventAPI] 获取回放历史失败', error);

    res.status(500).json({
      code: ErrorCode.INTERNAL_ERROR,
      message: '获取回放历史失败',
      timestamp: Date.now(),
    });
  }
});

/**
 * 清理旧事件
 */
router.post('/events/cleanup', async (req: Request, res: Response) => {
  try {
    const { daysToKeep = 30 } = req.body;

    const deletedCount = await eventStoreService.cleanupOldEvents(daysToKeep);

    res.json({
      code: 0,
      message: `已清理 ${deletedCount} 条事件日志`,
      data: {
        deletedCount,
        daysToKeep,
      },
      timestamp: Date.now(),
    });
  } catch (error) {
    logger.error('[EventAPI] 清理旧事件失败', error);

    res.status(500).json({
      code: ErrorCode.INTERNAL_ERROR,
      message: '清理旧事件失败',
      timestamp: Date.now(),
    });
  }
});

export default router;
