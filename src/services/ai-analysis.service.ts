/**
 * AI分析服务
 * 定时获取金十数据并生成交易策略
 */

const API_BASE = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3001';

// AI分析摘要接口
export interface AISummary {
  trend: string;
  support: number;
  resistance: number;
  risk: 'low' | 'medium' | 'high';
  summary: string;
  newsHighlight?: string;
  timestamp?: number;
}

// 金十新闻数据接口
interface JinshinewsItem {
  id: string;
  title: string;
  content: string;
  time: string;
  source: string;
  keywords: string[];
}

/**
 * 从本地存储获取AI分析摘要
 */
function getCachedAISummary(): AISummary | null {
  try {
    const cached = localStorage.getItem('ai-summary');
    if (cached) {
      const data = JSON.parse(cached);
      // 检查缓存是否过期(1小时)
      const now = Date.now();
      if (data.timestamp && (now - data.timestamp) < 60 * 60 * 1000) {
        return data;
      }
    }
  } catch (error) {
    console.error('读取AI分析缓存失败:', error);
  }
  return null;
}

/**
 * 保存AI分析摘要到本地存储
 */
function saveAISummary(summary: AISummary): void {
  try {
    const data = {
      ...summary,
      timestamp: Date.now()
    };
    localStorage.setItem('ai-summary', JSON.stringify(data));
  } catch (error) {
    console.error('保存AI分析缓存失败:', error);
  }
}

/**
 * 获取金十新闻数据
 */
async function getJinshinews(): Promise<JinshinewsItem[]> {
  try {
    const response = await fetch(`${API_BASE}/ai/jinshinews`);
    const data = await response.json();

    if (data.code === 0 && data.data) {
      return data.data;
    }

    return [];
  } catch (error) {
    console.error('获取金十新闻失败:', error);
    return [];
  }
}

/**
 * 调用AI生成分析摘要
 */
async function generateAISummary(newsData: JinshinewsItem[], marketData: any[]): Promise<AISummary> {
  try {
    const response = await fetch(`${API_BASE}/ai/generate-summary`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        news: newsData.slice(0, 5), // 只取前5条新闻
        market: marketData.slice(0, 3), // 只取前3个产品数据
      }),
    });

    const data = await response.json();

    if (data.code === 0 && data.data) {
      return data.data;
    }

    // 如果AI生成失败,返回默认分析
    return generateDefaultSummary(newsData);
  } catch (error) {
    console.error('AI生成分析失败:', error);
    return generateDefaultSummary(newsData);
  }
}

/**
 * 生成默认分析(当AI不可用时)
 */
function generateDefaultSummary(newsData: JinshinewsItem[]): AISummary {
  const now = new Date();
  const hour = now.getHours();

  // 根据时间和新闻生成简单分析
  const latestNews = newsData[0];
  const newsHighlight = latestNews ? latestNews.title : '暂无最新新闻';

  // 简单的趋势判断
  let trend = '震荡';
  let risk: 'low' | 'medium' | 'high' = 'medium';

  if (newsHighlight.includes('利好') || newsHighlight.includes('上涨')) {
    trend = '偏多';
  } else if (newsHighlight.includes('利空') || newsHighlight.includes('下跌')) {
    trend = '偏空';
  }

  // 基础支撑阻力位
  const support = 2320;
  const resistance = 2355;

  return {
    trend,
    support,
    resistance,
    risk,
    summary: `基于金十数据: ${newsHighlight.slice(0, 30)}... 建议关注${trend}走势，支撑${support}，阻力${resistance}`,
    newsHighlight: newsHighlight,
    timestamp: Date.now()
  };
}

/**
 * 获取AI分析摘要
 * 优先从缓存获取,过期后重新生成
 */
export async function getAISummary(marketData: any[] = []): Promise<AISummary> {
  // 先检查缓存
  const cached = getCachedAISummary();
  if (cached) {
    return cached;
  }

  // 获取金十新闻
  const newsData = await getJinshinews();

  // 生成AI分析
  const summary = await generateAISummary(newsData, marketData);

  // 保存到缓存
  saveAISummary(summary);

  return summary;
}

/**
 * 手动刷新AI分析
 */
