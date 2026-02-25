import { Router } from 'express';
import axios from 'axios';

// ============================================
// 免费市场数据 API 聚合路由
// ============================================

// 创建 axios 实例
const apiAxios = axios.create({
  timeout: 10000,
  headers: {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
  }
});

// 市场品种列表
export const FREE_MARKET_SYMBOLS = [
  { symbol: 'USOIL', name: '美原油', category: 'commodity' },
  { symbol: 'GOLD', name: '美黄金', category: 'commodity' },
  { symbol: 'XAGUSD', name: '美白银', category: 'commodity' },
  { symbol: 'XAUUSD', name: '现货黄金', category: 'commodity' },
  { symbol: 'DAX', name: '德指', category: 'index' },
  { symbol: 'HSI', name: '恒指', category: 'index' },
  { symbol: 'MHSI', name: '小恒指', category: 'index' },
  { symbol: 'NQ', name: '纳指', category: 'index' },
  { symbol: 'MNQ', name: '小纳指', category: 'index' },
  { symbol: 'YM', name: '小道琼', category: 'index' },
  { symbol: 'ES', name: '小标普', category: 'index' },
  { symbol: 'NK', name: '日经', category: 'index' },
  { symbol: 'HG', name: '美精铜', category: 'commodity' },
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
 * 基础价格数据 (2025年2月真实价格)
 */
const BASE_PRICES: Record<string, number> = {
  'USOIL': 72.50,
  'GOLD': 2945.00,
  'XAGUSD': 31.50,
  'XAUUSD': 2945.00,
  'DAX': 20250,
  'HSI': 23850,
  'MHSI': 23850,
  'NQ': 22500,
  'MNQ': 22500,
  'YM': 44800,
  'ES': 6120,
  'NK': 38500,
  'HG': 4.75,
};

/**
 * 生成模拟行情数据
 */
function generateMockQuote(symbol: string, useCrypto: boolean = false) {
  const basePrice = BASE_PRICES[symbol] || 100;
  const volatility = useCrypto ? 0.02 : 0.003; // 加密货币波动更大
  const change = (Math.random() - 0.5) * 2 * volatility * basePrice;
  const currentPrice = basePrice + change;
  const open = basePrice + (Math.random() - 0.5) * volatility * basePrice;
  const high = Math.max(currentPrice, open) + Math.random() * volatility * basePrice * 0.5;
  const low = Math.min(currentPrice, open) - Math.random() * volatility * basePrice * 0.5;
  const volume = Math.floor(Math.random() * 10000000) + 1000000;

  return {
    code: symbol,
    price: currentPrice,
    open: open,
    high: high,
    low: low,
    close: currentPrice,
    volume: volume,
    change: change,
    changePercent: (change / basePrice) * 100,
    timestamp: Math.floor(Date.now() / 1000),
    datetime: new Date().toISOString(),
    marketState: Math.random() > 0.3 ? 'REGULAR' : 'CLOSED',
    exchangeName: symbol.includes('-') ? 'Crypto' : 'Market',
  };
}

/**
 * 生成模拟K线数据
 */
function generateMockKline(symbol: string, count: number = 100, periodMinutes: number = 60) {
  const basePrice = BASE_PRICES[symbol] || 100;
  const data = [];
  let currentPrice = basePrice;
  const periodMs = periodMinutes * 60 * 1000; // 将分钟转换为毫秒

  for (let i = 0; i < count; i++) {
    const volatility = 0.003;
    const change = (Math.random() - 0.5) * 2 * volatility * currentPrice;
    const open = currentPrice;
    const close = currentPrice + change;
    const high = Math.max(open, close) + Math.random() * volatility * currentPrice * 0.3;
    const low = Math.min(open, close) - Math.random() * volatility * currentPrice * 0.3;

    const timeMs = Date.now() - (count - i) * periodMs;
    data.push({
      timestamp: Math.floor(timeMs / 1000), // Unix 秒时间戳
      datetime: new Date(timeMs).toISOString(),
      time: timeMs, // 毫秒时间戳，ECharts 需要
      open: parseFloat(open.toFixed(2)),
      high: parseFloat(high.toFixed(2)),
      low: parseFloat(low.toFixed(2)),
      close: parseFloat(close.toFixed(2)),
      volume: Math.floor(Math.random() * 1000000) + 100000,
    });

    currentPrice = close;
  }

  return {
    code: symbol,
    data: data,
    count: data.length,
    period: periodMinutes,
  };
}

/**
 * 创建免费市场 API 路由
 */
export function createFreeMarketRouter(): Router {
  const router = Router();

  // ============================================
  // 健康检查
  // ============================================

  router.get('/health', (req, res) => {
    res.json(success({
      status: 'ok',
      service: 'free-market-proxy',
      note: '使用模拟数据，可用于测试'
    }));
  });

  // ============================================
  // 品种列表
  // ============================================

  router.get('/symbols', (req, res) => {
    res.json(success(FREE_MARKET_SYMBOLS));
  });

  // ============================================
  // 实时行情
  // ============================================

  router.get('/quote', async (req, res) => {
    try {
      const { code } = req.query;

      if (!code || typeof code !== 'string') {
        return res.status(400).json(error(400, '缺少必要参数: code'));
      }

      const isCrypto = code.includes('-USD');
      const quote = generateMockQuote(code, isCrypto);

      res.json(success(quote));

    } catch (err: any) {
      console.error('[Free Market] 获取实时行情错误:', err.message);
      res.status(500).json(error(500, `服务器错误: ${err.message}`));
    }
  });

  // ============================================
  // K线数据
  // ============================================

  router.get('/kline', async (req, res) => {
    try {
      const { code, period = '60', count = '100' } = req.query;

      if (!code || typeof code !== 'string') {
        return res.status(400).json(error(400, '缺少必要参数: code'));
      }

      const klineData = generateMockKline(code, parseInt(count as string), parseInt(period as string));

      res.json(success(klineData));

    } catch (err: any) {
      console.error('[Free Market] 获取K线数据错误:', err.message);
      res.status(500).json(error(500, `服务器错误: ${err.message}`));
    }
  });

  // ============================================
  // 批量获取行情
  // ============================================

  router.get('/batch-quotes', async (req, res) => {
    try {
      const { codes } = req.query;

      if (!codes || typeof codes !== 'string') {
        return res.status(400).json(error(400, '缺少必要参数: codes (逗号分隔)'));
      }

      const codeList = codes.split(',').map(c => c.trim());
      const results: any = {};

      codeList.forEach(code => {
        const isCrypto = code.includes('-USD');
        results[code] = {
          success: true,
          data: generateMockQuote(code, isCrypto)
        };
      });

      res.json(success(results));

    } catch (err: any) {
      console.error('[Free Market] 批量获取行情错误:', err.message);
      res.status(500).json(error(500, `服务器错误: ${err.message}`));
    }
  });

  return router;
}
