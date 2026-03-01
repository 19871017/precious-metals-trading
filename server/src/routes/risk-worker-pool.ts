import { Router, Request, Response } from 'express';
import logger from '../utils/logger';
import { riskEngineWorkerPoolManager } from '../services/RiskEngineWorkerPoolManager';
import { ErrorCode, createErrorResponse } from '../utils/error-codes';

const router = Router();

// ============================================
// Risk Engine Worker Pool 管理路由
// ============================================

/**
 * 获取 Worker Pool 状态
 */
router.get('/worker-pool/status', async (req: Request, res: Response) => {
  try {
    const status = riskEngineWorkerPoolManager.getStatus();

    res.json({
      code: 0,
      message: '获取 Worker Pool 状态成功',
      data: status,
      timestamp: Date.now(),
    });
  } catch (error) {
    logger.error('[RiskAPI] 获取 Worker Pool 状态失败', error);

    res.status(500).json({
      code: ErrorCode.INTERNAL_ERROR,
      message: '获取 Worker Pool 状态失败',
      timestamp: Date.now(),
    });
  }
});

/**
 * 获取队列统计
 */
router.get('/worker-pool/queue/stats', async (req: Request, res: Response) => {
  try {
    const stats = await riskEngineWorkerPoolManager.getQueueStats();

    res.json({
      code: 0,
      message: '获取队列统计成功',
      data: stats,
      timestamp: Date.now(),
    });
  } catch (error) {
    logger.error('[RiskAPI] 获取队列统计失败', error);

    if (error instanceof Error && error.message === 'Risk Engine Worker Pool 未初始化') {
      res.status(400).json({
        code: 'WORKER_POOL_NOT_INITIALIZED',
        message: 'Risk Engine Worker Pool 未初始化',
        timestamp: Date.now(),
      });
    } else {
      res.status(500).json({
        code: ErrorCode.INTERNAL_ERROR,
        message: '获取队列统计失败',
        timestamp: Date.now(),
      });
    }
  }
});

/**
 * 暂停队列
 */
router.post('/worker-pool/queue/pause', async (req: Request, res: Response) => {
  try {
    await riskEngineWorkerPoolManager.pauseQueue();

    res.json({
      code: 0,
      message: '队列已暂停',
      data: null,
      timestamp: Date.now(),
    });
  } catch (error) {
    logger.error('[RiskAPI] 暂停队列失败', error);

    if (error instanceof Error && error.message === 'Risk Engine Worker Pool 未初始化') {
      res.status(400).json({
        code: 'WORKER_POOL_NOT_INITIALIZED',
        message: 'Risk Engine Worker Pool 未初始化',
        timestamp: Date.now(),
      });
    } else {
      res.status(500).json({
        code: ErrorCode.INTERNAL_ERROR,
        message: '暂停队列失败',
        timestamp: Date.now(),
      });
    }
  }
});

/**
 * 恢复队列
 */
router.post('/worker-pool/queue/resume', async (req: Request, res: Response) => {
  try {
    await riskEngineWorkerPoolManager.resumeQueue();

    res.json({
      code: 0,
      message: '队列已恢复',
      data: null,
      timestamp: Date.now(),
    });
  } catch (error) {
    logger.error('[RiskAPI] 恢复队列失败', error);

    if (error instanceof Error && error.message === 'Risk Engine Worker Pool 未初始化') {
      res.status(400).json({
        code: 'WORKER_POOL_NOT_INITIALIZED',
        message: 'Risk Engine Worker Pool 未初始化',
        timestamp: Date.now(),
      });
    } else {
      res.status(500).json({
        code: ErrorCode.INTERNAL_ERROR,
        message: '恢复队列失败',
        timestamp: Date.now(),
      });
    }
  }
});

/**
 * 清空队列
 */
router.post('/worker-pool/queue/drain', async (req: Request, res: Response) => {
  try {
    await riskEngineWorkerPoolManager.drainQueue();

    res.json({
      code: 0,
      message: '队列已清空',
      data: null,
      timestamp: Date.now(),
    });
  } catch (error) {
    logger.error('[RiskAPI] 清空队列失败', error);

    if (error instanceof Error && error.message === 'Risk Engine Worker Pool 未初始化') {
      res.status(400).json({
        code: 'WORKER_POOL_NOT_INITIALIZED',
        message: 'Risk Engine Worker Pool 未初始化',
        timestamp: Date.now(),
      });
    } else {
      res.status(500).json({
        code: ErrorCode.INTERNAL_ERROR,
        message: '清空队列失败',
        timestamp: Date.now(),
      });
    }
  }
});

export default router;