export async function refreshAISummary(marketData: any[] = []): Promise<AISummary> {
  // 获取金十新闻
  const newsData = await getJinshinews();

  // 生成AI分析
  const summary = await generateAISummary(newsData, marketData);

  // 保存到缓存
  saveAISummary(summary);

  return summary;
}

/**
 * 获取AI分析历史记录
 */
export function getAISummaryHistory(): AISummary[] {
  try {
    const cached = localStorage.getItem('ai-summary-history');
    if (cached) {
      return JSON.parse(cached);
    }
  } catch (error) {
    console.error('读取AI分析历史失败:', error);
  }
  return [];
}

/**
 * 保存AI分析到历史记录
 */
export function saveAISummaryHistory(summary: AISummary): void {
  try {
    const history = getAISummaryHistory();
    history.unshift(summary);
    // 只保留最近24小时的记录
    const filtered = history.filter((item: AISummary) => {
      if (!item.timestamp) return false;
      return (Date.now() - item.timestamp) < 24 * 60 * 60 * 1000;
    });
    localStorage.setItem('ai-summary-history', JSON.stringify(filtered));
  } catch (error) {
    console.error('保存AI分析历史失败:', error);
  }
}

// 品种策略分析接口
export interface SymbolStrategy {
  symbol: string;
  name: string;
  direction: 'long' | 'short' | 'neutral';
  confidence: number; // 0-100
  entryPrice: number;
  targetPrice: number;
  stopLossPrice: number;
  riskReward: number;
  reason: string;
  trend: string;
  timestamp: number;
}

/**
 * 根据品种生成AI策略分析
 * 基于价格走势和技术指标生成交易建议
 */
export function generateSymbolStrategy(
  symbol: string,
  name: string,
  price: number,
  change: number,
  changePercent: number
): SymbolStrategy {
  // 基于涨跌幅和技术指标模拟AI分析
  let direction: 'long' | 'short' | 'neutral' = 'neutral';
  let confidence = 50;
  let trend = '震荡';
  let reason = '';

  // 分析逻辑
  if (changePercent > 1.5) {
    direction = 'long';
    confidence = Math.min(85, 60 + Math.abs(changePercent) * 5);
    trend = '强势上涨';
    reason = `价格强势上涨${changePercent.toFixed(2)}%，突破短期阻力位，动能充足，建议逢低做多`;
  } else if (changePercent > 0.5) {
    direction = 'long';
    confidence = Math.min(75, 55 + Math.abs(changePercent) * 8);
    trend = '温和上涨';
    reason = `价格稳步上涨${changePercent.toFixed(2)}%，趋势向好，可考虑适量做多`;
  } else if (changePercent < -1.5) {
    direction = 'short';
    confidence = Math.min(85, 60 + Math.abs(changePercent) * 5);
    trend = '强势下跌';
    reason = `价格大幅下跌${Math.abs(changePercent).toFixed(2)}%，跌破支撑位，空头动能强劲，建议逢高做空`;
  } else if (changePercent < -0.5) {
    direction = 'short';
    confidence = Math.min(75, 55 + Math.abs(changePercent) * 8);
    trend = '温和下跌';
    reason = `价格持续下跌${Math.abs(changePercent).toFixed(2)}%，趋势偏弱，可考虑适量做空`;
  } else {
    direction = 'neutral';
    confidence = 40;
    trend = '区间震荡';
    reason = `价格波动较小(${changePercent.toFixed(2)}%)，处于盘整阶段，建议观望或区间操作`;
  }

  // 计算目标价和止损价
  const volatility = Math.abs(changePercent) / 100 + 0.01; // 基于当前波动率
  const targetPrice = direction === 'long' 
    ? price * (1 + volatility * 2)
    : direction === 'short'
    ? price * (1 - volatility * 2)
    : price;
  
  const stopLossPrice = direction === 'long'
    ? price * (1 - volatility * 1.5)
    : direction === 'short'
    ? price * (1 + volatility * 1.5)
    : price;

  const riskReward = direction === 'neutral' ? 0 : Math.abs((targetPrice - price) / (price - stopLossPrice));

  return {
    symbol,
    name,
    direction,
    confidence,
    entryPrice: price,
    targetPrice,
    stopLossPrice,
    riskReward,
    reason,
    trend,
    timestamp: Date.now()
  };
}
