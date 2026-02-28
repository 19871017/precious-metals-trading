import redis from '../utils/redis';
import logger from '../utils/logger';

// ============================================
// 行情缓存服务
// ============================================

export interface MarketCacheEntry {
  version: number;
  productCode: string;
  price: number;
  bid: number;
  ask: number;
  timestamp: number;
  source: string;
}

export interface MarketSnapshot {
  version: number;
  productCode: string;
  price: number;
  bid: number;
  ask: number;
  high24h: number;
  low24h: number;
  volume24h: number;
  change: number;
  changePercent: number;
  timestamp: number;
}

export class MarketCacheService {
  private static readonly CACHE_PREFIX = 'market:cache:';
  private static readonly SNAPSHOT_PREFIX = 'market:snapshot:';
  private static readonly VERSION_PREFIX = 'market:version:';
  private static readonly CACHE_TTL = 30; // 30秒过期
  private static readonly SNAPSHOT_TTL = 300; // 5分钟过期

  private currentVersion: number = 0;

  /**
   * 更新行情缓存
   */
  async updateCache(entry: MarketCacheEntry): Promise<void> {
    const { productCode, version } = entry;

    const cacheKey = `${this.CACHE_PREFIX}${productCode}`;

    await redis.set(cacheKey, JSON.stringify(entry), 'EX', this.CACHE_TTL);

    logger.debug(
      `[MarketCache] 缓存已更新: product=${productCode}, version=${version}`
    );
  }

  /**
   * 获取行情缓存
   */
  async getCache(productCode: string): Promise<MarketCacheEntry | null> {
    const cacheKey = `${this.CACHE_PREFIX}${productCode}`;
    const cached = await redis.get(cacheKey);

    if (!cached) {
      logger.debug(`[MarketCache] 缓存未命中: product=${productCode}`);
      return null;
    }

    try {
      const entry: MarketCacheEntry = JSON.parse(cached);

      // 检查版本是否过期
      const currentVersion = await this.getCurrentVersion();
      if (entry.version < currentVersion) {
        logger.warn(
          `[MarketCache] 缓存版本过低: product=${productCode}, cacheVersion=${entry.version}, currentVersion=${currentVersion}`
        );
        return null;
      }

      logger.debug(`[MarketCache] 缓存命中: product=${productCode}, version=${entry.version}`);
      return entry;
    } catch (error) {
      logger.error(`[MarketCache] 解析缓存失败: product=${productCode}`, error);
      return null;
    }
  }

  /**
   * 批量更新行情缓存
   */
  async batchUpdateCache(entries: MarketCacheEntry[]): Promise<void> {
    const keys: string[] = [];
    const values: string[] = [];

    for (const entry of entries) {
      const cacheKey = `${this.CACHE_PREFIX}${entry.productCode}`;
      keys.push(cacheKey);
      values.push(JSON.stringify(entry));
    }

    const msetResult = await redis.mget(keys);

    for (let i = 0; i < entries.length; i++) {
      await redis.set(keys[i], values[i], 'EX', this.CACHE_TTL);
    }

    logger.info(`[MarketCache] 批量更新缓存完成: count=${entries.length}`);
  }

  /**
   * 获取行情快照
   */
  async getSnapshot(productCode: string): Promise<MarketSnapshot | null> {
    const snapshotKey = `${this.SNAPSHOT_PREFIX}${productCode}`;
    const cached = await redis.get(snapshotKey);

    if (!cached) {
      logger.debug(`[MarketCache] 快照未命中: product=${productCode}`);
      return null;
    }

    try {
      const snapshot: MarketSnapshot = JSON.parse(cached);
      logger.debug(`[MarketCache] 快照命中: product=${productCode}, version=${snapshot.version}`);
      return snapshot;
    } catch (error) {
      logger.error(`[MarketCache] 解析快照失败: product=${productCode}`, error);
      return null;
    }
  }

  /**
   * 创建行情快照
   */
  async createSnapshot(productCode: string, marketData: any): Promise<MarketSnapshot> {
    const snapshot: MarketSnapshot = {
      version: await this.incrementVersion(),
      productCode,
      price: marketData.lastPrice || marketData.price || 0,
      bid: marketData.bid || marketData.price || 0,
      ask: marketData.ask || marketData.price || 0,
      high24h: marketData.high24h || 0,
      low24h: marketData.low24h || 0,
      volume24h: marketData.volume24h || 0,
      change: marketData.change || 0,
      changePercent: marketData.changePercent || 0,
      timestamp: Date.now(),
    };

    const snapshotKey = `${this.SNAPSHOT_PREFIX}${productCode}`;
    await redis.set(snapshotKey, JSON.stringify(snapshot), 'EX', this.SNAPSHOT_TTL);

    logger.info(
      `[MarketCache] 快照已创建: product=${productCode}, version=${snapshot.version}`
    );

    return snapshot;
  }

