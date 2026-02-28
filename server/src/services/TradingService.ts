import { MarketCacheService, MarketCacheEntry, MarketSnapshot } from './MarketCacheService';
import logger from '../utils/logger';

// ============================================
// 交易服务 - 与行情服务解耦
// ============================================

export interface TradeRequest {
  userId: string;
  productCode: string;
  type: 'MARKET' | 'LIMIT';
  direction: 'BUY' | 'SELL';
  quantity: number;
  price?: number;
  leverage: number;
  stopLoss?: number;
  takeProfit?: number;
}

export interface TradeResult {
  success: boolean;
  orderId?: string;
  tradeId?: string;
  filledPrice?: number;
  filledQuantity?: number;
  fee?: number;
  version?: number;
  message: string;
  error?: string;
}

export class TradingService {
  private marketCacheService: MarketCacheService;

  constructor() {
    this.marketCacheService = marketCacheService;
  }

  /**
   * 基于缓存行情撮合市价单
   */
  async executeMarketOrder(request: TradeRequest): Promise<TradeResult> {
    logger.info(
      `[TradingService] 执行市价单: userId=${request.userId}, product=${request.productCode}, quantity=${request.quantity}`
    );

    try {
      const cacheEntry = await this.marketCacheService.getCache(
        request.productCode
      );

      if (!cacheEntry) {
        logger.warn(
          `[TradingService] 行情缓存不存在: product=${request.productCode}`
        );
        return {
          success: false,
          message: '行情数据不可用,请稍后重试',
          error: 'MARKET_DATA_UNAVAILABLE',
        };
      }

      const isStale = await this.marketCacheService.isStale(
        request.productCode,
        5000
      );

      if (isStale) {
        logger.warn(
          `[TradingService] 检测到旧行情: product=${request.productCode}, cacheAge=${Date.now() - cacheEntry.timestamp}ms`
        );
        return {
          success: false,
          message: '行情数据已过期,请刷新后重试',
          error: 'STALE_QUOTE',
          version: cacheEntry.version,
        };
      }

      const result = await this.executeTradeWithCache(
        request,
        cacheEntry
      );

      return result;
    } catch (error) {
      logger.error(
        `[TradingService] 执行市价单失败: userId=${request.userId}, product=${request.productCode}`,
        error
      );
      return {
        success: false,
        message: '订单执行失败',
        error: 'EXECUTION_FAILED',
      };
    }
  }

  /**
   * 基于缓存行情撮合限价单
   */
  async executeLimitOrder(request: TradeRequest): Promise<TradeResult> {
    logger.info(
      `[TradingService] 执行限价单: userId=${request.userId}, product=${request.productCode}, price=${request.price}, quantity=${request.quantity}`
    );

    try {
      const cacheEntry = await this.marketCacheService.getCache(
        request.productCode
      );

      if (!cacheEntry) {
        return {
          success: false,
          message: '行情数据不可用,请稍后重试',
          error: 'MARKET_DATA_UNAVAILABLE',
        };
      }

      const isStale = await this.marketCacheService.isStale(
        request.productCode,
        5000
      );

      if (isStale) {
        return {
          success: false,
          message: '行情数据已过期,请刷新后重试',
          error: 'STALE_QUOTE',
          version: cacheEntry.version,
        };
      }

      if (request.price) {
        const canFill = this.canFillLimitOrder(
          cacheEntry,
          request
        );

        if (!canFill) {
          return {
            success: false,
            message: '限价单无法成交',
            error: 'CANNOT_FILL_LIMIT_ORDER',
            version: cacheEntry.version,
          };
        }
      }

      const result = await this.executeTradeWithCache(
        request,
        cacheEntry
      );

      return result;
    } catch (error) {
      logger.error(
        `[TradingService] 执行限价单失败: userId=${request.userId}, product=${request.productCode}`,
        error
      );
      return {
        success: false,
        message: '订单执行失败',
        error: 'EXECUTION_FAILED',
      };
    }
  }

