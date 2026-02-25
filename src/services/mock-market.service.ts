// ============================================
// 模拟行情数据服务 (用于开发测试)
// ============================================

// 品种代码映射
export const SYMBOL_MAPPING: Record<string, string> = {
  'XAUUSD': 'GC',
  'XAGUSD': 'CL',
  'USOIL': 'CL',
  'GOLD': 'GC',
  'DAX': 'DAX',
  'HSI': 'HSI',
  'MHSI': 'MHSI',
  'NQ': 'NQ',
  'MNQ': 'MNQ',
  'YM': 'YM',
  'ES': 'ES',
  'NK': 'NK',
  'HG': 'HG',
};

// 市场品种列表
export const MARKET_SYMBOLS = [
  { symbol: 'USOIL', name: '美原油', shuhaiCode: 'CL' },
  { symbol: 'GOLD', name: '美黄金', shuhaiCode: 'GC' },
  { symbol: 'DAX', name: '德指', shuhaiCode: 'DAX' },
  { symbol: 'HSI', name: '恒指', shuhaiCode: 'HSI' },
  { symbol: 'MHSI', name: '小恒指', shuhaiCode: 'MHSI' },
  { symbol: 'NQ', name: '纳指', shuhaiCode: 'NQ' },
  { symbol: 'MNQ', name: '小纳指', shuhaiCode: 'MNQ' },
  { symbol: 'YM', name: '小道琼', shuhaiCode: 'YM' },
  { symbol: 'ES', name: '小标普', shuhaiCode: 'ES' },
  { symbol: 'NK', name: '日经', shuhaiCode: 'NK' },
  { symbol: 'HG', name: '美精铜', shuhaiCode: 'HG' },
];

// 模拟基准价格
const BASE_PRICES: Record<string, number> = {
  'CL': 75.50,
  'GC': 2335.00,
  'DAX': 18450.00,
  'HSI': 17800.00,
  'MHSI': 17800.00,
  'NQ': 18350.00,
  'MNQ': 18350.00,
  'YM': 38900.00,
  'ES': 5180.00,
  'NK': 39500.00,
  'HG': 4.35,
};

/**
 * 生成随机价格变动
 */
function generatePrice(basePrice: number) {
  const changePercent = (Math.random() - 0.5) * 0.02; // ±1%
  const price = basePrice * (1 + changePercent);
  const change = price - basePrice;
  const changePercentFormatted = (change / basePrice) * 100;

  return {
    price: price.toFixed(2),
    change: change.toFixed(2),
    changePercent: changePercentFormatted.toFixed(2),
    high: (price * 1.005).toFixed(2),
    low: (price * 0.995).toFixed(2),
    open: (price * (1 + (Math.random() - 0.5) * 0.01)).toFixed(2),
    volume: Math.floor(Math.random() * 10000) + 1000,
    updateTime: new Date().toISOString()
  };
}

/**
 * 获取实时行情快照 (模拟)
 */
export async function getRealtimeQuote(shuhaiCode: string): Promise<any> {
  // 模拟网络延迟
  await new Promise(resolve => setTimeout(resolve, 100 + Math.random() * 200));

  const basePrice = BASE_PRICES[shuhaiCode] || 100;
  const data = generatePrice(basePrice);

  console.log(`[模拟行情] ${shuhaiCode}: ${data.price}`);

  return {
    code: shuhaiCode,
    ...data
  };
}

/**
 * 根据品种代码获取实时行情
 */
export async function getQuoteBySymbol(symbol: string): Promise<any> {
  const shuhaiCode = SYMBOL_MAPPING[symbol] || symbol;
  return getRealtimeQuote(shuhaiCode);
}

/**
 * 生成 K 线数据
 */
function generateKLineData(basePrice: number, period: number, count: number) {
  const data = [];
  let currentPrice = basePrice;

  const now = Date.now();
  const periodMs = period * 60 * 1000; // 转换为毫秒

  for (let i = count - 1; i >= 0; i--) {
    const time = new Date(now - i * periodMs);
    const open = currentPrice;
    const volatility = basePrice * 0.002;
    const close = open + (Math.random() - 0.5) * volatility * 2;
    const high = Math.max(open, close) + Math.random() * volatility;
    const low = Math.min(open, close) - Math.random() * volatility;

    data.push({
      time: time.toISOString(),
      open: open.toFixed(2),
      high: high.toFixed(2),
      low: low.toFixed(2),
      close: close.toFixed(2),
      volume: Math.floor(Math.random() * 1000) + 100
    });

    currentPrice = close;
  }

  return data;
}

/**
 * 获取 K 线数据 (模拟)
 */
export async function getKlineData(
  shuhaiCode: string,
  period: number = 60,
  count: number = 100
): Promise<any> {
  // 模拟网络延迟
  await new Promise(resolve => setTimeout(resolve, 200 + Math.random() * 300));

  const basePrice = BASE_PRICES[shuhaiCode] || 100;
  const data = generateKLineData(basePrice, period, count);

  console.log(`[模拟K线] ${shuhaiCode}: ${data.length} 条数据`);

  return data;
}

/**
 * 根据品种代码获取 K 线数据
 */
export async function getKlineBySymbol(
  symbol: string,
  period: number = 60,
  count: number = 100
): Promise<any> {
  const shuhaiCode = SYMBOL_MAPPING[symbol] || symbol;
  return getKlineData(shuhaiCode, period, count);
}

/**
 * 批量获取多个品种的实时行情
 */
export async function getBatchQuotes(symbols: string[]): Promise<any> {
  const results: Record<string, any> = {};

  for (const symbol of symbols) {
    try {
      const shuhaiCode = SYMBOL_MAPPING[symbol] || symbol;
      results[symbol] = await getRealtimeQuote(shuhaiCode);
    } catch (error) {
      results[symbol] = null;
    }
  }

  return results;
}

/**
 * 获取所有支持的品种列表
 */
export async function getMarketSymbols(): Promise<any> {
  return MARKET_SYMBOLS;
}

export default {
  getRealtimeQuote,
  getKlineData,
  getBatchQuotes,
  getMarketSymbols
};
