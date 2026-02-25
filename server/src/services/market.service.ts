import { RedisClient } from '../utils/redis';
import { Logger } from '../utils/logger';

export interface RealTimeDataRequest {
  symbols: string[];
  fields?: string[];
  includePreMarket?: boolean;
}

export interface KlineDataRequest {
  symbol: string;
  interval: '1m' | '5m' | '15m' | '30m' | '1h' | '4h' | '1d';
  startTime?: number;
  endTime?: number;
  limit?: number;
}

export interface MarketDepthRequest {
  symbol: string;
  limit?: number;
}

export interface TradesRequest {
  symbol: string;
  limit?: number;
}

export class MarketService {
  private redis: RedisClient;
  private logger: Logger;

  constructor() {
    this.redis = new RedisClient();
    this.logger = new Logger('MarketService');
  }

  /**
   * 获取实时行情数据
   */
  async getRealTimeData(params: RealTimeDataRequest) {
    const cacheKey = `market:realtime:${params.symbols.join(',')}`;

    // 尝试从缓存获取
    const cached = await this.redis.get(cacheKey);
    if (cached) {
      this.logger.info(`从缓存获取实时行情: ${cacheKey}`);
      return JSON.parse(cached);
    }

    // 模拟数据（实际应从数据源获取）
    const data = params.symbols.map(symbol => ({
      symbol,
      price: this.getRandomPrice(),
      volume: Math.floor(Math.random() * 1000000),
      change: (Math.random() - 0.5) * 10,
      changePercent: (Math.random() - 0.5) * 2,
      high: this.getRandomPrice(),
      low: this.getRandomPrice(),
      open: this.getRandomPrice(),
      prevClose: this.getRandomPrice(),
      timestamp: Date.now()
    }));

    // 缓存1秒
    await this.redis.setex(cacheKey, 1, JSON.stringify(data));

    return data;
  }

  /**
   * 获取K线数据
   */
  async getKlineData(params: KlineDataRequest) {
    const cacheKey = `market:kline:${params.symbol}:${params.interval}`;

    // 尝试从缓存获取
    const cached = await this.redis.get(cacheKey);
    if (cached) {
      this.logger.info(`从缓存获取K线数据: ${cacheKey}`);
      return JSON.parse(cached);
    }

    // 模拟K线数据
    const limit = params.limit || 1000;
    const data: any[] = [];
    const now = Date.now();
    const intervalMs = this.getIntervalMs(params.interval);

    for (let i = limit - 1; i >= 0; i--) {
      const basePrice = this.getRandomPrice();
      const high = basePrice + Math.random() * 5;
      const low = basePrice - Math.random() * 5;

      data.push({
        timestamp: now - i * intervalMs,
        open: basePrice,
        high,
        low,
        close: low + Math.random() * (high - low),
        volume: Math.floor(Math.random() * 100000)
      });
    }

    // 缓存5秒
    await this.redis.setex(cacheKey, 5, JSON.stringify(data));

    return data;
  }

  /**
   * 获取市场深度
   */
  async getMarketDepth(params: MarketDepthRequest) {
    const limit = params.limit || 20;
    const basePrice = this.getRandomPrice();

    return {
      symbol: params.symbol,
      asks: Array.from({ length: limit }, (_, i) => ({
        price: basePrice + (i + 1) * 0.01,
        volume: Math.floor(Math.random() * 10000)
      })),
      bids: Array.from({ length: limit }, (_, i) => ({
        price: basePrice - (i + 1) * 0.01,
        volume: Math.floor(Math.random() * 10000)
      })),
      timestamp: Date.now()
    };
  }

  /**
   * 获取成交明细
   */
  async getTrades(params: TradesRequest) {
    const limit = params.limit || 100;
    const now = Date.now();

    return Array.from({ length: limit }, (_, i) => ({
      price: this.getRandomPrice(),
      volume: Math.floor(Math.random() * 1000),
      direction: Math.random() > 0.5 ? 'buy' : 'sell',
      timestamp: now - i * 1000
    }));
  }

  private getRandomPrice(): number {
    return 2000 + Math.random() * 500;
  }

  private getIntervalMs(interval: string): number {
    const map: Record<string, number> = {
      '1m': 60 * 1000,
      '5m': 5 * 60 * 1000,
      '15m': 15 * 60 * 1000,
      '30m': 30 * 60 * 1000,
      '1h': 60 * 60 * 1000,
      '4h': 4 * 60 * 60 * 1000,
      '1d': 24 * 60 * 60 * 1000
    };
    return map[interval] || 60 * 1000;
  }
}
