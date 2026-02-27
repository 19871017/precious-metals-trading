import { v4 as uuidv4 } from 'uuid';
import { query, findOne, transaction } from '../config/database';
import logger from '../utils/logger';
import { Calculator } from '../utils/calculator';
import {
  OrderType,
  OrderDirection,
  OrderStatus,
  PositionDirection,
  MarketData
} from '../types';
import { stopLossTakeProfitService } from './StopLossTakeProfitService';

/**
 * 订单接口
 */
export interface DBOrder {
  id: number;
  userId: number;
  orderNumber: string;
  productId: number;
  orderType: number;
  tradeType: number;
  orderDirection: number;
  lotSize: number;
  leverage: number;
  price?: number;
  stopLoss?: number;
  takeProfit?: number;
  margin: number;
  commission?: number;
  status: number;
  filledSize: number;
  filledPrice?: number;
  avgPrice?: number;
  errorMessage?: string;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * 持仓接口
 */
export interface DBPosition {
  id: number;
  userId: number;
  productId: number;
  positionNumber: string;
  orderId?: number;
  tradeType: number;
  direction: number;
  lotSize: number;
  entryPrice: number;
  currentPrice: number;
  leverage: number;
  margin: number;
  stopLoss?: number;
  takeProfit?: number;
  floatingPl: number;
  realizedPl: number;
  commission?: number;
  swap: number;
  status: number;
  openTime: Date;
  closeTime?: Date;
  closePrice?: number;
}

/**
 * 成交记录接口
 */
export interface DBTrade {
  id: number;
  orderId: number;
  userId: number;
  productCode: string;
  direction: number;
  price: number;
  quantity: number;
  leverage: number;
  margin: number;
  fee: number;
  timestamp: Date;
}

/**
 * 数据库订单管理器
 */
export class DBOperationManager {
  /**
   * 创建订单
   */
  async createOrder(
    userId: number,
    productCode: string,
    type: OrderType,
    direction: OrderDirection,
    quantity: number,
    leverage: number,
    price?: number,
    stopLoss?: number,
    takeProfit?: number
  ): Promise<DBOrder> {
    try {
      // 生成订单号
      const orderNumber = 'ORD' + Date.now().toString() + Math.floor(Math.random() * 10000).toString().padStart(4, '0');

      // 获取产品ID
      const product = await findOne<{ id: number }>(
        'SELECT id FROM products WHERE symbol = $1',
        [productCode]
      );

      if (!product) {
        throw new Error('产品不存在');
      }

      // 插入订单到数据库
      const result = await query(
        `INSERT INTO orders
         (user_id, order_number, product_id, order_type, trade_type, order_direction, lot_size, leverage, price, stop_loss, take_profit, status)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, 0)
         RETURNING *`,
        [
          userId,
          orderNumber,
          product.id,
          type,
          direction === OrderDirection.LONG ? 1 : 2,
          direction,
          quantity,
          leverage,
          price || null,
          stopLoss || null,
          takeProfit || null
        ]
      );

      const order = result.rows[0] as DBOrder;
      logger.info(`订单创建成功: ${order.orderNumber}, 用户: ${userId}, 产品: ${productCode}`);

      return order;
    } catch (error) {
      logger.error('创建订单失败:', error);
      throw error;
    }
  }

