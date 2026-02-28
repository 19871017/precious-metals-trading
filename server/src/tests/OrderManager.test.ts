import { describe, test, expect, beforeEach, jest } from '@jest/globals';
import { OrderManager, PositionManager } from '../core/OrderManager';
import {
  OrderType,
  OrderDirection,
  OrderStatus,
  PositionDirection,
  PositionStatus,
} from '../types';

describe('OrderManager', () => {
  let orderManager: OrderManager;
  let positionManager: PositionManager;

  beforeEach(() => {
    positionManager = new PositionManager();
    orderManager = new OrderManager(positionManager);
  });

  describe('createOrder', () => {
    test('应该创建市价买单', () => {
      const order = orderManager.createOrder(
        'user-1',
        'XAUUSD',
        OrderType.MARKET,
        OrderDirection.BUY,
        1,
        10,
        undefined,
        1900,
        2100
      );

      expect(order).toBeDefined();
      expect(order.userId).toBe('user-1');
      expect(order.productCode).toBe('XAUUSD');
      expect(order.type).toBe(OrderType.MARKET);
      expect(order.direction).toBe(OrderDirection.BUY);
      expect(order.quantity).toBe(1);
      expect(order.leverage).toBe(10);
      expect(order.stopLoss).toBe(1900);
      expect(order.takeProfit).toBe(2100);
      expect(order.status).toBe(OrderStatus.CREATED);
      expect(order.filledQuantity).toBe(0);
    });

    test('应该创建限价卖单', () => {
      const order = orderManager.createOrder(
        'user-1',
        'XAUUSD',
        OrderType.LIMIT,
        OrderDirection.SELL,
        1,
        10,
        2050,
        1900,
        2100
      );

      expect(order).toBeDefined();
      expect(order.type).toBe(OrderType.LIMIT);
      expect(order.direction).toBe(OrderDirection.SELL);
      expect(order.price).toBe(2050);
      expect(order.status).toBe(OrderStatus.CREATED);
    });
  });

  describe('matchOrder', () => {
    test('市价买单应该以市场价成交', () => {
      const order = orderManager.createOrder(
        'user-1',
        'XAUUSD',
        OrderType.MARKET,
        OrderDirection.BUY,
        1,
        10
      );

      const marketData = {
        productId: 1,
        symbol: 'XAUUSD',
        bid: 2000,
        ask: 2002,
        lastPrice: 2001,
      };

      const trade = orderManager.matchOrder(order.id, marketData);

      expect(trade).toBeDefined();
      expect(trade!.orderId).toBe(order.id);
      expect(trade!.price).toBe(2001);
      expect(trade!.quantity).toBe(1);
      expect(trade!.leverage).toBe(10);
      expect(order.status).toBe(OrderStatus.FILLED);
      expect(order.filledQuantity).toBe(1);
      expect(order.filledPrice).toBe(2001);
    });

    test('限价买单达到触发价格时应该成交', () => {
      const order = orderManager.createOrder(
        'user-1',
        'XAUUSD',
        OrderType.LIMIT,
        OrderDirection.BUY,
        1,
        10,
        2050
      );

      const marketData = {
        productId: 1,
        symbol: 'XAUUSD',
        bid: 2048,
        ask: 2050,
        lastPrice: 2049,
      };

      const trade = orderManager.matchOrder(order.id, marketData);

      expect(trade).toBeDefined();
      expect(trade!.price).toBe(2050);
      expect(order.status).toBe(OrderStatus.FILLED);
    });

    test('限价买单未达到触发价格时不应该成交', () => {
      const order = orderManager.createOrder(
        'user-1',
        'XAUUSD',
        OrderType.LIMIT,
        OrderDirection.BUY,
        1,
        10,
        2050
      );

      const marketData = {
        productId: 1,
        symbol: 'XAUUSD',
        bid: 2052,
        ask: 2054,
        lastPrice: 2053,
      };

      const trade = orderManager.matchOrder(order.id, marketData);

      expect(trade).toBeNull();
      expect(order.status).toBe(OrderStatus.PENDING);
    });

    test('限价卖单达到触发价格时应该成交', () => {
      const order = orderManager.createOrder(
        'user-1',
        'XAUUSD',
        OrderType.LIMIT,
        OrderDirection.SELL,
        1,
        10,
        1950
      );

      const marketData = {
        productId: 1,
        symbol: 'XAUUSD',
        bid: 1952,
        ask: 1954,
        lastPrice: 1953,
      };

      const trade = orderManager.matchOrder(order.id, marketData);

      expect(trade).toBeDefined();
      expect(trade!.price).toBe(1950);
      expect(order.status).toBe(OrderStatus.FILLED);
    });

    test('限价卖单未达到触发价格时不应该成交', () => {
      const order = orderManager.createOrder(
        'user-1',
        'XAUUSD',
        OrderType.LIMIT,
        OrderDirection.SELL,
        1,
        10,
        1950
      );

      const marketData = {
        productId: 1,
        symbol: 'XAUUSD',
        bid: 1948,
        ask: 1950,
        lastPrice: 1949,
      };

      const trade = orderManager.matchOrder(order.id, marketData);

      expect(trade).toBeNull();
      expect(order.status).toBe(OrderStatus.PENDING);
    });

    test('订单不存在时应该返回 null', () => {
      const marketData = {
        productId: 1,
        symbol: 'XAUUSD',
        bid: 2000,
        ask: 2002,
        lastPrice: 2001,
      };

      const trade = orderManager.matchOrder('non-existent-order-id', marketData);

      expect(trade).toBeNull();
    });

    test('已成交的订单不应该重复撮合', () => {
      const order = orderManager.createOrder(
        'user-1',
        'XAUUSD',
        OrderType.MARKET,
        OrderDirection.BUY,
        1,
        10
      );

      const marketData = {
        productId: 1,
        symbol: 'XAUUSD',
        bid: 2000,
        ask: 2002,
        lastPrice: 2001,
      };

      const trade1 = orderManager.matchOrder(order.id, marketData);
      const trade2 = orderManager.matchOrder(order.id, marketData);

      expect(trade1).toBeDefined();
      expect(trade2).toBeNull();
      expect(order.status).toBe(OrderStatus.FILLED);
    });
  });

  describe('cancelOrder', () => {
    test('应该取消待成交订单', () => {
      const order = orderManager.createOrder(
        'user-1',
        'XAUUSD',
        OrderType.LIMIT,
        OrderDirection.BUY,
        1,
        10,
        2050
      );

      const result = orderManager.cancelOrder(order.id);

      expect(result).toBe(true);
      expect(order.status).toBe(OrderStatus.CANCELED);
      expect(order.canceledAt).toBeDefined();
    });

    test('不应该取消已成交的订单', () => {
      const order = orderManager.createOrder(
        'user-1',
        'XAUUSD',
        OrderType.MARKET,
        OrderDirection.BUY,
        1,
        10
      );

      const marketData = {
        productId: 1,
        symbol: 'XAUUSD',
        bid: 2000,
        ask: 2002,
        lastPrice: 2001,
      };

      orderManager.matchOrder(order.id, marketData);

      const result = orderManager.cancelOrder(order.id);

      expect(result).toBe(false);
      expect(order.status).toBe(OrderStatus.FILLED);
    });

    test('订单不存在时应该返回 false', () => {
      const result = orderManager.cancelOrder('non-existent-order-id');

      expect(result).toBe(false);
    });
  });

  describe('rejectOrder', () => {
    test('应该拒绝订单', () => {
      const order = orderManager.createOrder(
        'user-1',
        'XAUUSD',
        OrderType.LIMIT,
        OrderDirection.BUY,
        1,
        10,
        2050
      );

      const result = orderManager.rejectOrder(order.id, '余额不足');

      expect(result).toBe(true);
      expect(order.status).toBe(OrderStatus.REJECTED);
      expect(order.rejectReason).toBe('余额不足');
    });

    test('订单不存在时应该返回 false', () => {
      const result = orderManager.rejectOrder('non-existent-order-id', '余额不足');

      expect(result).toBe(false);
    });
  });

  describe('getOrder', () => {
    test('应该获取订单', () => {
      const order = orderManager.createOrder(
        'user-1',
        'XAUUSD',
        OrderType.MARKET,
        OrderDirection.BUY,
        1,
        10
      );

      const foundOrder = orderManager.getOrder(order.id);

      expect(foundOrder).toBeDefined();
      expect(foundOrder!.id).toBe(order.id);
    });

    test('订单不存在时应该返回 undefined', () => {
      const foundOrder = orderManager.getOrder('non-existent-order-id');

      expect(foundOrder).toBeUndefined();
    });
  });

  describe('getUserOrders', () => {
    test('应该获取用户的所有订单', () => {
      const order1 = orderManager.createOrder(
        'user-1',
        'XAUUSD',
        OrderType.MARKET,
        OrderDirection.BUY,
        1,
        10
      );

      const order2 = orderManager.createOrder(
        'user-1',
        'XAGUSD',
        OrderType.LIMIT,
        OrderDirection.SELL,
        1,
        10,
        25
      );

      const order3 = orderManager.createOrder(
        'user-2',
        'XAUUSD',
        OrderType.MARKET,
        OrderDirection.BUY,
        1,
        10
      );

      const userOrders = orderManager.getUserOrders('user-1');

      expect(userOrders.length).toBe(2);
      expect(userOrders.map(o => o.id)).toContain(order1.id);
      expect(userOrders.map(o => o.id)).toContain(order2.id);
      expect(userOrders.map(o => o.id)).not.toContain(order3.id);
    });
  });

  describe('getUserTrades', () => {
    test('应该获取用户的所有成交记录', () => {
      const order1 = orderManager.createOrder(
        'user-1',
        'XAUUSD',
        OrderType.MARKET,
        OrderDirection.BUY,
        1,
        10
      );

      const order2 = orderManager.createOrder(
        'user-1',
        'XAGUSD',
        OrderType.MARKET,
        OrderDirection.SELL,
        1,
        10
      );

      const marketData1 = {
        productId: 1,
        symbol: 'XAUUSD',
        bid: 2000,
        ask: 2002,
        lastPrice: 2001,
      };

      const marketData2 = {
        productId: 2,
        symbol: 'XAGUSD',
        bid: 25,
        ask: 25.1,
        lastPrice: 25.05,
      };

      orderManager.matchOrder(order1.id, marketData1);
      orderManager.matchOrder(order2.id, marketData2);

      const trades = orderManager.getUserTrades('user-1');

      expect(trades.length).toBe(2);
      expect(trades[0].userId).toBe('user-1');
      expect(trades[1].userId).toBe('user-1');
    });
  });
});