  /**
   * 使用缓存行情执行交易
   */
  private async executeTradeWithCache(
    request: TradeRequest,
    cacheEntry: MarketCacheEntry
  ): Promise<TradeResult> {
    logger.debug(
      `[TradingService] 使用缓存行情执行交易: product=${request.productCode}, cacheVersion=${cacheEntry.version}`
    );

    const { transaction } = await import('../config/database');

    return await transaction(async (client: PoolClient) => {
      const versionValid = await this.marketCacheService.validateVersion(
        request.productCode,
        cacheEntry.version
      );

      if (!versionValid) {
        throw new Error(
          `行情版本不一致: cacheVersion=${cacheEntry.version}, currentVersion=higher`
        );
      }

      const { userId, productCode, type, direction, quantity, leverage, price, stopLoss, takeProfit } =
        request;

      const product = await client.query(
        `SELECT * FROM products WHERE symbol = $1 AND status = 1`,
        [productCode]
      );

      if (!product.rows[0]) {
        throw new Error('产品不存在或已下架');
      }

      const prod = product.rows[0];

      const tradePrice = cacheEntry.price;

      const margin = (tradePrice * quantity * (prod.contract_size || 1)) / leverage;

      const account = await client.query(
        `SELECT * FROM accounts WHERE user_id = $1 FOR UPDATE`,
        [parseInt(userId)]
      );

      if (!account.rows[0]) {
        throw new Error('账户不存在');
      }

      if (account.rows[0].available_balance < margin) {
        throw new Error('可用余额不足');
      }

      const orderId = this.generateOrderId();
      const tradeId = this.generateTradeId();

      await client.query(
        `INSERT INTO orders
         (user_id, order_number, product_id, order_type, trade_type, order_direction,
          lot_size, leverage, price, stop_loss, take_profit, margin, commission, status)
         VALUES ($1, $2, (SELECT id FROM products WHERE symbol = $3), $4, $5, $6,
          $7, $8, $9, $10, $11, $12, $13, $14, $15)
         RETURNING id`,
        [
          parseInt(userId),
          orderId,
          productCode,
          type === 'MARKET' ? 1 : 2,
          direction === 'BUY' ? 1 : 2,
          direction === 'BUY' ? 1 : 2,
          quantity,
          leverage,
          price || tradePrice,
          stopLoss,
          takeProfit,
          margin,
          quantity * (prod.commission || 0),
          2,
        ]
      );

      await client.query(
        `UPDATE accounts
         SET balance = balance - $1,
             available_balance = available_balance - $1,
             frozen_amount = frozen_amount + $1
         WHERE user_id = $2`,
        [margin, parseInt(userId)]
      );

      const filledQuantity = quantity;
      const fee = quantity * (prod.commission || 0);

      await client.query(
        `UPDATE orders
         SET status = 2,
             filled_size = $1,
             filled_price = $2,
             avg_price = $2,
             updated_at = CURRENT_TIMESTAMP
         WHERE order_number = $3`,
        [filledQuantity, tradePrice, orderId]
      );

      const { auditLogService } = await import('./AuditLogService');

      await auditLogService.createAuditLog(client, {
        userId: parseInt(userId),
        operation: 'ORDER_FILLED',
        amount: -margin,
        beforeBalance: account.rows[0].balance,
        afterBalance: account.rows[0].balance - margin,
        orderId: parseInt(
          (
            await client.query(
              `SELECT id FROM orders WHERE order_number = $1`,
              [orderId]
            )
          ).rows[0]?.id
        ),
        description: `市价单成交: ${productCode}, 数量=${quantity}, 价格=${tradePrice}`,
        metadata: {
          cacheVersion: cacheEntry.version,
          cachePrice: cacheEntry.price,
        },
        createdBy: userId,
      });

      logger.info(
        `[TradingService] 订单成交成功: userId=${userId}, orderId=${orderId}, tradeId=${tradeId}`
      );

      return {
        success: true,
        orderId,
        tradeId,
        filledPrice: tradePrice,
        filledQuantity,
        fee,
        version: cacheEntry.version,
        message: '订单成交成功',
      };
    });
  }

  /**
   * 检查限价单是否可以成交
   */
  private canFillLimitOrder(
    cacheEntry: MarketCacheEntry,
    request: TradeRequest
  ): boolean {
    const { price, direction } = request;

    if (!price) {
      return true;
    }

    if (direction === 'BUY') {
      return price >= cacheEntry.ask;
    } else {
      return price <= cacheEntry.bid;
    }
  }

  /**
   * 生成订单号
   */
  private generateOrderId(): string {
    return `ORD${Date.now()}${Math.floor(Math.random() * 10000).toString().padStart(4, '0')}`;
  }

  /**
   * 生成交易号
   */
  private generateTradeId(): string {
    return `TRD${Date.now()}${Math.floor(Math.random() * 10000).toString().padStart(4, '0')}`;
  }

  /**
   * 获取行情快照用于平仓
   */
  async getMarketSnapshotForClose(
    productCode: string
  ): Promise<MarketSnapshot | null> {
    return await this.marketCacheService.getSnapshot(productCode);
  }

  /**
   * 获取当前行情版本
   */
  async getCurrentMarketVersion(productCode: string): Promise<number> {
    const cache = await this.marketCacheService.getCache(productCode);

    if (!cache) {
      return 0;
    }

    return cache.version;
  }
}

export const tradingService = new TradingService();