  /**
   * 撮合订单
   */
  async matchOrder(orderId: number, marketData: MarketData): Promise<DBTrade | null> {
    return await transaction(async (client) => {
      try {
        // 获取订单
        const orderResult = await client.query(
          'SELECT * FROM orders WHERE id = $1',
          [orderId]
        );

        if (orderResult.rows.length === 0) {
          throw new Error('订单不存在');
        }

        const order = orderResult.rows[0] as DBOrder;

        // 检查订单状态
        if (order.status !== OrderStatus.CREATED && order.status !== OrderStatus.PENDING) {
          throw new Error('订单状态不正确');
        }

        let executionPrice: number;

        if (order.orderType === OrderType.MARKET) {
          executionPrice = marketData.lastPrice;
        } else if (order.orderType === OrderType.LIMIT && order.price) {
          if (order.orderDirection === OrderDirection.LONG) {
            if (marketData.lastPrice > order.price) {
              return null;
            }
          } else {
            if (marketData.lastPrice < order.price) {
              return null;
            }
          }
          executionPrice = order.price;
        } else {
          throw new Error('订单类型不支持');
        }

        // 计算保证金
        const margin = Calculator.calculateMargin(executionPrice, order.lotSize, order.leverage);

        // 计算手续费
        const fee = Calculator.calculateFee(executionPrice, order.lotSize);

        // 更新订单状态
        await client.query(
          `UPDATE orders
           SET status = 2,
               filled_size = lot_size,
               filled_price = $1,
               avg_price = $1,
               margin = $2,
               commission = $3,
               updated_at = CURRENT_TIMESTAMP
           WHERE id = $4`,
          [executionPrice, margin, fee, orderId]
        );

        // 获取产品代码
        const product = await client.query(
          'SELECT symbol FROM products WHERE id = $1',
          [order.productId]
        );

        const productCode = product.rows[0].symbol;

        // 创建成交记录
        const tradeResult = await client.query(
          `INSERT INTO trades
           (order_id, user_id, product_code, direction, price, quantity, leverage, margin, fee, timestamp)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, CURRENT_TIMESTAMP)
           RETURNING *`,
          [
            orderId,
            order.userId,
            productCode,
            order.orderDirection,
            executionPrice,
            order.lotSize,
            order.leverage,
            margin,
            fee
          ]
        );

        const trade = tradeResult.rows[0] as DBTrade;

        // 更新或创建持仓
        await this.updateOrCreatePosition(
          client,
          order.userId,
          order.productId,
          order.orderDirection === OrderDirection.LONG ? 1 : 2,
          executionPrice,
          order.lotSize,
          order.leverage,
          margin,
          order.stopLoss,
          order.takeProfit,
          orderId
        );

        logger.info(`订单撮合成功: ${order.orderNumber}, 成交价: ${executionPrice}`);

        return trade;
      } catch (error) {
        logger.error('撮合订单失败:', error);
        throw error;
      }
    });
  }

  /**
   * 更新或创建持仓
   */
  private async updateOrCreatePosition(
    client: any,
    userId: number,
    productId: number,
    direction: number,
    price: number,
    quantity: number,
    leverage: number,
    margin: number,
    stopLoss?: number,
    takeProfit?: number,
    orderId?: number
  ): Promise<void> {
    try {
      // 检查是否已有相同方向的持仓
      const existingPosition = await client.query(
        `SELECT * FROM positions
         WHERE user_id = $1 AND product_id = $2 AND direction = $3 AND status = 1`,
        [userId, productId, direction]
      );

      const positionNumber = 'POS' + Date.now().toString() + Math.floor(Math.random() * 10000).toString().padStart(4, '0');

      if (existingPosition.rows.length > 0) {
        // 更新现有持仓
        const pos = existingPosition.rows[0];

        const totalSize = parseFloat(pos.lotSize) + quantity;
        const avgPrice = (parseFloat(pos.entryPrice) * parseFloat(pos.lotSize) + price * quantity) / totalSize;
        const totalMargin = parseFloat(pos.margin) + margin;

        await client.query(
          `UPDATE positions
           SET lot_size = $1,
               entry_price = $2,
               margin = $3,
               stop_loss = COALESCE($4, stop_loss),
               take_profit = COALESCE($5, take_profit),
               updated_at = CURRENT_TIMESTAMP
           WHERE id = $6`,
          [totalSize, avgPrice, totalMargin, stopLoss, takeProfit, pos.id]
        );

        logger.info(`持仓更新: ${pos.positionNumber}, 新数量: ${totalSize}`);
      } else {
        // 创建新持仓
        await client.query(
          `INSERT INTO positions
           (user_id, product_id, position_number, order_id, trade_type, direction, lot_size, entry_price, current_price, leverage, margin, stop_loss, take_profit, floating_pl, status)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, 0, 1)`,
          [
            userId,
            productId,
            positionNumber,
            orderId || null,
            direction === 1 ? 1 : 2,
            direction,
            quantity,
            price,
            price,
            leverage,
            margin,
            stopLoss || null,
            takeProfit || null
          ]
        );

        logger.info(`新持仓创建: ${positionNumber}, 数量: ${quantity}`);

        // 注册止盈止损
        if (stopLoss || takeProfit) {
          try {
            await stopLossTakeProfitService.addPosition(
              positionNumber,
              userId,
              productId,
              direction === 1,
              price,
              quantity,
              leverage,
              stopLoss,
              takeProfit
            );
          } catch (slTpError) {
            logger.error('注册止盈止损失败:', slTpError);
          }
        }
      }
    } catch (error) {
      logger.error('更新或创建持仓失败:', error);
      throw error;
    }
  }

