import { describe, beforeEach, test, expect, jest } from '@jest/globals';
import { query } from '../config/database';

const queueAdd = jest.fn().mockResolvedValue({ id: 'priority-job' });
const queueClose = jest.fn().mockResolvedValue(undefined);
const workerClose = jest.fn().mockResolvedValue(undefined);

jest.mock('bullmq', () => ({
  Queue: jest.fn().mockImplementation(() => ({
    add: queueAdd,
    close: queueClose,
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
  auditLogService: { createAuditLog: jest.fn().mockResolvedValue(undefined) },
}));

import { LiquidationPriorityScheduler } from '../services/LiquidationPriorityScheduler';
import { acquirePositionLock } from '../utils/distributed-lock';

const queryMock = query as unknown as jest.Mock;

describe('LiquidationPriorityScheduler', () => {
  let scheduler: LiquidationPriorityScheduler;

  beforeEach(() => {
    scheduler = new LiquidationPriorityScheduler(1000);
    queueAdd.mockClear();
    queueClose.mockClear();
    workerClose.mockClear();
    queryMock.mockReset();
    (acquirePositionLock as jest.Mock).mockClear();
  });

  test('start/stop 应该管理定时器与 worker', async () => {
    await scheduler.start();
    await scheduler.stop();
    expect(workerClose).toHaveBeenCalled();
    expect(queueClose).toHaveBeenCalled();
  });

  test('scanRiskAccounts 应构建风险账户列表', async () => {
    queryMock
      .mockResolvedValueOnce({
        rows: [{ user_id: 1, balance: 1000, available_balance: 500, frozen_amount: 400 }],
      })
      .mockResolvedValueOnce({
        rows: [
          {
            position_id: 10,
            product_code: 'XAUUSD',
            liquidation_price: 1900,
            margin: 100,
            direction: 1,
          },
        ],
      })
      .mockResolvedValueOnce({
        rows: [{ last_price: 1850 }],
      });

    const accounts = await (scheduler as any).scanRiskAccounts();
    expect(accounts).toHaveLength(1);
    expect(accounts[0].positions[0].shouldLiquidate).toBe(true);
  });

  test('queuePriorityLiquidations 应根据风险级别添加任务', async () => {
    const queued = await (scheduler as any).queuePriorityLiquidations([
      {
        userId: 1,
        riskLevel: 'CRITICAL',
        marginUsage: 0.95,
        positions: [
          { positionId: 10, productCode: 'XAUUSD', liquidationPrice: 1900, margin: 100, shouldLiquidate: true },
        ],
      },
    ]);

    expect(queued).toBe(1);
    expect(queueAdd).toHaveBeenCalled();
  });

  test('processPriorityLiquidation 应处理任务并释放锁', async () => {
    const executeSpy = jest
      .spyOn(scheduler as any, 'executePriorityLiquidation')
      .mockResolvedValue(undefined);

    await (scheduler as any).processPriorityLiquidation({
      data: {
        userId: 1,
        positionId: 10,
        productCode: 'XAUUSD',
        liquidationPrice: 1800,
        reason: 'test',
        priority: 1,
        marginUsage: 0.9,
      },
    });

    expect(acquirePositionLock).toHaveBeenCalledWith(10, 1);
    expect(executeSpy).toHaveBeenCalled();
  });
});
