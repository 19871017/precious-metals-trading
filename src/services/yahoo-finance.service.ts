// ============================================
// Yahoo Finance 免费市场数据服务
// ============================================

const YAHOO_API_BASE = 'https://query1.finance.yahoo.com/v8/finance/chart';

// Yahoo Finance 产品代码映射
const YAHOO_SYMBOLS: Record<string, string> = {
  'USOIL': 'CL=F',      // 美原油期货
  'GOLD': 'GC=F',       // 美黄金期货
  'DAX': '^GDAXI',      // 德指
  'HSI': '^HSI',        // 恒生指数
  'MHSI': '^HSI',       // 小恒指（使用恒指数据）
  'NQ': 'NQ=F',        // 纳斯达克100期货
  'MNQ': 'NQ=F',       // 小纳指（使用纳指数据）
  'YM': 'YM=F',        // 道琼斯迷你期货
  'ES': 'ES=F',        // 标普500迷你期货
  'NK': '^N225',       // 日经225指数
  'HG': 'HG=F',        // 铜期货
  'XAUUSD': 'GC=F',    // 黄金期货
  'XAGUSD': 'SI=F',    // 白银期货
};

// 市场品种列表
export const MARKET_SYMBOLS = [
  { symbol: 'USOIL', name: '美原油', yahooCode: 'CL=F', basePrice: 75.50 },
  { symbol: 'GOLD', name: '美黄金', yahooCode: 'GC=F', basePrice: 2335.00 },
  { symbol: 'DAX', name: '德指', yahooCode: '^GDAXI', basePrice: 18450.00 },
  { symbol: 'HSI', name: '恒指', yahooCode: '^HSI', basePrice: 17800.00 },
  { symbol: 'MHSI', name: '小恒指', yahooCode: '^HSI', basePrice: 17800.00 },
  { symbol: 'NQ', name: '纳指', yahooCode: 'NQ=F', basePrice: 18350.00 },
  { symbol: 'MNQ', name: '小纳指', yahooCode: 'NQ=F', basePrice: 18350.00 },
  { symbol: 'YM', name: '小道琼', yahooCode: 'YM=F', basePrice: 38900.00 },
  { symbol: 'ES', name: '小标普', yahooCode: 'ES=F', basePrice: 5180.00 },
  { symbol: 'NK', name: '日经', yahooCode: '^N225', basePrice: 39500.00 },
  { symbol: 'HG', name: '美精铜', yahooCode: 'HG=F', basePrice: 4.35 },
  { symbol: 'XAUUSD', name: '黄金', yahooCode: 'GC=F', basePrice: 2335.00 },
  { symbol: 'XAGUSD', name: '白银', yahooCode: 'SI=F', basePrice: 27.50 },
  { symbol: 'BTC-USD', name: '比特币', yahooCode: 'BTC-USD', basePrice: 67000 },
  { symbol: 'ETH-USD', name: '以太坊', yahooCode: 'ETH-USD', basePrice: 3500 },
];

/**
 * 获取实时行情快照
 * @param symbol 系统品种代码，如 'GOLD'、'USOIL'
 */
export async function getRealtimeQuote(symbol: string): Promise<any> {
  try {
    const yahooCode = YAHOO_SYMBOLS[symbol] || symbol;
    const url = `${YAHOO_API_BASE}/${yahooCode}?interval=1m&range=1d`;

    console.log(`[Yahoo Finance] 获取实时行情: ${symbol} (${yahooCode})`);

    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`Yahoo Finance API 请求失败: ${response.status}`);
    }

    const data = await response.json();
    
    if (!data.chart || !data.chart.result || data.chart.result.length === 0) {
      throw new Error(`未找到数据: ${symbol}`);
    }

    const result = data.chart.result[0];
    const meta = result.meta;
    const quote = result.indicators.quote[0];
    const timestamps = result.timestamp;

    // 获取最新数据
    const lastIndex = timestamps.length - 1;
    const currentTimestamp = timestamps[lastIndex];
    const open = quote.open[lastIndex];
    const high = quote.high[lastIndex];
    const low = quote.low[lastIndex];
    const close = quote.close[lastIndex];
    const volume = quote.volume[lastIndex];
    const prevClose = quote.previousClose[lastIndex] || open;

    const change = close - prevClose;
    const changePercent = (change / prevClose) * 100;

    console.log(`[Yahoo Finance] ${symbol} 实时行情:`, {
      price: close,
      change,
      changePercent
    });

    return {
      symbol: symbol,
      code: yahooCode,
      price: close,
      open: open,
      high: high,
      low: low,
      close: close,
      volume: volume,
      change: change,
      changePercent: changePercent,
      prevClose: prevClose,
      timestamp: currentTimestamp,
      updateTime: new Date(currentTimestamp * 1000).toISOString()
    };
  } catch (error) {
    console.error('[Yahoo Finance] 获取实时行情失败:', error);
    throw error;
  }
}

/**
 * 批量获取多个品种的实时行情
 * @param symbols 产品代码数组
 */