describe('PositionManager', () => {
  let positionManager: PositionManager;

  beforeEach(() => {
    positionManager = new PositionManager();
  });

  describe('updatePosition', () => {
    test('应该创建新仓位', () => {
      const position = positionManager.updatePosition(
        'user-1',
        'XAUUSD',
        PositionDirection.LONG,
        2000,
        1,
        10,
        200,
        1900,
        2100,
        'order-1'
      );

      expect(position).toBeDefined();
      expect(position.userId).toBe('user-1');
      expect(position.productCode).toBe('XAUUSD');
      expect(position.direction).toBe(PositionDirection.LONG);
      expect(position.openPrice).toBe(2000);
      expect(position.quantity).toBe(1);
      expect(position.leverage).toBe(10);
      expect(position.marginUsed).toBe(200);
      expect(position.stopLoss).toBe(1900);
      expect(position.takeProfit).toBe(2100);
      expect(position.status).toBe(PositionStatus.OPEN);
      expect(position.orders).toContain('order-1');
    });

    test('应该合并同方向仓位', () => {
      const position1 = positionManager.updatePosition(
        'user-1',
        'XAUUSD',
        PositionDirection.LONG,
        2000,
        1,
        10,
        200,
        1900,
        2100,
        'order-1'
      );

      const position2 = positionManager.updatePosition(
        'user-1',
        'XAUUSD',
        PositionDirection.LONG,
        2050,
        1,
        10,
        200,
        1900,
        2100,
        'order-2'
      );

      expect(position2.id).toBe(position1.id);
      expect(position2.quantity).toBe(2);
      expect(position2.openPrice).toBe(2025);
      expect(position2.marginUsed).toBe(400);
      expect(position2.orders).toContain('order-1');
      expect(position2.orders).toContain('order-2');
    });

    test('不同方向的仓位应该独立', () => {
      const position1 = positionManager.updatePosition(
        'user-1',
        'XAUUSD',
        PositionDirection.LONG,
        2000,
        1,
        10,
        200
      );

      const position2 = positionManager.updatePosition(
        'user-1',
        'XAUUSD',
        PositionDirection.SHORT,
        2000,
        1,
        10,
        200
      );

      expect(position2.id).not.toBe(position1.id);
      expect(position2.direction).toBe(PositionDirection.SHORT);
    });
  });

  describe('findPosition', () => {
    test('应该找到同品种同方向的仓位', () => {
      const position1 = positionManager.updatePosition(
        'user-1',
        'XAUUSD',
        PositionDirection.LONG,
        2000,
        1,
        10,
        200
      );

      const foundPosition = positionManager.findPosition(
        'user-1',
        'XAUUSD',
        PositionDirection.LONG
      );

      expect(foundPosition).toBeDefined();
      expect(foundPosition!.id).toBe(position1.id);
    });

    test('找不到不存在的仓位时应该返回 undefined', () => {
      const foundPosition = positionManager.findPosition(
        'user-1',
        'XAUUSD',
        PositionDirection.LONG
      );

      expect(foundPosition).toBeUndefined();
    });
  });

  describe('getPosition', () => {
    test('应该获取仓位', () => {
      const position = positionManager.updatePosition(
        'user-1',
        'XAUUSD',
        PositionDirection.LONG,
        2000,
        1,
        10,
        200
      );

      const foundPosition = positionManager.getPosition(position.id);

      expect(foundPosition).toBeDefined();
      expect(foundPosition!.id).toBe(position.id);
    });

    test('仓位不存在时应该返回 undefined', () => {
      const foundPosition = positionManager.getPosition('non-existent-position-id');

      expect(foundPosition).toBeUndefined();
    });
  });

  describe('getUserPositions', () => {
    test('应该获取用户的所有仓位', () => {
      const position1 = positionManager.updatePosition(
        'user-1',
        'XAUUSD',
        PositionDirection.LONG,
        2000,
        1,
        10,
        200
      );

      const position2 = positionManager.updatePosition(
        'user-1',
        'XAGUSD',
        PositionDirection.SHORT,
        25,
        1,
        10,
        25
      );

      const position3 = positionManager.updatePosition(
        'user-2',
        'XAUUSD',
        PositionDirection.LONG,
        2000,
        1,
        10,
        200
      );

      const userPositions = positionManager.getUserPositions('user-1');

      expect(userPositions.length).toBe(2);
      expect(userPositions.map(p => p.id)).toContain(position1.id);
      expect(userPositions.map(p => p.id)).toContain(position2.id);
      expect(userPositions.map(p => p.id)).not.toContain(position3.id);
    });
  });

  describe('updateUnrealizedPnl', () => {
    test('应该更新多头仓位的未实现盈亏', () => {
      const position = positionManager.updatePosition(
        'user-1',
        'XAUUSD',
        PositionDirection.LONG,
        2000,
        1,
        10,
        200
      );

      const updatedPosition = positionManager.updateUnrealizedPnl(position.id, 2010);

      expect(updatedPosition).toBeDefined();
      expect(updatedPosition!.unrealizedPnl).toBe(100);
    });

    test('应该更新空头仓位的未实现盈亏', () => {
      const position = positionManager.updatePosition(
        'user-1',
        'XAUUSD',
        PositionDirection.SHORT,
        2000,
        1,
        10,
        200
      );

      const updatedPosition = positionManager.updateUnrealizedPnl(position.id, 2010);

      expect(updatedPosition).toBeDefined();
      expect(updatedPosition!.unrealizedPnl).toBe(-100);
    });

    test('仓位不存在或已关闭时应该返回 null', () => {
      const updatedPosition = positionManager.updateUnrealizedPnl('non-existent', 2010);

      expect(updatedPosition).toBeNull();
    });
  });

  describe('closePosition', () => {
    test('应该平仓', () => {
      const position = positionManager.updatePosition(
        'user-1',
        'XAUUSD',
        PositionDirection.LONG,
        2000,
        1,
        10,
        200
      );

      const closedPosition = positionManager.closePosition(position.id, 2010);

      expect(closedPosition).toBeDefined();
      expect(closedPosition!.status).toBe(PositionStatus.CLOSED);
      expect(closedPosition!.realizedPnl).toBe(100);
      expect(closedPosition!.closedAt).toBeDefined();
    });

    test('仓位不存在时应该返回 null', () => {
      const closedPosition = positionManager.closePosition('non-existent', 2010);

      expect(closedPosition).toBeNull();
    });
  });

  describe('liquidatePosition', () => {
    test('应该强平仓位', () => {
      const position = positionManager.updatePosition(
        'user-1',
        'XAUUSD',
        PositionDirection.LONG,
        2000,
        1,
        10,
        200
      );

      const liquidationRecord = positionManager.liquidatePosition(position.id, 1900, '强平触发');

      expect(liquidationRecord).toBeDefined();
      expect(liquidationRecord!.userId).toBe('user-1');
      expect(liquidationRecord!.positionId).toBe(position.id);
      expect(liquidationRecord!.liquidationPrice).toBe(1900);
      expect(liquidationRecord!.quantity).toBe(1);
      expect(position.status).toBe(PositionStatus.LIQUIDATED);
      expect(position.realizedPnl).toBeLessThan(0);
    });

    test('应该限制最大损失为保证金', () => {
      const position = positionManager.updatePosition(
        'user-1',
        'XAUUSD',
        PositionDirection.LONG,
        2000,
        1,
        10,
        200
      );

      const liquidationRecord = positionManager.liquidatePosition(position.id, 1800, '强平触发');

      expect(liquidationRecord!.marginLost).toBe(200);
    });
  });

  describe('updateSlTp', () => {
    test('应该更新止盈止损', () => {
      const position = positionManager.updatePosition(
        'user-1',
        'XAUUSD',
        PositionDirection.LONG,
        2000,
        1,
        10,
        200,
        1900,
        2100
      );

      const updatedPosition = positionManager.updateSlTp(position.id, 1880, 2150);

      expect(updatedPosition).toBeDefined();
      expect(updatedPosition!.stopLoss).toBe(1880);
      expect(updatedPosition!.takeProfit).toBe(2150);
    });

    test('仓位不存在时应该返回 null', () => {
      const updatedPosition = positionManager.updateSlTp('non-existent', 1880, 2150);

      expect(updatedPosition).toBeNull();
    });
  });

  describe('getLiquidationRecords', () => {
    test('应该获取用户的强平记录', () => {
      const position = positionManager.updatePosition(
        'user-1',
        'XAUUSD',
        PositionDirection.LONG,
        2000,
        1,
        10,
        200
      );

      positionManager.liquidatePosition(position.id, 1900, '强平触发');

      const records = positionManager.getLiquidationRecords('user-1');

      expect(records.length).toBe(1);
      expect(records[0].userId).toBe('user-1');
      expect(records[0].reason).toBe('强平触发');
    });
  });
});