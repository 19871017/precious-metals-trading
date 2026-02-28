import { describe, test, expect, beforeEach, jest } from '@jest/globals';
import { RiskEngine, RiskCheckResult, RiskConfig } from '../services/RiskEngine';

describe('RiskEngine', () => {
  let riskEngine: RiskEngine;
  let mockQuery: any;

  beforeEach(() => {
    riskEngine = new RiskEngine();
    
    mockQuery = jest.fn();
    
    (jest as any).requireMock('../config/database').query = mockQuery;
    (jest as any).requireMock('../utils/redis').default = {
      incr: jest.fn(),
      expire: jest.fn(),
      get: jest.fn(),
      set: jest.fn(),
    };
  });

  describe('validate', () => {
    test('应该验证开仓操作', async () => {
      mockQuery.mockResolvedValue({
        rows: [
          {
            balance: 10000,
            frozen_amount: 0,
            available_balance: 10000,
          },
        ],
      });

      const request = {
        userId: 1,
        productCode: 'XAUUSD',
        operation: 'OPEN' as const,
        quantity: 1,
        leverage: 10,
        price: 2000,
        direction: 'LONG' as const,
      };

      const result = await riskEngine.validate(request);

      expect(result.passed).toBe(true);
      expect(result.riskLevel).toBe('SAFE');
    });

    test('应该验证平仓操作', async () => {
      mockQuery.mockResolvedValue({
        rows: [
          {
            balance: 10000,
            frozen_amount: 1000,
            available_balance: 9000,
          },
        ],
      });

      const request = {
        userId: 1,
        productCode: 'XAUUSD',
        operation: 'CLOSE' as const,
      };

      const result = await riskEngine.validate(request);

      expect(result.passed).toBe(true);
      expect(result.riskLevel).toBe('SAFE');
    });

    test('应该验证强平操作', async () => {
      mockQuery.mockResolvedValue({
        rows: [
          {
            balance: -100,
            frozen_amount: 0,
            available_balance: -100,
          },
        ],
      });

      const request = {
        userId: 1,
        productCode: 'XAUUSD',
        operation: 'LIQUIDATE' as const,
      };

      const result = await riskEngine.validate(request);

      expect(result.passed).toBe(true);
      expect(result.riskLevel).toBe('CRITICAL');
    });

    test('余额不足时应该拒绝', async () => {
      mockQuery.mockResolvedValue({
        rows: [
          {
            balance: 100,
            frozen_amount: 0,
            available_balance: 100,
          },
        ],
      });

      const request = {
        userId: 1,
        productCode: 'XAUUSD',
        operation: 'OPEN' as const,
        quantity: 1,
        leverage: 10,
        price: 2000,
        direction: 'LONG' as const,
      };

      const result = await riskEngine.validate(request);

      expect(result.passed).toBe(false);
      expect(result.riskLevel).toBe('DANGER');
      expect(result.errorCode).toBe('INSUFFICIENT_BALANCE');
    });

    test('杠杆超限时应该拒绝', async () => {
      mockQuery.mockResolvedValue({
        rows: [
          {
            balance: 10000,
            frozen_amount: 0,
            available_balance: 10000,
          },
        ],
      });

      const request = {
        userId: 1,
        productCode: 'XAUUSD',
        operation: 'OPEN' as const,
        quantity: 1,
        leverage: 200,
        price: 2000,
        direction: 'LONG' as const,
      };

      const result = await riskEngine.validate(request);

      expect(result.passed).toBe(false);
      expect(result.riskLevel).toBe('DANGER');
      expect(result.errorCode).toBe('LEVERAGE_EXCEEDED');
    });

    test('单笔持仓超限时应该拒绝', async () => {
      mockQuery.mockResolvedValue({
        rows: [
          {
            balance: 100000,
            frozen_amount: 0,
            available_balance: 100000,
          },
        ],
      });

      const request = {
        userId: 1,
        productCode: 'XAUUSD',
        operation: 'OPEN' as const,
        quantity: 200,
        leverage: 10,
        price: 2000,
        direction: 'LONG' as const,
      };

      const result = await riskEngine.validate(request);

      expect(result.passed).toBe(false);
      expect(result.riskLevel).toBe('DANGER');
      expect(result.errorCode).toBe('POSITION_SIZE_EXCEEDED');
    });

    test('持仓数量达上限时应该拒绝', async () => {
      mockQuery
        .mockResolvedValueOnce({
          rows: [
            {
              balance: 100000,
              frozen_amount: 0,
              available_balance: 100000,
            },
          ],
        })
        .mockResolvedValueOnce({
          rows: [{ count: '10' }],
        });

      const request = {
        userId: 1,
        productCode: 'XAUUSD',
        operation: 'OPEN' as const,
        quantity: 1,
        leverage: 10,
        price: 2000,
        direction: 'LONG' as const,
      };

      const result = await riskEngine.validate(request);

      expect(result.passed).toBe(false);
      expect(result.riskLevel).toBe('DANGER');
      expect(result.errorCode).toBe('POSITION_LIMIT_EXCEEDED');
    });

    test('高频交易应该被限流', async () => {
      mockQuery.mockResolvedValue({
        rows: [
          {
            balance: 100000,
            frozen_amount: 0,
            available_balance: 100000,
          },
        ],
      });

      const redisMock = (jest as any).requireMock('../utils/redis').default;
      redisMock.incr.mockResolvedValue(6);

      const request = {
        userId: 1,
        productCode: 'XAUUSD',
        operation: 'OPEN' as const,
        quantity: 1,
        leverage: 10,
        price: 2000,
        direction: 'LONG' as const,
      };

      const result = await riskEngine.validate(request);

      expect(result.passed).toBe(false);
      expect(result.riskLevel).toBe('WARNING');
      expect(result.errorCode).toBe('RATE_LIMIT_EXCEEDED');
    });

    test('冷却时间内应该拒绝', async () => {
      mockQuery.mockResolvedValue({
        rows: [
          {
            balance: 100000,
            frozen_amount: 0,
            available_balance: 100000,
          },
        ],
      });

      const redisMock = (jest as any).requireMock('../utils/redis').default;
      redisMock.get.mockResolvedValue(Date.now().toString());

      const request = {
        userId: 1,
        productCode: 'XAUUSD',
        operation: 'OPEN' as const,
        quantity: 1,
        leverage: 10,
        price: 2000,
        direction: 'LONG' as const,
      };

      const result = await riskEngine.validate(request);

      expect(result.passed).toBe(false);
      expect(result.riskLevel).toBe('WARNING');
      expect(result.errorCode).toBe('COOLDOWN_ACTIVE');
    });

    test('异常情况应该返回 CRITICAL', async () => {
      mockQuery.mockRejectedValue(new Error('Database error'));

      const request = {
        userId: 1,
        productCode: 'XAUUSD',
        operation: 'OPEN' as const,
        quantity: 1,
        leverage: 10,
        price: 2000,
        direction: 'LONG' as const,
      };

      const result = await riskEngine.validate(request);

      expect(result.passed).toBe(false);
      expect(result.riskLevel).toBe('CRITICAL');
      expect(result.errorCode).toBe('RISK_CHECK_ERROR');
    });
  });

  describe('getAccountEquity', () => {
    test('应该正确计算账户权益', async () => {
      mockQuery
        .mockResolvedValueOnce({
          rows: [
            {
              balance: 10000,
            },
          ],
        })
        .mockResolvedValueOnce({
          rows: [
            {
              id: 1,
              user_id: 1,
              product_id: 1,
              product_code: 'XAUUSD',
              direction: 1,
              entry_price: 2000,
              lot_size: 1,
              leverage: 10,
            },
          ],
        })
        .mockResolvedValueOnce({
          rows: [
            {
              last_price: 2010,
            },
          ],
        });

      const equity = await riskEngine.getAccountEquity(1);

      expect(equity).toBe(10010);
    });

    test('账户不存在应该抛出错误', async () => {
      mockQuery.mockResolvedValue({ rows: [] });

      await expect(riskEngine.getAccountEquity(999)).rejects.toThrow('账户不存在');
    });
  });

  describe('getPlatformRiskStats', () => {
    test('应该返回平台风险统计', async () => {
      mockQuery
        .mockResolvedValueOnce({
          rows: [{ count: '5' }],
        })
        .mockResolvedValueOnce({
          rows: [{ count: '20' }],
        })
        .mockResolvedValueOnce({
          rows: [{ total_margin: '50000' }],
        })
        .mockResolvedValueOnce({
          rows: [{ avg_margin_usage: '0.6' }],
        })
        .mockResolvedValueOnce({
          rows: [{ count: '1' }],
        });

      const stats = await riskEngine.getPlatformRiskStats();

      expect(stats.totalUsers).toBe(5);
      expect(stats.totalPositions).toBe(20);
      expect(stats.totalExposure).toBe(50000);
      expect(stats.avgMarginUsage).toBe(0.6);
      expect(stats.dangerAccounts).toBe(1);
    });
  });

  describe('config management', () => {
    test('应该更新配置', () => {
      const newConfig: Partial<RiskConfig> = {
        MAX_LEVERAGE: 50,
        MAX_POSITION_SIZE: 50,
      };

      riskEngine.updateConfig(newConfig);
      const config = riskEngine.getConfig();

      expect(config.MAX_LEVERAGE).toBe(50);
      expect(config.MAX_POSITION_SIZE).toBe(50);
    });

    test('应该返回当前配置', () => {
      const config = riskEngine.getConfig();

      expect(config).toHaveProperty('MAX_LEVERAGE');
      expect(config).toHaveProperty('MAX_POSITION_SIZE');
      expect(config).toHaveProperty('MAX_POSITION_PER_USER');
      expect(config).toHaveProperty('MIN_MARGIN_RATIO');
    });
  });

  describe('risk level calculation', () => {
    test('margin usage < 0.5 应该是 SAFE', async () => {
      mockQuery.mockResolvedValue({
        rows: [
          {
            balance: 10000,
            frozen_amount: 0,
            available_balance: 10000,
          },
        ],
      });

      const request = {
        userId: 1,
        productCode: 'XAUUSD',
        operation: 'OPEN' as const,
        quantity: 1,
        leverage: 10,
        price: 2000,
        direction: 'LONG' as const,
      };

      const result = await riskEngine.validate(request);

      expect(result.riskLevel).toBe('SAFE');
    });

    test('margin usage >= 0.5 应该是 WARNING', async () => {
      const engine = new RiskEngine({ WARNING_MARGIN_RATIO: 0.4 });

      mockQuery.mockResolvedValue({
        rows: [
          {
            balance: 10000,
            frozen_amount: 6000,
            available_balance: 4000,
          },
        ],
      });

      const request = {
        userId: 1,
        productCode: 'XAUUSD',
        operation: 'OPEN' as const,
        quantity: 1,
        leverage: 10,
        price: 200,
        direction: 'LONG' as const,
      };

      const result = await engine.validate(request);

      expect(result.riskLevel).toBe('WARNING');
    });

    test('margin usage >= 0.8 应该是 DANGER', async () => {
      const engine = new RiskEngine({ DANGER_MARGIN_RATIO: 0.7 });

      mockQuery.mockResolvedValue({
        rows: [
          {
            balance: 10000,
            frozen_amount: 8000,
            available_balance: 2000,
          },
        ],
      });

      const request = {
        userId: 1,
        productCode: 'XAUUSD',
        operation: 'OPEN' as const,
        quantity: 1,
        leverage: 10,
        price: 200,
        direction: 'LONG' as const,
      };

      const result = await engine.validate(request);

      expect(result.riskLevel).toBe('DANGER');
    });
  });
});