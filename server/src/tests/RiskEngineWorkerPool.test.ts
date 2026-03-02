import { jest, describe, beforeEach, test, expect } from '@jest/globals';

const workerInstances: any[] = [];

jest.mock('bullmq', () => {
  return {
    Worker: jest.fn().mockImplementation((queueName: string, processor: any) => {
      const instance = {
        queueName,
        processor,
        close: jest.fn().mockResolvedValue(undefined),
        on: jest.fn(),
      };
      workerInstances.push(instance);
      return instance;
    }),
    Job: jest.fn(),
  };
});

import { RiskEngineWorkerPool, RiskCheckJobData } from '../services/RiskEngineWorkerPool';

describe('RiskEngineWorkerPool', () => {
  beforeEach(() => {
    workerInstances.length = 0;
    jest.clearAllMocks();
  });

  test('start 应该创建配置数量的 worker 并执行处理器', async () => {
    const pool = new RiskEngineWorkerPool({ workerCount: 2, concurrency: 1 });
    const processor = jest.fn().mockResolvedValue({
      success: true,
      passed: true,
      riskLevel: 'SAFE',
      message: 'ok',
    });

    await pool.start(processor);

    expect(workerInstances.length).toBe(2);
    expect(pool.getStatus()).toMatchObject({ isRunning: true, workerCount: 2 });

    const mockJob = { id: 'job-1', data: { userId: '1' } } as any;
    await workerInstances[0].processor(mockJob);
    expect(processor).toHaveBeenCalledWith(mockJob);

    // 再次调用 start 不应重复创建
    await pool.start(processor);
    expect(workerInstances.length).toBe(2);
  });

  test('stop 应该关闭所有 worker 并重置状态', async () => {
    const pool = new RiskEngineWorkerPool({ workerCount: 1 });
    await pool.start(jest.fn().mockResolvedValue({ success: true, passed: true, riskLevel: 'SAFE', message: 'ok' }));

    await pool.stop();
    expect(workerInstances[0].close).toHaveBeenCalled();
    expect(pool.getStatus().isRunning).toBe(false);

    // 未运行时调用 stop 应记录警告但不抛错
    await pool.stop();
    expect(pool.getStatus().workerCount).toBe(0);
  });

  test('updateConfig 与 restart 应该更新配置并重新启动', async () => {
    const pool = new RiskEngineWorkerPool({ workerCount: 1, concurrency: 1 });
    const processor = jest.fn().mockResolvedValue({ success: true, passed: true, riskLevel: 'SAFE', message: 'ok' });

    await pool.start(processor);
    pool.updateConfig({ concurrency: 5, workerCount: 1 });

    await pool.restart();
    expect(pool.getStatus().isRunning).toBe(true);

    await pool.restart(processor);
    expect(pool.getStatus().workerCount).toBeGreaterThan(0);
  });
});
