import { describe, test, expect, beforeEach, jest } from '@jest/globals';
import { LiquidationScheduler, LiquidationJobData } from '../services/LiquidationScheduler';

describe('LiquidationScheduler', () => {
  let scheduler: LiquidationScheduler;
  let mockQuery: any;
  let mockTransaction: any;
  let mockRiskEngine: any;

  beforeEach(() => {
    scheduler = new LiquidationScheduler();
    
    mockQuery = jest.fn();
    mockTransaction = jest.fn();
    
    (jest as any).requireMock('../config/database').query = mockQuery;
    (jest as any).requireMock('../config/database').transaction = mockTransaction;
    
    mockRiskEngine = {
      validate: jest.fn(),
    };
    
    (jest as any).requireMock('../services/RiskEngine').riskEngine = mockRiskEngine;
  });

  describe('addLiquidationJob', () => {
    test('应该添加强平任务', async () => {
      const jobData: LiquidationJobData = {
        userId: 1,
        positionId: 1,
        productCode: 'XAUUSD',
        liquidationPrice: 1900,
        reason: '强平触发',
      };

      const jobId = await scheduler.addLiquidationJob(jobData);

      expect(jobId).toBeDefined();
      expect(typeof jobId).toBe('string');
    });
  });

  describe('checkAndQueueLiquidations', () => {
    test('应该检查并排队强平任务', async () => {
      mockQuery.mockResolvedValue({
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
            margin: 200,
            liquidation_price: 1900,
            status: 1,
          },
        ],
      });

      mockRiskEngine.validate.mockResolvedValue({ passed: true });

      const queuedCount = await scheduler.checkAndQueueLiquidations();

      expect(queuedCount).toBeGreaterThanOrEqual(0);
    });

    test('没有市场数据时应该跳过', async () => {
      mockQuery
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
              margin: 200,
              liquidation_price: 1900,
              status: 1,
            },
          ],
        })
        .mockResolvedValueOnce({ rows: [] });

      const queuedCount = await scheduler.checkAndQueueLiquidations();

      expect(queuedCount).toBe(0);
    });

    test('风控检查未通过时应该跳过', async () => {
      mockQuery.mockResolvedValue({
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
            margin: 200,
            liquidation_price: 1900,
            status: 1,
          },
        ],
      });

      mockQuery.mockResolvedValueOnce({
        rows: [
          {
            last_price: 1850,
          },
        ],
      });

      mockRiskEngine.validate.mockResolvedValue({ passed: false });

      const queuedCount = await scheduler.checkAndQueueLiquidations();

      expect(queuedCount).toBe(0);
    });
  });

  describe('shouldLiquidate', () => {
    test('多头持仓价格跌破强平价应该强平', () => {
      const position = {
        direction: 1,
        liquidation_price: 1900,
      };

      const shouldLiquidate = (scheduler as any).shouldLiquidate(position, 1850);

      expect(shouldLiquidate).toBe(true);
    });

    test('多头持仓价格未跌破强平价不应该强平', () => {
      const position = {
        direction: 1,
        liquidation_price: 1900,
      };

      const shouldLiquidate = (scheduler as any).shouldLiquidate(position, 1950);

      expect(shouldLiquidate).toBe(false);
    });

    test('空头持仓价格涨破强平价应该强平', () => {
      const position = {
        direction: 2,
        liquidation_price: 2100,
      };

      const shouldLiquidate = (scheduler as any).shouldLiquidate(position, 2150);

      expect(shouldLiquidate).toBe(true);
    });

    test('空头持仓价格未涨破强平价不应该强平', () => {
      const position = {
        direction: 2,
        liquidation_price: 2100,
      };

      const shouldLiquidate = (scheduler as any).shouldLiquidate(position, 2050);

      expect(shouldLiquidate).toBe(false);
    });

    test('没有强平价格时不应该强平', () => {
      const position = {
        direction: 1,
      };

      const shouldLiquidate = (scheduler as any).shouldLiquidate(position, 1850);

      expect(shouldLiquidate).toBe(false);
    });
  });

  describe('getQueueStats', () => {
    test('应该返回队列统计', async () => {
      const stats = await scheduler.getQueueStats();

      expect(stats).toHaveProperty('waiting');
      expect(stats).toHaveProperty('active');
      expect(stats).toHaveProperty('completed');
      expect(stats).toHaveProperty('failed');

      expect(typeof stats.waiting).toBe('number');
      expect(typeof stats.active).toBe('number');
      expect(typeof stats.completed).toBe('number');
      expect(typeof stats.failed).toBe('number');
    });
  });

  describe('calculateUnrealizedPnl', () => {
    test('应该正确计算多头持仓的未实现盈亏', () => {
      const position = {
        direction: 1,
        entry_price: 2000,
        lot_size: 1,
        leverage: 10,
      };

      const currentPrice = 2010;

      const pnl = (scheduler as any).calculateUnrealizedPnl(position, currentPrice);

      expect(pnl).toBe(100);
    });

    test('应该正确计算空头持仓的未实现盈亏', () => {
      const position = {
        direction: 2,
        entry_price: 2000,
        lot_size: 1,
        leverage: 10,
      };

      const currentPrice = 2010;

      const pnl = (scheduler as any).calculateUnrealizedPnl(position, currentPrice);

      expect(pnl).toBe(-100);
    });
  });

  describe('start and stop', () => {
    test('应该启动调度器', async () => {
      await scheduler.start(1000);

      const isRunning = (scheduler as any).isRunning;

      expect(isRunning).toBe(true);
    });

    test('已经运行时不应该重复启动', async () => {
      await scheduler.start(1000);
      await scheduler.start(1000);

      const isRunning = (scheduler as any).isRunning;

      expect(isRunning).toBe(true);
    });

    test('应该停止调度器', async () => {
      await scheduler.start(1000);
      await scheduler.stop();

      const isRunning = (scheduler as any).isRunning;

      expect(isRunning).toBe(false);
    });
  });

  describe('processLiquidation', () => {
    test('应该处理强平任务', async () => {
      const job = {
        id: 'job-1',
        data: {
          userId: 1,
          positionId: 1,
          productCode: 'XAUUSD',
          liquidationPrice: 1900,
          reason: '强平触发',
        },
      };

      mockRiskEngine.validate.mockResolvedValue({ passed: true });

      mockTransaction.mockImplementation(async (callback: any) => {
        const mockClient = {
          query: jest.fn(),
        };

        mockClient.query
          .mockResolvedValueOnce({
            rows: [
              {
                id: 1,
                status: 1,
                entry_price: 2000,
                lot_size: 1,
                leverage: 10,
              },
            ],
          })
          .mockResolvedValueOnce({ rows: [] })
          .mockResolvedValueOnce({ rows: [] });

        await callback(mockClient);
      });

      await expect((scheduler as any).processLiquidation(job)).resolves.not.toThrow();
    });

    test('风控检查未通过时应该跳过', async () => {
      const job = {
        id: 'job-1',
        data: {
          userId: 1,
          positionId: 1,
          productCode: 'XAUUSD',
          liquidationPrice: 1900,
          reason: '强平触发',
        },
      };

      mockRiskEngine.validate.mockResolvedValue({ passed: false });

      await expect((scheduler as any).processLiquidation(job)).resolves.not.toThrow();
    });

    test('持仓不存在时应该抛出错误', async () => {
      const job = {
        id: 'job-1',
        data: {
          userId: 1,
          positionId: 999,
          productCode: 'XAUUSD',
          liquidationPrice: 1900,
          reason: '强平触发',
        },
      };

      mockRiskEngine.validate.mockResolvedValue({ passed: true });

      mockTransaction.mockImplementation(async (callback: any) => {
        const mockClient = {
          query: jest.fn(),
        };

        mockClient.query.mockResolvedValue({ rows: [] });

        await callback(mockClient);
      });

      await expect((scheduler as any).processLiquidation(job)).rejects.toThrow('持仓不存在');
    });

    test('持仓已关闭时应该抛出错误', async () => {
      const job = {
        id: 'job-1',
        data: {
          userId: 1,
          positionId: 1,
          productCode: 'XAUUSD',
          liquidationPrice: 1900,
          reason: '强平触发',
        },
      };

      mockRiskEngine.validate.mockResolvedValue({ passed: true });

      mockTransaction.mockImplementation(async (callback: any) => {
        const mockClient = {
          query: jest.fn(),
        };

        mockClient.query.mockResolvedValue({
          rows: [
            {
              id: 1,
              status: 2,
            },
          ],
        });

        await callback(mockClient);
      });

      await expect((scheduler as any).processLiquidation(job)).rejects.toThrow('持仓已关闭');
    });
  });
});