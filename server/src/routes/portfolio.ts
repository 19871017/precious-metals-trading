import express from 'express';
import logger from '../utils/logger';
import { ErrorCode, createErrorResponse, createSuccessResponse } from '../utils/error-codes';
import {
  getPortfolio,
  getRiskExposure,
  getPerformanceMetrics,
  getPortfolioAnalysis
} from '../services/portfolio.service';

const router = express.Router();

/**
 * JWT认证中间件
 */
const authenticateUser = (req: express.Request, res: express.Response, next: express.NextFunction) => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json(createErrorResponse(ErrorCode.TOKEN_MISSING));
    }

    const token = authHeader.substring(7);

    try {
      const jwt = require('jsonwebtoken');
      const JWT_SECRET = process.env.JWT_SECRET;

      if (!JWT_SECRET) {
        throw new Error('JWT_SECRET未配置');
      }

      const decoded = jwt.verify(token, JWT_SECRET);
      req.user = decoded;
      next();
    } catch (jwtError) {
      const isExpired = (jwtError as any).name === 'TokenExpiredError';
      return res.status(401).json(
        createErrorResponse(isExpired ? ErrorCode.TOKEN_EXPIRED : ErrorCode.TOKEN_INVALID)
      );
    }
  } catch (error) {
    logger.error('[Portfolio] 认证中间件错误:', error);
    return res.status(500).json(createErrorResponse(ErrorCode.INTERNAL_ERROR, '认证失败'));
  }
};

/**
 * 获取投资组合
 */
router.get('/portfolio', authenticateUser, async (req: express.Request, res: express.Response) => {
  try {
    const userId = req.user?.user_id || req.user?.userId;

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
    const userId = req.user?.user_id || req.user?.userId;

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
    const userId = req.user?.user_id || req.user?.userId;
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
    const userId = req.user?.user_id || req.user?.userId;
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
