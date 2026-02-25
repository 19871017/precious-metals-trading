import { Router, Request, Response } from 'express';
import { FundamentalService } from '../../services/fundamental.service';

const router = Router();
const fundamentalService = new FundamentalService();

/**
 * 获取公司财务数据
 * GET /api/v1/fundamental/financials
 */
router.get('/financials', async (req: Request, res: Response) => {
  try {
    const { symbol, period, statement, years } = req.query;

    if (!symbol) {
      return res.status(400).json({
        code: 1001,
        message: '缺少必要参数: symbol',
        data: null
      });
    }

    const data = await fundamentalService.getFinancialData({
      symbol: symbol as string,
      period: (period as 'quarterly' | 'annual') || 'quarterly',
      statement: statement as 'income' | 'balance' | 'cashflow' | 'all' || 'all',
      years: years ? parseInt(years as string) : 5
    });

    // 设置缓存，TTL 300秒（5分钟）
    res.set('Cache-Control', 'public, max-age=300');
    res.json({
      code: 0,
      message: 'success',
      data
    });
  } catch (error) {
    console.error('获取财务数据失败:', error);
    res.status(500).json({
      code: 5000,
      message: '服务器内部错误',
      data: null
    });
  }
});

/**
 * 获取行业分析数据
 * GET /api/v1/fundamental/industry
 */
router.get('/industry', async (req: Request, res: Response) => {
  try {
    const { industryCode, sector, metrics } = req.query;

    const data = await fundamentalService.getIndustryData({
      industryCode: industryCode as string,
      sector: sector as string,
      metrics: metrics ? (metrics as string).split(',') : undefined
    });

    // 设置缓存，TTL 600秒（10分钟）
    res.set('Cache-Control', 'public, max-age=600');
    res.json({
      code: 0,
      message: 'success',
      data
    });
  } catch (error) {
    console.error('获取行业数据失败:', error);
    res.status(500).json({
      code: 5000,
      message: '服务器内部错误',
      data: null
    });
  }
});

/**
 * 获取宏观经济数据
 * GET /api/v1/fundamental/macro
 */
router.get('/macro', async (req: Request, res: Response) => {
  try {
    const { country, indicators, startDate, endDate } = req.query;

    const data = await fundamentalService.getMacroData({
      country: country as string || 'CN',
      indicators: indicators ? (indicators as string).split(',') : ['GDP', 'CPI', '利率'],
      startDate: startDate as string,
      endDate: endDate as string
    });

    // 设置缓存，TTL 3600秒（1小时）
    res.set('Cache-Control', 'public, max-age=3600');
    res.json({
      code: 0,
      message: 'success',
      data
    });
  } catch (error) {
    console.error('获取宏观数据失败:', error);
    res.status(500).json({
      code: 5000,
      message: '服务器内部错误',
      data: null
    });
  }
});

/**
 * 获取公司基本信息
 * GET /api/v1/fundamental/company
 */
router.get('/company', async (req: Request, res: Response) => {
  try {
    const { symbol } = req.query;

    if (!symbol) {
      return res.status(400).json({
        code: 1001,
        message: '缺少必要参数: symbol',
        data: null
      });
    }

    const data = await fundamentalService.getCompanyInfo(symbol as string);

    // 设置缓存，TTL 86400秒（24小时）
    res.set('Cache-Control', 'public, max-age=86400');
    res.json({
      code: 0,
      message: 'success',
      data
    });
  } catch (error) {
    console.error('获取公司信息失败:', error);
    res.status(500).json({
      code: 5000,
      message: '服务器内部错误',
      data: null
    });
  }
});

export default router;
