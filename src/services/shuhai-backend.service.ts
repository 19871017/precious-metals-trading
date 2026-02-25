// ============================================
// 数海行情数据服务 (通过后端代理)
// ============================================

const API_BASE = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3001';
const SHUHAI_BASE = `${API_BASE}/shuhai`;

// 价格缓存 - 用于在API超时或失败时保持上一次的价格
const priceCache = new Map<string, any>();

// 品种代码映射 (前端代码 -> 数海代码)
export const SYMBOL_MAPPING: Record<string, string> = {
  'DAX': 'CEDAXA0',    // 德指
  'NQ': 'CENQA0',      // 小纳指
  'HSI': 'HIHHI01',    // 恒指
  'MHSI': 'HIMCH01',   // 小恒指
  'GOLD': 'CMGCA0',    // 美黄金
  'USOIL': 'NECLA0',   // 美原油
};

// 市场品种列表
export const MARKET_SYMBOLS = [
  { symbol: 'DAX', name: '德指', shuhaiCode: 'CEDAXA0' },
  { symbol: 'NQ', name: '纳指', shuhaiCode: 'CENQA0' },
  { symbol: 'HSI', name: '恒指', shuhaiCode: 'HIHHI01' },
  { symbol: 'MHSI', name: '小恒指', shuhaiCode: 'HIMCH01' },
  { symbol: 'GOLD', name: '美黄金', shuhaiCode: 'CMGCA0' },
  { symbol: 'USOIL', name: '美原油', shuhaiCode: 'NECLA0' },
];

/**
 * 获取实时行情快照
 * @param shuhaiCode 数海产品代码
 */
export async function getRealtimeQuote(shuhaiCode: string): Promise<any> {
  try {
    const url = `${SHUHAI_BASE}/quote?code=${shuhaiCode}`;
    console.log('请求实时行情:', url);

    const response = await fetch(url);

    let result;
    try {
      result = await response.json();
    } catch (e) {
      console.error('解析JSON失败:', e);
      throw new Error('服务器返回无效数据');
    }

    console.log('实时行情响应:', result);

    // 如果API返回错误，返回缓存的旧价格
    if (result.code !== 0) {
      console.warn(`行情数据获取失败 (${shuhaiCode}):`, result.message);

      // 尝试从缓存中获取上一次的价格
      const cachedData = priceCache.get(shuhaiCode);
      if (cachedData && cachedData.price > 0) {
        console.log(`使用缓存的价格 (${shuhaiCode}):`, cachedData.price);
        return {
          ...cachedData,
          _error: true,
          _errorMessage: result.message || '数据获取失败',
          _fromCache: true
        };
      }

      // 如果没有缓存，返回一个默认的行情数据
      return {
        code: shuhaiCode,
        price: 0,
        open: 0,
        high: 0,
        low: 0,
        close: 0,
        volume: 0,
        amount: 0,
        lastClose: 0,
        change: 0,
        changePercent: 0,
        timestamp: Date.now() / 1000,
        datetime: new Date().toISOString(),
        name: shuhaiCode,
        bidPrice: 0,
        askPrice: 0,
        _error: true,
        _errorMessage: result.message || '数据获取失败'
      };
    }

    const data = result.data;

    // 如果新数据的价格有效，保存到缓存
    if (data && data.price > 0) {
      priceCache.set(shuhaiCode, { ...data });
    }

    return data;
  } catch (error: any) {
    console.error('获取实时行情失败:', error);

    // 尝试从缓存中获取上一次的价格
    const cachedData = priceCache.get(shuhaiCode);
    if (cachedData && cachedData.price > 0) {
      console.log(`使用缓存的价格 (${shuhaiCode}):`, cachedData.price);
      return {
        ...cachedData,
        _error: true,
        _errorMessage: error.message || '网络错误',
        _fromCache: true
      };
    }

    // 如果没有缓存，返回一个默认的行情数据
    return {
      code: shuhaiCode,
      price: 0,
      open: 0,
      high: 0,
      low: 0,
      close: 0,
      volume: 0,
      amount: 0,
      lastClose: 0,
      change: 0,
      changePercent: 0,
      timestamp: Date.now() / 1000,
      datetime: new Date().toISOString(),
      name: shuhaiCode,
      bidPrice: 0,
      askPrice: 0,
      _error: true,
      _errorMessage: error.message || '网络错误'
    };
  }
}

