import { describe, test, expect, beforeAll, afterAll, jest } from '@jest/globals';
import { RiskEngine } from '../services/RiskEngine';
import { AccountService } from '../services/AccountService';
import { OrderManager, PositionManager } from '../core/OrderManager';
import { OrderType, OrderDirection, PositionDirection } from '../types';

describe('并发压力测试', () => {
  let riskEngine: RiskEngine;
  let accountService: AccountService;
  let orderManager: OrderManager;
  let positionManager: PositionManager;

  beforeAll(() => {
    riskEngine = new RiskEngine();
    accountService = new AccountService();
    positionManager = new PositionManager();
    orderManager = new OrderManager(positionManager);
  });

  afterAll(() => {
    jest.clearAllMocks();
  });

  describe('RiskEngine 并发测试', () => {
    test('应该处理 100 个并发的风控检查请求', async () => {
      const mockQuery = jest.fn();
      const redisMock = {
        incr: jest.fn(),
        expire: jest.fn(),
        get: jest.fn(),
        set: jest.fn(),
      };

      (jest as any).requireMock('../config/database').query = mockQuery;
      (jest as any).requireMock('../utils/redis').default = redisMock;

      mockQuery.mockResolvedValue({
        rows: [
          {
            balance: 10000,
            frozen_amount: 0,
            available_balance: 10000,
          },
        ],
      });

      redisMock.incr.mockResolvedValue(1);
      redisMock.get.mockResolvedValue(null);

      const requests = Array.from({ length: 100 }, (_, i) => ({
        userId: 1,
        productCode: 'XAUUSD',
        operation: 'OPEN' as const,
        quantity: 1,
        leverage: 10,
        price: 2000,
        direction: 'LONG' as const,
      }));

      const startTime = Date.now();

      const results = await Promise.all(
        requests.map(request => riskEngine.validate(request))
      );

      const duration = Date.now() - startTime;

      expect(results.length).toBe(100);
      results.forEach(result => {
        expect(result).toBeDefined();
        expect(result.passed).toBe(true);
      });

      console.log(`RiskEngine 并发处理 100 个请求耗时: ${duration}ms`);
      console.log(`平均响应时间: ${duration / 100}ms`);
    });

    test('应该正确处理高频交易限流', async () => {
      const mockQuery = jest.fn();
      const redisMock = {
        incr: jest.fn(),
        expire: jest.fn(),
        get: jest.fn(),
        set: jest.fn(),
      };

      (jest as any).requireMock('../config/database').query = mockQuery;
      (jest as any).requireMock('../utils/redis').default = redisMock;

      mockQuery.mockResolvedValue({
        rows: [
          {
            balance: 100000,
            frozen_amount: 0,
            available_balance: 100000,
          },
        ],
      });

      let callCount = 0;
      redisMock.incr.mockImplementation(async () => {
        callCount++;
        if (callCount <= 5) {
          return callCount;
        }
        return callCount;
      });

      const requests = Array.from({ length: 10 }, (_, i) => ({
        userId: 1,
        productCode: 'XAUUSD',
        operation: 'OPEN' as const,
        quantity: 1,
        leverage: 10,
        price: 2000,
        direction: 'LONG' as const,
      }));

      const results = await Promise.all(
        requests.map(request => riskEngine.validate(request))
      );

      const passedCount = results.filter(r => r.passed).length;
      const rejectedCount = results.filter(r => !r.passed && r.errorCode === 'RATE_LIMIT_EXCEEDED').length;

      expect(passedCount).toBe(5);
      expect(rejectedCount).toBe(5);
    });
  });

  describe('AccountService 并发测试', () => {
    test('应该处理 50 个并发的余额更新请求', async () => {
      const mockQuery = jest.fn();
      const mockTransaction = jest.fn();
      const mockAcquireBalanceLock = jest.fn();
      const mockReleaseLock = jest.fn();

      (jest as any).requireMock('../config/database').query = mockQuery;
      (jest as any).requireMock('../config/database').transaction = mockTransaction;
      (jest as any).requireMock('../utils/distributed-lock').acquireBalanceLock = mockAcquireBalanceLock;
      (jest as any).requireMock('../utils/distributed-lock').releaseLock = mockReleaseLock;

      const mockAuditLogService = {
        createAuditLog: jest.fn(),
      };

      (jest as any).requireMock('../services/AuditLogService').auditLogService = mockAuditLogService;

      mockAcquireBalanceLock.mockResolvedValue({ lockId: 'lock-1' });

      mockTransaction.mockImplementation(async (callback: any) => {
        const mockClient = {
          query: jest.fn(),
        };

        let balance = 10000;
        mockClient.query
          .mockImplementationOnce(async () => {
            return {
              rows: [
                {
                  user_id: 1,
                  balance,
                  available_balance: balance,
                  frozen_amount: 0,
                },
              ],
            };
          })
          .mockImplementationOnce(async () => {
            return { rows: [] };
          })
          .mockImplementation(async () => {
            balance += 1000;
            return {
              rows: [
                {
                  user_id: 1,
                  balance,
                  available_balance: balance,
                  frozen_amount: 0,
                },
              ],
            };
          });

        await callback(mockClient);
      });

      const requests = Array.from({ length: 50 }, (_, i) => ({
        userId: 1,
        amount: 1000,
        operation: `DEPOSIT_${i}`,
        description: `测试充值 ${i}`,
      }));

      const startTime = Date.now();

      const results = await Promise.all(
        requests.map(request => accountService.updateBalanceAtomic(request))
      );

      const duration = Date.now() - startTime;

      expect(results.length).toBe(50);
      results.forEach((result, index) => {
        expect(result.success).toBe(true);
        expect(result.amount).toBe(1000);
      });

      console.log(`AccountService 并发处理 50 个请求耗时: ${duration}ms`);
      console.log(`平均响应时间: ${duration / 50}ms`);
    });

    test('应该正确处理资金冻结和解冻', async () => {
      const mockQuery = jest.fn();
      const mockTransaction = jest.fn();
      const mockAcquireBalanceLock = jest.fn();
      const mockReleaseLock = jest.fn();

      (jest as any).requireMock('../config/database').query = mockQuery;
      (jest as any).requireMock('../config/database').transaction = mockTransaction;
      (jest as any).requireMock('../utils/distributed-lock').acquireBalanceLock = mockAcquireBalanceLock;
      (jest as any).requireMock('../utils/distributed-lock').releaseLock = mockReleaseLock;

      const mockAuditLogService = {
        createAuditLog: jest.fn(),
      };

      (jest as any).requireMock('../services/AuditLogService').auditLogService = mockAuditLogService;

      mockAcquireBalanceLock.mockResolvedValue({ lockId: 'lock-1' });

      mockTransaction.mockImplementation(async (callback: any) => {
        const mockClient = {
          query: jest.fn(),
        };

        mockClient.query
          .mockImplementationOnce(async () => {
            return {
              rows: [
                {
                  user_id: 1,
                  balance: 10000,
                  available_balance: 10000,
                  frozen_amount: 0,
                },
              ],
            };
          })
          .mockImplementationOnce(async () => {
            return { rows: [] };
          })
          .mockImplementation(async () => {
            return {
              rows: [
                {
                  user_id: 1,
                  balance: 10000,
                  available_balance: 8000,
                  frozen_amount: 2000,
                },
              ],
            };
          });

        await callback(mockClient);
      });

      await accountService.freezeBalanceAtomic(1, 2000, '测试冻结');

      expect(mockAcquireBalanceLock).toHaveBeenCalledWith(1);
      expect(mockAuditLogService.createAuditLog).toHaveBeenCalled();
    });
  });

  describe('OrderManager 并发测试', () => {
    test('应该处理 100 个并发的订单创建和撮合请求', async () => {
      const marketData = {
        productId: 1,
        symbol: 'XAUUSD',
        bid: 2000,
        ask: 2002,
        lastPrice: 2001,
      };

      const startTime = Date.now();

      const orders = [];
      const trades = [];

      for (let i = 0; i < 100; i++) {
        const order = orderManager.createOrder(
          `user-${i % 10}`,
          'XAUUSD',
          OrderType.MARKET,
          i % 2 === 0 ? OrderDirection.BUY : OrderDirection.SELL,
          1,
          10
        );
        orders.push(order);

        const trade = orderManager.matchOrder(order.id, marketData);
        if (trade) {
          trades.push(trade);
        }
      }

      const duration = Date.now() - startTime;

      expect(orders.length).toBe(100);
      expect(trades.length).toBe(100);

      console.log(`OrderManager 并发处理 100 个订单耗时: ${duration}ms`);
      console.log(`平均响应时间: ${duration / 100}ms`);
    });

    test('应该正确处理限价单的撮合', async () => {
      const buyOrder = orderManager.createOrder(
        'user-1',
        'XAUUSD',
        OrderType.LIMIT,
        OrderDirection.BUY,
        1,
        10,
        2050
      );

      const sellOrder = orderManager.createOrder(
        'user-2',
        'XAUUSD',
        OrderType.LIMIT,
        OrderDirection.SELL,
        1,
        10,
        2050
      );

      const marketDataBelowLimit = {
        productId: 1,
        symbol: 'XAUUSD',
        bid: 2048,
        ask: 2050,
        lastPrice: 2049,
      };

      const marketDataAboveLimit = {
        productId: 1,
        symbol: 'XAUUSD',
        bid: 2052,
        ask: 2054,
        lastPrice: 2053,
      };

      let buyTrade = orderManager.matchOrder(buyOrder.id, marketDataBelowLimit);
      let sellTrade = orderManager.matchOrder(sellOrder.id, marketDataAboveLimit);

      expect(buyTrade).toBeDefined();
      expect(sellTrade).toBeDefined();
    });
  });

  describe('PositionManager 并发测试', () => {
    test('应该处理 100 个并发的仓位更新请求', async () => {
      const startTime = Date.now();

      const positions = [];

      for (let i = 0; i < 100; i++) {
        const position = positionManager.updatePosition(
          `user-${i % 10}`,
          'XAUUSD',
          i % 2 === 0 ? PositionDirection.LONG : PositionDirection.SHORT,
          2000 + (i % 100),
          1,
          10,
          200
        );
        positions.push(position);
      }

      const duration = Date.now() - startTime;

      expect(positions.length).toBe(100);

      console.log(`PositionManager 并发处理 100 个仓位更新耗时: ${duration}ms`);
      console.log(`平均响应时间: ${duration / 100}ms`);
    });

    test('应该正确合并同方向仓位', async () => {
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
    });
  });

  describe('综合性能测试', () => {
    test('应该处理混合的并发请求', async () => {
      const mockQuery = jest.fn();
      const mockTransaction = jest.fn();
      const mockAcquireBalanceLock = jest.fn();
      const mockReleaseLock = jest.fn();
      const redisMock = {
        incr: jest.fn(),
        expire: jest.fn(),
        get: jest.fn(),
        set: jest.fn(),
      };

      (jest as any).requireMock('../config/database').query = mockQuery;
      (jest as any).requireMock('../config/database').transaction = mockTransaction;
      (jest as any).requireMock('../utils/distributed-lock').acquireBalanceLock = mockAcquireBalanceLock;
      (jest as any).requireMock('../utils/distributed-lock').releaseLock = mockReleaseLock;
      (jest as any).requireMock('../utils/redis').default = redisMock;

      const mockAuditLogService = {
        createAuditLog: jest.fn(),
      };

      (jest as any).requireMock('../services/AuditLogService').auditLogService = mockAuditLogService;

      mockAcquireBalanceLock.mockResolvedValue({ lockId: 'lock-1' });
      mockQuery.mockResolvedValue({
        rows: [
          {
            balance: 100000,
            frozen_amount: 0,
            available_balance: 100000,
          },
        ],
      });
      mockTransaction.mockImplementation(async (callback: any) => {
        const mockClient = {
          query: jest.fn(),
        };

        let balance = 100000;
        mockClient.query
          .mockImplementationOnce(async () => {
            return {
              rows: [
                {
                  user_id: 1,
                  balance,
                  available_balance: balance,
                  frozen_amount: 0,
                },
              ],
            };
          })
          .mockImplementationOnce(async () => {
            return { rows: [] };
          })
          .mockImplementation(async () => {
            return {
              rows: [
                {
                  user_id: 1,
                  balance,
                  available_balance: balance,
                  frozen_amount: 0,
                },
              ],
            };
          });

        await callback(mockClient);
      });
      redisMock.incr.mockResolvedValue(1);
      redisMock.get.mockResolvedValue(null);

      const startTime = Date.now();

      const tasks = [];

      for (let i = 0; i < 50; i++) {
        tasks.push(riskEngine.validate({
          userId: 1,
          productCode: 'XAUUSD',
          operation: 'OPEN' as const,
          quantity: 1,
          leverage: 10,
          price: 2000,
          direction: 'LONG' as const,
        }));

        tasks.push(accountService.updateBalanceAtomic({
          userId: 1,
          amount: 1000,
          operation: 'DEPOSIT',
        }));
      }

      const results = await Promise.all(tasks);

      const duration = Date.now() - startTime;

      expect(results.length).toBe(100);

      console.log(`综合并发处理 100 个混合请求耗时: ${duration}ms`);
      console.log(`平均响应时间: ${duration / 100}ms`);
    });
  });
});