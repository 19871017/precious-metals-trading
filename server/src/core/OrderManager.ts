import { v4 as uuidv4 } from 'uuid';
import {
  Order,
  OrderType,
  OrderDirection,
  OrderStatus,
  Position,
  PositionDirection,
  PositionStatus,
  Trade,
  MarketData
} from '../types';
import { Calculator } from '../utils/calculator';

// ============================================
// 订单管理器
// ============================================

export class OrderManager {
  private orders: Map<string, Order> = new Map();
  private trades: Map<string, Trade> = new Map();
  private positionManager: PositionManager;
  
  constructor(positionManager: PositionManager) {
    this.positionManager = positionManager;
  }

  /**
   * 创建订单
   */
  createOrder(
    userId: string,
    productCode: string,
    type: OrderType,
    direction: OrderDirection,
    quantity: number,
    leverage: number,
    price?: number,
    stopLoss?: number,
    takeProfit?: number
  ): Order {
    const order: Order = {
      id: uuidv4(),
      userId,
      productCode,
      type,
      direction,
      quantity,
      price,
      leverage,
      margin: 0, // 将在撮合时计算
      stopLoss,
      takeProfit,
      status: OrderStatus.CREATED,
      filledQuantity: 0,
      createdAt: new Date(),
      updatedAt: new Date()
    };

    this.orders.set(order.id, order);
    return order;
  }

  /**
   * 撮合订单
   */
  matchOrder(orderId: string, marketData: MarketData): Trade | null {
    const order = this.orders.get(orderId);
    if (!order) return null;

    // 检查订单状态
    if (order.status !== OrderStatus.CREATED && order.status !== OrderStatus.PENDING) {
      return null;
    }

    let executionPrice: number;

    if (order.type === OrderType.MARKET) {
      // 市价单按当前市场价成交
      executionPrice = marketData.lastPrice;
    } else if (order.type === OrderType.LIMIT && order.price) {
      // 限价单检查是否达到触发条件
      if (order.direction === OrderDirection.BUY) {
        // 买入限价单：当市场价 <= 限价时成交（以限价或更低的价格买入）
        if (marketData.lastPrice > order.price) {
          order.status = OrderStatus.PENDING;
          order.updatedAt = new Date();
          return null;
        }
      } else if (order.direction === OrderDirection.SELL) {
        // 卖出限价单：当市场价 >= 限价时成交（以限价或更高的价格卖出）
        if (marketData.lastPrice < order.price) {
          order.status = OrderStatus.PENDING;
          order.updatedAt = new Date();
          return null;
        }
      }
      executionPrice = order.price;

      // 限价单触发前检查保证金是否充足（简单警告机制）
      // 注意：实际保证金检查在API路由中已完成
      const marginWarning = order.quantity > 100 ? true : false;
      if (marginWarning) {
        console.warn(`[OrderManager] 限价单 ${orderId} 数量较大，请关注保证金`);
      }
    } else {
      return null;
    }

    // 计算保证金
    const margin = Calculator.calculateMargin(
      executionPrice,
      order.quantity,
      order.leverage
    );

    // 更新订单状态
    order.margin = margin;
    order.filledQuantity = order.quantity;
    order.filledPrice = executionPrice;
    order.status = OrderStatus.FILLED;
    order.updatedAt = new Date();

    // 创建成交记录
    const trade: Trade = {
      id: uuidv4(),
      orderId: order.id,
      userId: order.userId,
      productCode: order.productCode,
      direction: order.direction,
      price: executionPrice,
      quantity: order.quantity,
      leverage: order.leverage,
      margin: margin,
      fee: Calculator.calculateFee(executionPrice, order.quantity),
      timestamp: new Date()
    };

    this.trades.set(trade.id, trade);

    // 更新或创建仓位
    this.positionManager.updatePosition(
      order.userId,
      order.productCode,
      order.direction === OrderDirection.BUY ? PositionDirection.LONG : PositionDirection.SHORT,
      executionPrice,
      order.quantity,
      order.leverage,
      margin,
      order.stopLoss,
      order.takeProfit,
      order.id
    );

    return trade;
  }

  /**
   * 取消订单
   */
  cancelOrder(orderId: string): boolean {
    const order = this.orders.get(orderId);
    if (!order) return false;

    // 只能取消待成交或已创建的订单
    if (order.status !== OrderStatus.CREATED && order.status !== OrderStatus.PENDING) {
      return false;
    }

    order.status = OrderStatus.CANCELED;
    order.canceledAt = new Date();
    order.updatedAt = new Date();

    return true;
  }

  /**
   * 拒绝订单
   */
  rejectOrder(orderId: string, reason: string): boolean {
    const order = this.orders.get(orderId);
    if (!order) return false;

    order.status = OrderStatus.REJECTED;
    order.rejectReason = reason;
    order.updatedAt = new Date();

    return true;
  }

  /**
   * 获取订单
   */
  getOrder(orderId: string): Order | undefined {
    return this.orders.get(orderId);
  }

  /**
   * 获取用户的所有订单
   */
  getUserOrders(userId: string): Order[] {
    return Array.from(this.orders.values())
      .filter(order => order.userId === userId)
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  }

  /**
   * 获取成交记录
   */
  getTrade(tradeId: string): Trade | undefined {
    return this.trades.get(tradeId);
  }

  /**
   * 获取用户的所有成交记录
   */
  getUserTrades(userId: string): Trade[] {
    return Array.from(this.trades.values())
      .filter(trade => trade.userId === userId)
      .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
  }
}

