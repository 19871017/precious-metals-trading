import { MarketCacheService, MarketCacheEntry } from '../services/MarketCacheService';
import { TradingService, TradeRequest, TradeResult } from '../services/TradingService';
import { tradingService } from '../services/TradingService';
import logger from '../utils/logger';

// ============================================
// 行情服务 - 与交易服务分离
// ============================================

export interface MarketUpdate {
  productCode: string;
  price: number;
  bid: number;
  ask: number;
  high24h: number;
  low24h: number;
  volume24h: number;
  change: number;
  changePercent: number;
  timestamp?: Date;
}

export class MarketDataServiceV2 {
  private marketCacheService: MarketCacheService;

  constructor() {
    this.marketCacheService = marketCacheService;
  }

  /**
   * 更新行情并触发快照创建
   */
  async updateMarketData(update: MarketUpdate): Promise<void> {
    logger.info(
      `[MarketDataServiceV2] 更新行情: product=${update.productCode}, price=${update.price}`
    );

    try {
      const cacheEntry: MarketCacheEntry = {
        version: await this.marketCacheService['currentVersion'],
        productCode: update.productCode,
        price: update.price,
        bid: update.bid || update.price,
        ask: update.ask || update.price,
        timestamp: update.timestamp || Date.now(),
        source: 'MARKET_DATA_SERVICE',
      };

      await this.marketCacheService.updateCache(cacheEntry);

      await this.marketCacheService.createSnapshot(
        update.productCode,
        update
      );

      logger.info(
        `[MarketDataServiceV2] 行情更新完成: product=${update.productCode}, price=${update.price}`
      );
    } catch (error) {
      logger.error(
        `[MarketDataServiceV2] 更新行情失败: product=${update.productCode}`,
        error
      );
      throw error;
    }
  }

  /**
   * 批量更新行情
   */
  async batchUpdateMarketData(updates: MarketUpdate[]): Promise<void> {
    logger.info(
      `[MarketDataServiceV2] 批量更新行情: count=${updates.length}`
    );

    try {
      const cacheEntries: MarketCacheEntry[] = [];

      for (const update of updates) {
        cacheEntries.push({
          version: await this.marketCacheService['currentVersion'],
          productCode: update.productCode,
          price: update.price,
          bid: update.bid || update.price,
          ask: update.ask || update.price,
          timestamp: update.timestamp || Date.now(),
          source: 'MARKET_DATA_SERVICE',
        });
      }

      await this.marketCacheService.batchUpdateCache(cacheEntries);

      await this.marketCacheService.batchCreateSnapshots(
        updates.map((update) => ({
          productCode: update.productCode,
          marketData: update,
        }))
      );

      logger.info(
        `[MarketDataServiceV2] 批量更新行情完成: count=${updates.length}`
      );
    } catch (error) {
      logger.error(
        `[MarketDataServiceV2] 批量更新行情失败: count=${updates.length}`,
        error
      );
      throw error;
    }
  }

  /**
   * 获取行情缓存
   */
  async getMarketCache(productCode: string): Promise<MarketCacheEntry | null> {
    return await this.marketCacheService.getCache(productCode);
  }

  /**
   * 获取所有行情缓存
   */
  async getAllMarketCache(): Promise<MarketCacheEntry[]> {
    const { cacheKeys } = await this.marketCacheService.getCacheStats();

    const caches: MarketCacheEntry[] = [];

    for (const key of cacheKeys) {
      const cache = await this.marketCacheService.getCache(key);

      if (cache) {
        caches.push(cache);
      }
    }

    return caches;
  }

  /**
   * 获取行情快照
   */
  async getMarketSnapshot(productCode: string): Promise<any> {
    return await this.marketCacheService.getSnapshot(productCode);
  }

  /**
   * 检查行情是否过期
   */
  async isMarketStale(productCode: string, maxAgeMs: number = 5000): Promise<boolean> {
    return await this.marketCacheService.isStale(productCode, maxAgeMs);
  }

  /**
   * 验证行情版本
   */
  async validateMarketVersion(
    productCode: string,
    expectedVersion: number
  ): Promise<boolean> {
    return await this.marketCacheService.validateVersion(
      productCode,
      expectedVersion
    );
  }

  /**
   * 清空行情缓存
   */
  async clearMarketCache(): Promise<void> {
    await this.marketCacheService.clearAllCache();
  }

  /**
   * 获取缓存统计
   */
  async getCacheStats(): Promise<{
    totalCached: number;
    totalSnapshots: number;
    currentVersion: number;
    cacheKeys: string[];
  }> {
    return await this.marketCacheService.getCacheStats();
  }
}

export const marketDataServiceV2 = new MarketDataServiceV2();
