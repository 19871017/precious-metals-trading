import { Router, Request, Response } from 'express';
import logger from '../utils/logger';
import {
  chaosTestService,
  ChaosTestConfig,
  ChaosTestResult,
} from '../services/ChaosTestService';
import { ErrorCode, createErrorResponse } from '../utils/error-codes';

const router = Router();

// ============================================
// 混沌测试管理路由
// ============================================

/**
 * 获取混沌测试状态
 */
router.get('/chaos-test/status', async (req: Request, res: Response) => {
  try {
    const results = chaosTestService.getResults();
    const status = {
      isRunning: results !== null,
      config: chaosTestService['config'],
      results,
    };

    res.json({
      code: 0,
      message: '获取混沌测试状态成功',
      data: status,
      timestamp: Date.now(),
    });
  } catch (error) {
    logger.error('[ChaosTestAPI] 获取混沌测试状态失败', error);

    res.status(500).json({
      code: ErrorCode.INTERNAL_ERROR,
      message: '获取混沌测试状态失败',
      timestamp: Date.now(),
    });
  }
});

/**
 * 运行混沌测试
 */
router.post('/chaos-test/run', async (req: Request, res: Response) => {
  try {
    const config: Partial<ChaosTestConfig> = req.body;

    // 更新配置
    if (config) {
      chaosTestService.updateConfig(config);
    }

    // 异步运行测试
    chaosTestService.runTest().then((results) => {
      logger.info('[ChaosTestAPI] 混沌测试完成', {
        stats: results.stats,
      });
    }).catch((error) => {
      logger.error('[ChaosTestAPI] 混沌测试失败', error);
    });

    res.json({
      code: 0,
      message: '混沌测试已启动',
      data: {
        config: chaosTestService['config'],
      },
      timestamp: Date.now(),
    });
  } catch (error) {
    logger.error('[ChaosTestAPI] 运行混沌测试失败', error);

    res.status(500).json({
      code: ErrorCode.INTERNAL_ERROR,
      message: '运行混沌测试失败',
      timestamp: Date.now(),
    });
  }
});

/**
 * 停止混沌测试
 */
router.post('/chaos-test/stop', async (req: Request, res: Response) => {
  try {
    await chaosTestService.stopTest();

    res.json({
      code: 0,
      message: '混沌测试已停止',
      data: null,
      timestamp: Date.now(),
    });
  } catch (error) {
    logger.error('[ChaosTestAPI] 停止混沌测试失败', error);

    res.status(500).json({
      code: ErrorCode.INTERNAL_ERROR,
      message: '停止混沌测试失败',
      timestamp: Date.now(),
    });
  }
});

/**
 * 更新混沌测试配置
 */
router.put('/chaos-test/config', async (req: Request, res: Response) => {
  try {
    const config: Partial<ChaosTestConfig> = req.body;

    chaosTestService.updateConfig(config);

    res.json({
      code: 0,
      message: '混沌测试配置已更新',
      data: chaosTestService['config'],
      timestamp: Date.now(),
    });
  } catch (error) {
    logger.error('[ChaosTestAPI] 更新混沌测试配置失败', error);

    res.status(500).json({
      code: ErrorCode.INTERNAL_ERROR,
      message: '更新混沌测试配置失败',
      timestamp: Date.now(),
    });
  }
});

/**
 * 获取混沌测试报告
 */
router.get('/chaos-test/report', async (req: Request, res: Response) => {
  try {
    const report = chaosTestService.outputReport();

    res.json({
      code: 0,
      message: '获取混沌测试报告成功',
      data: {
        report,
        results: chaosTestService.getResults(),
      },
      timestamp: Date.now(),
    });
  } catch (error) {
    logger.error('[ChaosTestAPI] 获取混沌测试报告失败', error);

    res.status(500).json({
      code: ErrorCode.INTERNAL_ERROR,
      message: '获取混沌测试报告失败',
      timestamp: Date.now(),
    });
  }
});

/**
 * 获取测试结果（JSON 格式）
 */
router.get('/chaos-test/results', async (req: Request, res: Response) => {
  try {
    const results = chaosTestService.getResults();

    if (!results) {
      return res.status(400).json({
        code: 'TEST_NOT_COMPLETED',
        message: '测试尚未完成',
        timestamp: Date.now(),
      });
    }

    res.json({
      code: 0,
      message: '获取测试结果成功',
      data: results,
      timestamp: Date.now(),
    });
  } catch (error) {
    logger.error('[ChaosTestAPI] 获取测试结果失败', error);

    res.status(500).json({
      code: ErrorCode.INTERNAL_ERROR,
      message: '获取测试结果失败',
      timestamp: Date.now(),
    });
  }
});

export default router;