  /**
   * 取消订单
   */
  async cancelOrder(orderId: number): Promise<boolean> {
    try {
      const result = await query(
        `UPDATE orders
         SET status = 3,
             error_message = '用户取消',
             updated_at = CURRENT_TIMESTAMP
         WHERE id = $1 AND status IN (0, 1)`,
        [orderId]
      );

      return result.rowCount > 0;
    } catch (error) {
      logger.error('取消订单失败:', error);
      throw error;
    }
  }

  /**
   * 拒绝订单
   */
  async rejectOrder(orderId: number, reason: string): Promise<boolean> {
    try {
      const result = await query(
        `UPDATE orders
         SET status = 4,
             error_message = $1,
             updated_at = CURRENT_TIMESTAMP
         WHERE id = $1`,
        [reason, orderId]
      );

      return result.rowCount > 0;
    } catch (error) {
      logger.error('拒绝订单失败:', error);
      throw error;
    }
  }

  /**
   * 获取订单
   */
  async getOrder(orderId: number): Promise<DBOrder | null> {
    try {
      const result = await query(
        'SELECT * FROM orders WHERE id = $1',
        [orderId]
      );

      return result.rows.length > 0 ? result.rows[0] : null;
    } catch (error) {
      logger.error('获取订单失败:', error);
      throw error;
    }
  }

  /**
   * 获取用户的所有订单
   */
  async getUserOrders(userId: number, status?: number): Promise<DBOrder[]> {
    try {
      let queryStr = `
        SELECT o.*, p.symbol, p.name
        FROM orders o
        JOIN products p ON o.product_id = p.id
        WHERE o.user_id = $1
      `;

      const params: any[] = [userId];

      if (status !== undefined) {
        queryStr += ' AND o.status = $2';
        params.push(status);
      }

      queryStr += ' ORDER BY o.created_at DESC';

      const result = await query(queryStr, params);
      return result.rows;
    } catch (error) {
      logger.error('获取用户订单失败:', error);
      throw error;
    }
  }

  /**
   * 平仓
   */
  async closePosition(
    userId: number,
    positionId: number,
    closePrice: number
  ): Promise<DBPosition | null> {
    return await transaction(async (client) => {
      try {
        // 获取持仓
        const positionResult = await client.query(
          'SELECT * FROM positions WHERE id = $1 AND user_id = $2 AND status = 1',
          [positionId, userId]
        );

        if (positionResult.rows.length === 0) {
          throw new Error('持仓不存在');
        }

        const position = positionResult.rows[0] as DBPosition;

        // 计算盈亏
        let realizedPl: number;
        if (position.direction === 1) {
          realizedPl = (closePrice - parseFloat(position.entryPrice)) * parseFloat(position.lotSize);
        } else {
          realizedPl = (parseFloat(position.entryPrice) - closePrice) * parseFloat(position.lotSize);
        }

        // 更新持仓状态
        await client.query(
          `UPDATE positions
           SET status = 2,
               close_price = $1,
               close_time = CURRENT_TIMESTAMP,
               current_price = $1,
               floating_pl = $2,
               realized_pl = $2
           WHERE id = $3`,
          [closePrice, realizedPl, positionId]
        );

        // 获取产品代码
        const product = await client.query(
          'SELECT symbol FROM products WHERE id = $1',
          [position.productId]
        );

        const productCode = product.rows[0].symbol;

        // 创建成交记录
        await client.query(
          `INSERT INTO trades
           (order_id, user_id, product_code, direction, price, quantity, leverage, margin, fee, timestamp)
           VALUES (NULL, $1, $2, $3, $4, $5, $6, $7, 0, CURRENT_TIMESTAMP)`,
          [
            userId,
            productCode,
            position.direction,
            closePrice,
            position.lotSize,
            position.leverage,
            position.margin
          ]
        );

        logger.info(`持仓平仓成功: ${position.positionNumber}, 平仓价: ${closePrice}, 盈亏: ${realizedPl}`);

        return { ...position, status: 2, closePrice, realizedPl, floatingPl: realizedPl };
      } catch (error) {
        logger.error('平仓失败:', error);
        throw error;
      }
    });
  }

