import logger from '../utils/logger';
import { Order } from '../types';

export interface AutoOrder {
  id: string;
  symbol: string;
  type: 'buy' | 'sell';
  orderType: 'market' | 'limit';
  price?: number;
  quantity: number;
  leverage: number;
  stopLoss?: number;
  takeProfit?: number;
  source: 'auto' | 'manual';
  strategyId?: string;
  status: 'pending' | 'submitted' | 'filled' | 'cancelled' | 'rejected';
  createdAt: string;
  submittedAt?: string;
  filledAt?: string;
  error?: string;
}

export interface OrderResult {
  success: boolean;
  orderId?: string;
  filledPrice?: number;
  filledQuantity?: number;
  profit?: number;
  error?: string;
  timestamp: string;
}

export interface AutoPosition {
  id: string;
  symbol: string;
  type: 'long' | 'short';
  quantity: number;
  entryPrice: number;
  stopLoss?: number;
  takeProfit?: number;
  leverage: number;
  openedAt: string;
  status: 'open' | 'closed' | 'liquidated';
  closedAt?: string;
  exitPrice?: number;
  profit: number;
  profitPercent: number;
}

export class AutoOrderService {
  private pendingOrders: Map<string, AutoOrder> = new Map();
  private executedOrders: AutoOrder[] = [];
  private positions: Map<string, AutoPosition> = new Map();

