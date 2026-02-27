import express from 'express';
import logger from '../utils/logger';
import { ErrorCode, createErrorResponse, createSuccessResponse } from '../utils/error-codes';
import { authenticateUser } from '../middleware/auth';
import {
  getPortfolio,
  getRiskExposure,
  getPerformanceMetrics,
  getPortfolioAnalysis
} from '../services/portfolio.service';

const router = express.Router();

/**
 * 获取投资组合
 */
router.get('/portfolio', authenticateUser, async (req: express.Request, res: express.Response) => {
  try {
    const userId = req.userId;

    if (!userId) {
      return res.status(400).json(createErrorResponse(ErrorCode.MISSING_PARAM, '用户ID不存在'));
    }

    const portfolio = await getPortfolio(userId);

    res.json(createSuccessResponse(portfolio, '获取成功'));
  } catch (error: any) {
    logger.error('[Portfolio] 获取投资组合失败:', error);
    res.status(500).json(createErrorResponse(ErrorCode.INTERNAL_ERROR, '获取投资组合失败'));
  }
});

/**
 * 获取风险敞口
 */
router.get('/portfolio/risk-exposure', authenticateUser, async (req: express.Request, res: express.Response) => {
  try {
    const userId = req.userId;

    if (!userId) {
      return res.status(400).json(createErrorResponse(ErrorCode.MISSING_PARAM, '用户ID不存在'));
    }

    const exposure = await getRiskExposure(userId);

    res.json(createSuccessResponse(exposure, '获取成功'));
  } catch (error: any) {
    logger.error('[Portfolio] 获取风险敞口失败:', error);
    res.status(500).json(createErrorResponse(ErrorCode.INTERNAL_ERROR, '获取风险敞口失败'));
  }
});

/**
 * 获取性能指标
 */
router.get('/portfolio/performance', authenticateUser, async (req: express.Request, res: express.Response) => {
  try {
    const userId = req.userId;
    const { days = 30 } = req.query;

    if (!userId) {
      return res.status(400).json(createErrorResponse(ErrorCode.MISSING_PARAM, '用户ID不存在'));
    }

    const performance = await getPerformanceMetrics(userId, parseInt(days as string));

    res.json(createSuccessResponse(performance, '获取成功'));
  } catch (error: any) {
    logger.error('[Portfolio] 获取性能指标失败:', error);
    res.status(500).json(createErrorResponse(ErrorCode.INTERNAL_ERROR, '获取性能指标失败'));
  }
});

/**
 * 获取投资组合分析
 */
router.get('/portfolio/analysis', authenticateUser, async (req: express.Request, res: express.Response) => {
  try {
    const userId = req.userId;
    const { days = 30 } = req.query;

    if (!userId) {
      return res.status(400).json(createErrorResponse(ErrorCode.MISSING_PARAM, '用户ID不存在'));
    }

    const analysis = await getPortfolioAnalysis(userId, parseInt(days as string));

    res.json(createSuccessResponse(analysis, '获取成功'));
  } catch (error: any) {
    logger.error('[Portfolio] 获取投资组合分析失败:', error);
    res.status(500).json(createErrorResponse(ErrorCode.INTERNAL_ERROR, '获取投资组合分析失败'));
  }
});

export default router;
