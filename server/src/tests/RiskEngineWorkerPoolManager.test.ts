import { jest, describe, beforeEach, test, expect } from '@jest/globals';

const mockWorkerPool = {
  start: jest.fn(),
  stop: jest.fn(),
  getStatus: jest.fn().mockReturnValue({ running: true }),
  getQueueStats: jest.fn(),
};

const mockQueueProducer = {
  initialize: jest.fn(),
  close: jest.fn(),
  getQueueName: jest.fn().mockReturnValue('risk-engine:queue'),
  getQueueStats: jest.fn().mockResolvedValue({ waiting: 0 }),
  pause: jest.fn(),
  resume: jest.fn(),
  drain: jest.fn(),
};

const mockRiskEngine = {
  validate: jest.fn(),
};

jest.mock('../services/RiskEngineWorkerPool', () => ({
  riskEngineWorkerPool: mockWorkerPool,
}));

jest.mock('../services/RiskEngineQueueProducer', () => ({
  riskEngineQueueProducer: mockQueueProducer,
}));

jest.mock('../services/RiskEngine', () => ({
  riskEngine: mockRiskEngine,
}));

import { RiskEngineWorkerPoolManager } from '../services/RiskEngineWorkerPoolManager';

describe('RiskEngineWorkerPoolManager', () => {
  let manager: RiskEngineWorkerPoolManager;

  beforeEach(() => {
    jest.clearAllMocks();
    manager = new RiskEngineWorkerPoolManager();
  });

  test('initialize 应该初始化队列并启动 worker pool', async () => {
    mockWorkerPool.start.mockResolvedValue(undefined);
    mockQueueProducer.initialize.mockResolvedValue(undefined);
    mockRiskEngine.validate.mockResolvedValue({
      passed: true,
      riskLevel: 'SAFE',
      message: 'ok',
    });

    await manager.initialize();

    expect(mockQueueProducer.initialize).toHaveBeenCalled();
    expect(mockWorkerPool.start).toHaveBeenCalled();

    // 捕获处理器执行成功
    const processor = mockWorkerPool.start.mock.calls[0][0];
    const job = { data: { userId: '1', productCode: 'XAUUSD', operation: 'OPEN' } };
    const result = await processor(job);
    expect(result.success).toBe(true);

    // 再次初始化应跳过
    await manager.initialize();
    expect(mockWorkerPool.start).toHaveBeenCalledTimes(1);
  });

  test('处理器在风控失败时返回错误结果', async () => {
    mockQueueProducer.initialize.mockResolvedValue(undefined);
    mockWorkerPool.start.mockResolvedValue(undefined);
    mockRiskEngine.validate.mockRejectedValue(new Error('invalid'));

    await manager.initialize();

    const processor = mockWorkerPool.start.mock.calls[0][0];
    const result = await processor({ data: { userId: '1', operation: 'OPEN' } });
    expect(result.success).toBe(false);
    expect(result.errorCode).toBe('RISK_CHECK_ERROR');
  });

  test('stop 应该停止 worker pool 并关闭队列', async () => {
    mockQueueProducer.initialize.mockResolvedValue(undefined);
    mockWorkerPool.start.mockResolvedValue(undefined);
    mockRiskEngine.validate.mockResolvedValue({
      passed: true,
      riskLevel: 'SAFE',
      message: 'ok',
    });

    await manager.initialize();
    await manager.stop();

    expect(mockWorkerPool.stop).toHaveBeenCalled();
    expect(mockQueueProducer.close).toHaveBeenCalled();

    // 未初始化时调用 stop 只发出警告
    await manager.stop();
  });

  test('队列相关操作在未初始化时应抛出错误', async () => {
    await expect(manager.getQueueStats()).rejects.toThrow('未初始化');
    await expect(manager.pauseQueue()).rejects.toThrow('未初始化');
    await expect(manager.resumeQueue()).rejects.toThrow('未初始化');
    await expect(manager.drainQueue()).rejects.toThrow('未初始化');
  });

  test('队列相关操作在初始化后应调用底层实现', async () => {
    mockQueueProducer.initialize.mockResolvedValue(undefined);
    mockWorkerPool.start.mockResolvedValue(undefined);
    mockRiskEngine.validate.mockResolvedValue({
      passed: true,
      riskLevel: 'SAFE',
      message: 'ok',
    });

    await manager.initialize();

    await manager.getQueueStats();
    await manager.pauseQueue();
    await manager.resumeQueue();
    await manager.drainQueue();

    expect(mockQueueProducer.getQueueStats).toHaveBeenCalled();
    expect(mockQueueProducer.pause).toHaveBeenCalled();
    expect(mockQueueProducer.resume).toHaveBeenCalled();
    expect(mockQueueProducer.drain).toHaveBeenCalled();
  });
});
