import { Router, Request, Response } from 'express';
import logger from '../utils/logger';
import {
  degradationService,
  DegradationConfig,
  DegradationLevel,
} from '../services/DegradationService';
import { ErrorCode, createErrorResponse } from '../utils/error-codes';

const router = Router();

// ============================================
// 系统降级机制管理路由
// ============================================

/**
 * 获取降级服务状态
 */
router.get('/degradation/status', async (req: Request, res: Response) => {
  try {
    const status = degradationService.getStatus();

    res.json({
      code: 0,
      message: '获取降级服务状态成功',
      data: status,
      timestamp: Date.now(),
    });
  } catch (error) {
    logger.error('[DegradationAPI] 获取降级服务状态失败', error);

    res.status(500).json({
      code: ErrorCode.INTERNAL_ERROR,
      message: '获取降级服务状态失败',
      timestamp: Date.now(),
    });
  }
});

/**
 * 启动降级服务
 */
router.post('/degradation/start', async (req: Request, res: Response) => {
  try {
    await degradationService.start();

    res.json({
      code: 0,
      message: '降级服务已启动',
      data: null,
      timestamp: Date.now(),
    });
  } catch (error) {
    logger.error('[DegradationAPI] 启动降级服务失败', error);

    res.status(500).json({
      code: ErrorCode.INTERNAL_ERROR,
      message: '启动降级服务失败',
      timestamp: Date.now(),
    });
  }
});

/**
 * 停止降级服务
 */
router.post('/degradation/stop', async (req: Request, res: Response) => {
  try {
    await degradationService.stop();

    res.json({
      code: 0,
      message: '降级服务已停止',
      data: null,
      timestamp: Date.now(),
    });
  } catch (error) {
    logger.error('[DegradationAPI] 停止降级服务失败', error);

    res.status(500).json({
      code: ErrorCode.INTERNAL_ERROR,
      message: '停止降级服务失败',
      timestamp: Date.now(),
    });
  }
});

/**
 * 更新降级配置
 */
router.put('/degradation/config', async (req: Request, res: Response) => {
  try {
    const config: Partial<DegradationConfig> = req.body;

    degradationService.updateConfig(config);

    res.json({
      code: 0,
      message: '降级配置已更新',
      data: degradationService.getStatus().config,
      timestamp: Date.now(),
    });
  } catch (error) {
    logger.error('[DegradationAPI] 更新降级配置失败', error);

    res.status(500).json({
      code: ErrorCode.INTERNAL_ERROR,
      message: '更新降级配置失败',
      timestamp: Date.now(),
    });
  }
});

/**
 * 手动触发降级
 */
router.post('/degradation/trigger', async (req: Request, res: Response) => {
  try {
    const { reason } = req.body;

    await degradationService.manualTrigger(
      reason || '手动触发降级'
    );

    res.json({
      code: 0,
      message: '降级已手动触发',
      data: null,
      timestamp: Date.now(),
    });
  } catch (error) {
    logger.error('[DegradationAPI] 手动触发降级失败', error);

    res.status(500).json({
      code: ErrorCode.INTERNAL_ERROR,
      message: '手动触发降级失败',
      timestamp: Date.now(),
    });
  }
});

/**
 * 手动恢复
 */
router.post('/degradation/recover', async (req: Request, res: Response) => {
  try {
    await degradationService.manualRecover();

    res.json({
      code: 0,
      message: '系统已手动恢复',
      data: null,
      timestamp: Date.now(),
    });
  } catch (error) {
    logger.error('[DegradationAPI] 手动恢复失败', error);

    res.status(500).json({
      code: ErrorCode.INTERNAL_ERROR,
      message: '手动恢复失败',
      timestamp: Date.now(),
    });
  }
});

/**
 * 检查接口是否降级
 */
router.get('/degradation/interface/:path', async (req: Request, res: Response) => {
  try {
    const { path } = req.params;

    const isDegraded = degradationService.isInterfaceDegraded(path);

    res.json({
      code: 0,
      message: '检查接口降级状态成功',
      data: {
        interface: path,
        isDegraded,
        status: isDegraded ? 'DEGRADED' : 'NORMAL',
      },
      timestamp: Date.now(),
    });
  } catch (error) {
    logger.error('[DegradationAPI] 检查接口降级状态失败', error);

    res.status(500).json({
      code: ErrorCode.INTERNAL_ERROR,
      message: '检查接口降级状态失败',
      timestamp: Date.now(),
    });
  }
});

/**
 * 获取降级事件历史
 */
router.get('/degradation/history', async (req: Request, res: Response) => {
  try {
    const { limit } = req.query;

    const history = await degradationService.getDegradationHistory(
      limit ? parseInt(limit as string) : 100
    );

    res.json({
      code: 0,
      message: '获取降级事件历史成功',
      data: {
        history,
        count: history.length,
      },
      timestamp: Date.now(),
    });
  } catch (error) {
    logger.error('[DegradationAPI] 获取降级事件历史失败', error);

    res.status(500).json({
      code: ErrorCode.INTERNAL_ERROR,
      message: '获取降级事件历史失败',
      timestamp: Date.now(),
    });
  }
});

export default router;
