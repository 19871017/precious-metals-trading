import { describe, beforeEach, test, expect, jest } from '@jest/globals';
import { transaction } from '../config/database';

const queueAdd = jest.fn().mockResolvedValue({ id: 'job-1' });
const queueCounts = {
  getWaitingCount: jest.fn().mockResolvedValue(1),
  getActiveCount: jest.fn().mockResolvedValue(0),
  getCompletedCount: jest.fn().mockResolvedValue(0),
  getFailedCount: jest.fn().mockResolvedValue(0),
  getDelayedCount: jest.fn().mockResolvedValue(0),
  close: jest.fn().mockResolvedValue(undefined),
};
const workerClose = jest.fn().mockResolvedValue(undefined);

jest.mock('bullmq', () => ({
  Queue: jest.fn().mockImplementation(() => ({
    add: queueAdd,
    ...queueCounts,
    close: queueCounts.close,
  })),
  Worker: jest.fn().mockImplementation(() => ({
    on: jest.fn(),
    close: workerClose,
  })),
  Job: jest.fn(),
}));

jest.mock('../utils/distributed-lock', () => ({
  acquirePositionLock: jest.fn().mockResolvedValue({ lockId: 'lock' }),
  releaseLock: jest.fn().mockResolvedValue(undefined),
}));

jest.mock('../services/AuditLogService', () => ({
  auditLogService: {
    createAuditLog: jest.fn().mockResolvedValue(undefined),
  },
}));

import { LiquidationScheduler } from '../services/LiquidationSchedulerV2';
import { acquirePositionLock, releaseLock } from '../utils/distributed-lock';

const transactionMock = transaction as unknown as jest.Mock;

describe('LiquidationSchedulerV2', () => {
  let scheduler: LiquidationScheduler;

  beforeEach(() => {
    jest.clearAllMocks();
    scheduler = new LiquidationScheduler(1000);
  });

  test('addLiquidationJob 应调用队列', async () => {
    const jobId = await scheduler.addLiquidationJob({
      userId: 1,
      positionId: 1,
      productCode: 'XAUUSD',
      liquidationPrice: 1800,
      reason: 'test',
    });

    expect(queueAdd).toHaveBeenCalled();
    expect(jobId).toBe('job-1');
  });

  test('shouldLiquidate 与 calculateUnrealizedPnl 覆盖多头/空头逻辑', () => {
    const longPosition = { direction: 1, liquidation_price: 1900, entry_price: 2000, lot_size: 1, leverage: 10 };
    const shortPosition = { direction: 2, liquidation_price: 2100, entry_price: 2000, lot_size: 1, leverage: 5 };

    expect((scheduler as any).shouldLiquidate(longPosition, 1850)).toBe(true);
    expect((scheduler as any).shouldLiquidate(shortPosition, 2200)).toBe(true);

    const longPnl = (scheduler as any).calculateUnrealizedPnl(longPosition, 2050);
    const shortPnl = (scheduler as any).calculateUnrealizedPnl(shortPosition, 1950);

    expect(longPnl).toBeGreaterThan(0);
    expect(shortPnl).toBeGreaterThan(0);
  });

  test('processLiquidation 应获取锁并执行内部逻辑', async () => {
    const executeSpy = jest
      .spyOn(scheduler as any, 'executeLiquidationInternal')
      .mockResolvedValue(undefined);

    await (scheduler as any).processLiquidation({
      data: {
        userId: 1,
        positionId: 2,
        productCode: 'XAUUSD',
        liquidationPrice: 1900,
        reason: 'test',
      },
    });

    expect(acquirePositionLock).toHaveBeenCalledWith(2, 1);
    expect(executeSpy).toHaveBeenCalled();
    expect(releaseLock).toHaveBeenCalled();
  });

  test('executeLiquidationInternal 应更新数据库并记录日志', async () => {
    const mockClient = {
      query: jest.fn()
        .mockResolvedValueOnce({ rows: [{ id: 2, status: 1, margin: 100, direction: 1, entry_price: 2000, lot_size: 1 }] })
        .mockResolvedValueOnce({ rows: [{ id: 2, status: 2 }] })
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [{ id: 99 }] }),
    };

    transactionMock.mockImplementationOnce(async (callback: any) => {
      await callback(mockClient);
    });

    await (scheduler as any).executeLiquidationInternal(1, 2, 1900, 'test');

    expect(mockClient.query).toHaveBeenCalled();
  });

  test('getQueueStats 应返回队列统计', async () => {
    const stats = await scheduler.getQueueStats();
    expect(stats.waiting).toBe(1);
    expect(queueCounts.getWaitingCount).toHaveBeenCalled();
  });
});