export async function getBatchQuotes(symbols: string[]): Promise<Record<string, any>> {
  try {
    const results: Record<string, any> = {};

    // Yahoo Finance API 不支持批量查询，需要分别请求
    const promises = symbols.map(async symbol => {
      try {
        const data = await getRealtimeQuote(symbol);
        results[symbol] = { success: true, data };
      } catch (error: any) {
        console.error(`获取 ${symbol} 失败:`, error.message);
        results[symbol] = { success: false, error: error.message };
      }
    });

    await Promise.allSettled(promises);

    return results;
  } catch (error) {
    console.error('[Yahoo Finance] 批量获取行情失败:', error);
    throw error;
  }
}

/**
 * 获取 K 线数据
 * @param symbol 系统品种代码
 * @param interval 时间间隔: 1m, 2m, 5m, 15m, 30m, 60m, 90m, 1h, 1d, 5d, 1wk, 1mo, 3mo
 * @param range 时间范围: 1d, 5d, 1mo, 3mo, 6mo, 1y, 2y, 5y, 10y, ytd, max
 * @param count 数据数量
 */
export async function getKlineData(
  symbol: string,
  interval: string = '1h',
  range: string = '1mo',
  count: number = 100
): Promise<any> {
  try {
    const yahooCode = YAHOO_SYMBOLS[symbol] || symbol;
    const url = `${YAHOO_API_BASE}/${yahooCode}?interval=${interval}&range=${range}`;

    console.log(`[Yahoo Finance] 获取K线数据: ${symbol} (${yahooCode}), 间隔: ${interval}, 范围: ${range}`);

    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`Yahoo Finance API 请求失败: ${response.status}`);
    }

    const data = await response.json();

    if (!data.chart || !data.chart.result || data.chart.result.length === 0) {
      throw new Error(`未找到K线数据: ${symbol}`);
    }

    const result = data.chart.result[0];
    const meta = result.meta;
    const quote = result.indicators.quote[0];
    const timestamps = result.timestamp;

    // 转换数据格式
    const klineData = timestamps.map((timestamp, index) => {
      const open = quote.open[index];
      const high = quote.high[index];
      const low = quote.low[index];
      const close = quote.close[index];
      const volume = quote.volume[index];

      // 跳过无效数据
      if (open === null || high === null || low === null || close === null) {
        return null;
      }

      return {
        time: new Date(timestamp * 1000).toISOString(),
        timeStr: new Date(timestamp * 1000).toLocaleTimeString('zh-CN', {
          hour: '2-digit',
          minute: '2-digit'
        }),
        open: open,
        high: high,
        low: low,
        close: close,
        volume: volume,
        change: close - (quote.previousClose[index] || open),
        changePercent: ((close - (quote.previousClose[index] || open)) / (quote.previousClose[index] || open)) * 100
      };
    }).filter(item => item !== null);

    // 如果数据量超过请求的count，裁剪数据
    const finalData = klineData.slice(-count);

    console.log(`[Yahoo Finance] ${symbol} K线数据: ${finalData.length} 条`);

    return {
      symbol: symbol,
      code: yahooCode,
      interval: interval,
      range: range,
      data: finalData,
      meta: {
        currency: meta.currency,
        exchangeName: meta.exchangeName,
        instrumentType: meta.instrumentType,
        regularMarketTime: meta.regularMarketTime,
        gmtoffset: meta.gmtoffset,
        timezone: meta.timezone
      }
    };
  } catch (error) {
    console.error('[Yahoo Finance] 获取K线数据失败:', error);
    throw error;
  }
}

/**
 * 根据品种代码获取实时行情
 */
export async function getQuoteBySymbol(symbol: string): Promise<any> {
  return getRealtimeQuote(symbol);
}

/**
 * 根据品种代码获取 K 线数据
 */
export async function getKlineBySymbol(
  symbol: string,
  period: number = 60,
  count: number = 100
): Promise<any> {
  // 将周期转换为 Yahoo Finance 格式
  const intervalMap: Record<number, string> = {
    1: '1m',
    5: '5m',
    15: '15m',
    30: '30m',
    60: '1h',
    120: '2h',
    240: '4h',
    1440: '1d',
    10080: '1w'
  };

  const interval = intervalMap[period] || '1h';
  const rangeMap: Record<string, string> = {
    '1m': '5d',
    '5m': '1mo',
    '15m': '1mo',
    '30m': '1mo',
    '1h': '1mo',
    '2h': '3mo',
    '4h': '3mo',
    '1d': '1y',
    '1w': '2y'
  };

  const range = rangeMap[interval] || '1mo';
  return getKlineData(symbol, interval, range, count);
}

/**
 * 获取所有支持的品种列表
 */
export async function getMarketSymbols(): Promise<any> {
  return MARKET_SYMBOLS;
}

/**
 * 搜索股票/商品
 * @param query 搜索关键词
 */
export async function searchSymbols(query: string): Promise<any[]> {
  try {
    const url = `https://query1.finance.yahoo.com/v1/finance/search?q=${encodeURIComponent(query)}&quotesCount=10&newsCount=0`;
    
    console.log(`[Yahoo Finance] 搜索: ${query}`);

    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`搜索失败: ${response.status}`);
    }

    const data = await response.json();
    
    return data.quotes || [];
  } catch (error) {
    console.error('[Yahoo Finance] 搜索失败:', error);
    return [];
  }
}

export default {
  getRealtimeQuote,
  getKlineData,
  getBatchQuotes,
  getQuoteBySymbol,
  getKlineBySymbol,
  getMarketSymbols,
  searchSymbols
};