/**
 * 根据品种代码获取实时行情
 * @param symbol 系统品种代码，如 'GOLD'、'USOIL'
 */
export async function getQuoteBySymbol(symbol: string): Promise<any> {
  const shuhaiCode = SYMBOL_MAPPING[symbol] || symbol;
  return getRealtimeQuote(shuhaiCode);
}

/**
 * 获取 K 线数据
 * @param shuhaiCode 数海产品代码
 * @param period 周期：1、5、15、30、60、1440、10080（分钟）
 * @param count 数量，默认 100
 * @returns 返回格式: [[timestamp, open, close, low, high], ...]
 */
export async function getKlineData(
  shuhaiCode: string,
  period: number = 60,
  count: number = 100
): Promise<any> {
  try {
    const url = `${SHUHAI_BASE}/kline?code=${shuhaiCode}&period=${period}&count=${count}`;
    console.log('请求K线数据:', url);

    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`获取K线数据失败: ${response.status}`);
    }

    const result = await response.json();
    console.log('K线数据响应:', result);

    if (result.code === 0 && result.data) {
      // 后端已经返回格式化的数据: [[time, open, close, low, high], ...]
      // 直接返回 result.data.data 或 result.data
      const klineData = result.data.data || result.data;
      console.log('K线数据格式:', Array.isArray(klineData) ? `数组, ${klineData.length}条` : typeof klineData);
      return klineData;
    }

    return result.data;
  } catch (error) {
    console.error('获取K线数据失败:', error);
    throw error;
  }
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
 * 获取分时数据
 * @param symbol 产品代码
 */
export async function getTickData(symbol: string): Promise<any> {
  try {
    const shuhaiCode = SYMBOL_MAPPING[symbol] || symbol;
    const url = `${SHUHAI_BASE}/tick?code=${shuhaiCode}`;
    const response = await fetch(url);

    if (!response.ok) {
      throw new Error(`获取分时数据失败: ${response.status}`);
    }

    const result = await response.json();
    return result.data;
  } catch (error) {
    console.error('获取分时数据失败:', error);
    throw error;
  }
}

/**
 * 获取历史数据
 * @param symbol 产品代码
 * @param startDate 开始日期 (YYYYMMDD)
 * @param endDate 结束日期 (YYYYMMDD)
 */
export async function getHistoryData(
  symbol: string,
  startDate: string,
  endDate: string
): Promise<any> {
  try {
    const shuhaiCode = SYMBOL_MAPPING[symbol] || symbol;
    const url = `${SHUHAI_BASE}/history?code=${shuhaiCode}&start_date=${startDate}&end_date=${endDate}`;
    const response = await fetch(url);

    if (!response.ok) {
      throw new Error(`获取历史数据失败: ${response.status}`);
    }

    const result = await response.json();
    return result.data;
  } catch (error) {
    console.error('获取历史数据失败:', error);
    throw error;
  }
}

/**
 * 批量获取多个品种的实时行情
 * @param symbols 产品代码数组
 */
export async function getBatchQuotes(symbols: string[]): Promise<any> {
  try {
    const shuhaiCodes = symbols.map(s => SYMBOL_MAPPING[s] || s);
    const codesParam = shuhaiCodes.join(',');
    const url = `${SHUHAI_BASE}/batch-quotes?codes=${codesParam}`;

    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`批量获取行情失败: ${response.status}`);
    }

    const result = await response.json();
    return result.data;
  } catch (error) {
    console.error('批量获取行情失败:', error);
    throw error;
  }
}

/**
 * 获取所有支持的品种列表
 */
export async function getMarketSymbols(): Promise<any> {
  try {
    const url = `${SHUHAI_BASE}/symbols`;
    const response = await fetch(url);

    if (!response.ok) {
      throw new Error(`获取品种列表失败: ${response.status}`);
    }

    const result = await response.json();
    return result.data || MARKET_SYMBOLS;
  } catch (error) {
    console.error('获取品种列表失败:', error);
    return MARKET_SYMBOLS;
  }
}

export default {
  getRealtimeQuote,
  getKlineData,
  getTickData,
  getHistoryData,
  getBatchQuotes,
  getMarketSymbols
};
