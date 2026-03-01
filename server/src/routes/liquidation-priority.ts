import { Router, Request, Response } from 'express';
import logger from '../utils/logger';
import { liquidationPriorityScheduler } from '../services/LiquidationPriorityScheduler';
import { ErrorCode, createErrorResponse } from '../utils/error-codes';

const router = Router();

// ============================================
// 优先级强平队列管理路由
// ============================================

/**
 * 获取优先级队列统计
 */
router.get('/priority/queue/stats', async (req: Request, res: Response) => {
  try {
    const stats = await liquidationPriorityScheduler.getQueueStats();

    res.json({
      code: 0,
      message: '获取优先级队列统计成功',
      data: stats,
      timestamp: Date.now(),
    });
  } catch (error) {
    logger.error('[LiquidationAPI] 获取优先级队列统计失败', error);

    res.status(500).json({
      code: ErrorCode.INTERNAL_ERROR,
      message: '获取优先级队列统计失败',
      timestamp: Date.now(),
    });
  }
});

/**
 * 暂停优先级队列
 */
router.post('/priority/queue/pause', async (req: Request, res: Response) => {
  try {
    await liquidationPriorityScheduler.pauseQueue();

    res.json({
      code: 0,
      message: '优先级队列已暂停',
      data: null,
      timestamp: Date.now(),
    });
  } catch (error) {
    logger.error('[LiquidationAPI] 暂停优先级队列失败', error);

    res.status(500).json({
      code: ErrorCode.INTERNAL_ERROR,
      message: '暂停优先级队列失败',
      timestamp: Date.now(),
    });
  }
});

/**
 * 恢复优先级队列
 */
router.post('/priority/queue/resume', async (req: Request, res: Response) => {
  try {
    await liquidationPriorityScheduler.resumeQueue();

    res.json({
      code: 0,
      message: '优先级队列已恢复',
      data: null,
      timestamp: Date.now(),
    });
  } catch (error) {
    logger.error('[LiquidationAPI] 恢复优先级队列失败', error);

    res.status(500).json({
      code: ErrorCode.INTERNAL_ERROR,
      message: '恢复优先级队列失败',
      timestamp: Date.now(),
    });
  }
});

/**
 * 清空优先级队列
 */
router.post('/priority/queue/drain', async (req: Request, res: Response) => {
  try {
    await liquidationPriorityScheduler.drainQueue();

    res.json({
      code: 0,
      message: '优先级队列已清空',
      data: null,
      timestamp: Date.now(),
    });
  } catch (error) {
    logger.error('[LiquidationAPI] 清空优先级队列失败', error);

    res.status(500).json({
      code: ErrorCode.INTERNAL_ERROR,
      message: '清空优先级队列失败',
      timestamp: Date.now(),
    });
  }
});

/**
 * 手动触发优先级强平
 */
router.post('/priority/force', async (req: Request, res: Response) => {
  try {
    const { userId, positionId, productCode, currentPrice, reason } = req.body;

    if (!userId || !positionId || !productCode || !currentPrice) {
      return res.status(400).json({
        code: 'MISSING_PARAMS',
        message: '缺少必要参数',
        timestamp: Date.now(),
      });
    }

    await liquidationPriorityScheduler.forcePriorityLiquidate(
      userId,
      positionId,
      productCode,
      currentPrice,
      reason || '手动优先级强平'
    );

    res.json({
      code: 0,
      message: '优先级强平任务已提交',
      data: {
        userId,
        positionId,
      },
      timestamp: Date.now(),
    });
  } catch (error) {
    logger.error('[LiquidationAPI] 手动触发优先级强平失败', error);

    res.status(500).json({
      code: ErrorCode.INTERNAL_ERROR,
      message: '手动触发优先级强平失败',
      timestamp: Date.now(),
    });
  }
});

export default router;
