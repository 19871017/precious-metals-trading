import { Router } from 'express';
import axios from 'axios';

// ============================================
// Yahoo Finance API 代理路由
// ============================================

const YAHOO_API_BASE = 'https://query1.finance.yahoo.com/v8/finance/chart';

// 创建 axios 实例，设置超时时间
const yahooAxios = axios.create({
  timeout: 15000,
  headers: {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Accept': '*/*',
    'Accept-Language': 'en-US,en;q=0.9',
    'Accept-Encoding': 'gzip, deflate, br',
    'Referer': 'https://finance.yahoo.com/',
    'Origin': 'https://finance.yahoo.com',
    'Connection': 'keep-alive',
    'Sec-Fetch-Dest': 'empty',
    'Sec-Fetch-Mode': 'cors',
    'Sec-Fetch-Site': 'same-site',
  }
});

// Yahoo Finance 品种代码映射
const YAHOO_SYMBOL_MAPPING: Record<string, string> = {
  'XAUUSD': 'GC=F',      // 美黄金期货
  'XAGUSD': 'SI=F',      // 美白银期货
  'GOLD': 'GC=F',        // 美黄金
  'USOIL': 'CL=F',       // 美原油期货
  'BTC-USD': 'BTC-USD',  // 比特币
  'ETH-USD': 'ETH-USD',  // 以太坊
  'HSI': '^HSI',         // 恒生指数
  'MHSI': '^HSI',        // 小恒指(使用恒指)
  'NQ': 'NQ=F',          // 纳斯达克100期货
  'MNQ': 'NQ=F',         // 小纳指
  'ES': 'ES=F',          // 标普500期货
  'YM': 'YM=F',          // 道琼斯期货
  'NK': '^N225',         // 日经225指数
  'DAX': '^GDAXI',       // 德国DAX指数
  'HG': 'HG=F',          // 美精铜期货
};

// 市场品种列表
export const YAHOO_MARKET_SYMBOLS = [
  { symbol: 'USOIL', name: '美原油', yahooCode: 'CL=F' },
  { symbol: 'GOLD', name: '美黄金', yahooCode: 'GC=F' },
  { symbol: 'XAGUSD', name: '美白银', yahooCode: 'SI=F' },
  { symbol: 'XAUUSD', name: '现货黄金', yahooCode: 'GC=F' },
  { symbol: 'DAX', name: '德指', yahooCode: '^GDAXI' },
  { symbol: 'HSI', name: '恒指', yahooCode: '^HSI' },
  { symbol: 'MHSI', name: '小恒指', yahooCode: '^HSI' },
  { symbol: 'NQ', name: '纳指', yahooCode: 'NQ=F' },
  { symbol: 'MNQ', name: '小纳指', yahooCode: 'NQ=F' },
  { symbol: 'YM', name: '小道琼', yahooCode: 'YM=F' },
  { symbol: 'ES', name: '小标普', yahooCode: 'ES=F' },
  { symbol: 'NK', name: '日经', yahooCode: '^N225' },
  { symbol: 'HG', name: '美精铜', yahooCode: 'HG=F' },
  { symbol: 'BTC-USD', name: '比特币', yahooCode: 'BTC-USD' },
  { symbol: 'ETH-USD', name: '以太坊', yahooCode: 'ETH-USD' },
];

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
 * 构建 Yahoo Finance URL
 */
function buildYahooUrl(symbol: string, interval: string = '1m', range: string = '1d'): string {
  return `${YAHOO_API_BASE}/${symbol}?interval=${interval}&range=${range}`;
}

/**
 * 将 Yahoo Finance 数据转换为统一格式
 */
function convertYahooData(yahooData: any, symbol: string) {
  const result = yahooData.chart?.result?.[0];
  if (!result) {
    throw new Error('无效的 Yahoo Finance 响应');
  }

  const meta = result.meta;
  const quote = result.indicators?.quote?.[0];
  const timestamp = result.timestamp?.[0] || Math.floor(Date.now() / 1000);

  return {
    code: symbol,
    price: meta?.regularMarketPrice || quote?.close?.[0] || 0,
    open: quote?.open?.[0] || 0,
    high: quote?.high?.[0] || 0,
    low: quote?.low?.[0] || 0,
    close: quote?.close?.[0] || 0,
    volume: quote?.volume?.[0] || 0,
    change: meta?.previousClose ? (meta.regularMarketPrice - meta.previousClose) : 0,
    changePercent: meta?.previousClose 
      ? ((meta.regularMarketPrice - meta.previousClose) / meta.previousClose * 100) 
      : 0,
    timestamp: timestamp,
    datetime: new Date(timestamp * 1000).toISOString(),
    marketState: meta?.marketState || 'CLOSED',
    exchangeName: meta?.exchangeName || '',
  };
}

/**
 * 将 K线数据转换为统一格式
 */
function convertKlineData(yahooData: any, symbol: string) {
  const result = yahooData.chart?.result?.[0];
  if (!result) {
    throw new Error('无效的 Yahoo Finance K线响应');
  }

  const timestamps = result.timestamp || [];
  const quote = result.indicators?.quote?.[0];
  const opens = quote?.open || [];
  const highs = quote?.high || [];
  const lows = quote?.low || [];
  const closes = quote?.close || [];
  const volumes = quote?.volume || [];

  const klineData = timestamps.map((ts: number, i: number) => ({
    timestamp: ts,
    datetime: new Date(ts * 1000).toISOString(),
    open: opens[i] || 0,
    high: highs[i] || 0,
    low: lows[i] || 0,
    close: closes[i] || 0,
    volume: volumes[i] || 0,
  }));

  return {
    code: symbol,
    data: klineData,
    count: klineData.length,
  };
}

/**
 * 创建 Yahoo Finance 代理路由
 */
export function createYahooFinanceRouter(): Router {
  const router = Router();

  // ============================================
  // 健康检查
  // ============================================

  router.get('/health', (req, res) => {
    res.json(success({
      status: 'ok',
      service: 'yahoo-finance-proxy',
    }));
  });

  // ============================================
  // 品种列表
  // ============================================

  router.get('/symbols', (req, res) => {
    res.json(success(YAHOO_MARKET_SYMBOLS));
  });

  // ============================================
  // 实时行情
  // ============================================

  router.get('/quote', async (req, res) => {
    try {
      const { code, interval = '1m', range = '1d' } = req.query;

      if (!code || typeof code !== 'string') {
        return res.status(400).json(error(400, '缺少必要参数: code'));
      }

      // 使用 Yahoo 代码映射
      const yahooCode = YAHOO_SYMBOL_MAPPING[code] || code;
      const url = buildYahooUrl(yahooCode, interval as string, range as string);

      console.log(`[Yahoo 代理] 获取实时行情: ${code} -> ${yahooCode}, URL: ${url}`);

      const response = await yahooAxios.get(url);
      const convertedData = convertYahooData(response.data, code);

      console.log(`[Yahoo 代理] 获取成功: ${code}, 价格: ${convertedData.price}`);

      res.json(success(convertedData));

    } catch (err: any) {
      console.error('[Yahoo 代理] 获取实时行情错误:', err.message);
      console.error('[Yahoo 代理] 响应数据:', err.response?.data);
      res.status(500).json(error(500, `服务器错误: ${err.message}`));
    }
  });

  // ============================================
  // K线数据
  // ============================================

  router.get('/kline', async (req, res) => {
    try {
      const { 
        code, 
        interval = '1m', 
        range = '1d'
      } = req.query;

      if (!code || typeof code !== 'string') {
        return res.status(400).json(error(400, '缺少必要参数: code'));
      }

      const yahooCode = YAHOO_SYMBOL_MAPPING[code] || code;
      const url = buildYahooUrl(yahooCode, interval as string, range as string);

      console.log(`[Yahoo 代理] 获取K线数据: ${code} -> ${yahooCode}, 周期: ${interval}, 范围: ${range}`);

      const response = await yahooAxios.get(url);
      const convertedData = convertKlineData(response.data, code);

      console.log(`[Yahoo 代理] K线数据获取成功, 数据量: ${convertedData.count}`);

      res.json(success(convertedData));

    } catch (err: any) {
      console.error('[Yahoo 代理] 获取K线数据错误:', err.message);
      console.error('[Yahoo 代理] 响应数据:', err.response?.data);
      res.status(500).json(error(500, `服务器错误: ${err.message}`));
    }
  });

  // ============================================
  // 批量获取行情
  // ============================================

  router.get('/batch-quotes', async (req, res) => {
    try {
      const { codes, interval = '1m', range = '1d' } = req.query;

      if (!codes || typeof codes !== 'string') {
        return res.status(400).json(error(400, '缺少必要参数: codes (逗号分隔)'));
      }

      const codeList = codes.split(',').map(c => c.trim());
      const results: any = {};

      console.log(`[Yahoo 代理] 批量获取行情: ${codeList.join(', ')}`);

      const promises = codeList.map(async (code) => {
        const yahooCode = YAHOO_SYMBOL_MAPPING[code] || code;
        const url = buildYahooUrl(yahooCode, interval as string, range as string);

        try {
          const response = await yahooAxios.get(url);
          results[code] = {
            success: true,
            data: convertYahooData(response.data, code)
          };
        } catch (err: any) {
          results[code] = {
            success: false,
            error: err.message
          };
        }
      });

      await Promise.all(promises);

      res.json(success(results));

    } catch (err: any) {
      console.error('[Yahoo 代理] 批量获取行情错误:', err.message);
      res.status(500).json(error(500, `服务器错误: ${err.message}`));
    }
  });

  return router;
}