  /**
   * 批量创建快照
   */
  async batchCreateSnapshots(
    marketDataList: Array<{ productCode: string; marketData: any }>
  ): Promise<MarketSnapshot[]> {
    const snapshots: MarketSnapshot[] = [];

    for (const { productCode, marketData } of marketDataList) {
      const snapshot = await this.createSnapshot(productCode, marketData);
      snapshots.push(snapshot);
    }

    logger.info(`[MarketCache] 批量创建快照完成: count=${snapshots.length}`);

    return snapshots;
  }

  /**
   * 验证行情版本
   */
  async validateVersion(
    productCode: string,
    expectedVersion: number
  ): Promise<boolean> {
    const cache = await this.getCache(productCode);

    if (!cache) {
      logger.warn(
        `[MarketCache] 行情缓存不存在: product=${productCode}`
      );
      return false;
    }

    const isValid = cache.version >= expectedVersion;

    if (!isValid) {
      logger.warn(
        `[MarketCache] 行情版本验证失败: product=${productCode}, cacheVersion=${cache.version}, expectedVersion=${expectedVersion}`
      );
    } else {
      logger.debug(
        `[MarketCache] 行情版本验证通过: product=${productCode}, version=${cache.version}`
      );
    }

    return isValid;
  }

  /**
   * 检查是否存在"旧行情成交"
   */
  async isStaleQuote(productCode: string, maxAgeMs: number = 5000): Promise<boolean> {
    const cache = await this.getCache(productCode);

    if (!cache) {
      return true;
    }

    const age = Date.now() - cache.timestamp;

    const isStale = age > maxAgeMs;

    if (isStale) {
      logger.warn(
        `[MarketCache] 检测到旧行情: product=${productCode}, age=${age}ms, maxAge=${maxAgeMs}ms`
      );
    }

    return isStale;
  }

  /**
   * 获取当前版本号
   */
  private async getCurrentVersion(): Promise<number> {
    return this.currentVersion;
  }

  /**
   * 增加版本号
   */
  private async incrementVersion(): Promise<number> {
    this.currentVersion++;

    const versionKey = `${this.VERSION_PREFIX}current`;
    await redis.set(versionKey, this.currentVersion.toString(), 'EX', 86400);

    logger.debug(`[MarketCache] 版本号已增加: newVersion=${this.currentVersion}`);

    return this.currentVersion;
  }

  /**
   * 删除行情缓存
   */
  async deleteCache(productCode: string): Promise<void> {
    const cacheKey = `${this.CACHE_PREFIX}${productCode}`;
    await redis.del(cacheKey);

    logger.debug(`[MarketCache] 缓存已删除: product=${productCode}`);
  }

  /**
   * 批量删除行情缓存
   */
  async batchDeleteCache(productCodes: string[]): Promise<void> {
    const keys = productCodes.map(
      (code) => `${this.CACHE_PREFIX}${code}`
    );

    if (keys.length > 0) {
      await redis.del(...keys);
    }

    logger.info(`[MarketCache] 批量删除缓存完成: count=${productCodes.length}`);
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
    const cacheKeys = await redis.keys(`${this.CACHE_PREFIX}*`);
    const snapshotKeys = await redis.keys(`${this.SNAPSHOT_PREFIX}*`);

    return {
      totalCached: cacheKeys.length,
      totalSnapshots: snapshotKeys.length,
      currentVersion: this.currentVersion,
      cacheKeys: cacheKeys.map((key) => key.replace(this.CACHE_PREFIX, '')),
    };
  }

  /**
   * 清空所有缓存
   */
  async clearAllCache(): Promise<void> {
    const { totalCached, totalSnapshots } = await this.getCacheStats();

    if (totalCached > 0) {
      await this.batchDeleteCache(
        cacheKeys.map((key) => key.replace(this.CACHE_PREFIX, ''))
      );
    }

    if (totalSnapshots > 0) {
      const snapshotKeys = snapshotKeys.map((key) =>
        key.replace(this.SNAPSHOT_PREFIX, '')
      );
      for (const key of snapshotKeys) {
        await redis.del(`${this.SNAPSHOT_PREFIX}${key}`);
      }
    }

    logger.info(`[MarketCache] 所有缓存已清空: cached=${totalCached}, snapshots=${totalSnapshots}`);
  }
}

export const marketCacheService = new MarketCacheService();
