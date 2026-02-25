/**
 * 免费市场数据后端服务
 * 使用 /free API 端点获取市场数据
 */

const API_BASE = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3001';

// 市场品种列表
export const MARKET_SYMBOLS = [
  // 商品类
  { symbol: 'USOIL', name: '美原油', category: 'commodity' },
  { symbol: 'GOLD', name: '美黄金', category: 'commodity' },
  { symbol: 'XAGUSD', name: '美白银', category: 'commodity' },
  { symbol: 'XAUUSD', name: '现货黄金', category: 'commodity' },
  { symbol: 'HG', name: '美精铜', category: 'commodity' },
  // 指数类
  { symbol: 'DAX', name: '德指', category: 'index' },
  { symbol: 'HSI', name: '恒指', category: 'index' },
  { symbol: 'MHSI', name: '小恒指', category: 'index' },
  { symbol: 'NQ', name: '纳指', category: 'index' },
  { symbol: 'MNQ', name: '小纳指', category: 'index' },
  { symbol: 'YM', name: '小道琼', category: 'index' },
  { symbol: 'ES', name: '小标普', category: 'index' },
  { symbol: 'NK', name: '日经', category: 'index' },
];

/**
 * 获取单个品种的实时行情
 */
export async function getQuoteBySymbol(symbol: string): Promise<any> {
  try {
    const response = await fetch(`${API_BASE}/free/quote?code=${symbol}`);
    const data = await response.json();

    if (data.code === 0 && data.data) {
      return {
        symbol: data.data.code,
        name: data.data.name || symbol,
        price: data.data.price,
        open: data.data.open,
        high: data.data.high,
        low: data.data.low,
        close: data.data.close,
        volume: data.data.volume,
        change: data.data.change,
        change_percent: data.data.changePercent,
        timestamp: data.data.timestamp,
        datetime: data.data.datetime,
      };
    }
    return null;
  } catch (error) {
    console.error(`获取 ${symbol} 行情失败:`, error);
    return null;
  }
}

/**
 * 批量获取多个品种的实时行情
 */
export async function getBatchQuotes(symbols: string[]): Promise<Record<string, any>> {
  try {
    const codes = symbols.join(',');
    const response = await fetch(`${API_BASE}/free/batch-quotes?codes=${codes}`);
    const data = await response.json();

    if (data.code === 0 && data.data) {
      const result: Record<string, any> = {};
      Object.entries(data.data).forEach(([symbol, item]: [string, any]) => {
        if (item.success && item.data) {
          result[symbol] = {
            symbol: item.data.code,
            name: item.data.name || symbol,
            price: item.data.price,
            open: item.data.open,
            high: item.data.high,
            low: item.data.low,
            close: item.data.close,
            volume: item.data.volume,
            change: item.data.change,
            change_percent: item.data.changePercent,
          };
        }
      });
      return result;
    }
    return {};
  } catch (error) {
    console.error('批量获取行情失败:', error);
    return {};
  }
}

/**
 * 获取K线数据
 */
export async function getKlineBySymbol(
  symbol: string,
  period: number = 60,
  count: number = 100
): Promise<any[]> {
  try {
    const response = await fetch(
      `${API_BASE}/free/kline?code=${symbol}&period=${period}&count=${count}`
    );
    const data = await response.json();

    if (data.code === 0 && data.data?.data) {
      return data.data.data.map((item: any) => ({
        time: item.time, // 后端返回的 time 字段已经是毫秒时间戳
        timestamp: item.timestamp,
        datetime: item.datetime,
        open: item.open,
        high: item.high,
        low: item.low,
        close: item.close,
        volume: item.volume,
      }));
    }
    return [];
  } catch (error) {
    console.error(`获取 ${symbol} K线数据失败:`, error);
    return [];
  }
}

/**
 * 健康检查
 */
export async function checkHealth(): Promise<boolean> {
  try {
    const response = await fetch(`${API_BASE}/free/health`);
    const data = await response.json();
    return data.code === 0;
  } catch (error) {
    return false;
  }
}