  /**
   * 获取持仓
   */
  async getPosition(positionId: number): Promise<DBPosition | null> {
    try {
      const result = await query(
        'SELECT * FROM positions WHERE id = $1',
        [positionId]
      );

      return result.rows.length > 0 ? result.rows[0] : null;
    } catch (error) {
      logger.error('获取持仓失败:', error);
      throw error;
    }
  }

  /**
   * 获取用户的所有持仓
   */
  async getUserPositions(userId: number): Promise<DBPosition[]> {
    try {
      const result = await query(
        `SELECT p.*, pr.symbol, pr.name
         FROM positions p
         JOIN products pr ON p.product_id = pr.id
         WHERE p.user_id = $1 AND p.status = 1
         ORDER BY p.open_time DESC`,
        [userId]
      );

      return result.rows;
    } catch (error) {
      logger.error('获取用户持仓失败:', error);
      throw error;
    }
  }

  /**
   * 更新持仓盈亏 - 优化版本(批量查询)
   */
  async updatePositionPnL(userId: number): Promise<void> {
    try {
      // 获取所有持仓
      const positions = await this.getUserPositions(userId);

      if (positions.length === 0) return;

      // 批量获取所有产品的最新价格
      const productIds = positions.map(p => p.productId);
      const marketDataResult = await query(
        'SELECT product_id, last_price FROM market_rates WHERE product_id = ANY($1)',
        [productIds]
      );

      // 创建价格Map
      const priceMap = new Map<number, number>();
      marketDataResult.rows.forEach(row => {
        priceMap.set(row.product_id, parseFloat(row.last_price));
      });

      // 批量更新持仓盈亏
      for (const position of positions) {
        if (position.status !== 1) continue;

        const currentPrice = priceMap.get(position.productId);

        if (!currentPrice) continue;

        // 计算浮动盈亏
        let floatingPl: number;
        if (position.direction === 1) {
          floatingPl = (currentPrice - parseFloat(position.entryPrice)) * parseFloat(position.lotSize);
        } else {
          floatingPl = (parseFloat(position.entryPrice) - currentPrice) * parseFloat(position.lotSize);
        }

        // 更新持仓
        await query(
          `UPDATE positions
           SET current_price = $1,
               floating_pl = $2
           WHERE id = $3`,
          [currentPrice, floatingPl, position.id]
        );
      }
    } catch (error) {
      logger.error('更新持仓盈亏失败:', error);
      throw error;
    }
  }

  /**
   * 更新止盈止损
   */
  async updateSlTp(
    userId: number,
    positionId: number,
    stopLoss?: number,
    takeProfit?: number
  ): Promise<boolean> {
    try {
      const result = await query(
        `UPDATE positions
         SET stop_loss = COALESCE($1, stop_loss),
             take_profit = COALESCE($2, take_profit)
         WHERE id = $3 AND user_id = $4`,
        [stopLoss || null, takeProfit || null, positionId, userId]
      );

      return result.rowCount > 0;
    } catch (error) {
      logger.error('更新止盈止损失败:', error);
      throw error;
    }
  }
}

// 导出单例
export const dbOperationManager = new DBOperationManager();
