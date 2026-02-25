import { Router } from 'express';
import { fetchJinshinews } from '../services/jinshinews-scraper';

// ============================================
// AI分析路由
// ============================================

/**
 * 统一响应格式
 */
const success = <T>(data: T, message: string = 'success') => ({
  code: 0,
  message,
  data,
  timestamp: Date.now()
});

const error = (code: number, message: string) => ({
  code,
  message,
  data: null,
  timestamp: Date.now()
});

/**
 * 生成分析摘要的辅助函数
 */
function generateAnalysis(news: any[], market: any[]): any {
  const now = new Date();

  // 提取关键词
  const keywords = news.reduce((acc: string[], item: any) => {
    return [...acc, ...(item.keywords || [])];
  }, []);

  // 分析趋势
  let trend = '震荡';
  let risk: 'low' | 'medium' | 'high' = 'medium';

  // 利好因素
  const bullishFactors = ['降息', '增持', '避险', '利好', '上涨', '需求', '强劲'];
  // 利空因素
  const bearishFactors = ['加息', '通胀', '利空', '下跌', '疲软', '放缓'];

  let bullishCount = 0;
  let bearishCount = 0;

  keywords.forEach((keyword: string) => {
    if (bullishFactors.some(factor => keyword.includes(factor))) {
      bullishCount++;
    }
    if (bearishFactors.some(factor => keyword.includes(factor))) {
      bearishCount++;
    }
  });

  if (bullishCount > bearishCount) {
    trend = '偏多';
    risk = bullishCount >= 2 ? 'low' : 'medium';
  } else if (bearishCount > bullishCount) {
    trend = '偏空';
    risk = bearishCount >= 2 ? 'high' : 'medium';
  }

  // 计算支撑和阻力位
  let support = 2320;
  let resistance = 2355;

  if (market && market.length > 0) {
    const prices = market.map((m: any) => m.price).filter((p: number) => p > 0);
    if (prices.length > 0) {
      const avgPrice = prices.reduce((a: number, b: number) => a + b, 0) / prices.length;
      support = avgPrice * 0.99;
      resistance = avgPrice * 1.01;
    }
  }

  // 生成摘要
  const latestNews = news[0];
  let summary = '';

  if (latestNews) {
    summary = `${latestNews.title}。`;
  } else {
    summary = '暂无最新市场动态。';
  }

  if (trend === '偏多') {
    summary += ' 技术面偏多,上方阻力关注,下方支撑稳固,建议逢低做多为主。';
  } else if (trend === '偏空') {
    summary += ' 技术面偏空,上方阻力明显,下方支撑较弱,建议逢高做空为主。';
  } else {
    summary += ' 技术面震荡,建议区间操作,注意风险控制。';
  }

  return {
    trend,
    support: Math.round(support),
    resistance: Math.round(resistance),
    risk,
    summary,
    newsHighlight: latestNews?.title || '',
    timestamp: Date.now()
  };
}

/**
 * 创建AI分析路由
 */
export function createAIAnalysisRouter(): Router {
  const router = Router();

  // ============================================
  // 获取金十新闻(使用爬虫)
  // ============================================
  router.get('/jinshinews', async (req, res) => {
    try {
      // 使用爬虫获取真实的金十数据
      const newsData = await fetchJinshinews(10);

      res.json(success(newsData));

    } catch (err: any) {
      console.error('[AI Analysis] 获取金十新闻错误:', err.message);
      res.status(500).json(error(500, `服务器错误: ${err.message}`));
    }
  });

  // ============================================
  // 生成AI分析摘要
  // ============================================
  router.post('/generate-summary', async (req, res) => {
    try {
      const { news, market } = req.body;

      if (!news || !Array.isArray(news)) {
        return res.status(400).json(error(400, '缺少必要参数: news'));
      }

      // 基于新闻和市场数据生成分析
      const summary = generateAnalysis(news, market);

      res.json(success(summary));

    } catch (err: any) {
      console.error('[AI Analysis] 生成分析错误:', err.message);
      res.status(500).json(error(500, `服务器错误: ${err.message}`));
    }
  });

  return router;
}