// ============================================
// 仓位管理器
// ============================================

import { LiquidationRecord } from '../types';

export class PositionManager {
  private positions: Map<string, Position> = new Map();
  private liquidationRecords: Map<string, LiquidationRecord> = new Map();

  /**
   * 更新或创建仓位
   */
  updatePosition(
    userId: string,
    productCode: string,
    direction: PositionDirection,
    price: number,
    quantity: number,
    leverage: number,
    margin: number,
    stopLoss?: number,
    takeProfit?: number,
    orderId?: string
  ): Position {
    // 查找现有同方向仓位
    const existingPosition = this.findPosition(userId, productCode, direction);

    if (existingPosition && existingPosition.status === PositionStatus.OPEN) {
      // 合并仓位 - 计算新的开仓均价
      const totalQuantity = existingPosition.quantity + quantity;
      const totalValue = (existingPosition.openPrice * existingPosition.quantity) + (price * quantity);
      const newOpenPrice = totalValue / totalQuantity;

      existingPosition.openPrice = newOpenPrice;
      existingPosition.quantity = totalQuantity;
      existingPosition.marginUsed += margin;
      existingPosition.liquidationPrice = Calculator.calculateLiquidationPrice(
        newOpenPrice,
        leverage,
        direction
      );
      
      if (stopLoss) existingPosition.stopLoss = stopLoss;
      if (takeProfit) existingPosition.takeProfit = takeProfit;
      if (orderId) existingPosition.orders.push(orderId);

      return existingPosition;
    } else {
      // 创建新仓位
      const position: Position = {
        id: uuidv4(),
        userId,
        productCode,
        direction,
        openPrice: price,
        quantity,
        leverage,
        marginUsed: margin,
        liquidationPrice: Calculator.calculateLiquidationPrice(price, leverage, direction),
        stopLoss,
        takeProfit,
        unrealizedPnl: 0,
        realizedPnl: 0,
        status: PositionStatus.OPEN,
        openedAt: new Date(),
        orders: orderId ? [orderId] : []
      };

      this.positions.set(position.id, position);
      return position;
    }
  }

  /**
   * 查找仓位
   */
  findPosition(
    userId: string,
    productCode: string,
    direction: PositionDirection
  ): Position | undefined {
    return Array.from(this.positions.values()).find(
      p => p.userId === userId && 
           p.productCode === productCode && 
           p.direction === direction &&
           p.status === PositionStatus.OPEN
    );
  }

  /**
   * 获取仓位
   */
  getPosition(positionId: string): Position | undefined {
    return this.positions.get(positionId);
  }

  /**
   * 获取用户的所有仓位
   */
  getUserPositions(userId: string): Position[] {
    return Array.from(this.positions.values())
      .filter(position => position.userId === userId)
      .sort((a, b) => b.openedAt.getTime() - a.openedAt.getTime());
  }

  /**
   * 更新仓位未实现盈亏
   */
  updateUnrealizedPnl(positionId: string, currentPrice: number): Position | null {
    const position = this.positions.get(positionId);
    if (!position || position.status !== PositionStatus.OPEN) return null;

    position.unrealizedPnl = Calculator.calculateUnrealizedPnl(
      position.openPrice,
      currentPrice,
      position.quantity,
      position.direction
    );

    return position;
  }

  /**
   * 平仓
   */
  closePosition(positionId: string, closePrice: number): Position | null {
    const position = this.positions.get(positionId);
    if (!position || position.status !== PositionStatus.OPEN) return null;

    // 计算已实现盈亏
    position.realizedPnl = Calculator.calculateUnrealizedPnl(
      position.openPrice,
      closePrice,
      position.quantity,
      position.direction
    );

    position.status = PositionStatus.CLOSED;
    position.closedAt = new Date();

    return position;
  }

  /**
   * 强平仓位
   */
  liquidatePosition(positionId: string, liquidationPrice: number, reason: string): LiquidationRecord | null {
    const position = this.positions.get(positionId);
    if (!position || position.status !== PositionStatus.OPEN) return null;

    // 计算实际盈亏
    const pnl = Calculator.calculateUnrealizedPnl(
      position.openPrice,
      liquidationPrice,
      position.quantity,
      position.direction
    );

    // 计算实际损失（取盈亏和保证金的最小值，最多损失全部保证金）
    const actualLoss = Math.min(Math.abs(pnl), position.marginUsed);

    // 标记仓位为强平状态
    position.status = PositionStatus.LIQUIDATED;
    position.closedAt = new Date();
    position.realizedPnl = -actualLoss;

    // 创建强平记录
    const record: LiquidationRecord = {
      id: uuidv4(),
      userId: position.userId,
      positionId: position.id,
      productCode: position.productCode,
      liquidationPrice,
      quantity: position.quantity,
      marginLost: actualLoss,
      timestamp: new Date(),
      reason
    };

    this.liquidationRecords.set(record.id, record);
    return record;
  }

  /**
   * 修改止盈止损
   */
  updateSlTp(positionId: string, stopLoss?: number, takeProfit?: number): Position | null {
    const position = this.positions.get(positionId);
    if (!position || position.status !== PositionStatus.OPEN) return null;

    if (stopLoss !== undefined) position.stopLoss = stopLoss;
    if (takeProfit !== undefined) position.takeProfit = takeProfit;

    return position;
  }

  /**
   * 获取强平记录
   */
  getLiquidationRecords(userId: string): LiquidationRecord[] {
    return Array.from(this.liquidationRecords.values())
      .filter(record => record.userId === userId)
      .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
  }
}
