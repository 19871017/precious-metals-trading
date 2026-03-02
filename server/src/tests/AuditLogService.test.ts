import { describe, beforeEach, test, expect, jest } from '@jest/globals';
import { AuditLogService, AuditOperation } from '../services/AuditLogService';
import { query } from '../config/database';

const queryMock = query as unknown as jest.Mock;

describe('AuditLogService', () => {
  let service: AuditLogService;

  beforeEach(() => {
    service = new AuditLogService();
    queryMock.mockReset();
  });

  test('createAuditLog 应写入 audit_logs 表', async () => {
    const client = { query: jest.fn().mockResolvedValue({ rows: [] }) };
    await service.createAuditLog(client as any, {
      userId: 1,
      operation: AuditOperation.DEPOSIT,
      amount: 100,
      beforeBalance: 1000,
      afterBalance: 1100,
    });

    expect(client.query).toHaveBeenCalled();
  });

  test('查询 API 应返回数据库结果', async () => {
    queryMock.mockResolvedValueOnce({ rows: [{ id: 1, user_id: 1 }] });
    const result = await service.getAuditLogsByUser(1, 10, 0);
    expect(result).toHaveLength(1);

    queryMock.mockResolvedValueOnce({ rows: [{ id: 2, operation_type: 'TEST' }] });
    await service.getAuditLogsByOperation('TEST');

    queryMock.mockResolvedValueOnce({ rows: [{ id: 3 }] });
    await service.getAuditLogsByOrder(1);

    queryMock.mockResolvedValueOnce({ rows: [{ id: 4 }] });
    await service.getAuditLogsByPosition(1);
  });

  test('getAuditLogSummary 应聚合不同操作', async () => {
    queryMock.mockResolvedValueOnce({
      rows: [
        { operation_type: AuditOperation.DEPOSIT, total_amount: '100', last_operation_time: new Date() },
        { operation_type: AuditOperation.WITHDRAW, total_amount: '50', last_operation_time: new Date() },
        { operation_type: AuditOperation.COMMISSION, total_amount: '5', last_operation_time: new Date() },
        { operation_type: AuditOperation.PROFIT_LOSS, total_amount: '20', last_operation_time: new Date() },
      ],
    });

    const summary = await service.getAuditLogSummary(1);
    expect(summary.totalDeposits).toBe(100);
    expect(summary.totalWithdraws).toBe(50);
    expect(summary.totalCommissions).toBe(5);
    expect(summary.totalProfitLoss).toBe(20);
    expect(summary.lastOperationTime).not.toBeNull();
  });
});