  /**
   * 下单
   */
  public async placeOrder(order: Partial<AutoOrder>): Promise<OrderResult> {
    const orderId = `auto_order_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    const autoOrder: AutoOrder = {
      id: orderId,
      symbol: order.symbol || '',
      type: order.type || 'buy',
      orderType: order.orderType || 'market',
      price: order.price,
      quantity: order.quantity || 0,
      leverage: order.leverage || 10,
      stopLoss: order.stopLoss,
      takeProfit: order.takeProfit,
      source: order.source || 'auto',
      strategyId: order.strategyId,
      status: 'pending',
      createdAt: new Date().toISOString(),
    };

    try {
      logger.info('[AutoOrder] Placing order', { orderId, ...autoOrder });

      const result = await this.executeOrder(autoOrder);

      if (result.success) {
        autoOrder.status = 'filled';
        autoOrder.submittedAt = new Date().toISOString();
        autoOrder.filledAt = new Date().toISOString();
        this.executedOrders.push(autoOrder);

        await this.createPosition(autoOrder, result);

        logger.info('[AutoOrder] Order filled successfully', { orderId, result });
      } else {
        autoOrder.status = 'rejected';
        autoOrder.error = result.error;
        logger.error('[AutoOrder] Order rejected', { orderId, result });
      }

      this.pendingOrders.delete(orderId);

      return result;
    } catch (error) {
      autoOrder.status = 'rejected';
      autoOrder.error = (error as Error).message;
      this.pendingOrders.delete(orderId);

      logger.error('[AutoOrder] Failed to place order', { orderId, error });

      return {
        success: false,
        error: (error as Error).message,
        timestamp: new Date().toISOString(),
      };
    }
  }

  /**
   * 批量下单
   */
  public async placeOrders(orders: Partial<AutoOrder>[]): Promise<OrderResult[]> {
    const results: OrderResult[] = [];

    for (const order of orders) {
      const result = await this.placeOrder(order);
      results.push(result);
    }

    logger.info('[AutoOrder] Batch orders completed', {
      total: orders.length,
      success: results.filter(r => r.success).length,
      failed: results.filter(r => !r.success).length,
    });

    return results;
  }

  /**
   * 平仓
   */
  public async closePosition(symbol: string, reason: string = '手动平仓'): Promise<OrderResult> {
    const position = this.positions.get(symbol);

    if (!position) {
      logger.warn('[AutoOrder] Position not found', { symbol });
      return {
        success: false,
        error: 'Position not found',
        timestamp: new Date().toISOString(),
      };
    }

    try {
      const orderId = `auto_close_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

      const order: Partial<AutoOrder> = {
        id: orderId,
        symbol,
        type: position.type === 'long' ? 'sell' : 'buy',
        orderType: 'market',
        quantity: position.quantity,
        leverage: position.leverage,
        source: 'auto',
        strategyId: reason,
      };

      const result = await this.executeOrder({
        ...order,
        status: 'pending',
        createdAt: new Date().toISOString(),
      } as AutoOrder);

      if (result.success) {
        position.status = 'closed';
        position.closedAt = new Date().toISOString();
        position.exitPrice = result.filledPrice || position.entryPrice;

        const priceChange = position.exitPrice - position.entryPrice;
        position.profit = priceChange * position.quantity * (position.type === 'long' ? 1 : -1);
        position.profitPercent = (priceChange / position.entryPrice) * 100;

        this.positions.delete(symbol);

        logger.info('[AutoOrder] Position closed successfully', {
          symbol,
          reason,
          profit: position.profit,
        });
      }

      return result;
    } catch (error) {
      logger.error('[AutoOrder] Failed to close position', { symbol, error });

      return {
        success: false,
        error: (error as Error).message,
        timestamp: new Date().toISOString(),
      };
    }
  }

  /**
   * 执行订单
   */
  private async executeOrder(order: AutoOrder): Promise<OrderResult> {
    try {
      const response = await fetch('/api/order/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          productCode: order.symbol,
          type: order.orderType.toUpperCase(),
          direction: order.type.toUpperCase(),
          quantity: order.quantity,
          leverage: order.leverage,
          stopLoss: order.stopLoss,
          takeProfit: order.takeProfit,
        }),
      });

      if (response.ok) {
        const data = await response.json();
        if (data.code === 0 && data.data) {
          return {
            success: true,
            orderId: order.id,
            filledPrice: data.data.filledPrice,
            filledQuantity: data.data.filledQuantity || order.quantity,
            timestamp: new Date().toISOString(),
          };
        } else {
          return {
            success: false,
            error: data.message || 'Order execution failed',
            timestamp: new Date().toISOString(),
          };
        }
      } else {
        const errorText = await response.text();
        return {
          success: false,
          error: errorText || 'HTTP error',
          timestamp: new Date().toISOString(),
        };
      }
    } catch (error) {
      logger.error('[AutoOrder] Network error:', error);
      return {
        success: false,
        error: (error as Error).message,
        timestamp: new Date().toISOString(),
      };
    }
  }

  /**
   * 创建持仓
   */
  private async createPosition(order: AutoOrder, result: OrderResult): Promise<void> {
    const positionId = `pos_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    const position: AutoPosition = {
      id: positionId,
      symbol: order.symbol,
      type: order.type === 'buy' ? 'long' : 'short',
      quantity: order.quantity,
      entryPrice: result.filledPrice || 0,
      leverage: order.leverage,
      openedAt: new Date().toISOString(),
      status: 'open',
      profit: 0,
      profitPercent: 0,
    };

    if (order.stopLoss) {
      position.stopLoss = order.stopLoss;
    }
    if (order.takeProfit) {
      position.takeProfit = order.takeProfit;
    }

    this.positions.set(order.symbol, position);

    logger.info('[AutoOrder] Position created', {
      positionId,
      symbol: order.symbol,
      type: position.type,
      entryPrice: position.entryPrice,
    });
  }

  /**
   * 获取所有持仓
   */
  public getPositions(): AutoPosition[] {
    return Array.from(this.positions.values());
  }

  /**
   * 获取指定持仓
   */
  public getPosition(symbol: string): AutoPosition | undefined {
    return this.positions.get(symbol);
  }

  /**
   * 获取待处理订单
   */
  public getPendingOrders(): AutoOrder[] {
    return Array.from(this.pendingOrders.values());
  }

  /**
   * 获取已执行订单
   */
  public getExecutedOrders(): AutoOrder[] {
    return this.executedOrders;
  }

  /**
   * 取消订单
   */
  public async cancelOrder(orderId: string): Promise<boolean> {
    try {
      const response = await fetch('/api/order/cancel', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orderId }),
      });

      if (response.ok) {
        const data = await response.json();
        if (data.code === 0) {
          this.pendingOrders.delete(orderId);
          logger.info('[AutoOrder] Order cancelled', { orderId });
          return true;
        }
      }

      return false;
    } catch (error) {
      logger.error('[AutoOrder] Failed to cancel order', { orderId, error });
      return false;
    }
  }

  /**
   * 清理历史订单
   */
  public clearHistory(daysToKeep: number = 7): void {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - daysToKeep);

    this.executedOrders = this.executedOrders.filter(
      order => new Date(order.createdAt) >= cutoffDate
    );

    logger.info('[AutoOrder] History cleared', {
      daysToKeep,
      remainingOrders: this.executedOrders.length,
    });
  }

  /**
   * 获取统计数据
   */
  public getStats() {
    const positions = this.getPositions();
    const orders = this.getExecutedOrders();

    const totalProfit = positions.reduce((sum, p) => sum + p.profit, 0);
    const totalOrders = orders.length;
    const filledOrders = orders.filter(o => o.status === 'filled').length;
    const successRate = totalOrders > 0 ? (filledOrders / totalOrders) * 100 : 0;

    return {
      totalPositions: positions.length,
      totalProfit,
      totalOrders,
      filledOrders,
      successRate,
    };
  }
}

export const autoOrderService = new AutoOrderService();
