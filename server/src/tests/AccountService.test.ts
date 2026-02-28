import { describe, test, expect, beforeEach, jest } from '@jest/globals';
import { AccountService, BalanceUpdateResult, BalanceUpdateRequest } from '../services/AccountService';

describe('AccountService', () => {
  let accountService: AccountService;
  let mockQuery: any;
  let mockTransaction: any;
  let mockAcquireBalanceLock: any;
  let mockReleaseLock: any;
  let mockAuditLogService: any;

  beforeEach(() => {
    accountService = new AccountService();
    
    mockQuery = jest.fn();
    mockTransaction = jest.fn();
    mockAcquireBalanceLock = jest.fn();
    mockReleaseLock = jest.fn();
    
    (jest as any).requireMock('../config/database').query = mockQuery;
    (jest as any).requireMock('../config/database').transaction = mockTransaction;
    (jest as any).requireMock('../utils/distributed-lock').acquireBalanceLock = mockAcquireBalanceLock;
    (jest as any).requireMock('../utils/distributed-lock').releaseLock = mockReleaseLock;
    
    mockAuditLogService = {
      createAuditLog: jest.fn(),
    };
    
    (jest as any).requireMock('../services/AuditLogService').auditLogService = mockAuditLogService;
  });

  describe('updateBalanceAtomic', () => {
    test('应该成功更新余额', async () => {
      mockAcquireBalanceLock.mockResolvedValue({ lockId: 'lock-1' });
      mockTransaction.mockImplementation(async (callback: any) => {
        const mockClient = {
          query: jest.fn(),
        };

        mockClient.query
          .mockResolvedValueOnce({
            rows: [
              {
                user_id: 1,
                balance: 10000,
                available_balance: 10000,
                frozen_amount: 0,
              },
            ],
          })
          .mockResolvedValueOnce({ rows: [] })
          .mockResolvedValueOnce({
            rows: [
              {
                user_id: 1,
                balance: 11000,
                available_balance: 11000,
                frozen_amount: 0,
              },
            ],
          });

        await callback(mockClient);
      });

      const request: BalanceUpdateRequest = {
        userId: 1,
        amount: 1000,
        operation: 'DEPOSIT',
        description: '充值',
      };

      const result = await accountService.updateBalanceAtomic(request);

      expect(result.success).toBe(true);
      expect(result.userId).toBe(1);
      expect(result.amount).toBe(1000);
      expect(result.beforeBalance).toBe(10000);
      expect(result.afterBalance).toBe(11000);
      expect(mockAcquireBalanceLock).toHaveBeenCalledWith(1);
      expect(mockReleaseLock).toHaveBeenCalled();
    });

    test('获取锁失败时应该抛出错误', async () => {
      mockAcquireBalanceLock.mockResolvedValue(null);

      const request: BalanceUpdateRequest = {
        userId: 1,
        amount: 1000,
        operation: 'DEPOSIT',
      };

      await expect(accountService.updateBalanceAtomic(request)).rejects.toThrow('获取余额锁失败,请稍后重试');
    });

    test('余额不足时应该拒绝', async () => {
      mockAcquireBalanceLock.mockResolvedValue({ lockId: 'lock-1' });
      mockTransaction.mockImplementation(async (callback: any) => {
        const mockClient = {
          query: jest.fn(),
        };

        mockClient.query.mockResolvedValue({
          rows: [
            {
              user_id: 1,
              balance: 100,
              available_balance: 100,
              frozen_amount: 0,
            },
          ],
        });

        await callback(mockClient);
      });

      const request: BalanceUpdateRequest = {
        userId: 1,
        amount: -1000,
        operation: 'WITHDRAW',
        strictMode: true,
      };

      await expect(accountService.updateBalanceAtomic(request)).rejects.toThrow('余额不足');
    });

    test('账户不存在时应该抛出错误', async () => {
      mockAcquireBalanceLock.mockResolvedValue({ lockId: 'lock-1' });
      mockTransaction.mockImplementation(async (callback: any) => {
        const mockClient = {
          query: jest.fn(),
        };

        mockClient.query.mockResolvedValue({ rows: [] });

        await callback(mockClient);
      });

      const request: BalanceUpdateRequest = {
        userId: 999,
        amount: 1000,
        operation: 'DEPOSIT',
      };

      await expect(accountService.updateBalanceAtomic(request)).rejects.toThrow('账户不存在');
    });

    test('余额差异超出阈值时应该拒绝', async () => {
      mockAcquireBalanceLock.mockResolvedValue({ lockId: 'lock-1' });
      mockTransaction.mockImplementation(async (callback: any) => {
        const mockClient = {
          query: jest.fn(),
        };

        mockClient.query
          .mockResolvedValueOnce({
            rows: [
              {
                user_id: 1,
                balance: 10000,
                available_balance: 10000,
                frozen_amount: 0,
              },
            ],
          })
          .mockResolvedValueOnce({ rows: [] })
          .mockResolvedValue({
            rows: [
              {
                user_id: 1,
                balance: 15000,
                available_balance: 15000,
                frozen_amount: 0,
              },
            ],
          });

        await callback(mockClient);
      });

      const request: BalanceUpdateRequest = {
        userId: 1,
        amount: 1000,
        operation: 'DEPOSIT',
        strictMode: true,
      };

      await expect(accountService.updateBalanceAtomic(request)).rejects.toThrow('余额差异异常');
    });

    test('非严格模式下允许负余额', async () => {
      mockAcquireBalanceLock.mockResolvedValue({ lockId: 'lock-1' });
      mockTransaction.mockImplementation(async (callback: any) => {
        const mockClient = {
          query: jest.fn(),
        };

        mockClient.query
          .mockResolvedValueOnce({
            rows: [
              {
                user_id: 1,
                balance: 100,
                available_balance: 100,
                frozen_amount: 0,
              },
            ],
          })
          .mockResolvedValueOnce({ rows: [] })
          .mockResolvedValue({
            rows: [
              {
                user_id: 1,
                balance: -500,
                available_balance: -500,
                frozen_amount: 0,
              },
            ],
          });

        await callback(mockClient);
      });

      const request: BalanceUpdateRequest = {
        userId: 1,
        amount: -600,
        operation: 'WITHDRAW',
        strictMode: false,
      };

      const result = await accountService.updateBalanceAtomic(request);

      expect(result.success).toBe(true);
      expect(result.afterBalance).toBe(-500);
    });
  });

  describe('freezeBalanceAtomic', () => {
    test('应该成功冻结资金', async () => {
      mockAcquireBalanceLock.mockResolvedValue({ lockId: 'lock-1' });
      mockTransaction.mockImplementation(async (callback: any) => {
        const mockClient = {
          query: jest.fn(),
        };

        mockClient.query
          .mockResolvedValueOnce({
            rows: [
              {
                user_id: 1,
                balance: 10000,
                available_balance: 10000,
                frozen_amount: 0,
              },
            ],
          })
          .mockResolvedValueOnce({ rows: [] })
          .mockResolvedValue({
            rows: [
              {
                user_id: 1,
                balance: 10000,
                available_balance: 8000,
                frozen_amount: 2000,
              },
            ],
          });

        await callback(mockClient);
      });

      const result = await accountService.freezeBalanceAtomic(1, 2000, '开仓保证金', 123, 456);

      expect(result.success).toBe(true);
      expect(mockAcquireBalanceLock).toHaveBeenCalledWith(1);
      expect(mockAuditLogService.createAuditLog).toHaveBeenCalled();
    });

    test('可用余额不足时应该拒绝', async () => {
      mockAcquireBalanceLock.mockResolvedValue({ lockId: 'lock-1' });
      mockTransaction.mockImplementation(async (callback: any) => {
        const mockClient = {
          query: jest.fn(),
        };

        mockClient.query.mockResolvedValue({
          rows: [
            {
              user_id: 1,
              balance: 10000,
              available_balance: 1000,
              frozen_amount: 0,
            },
          ],
        });

        await callback(mockClient);
      });

      await expect(accountService.freezeBalanceAtomic(1, 2000, '开仓保证金')).rejects.toThrow('可用余额不足');
    });
  });

  describe('unfreezeBalanceAtomic', () => {
    test('应该成功解冻资金', async () => {
      mockAcquireBalanceLock.mockResolvedValue({ lockId: 'lock-1' });
      mockTransaction.mockImplementation(async (callback: any) => {
        const mockClient = {
          query: jest.fn(),
        };

        mockClient.query
          .mockResolvedValueOnce({
            rows: [
              {
                user_id: 1,
                balance: 10000,
                available_balance: 8000,
                frozen_amount: 2000,
              },
            ],
          })
          .mockResolvedValueOnce({ rows: [] })
          .mockResolvedValue({
            rows: [
              {
                user_id: 1,
                balance: 10000,
                available_balance: 10000,
                frozen_amount: 0,
              },
            ],
          });

        await callback(mockClient);
      });

      const result = await accountService.unfreezeBalanceAtomic(1, 2000, '平仓释放', 123, 456);

      expect(result.success).toBe(true);
      expect(mockAcquireBalanceLock).toHaveBeenCalledWith(1);
      expect(mockAuditLogService.createAuditLog).toHaveBeenCalled();
    });

    test('冻结资金不足时应该拒绝', async () => {
      mockAcquireBalanceLock.mockResolvedValue({ lockId: 'lock-1' });
      mockTransaction.mockImplementation(async (callback: any) => {
        const mockClient = {
          query: jest.fn(),
        };

        mockClient.query.mockResolvedValue({
          rows: [
            {
              user_id: 1,
              balance: 10000,
              available_balance: 8000,
              frozen_amount: 1000,
            },
          ],
        });

        await callback(mockClient);
      });

      await expect(accountService.unfreezeBalanceAtomic(1, 2000, '平仓释放')).rejects.toThrow('冻结资金不足');
    });
  });

  describe('transferBalanceAtomic', () => {
    test('应该成功转账', async () => {
      mockTransaction.mockImplementation(async (callback: any) => {
        const mockClient = {
          query: jest.fn(),
        };

        mockClient.query
          .mockResolvedValueOnce({
            rows: [
              {
                user_id: 1,
                balance: 10000,
                available_balance: 10000,
                frozen_amount: 0,
              },
            ],
          })
          .mockResolvedValueOnce({
            rows: [
              {
                user_id: 2,
                balance: 5000,
                available_balance: 5000,
                frozen_amount: 0,
              },
            ],
          })
          .mockResolvedValue({ rows: [] })
          .mockResolvedValue({ rows: [] });

        await callback(mockClient);
      });

      const result = await accountService.transferBalanceAtomic(1, 2, 1000, '转账');

      expect(result.fromResult.success).toBe(true);
      expect(result.toResult.success).toBe(true);
      expect(result.fromResult.amount).toBe(-1000);
      expect(result.toResult.amount).toBe(1000);
    });

    test('余额不足时应该拒绝', async () => {
      mockTransaction.mockImplementation(async (callback: any) => {
        const mockClient = {
          query: jest.fn(),
        };

        mockClient.query.mockResolvedValue({
          rows: [
            {
              user_id: 1,
              balance: 100,
              available_balance: 100,
              frozen_amount: 0,
            },
          ],
        });

        await callback(mockClient);
      });

      await expect(accountService.transferBalanceAtomic(1, 2, 1000, '转账')).rejects.toThrow('余额不足');
    });
  });

  describe('batchUpdateBalanceAtomic', () => {
    test('应该批量更新余额', async () => {
      mockAcquireBalanceLock.mockResolvedValue({ lockId: 'lock-1' });
      mockTransaction.mockImplementation(async (callback: any) => {
        const mockClient = {
          query: jest.fn(),
        };

        mockClient.query
          .mockResolvedValueOnce({
            rows: [
              {
                user_id: 1,
                balance: 10000,
                available_balance: 10000,
                frozen_amount: 0,
              },
            ],
          })
          .mockResolvedValueOnce({ rows: [] })
          .mockResolvedValue({
            rows: [
              {
                user_id: 1,
                balance: 11000,
                available_balance: 11000,
                frozen_amount: 0,
              },
            ],
          });

        await callback(mockClient);
      });

      const requests: BalanceUpdateRequest[] = [
        {
          userId: 1,
          amount: 1000,
          operation: 'DEPOSIT',
        },
        {
          userId: 2,
          amount: 500,
          operation: 'DEPOSIT',
        },
      ];

      const results = await accountService.batchUpdateBalanceAtomic(requests);

      expect(results.length).toBe(2);
      expect(results[0].success).toBe(true);
    });

    test('部分失败时应该继续处理', async () => {
      mockAcquireBalanceLock
        .mockResolvedValueOnce({ lockId: 'lock-1' })
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce({ lockId: 'lock-3' });

      mockTransaction.mockImplementation(async (callback: any) => {
        const mockClient = {
          query: jest.fn(),
        };

        mockClient.query
          .mockResolvedValueOnce({
            rows: [
              {
                user_id: 1,
                balance: 10000,
                available_balance: 10000,
                frozen_amount: 0,
              },
            ],
          })
          .mockResolvedValueOnce({ rows: [] })
          .mockResolvedValue({
            rows: [
              {
                user_id: 1,
                balance: 11000,
                available_balance: 11000,
                frozen_amount: 0,
              },
            ],
          });

        await callback(mockClient);
      });

      const requests: BalanceUpdateRequest[] = [
        {
          userId: 1,
          amount: 1000,
          operation: 'DEPOSIT',
        },
        {
          userId: 2,
          amount: 500,
          operation: 'DEPOSIT',
        },
        {
          userId: 3,
          amount: 200,
          operation: 'DEPOSIT',
        },
      ];

      const results = await accountService.batchUpdateBalanceAtomic(requests);

      expect(results.length).toBe(3);
      expect(results[0].success).toBe(true);
      expect(results[1].success).toBe(false);
      expect(results[2].success).toBe(true);
    });
  });

  describe('checkBalance', () => {
    test('应该检查余额是否充足', async () => {
      mockQuery.mockResolvedValue({
        rows: [
          {
            balance: 10000,
            available_balance: 8000,
            frozen_amount: 2000,
          },
        ],
      });

      const result = await accountService.checkBalance(1, 5000);

      expect(result.sufficient).toBe(true);
      expect(result.currentBalance).toBe(10000);
      expect(result.availableBalance).toBe(8000);
      expect(result.frozenAmount).toBe(2000);
    });

    test('余额不足时应该返回 false', async () => {
      mockQuery.mockResolvedValue({
        rows: [
          {
            balance: 10000,
            available_balance: 1000,
            frozen_amount: 9000,
          },
        ],
      });

      const result = await accountService.checkBalance(1, 5000);

      expect(result.sufficient).toBe(false);
    });

    test('账户不存在时应该抛出错误', async () => {
      mockQuery.mockResolvedValue({ rows: [] });

      await expect(accountService.checkBalance(999, 1000)).rejects.toThrow('账户不存在');
    });
  });

  describe('getAccountInfo', () => {
    test('应该获取账户信息', async () => {
      mockQuery.mockResolvedValue({
        rows: [
          {
            user_id: 1,
            balance: 10000,
            available_balance: 8000,
            frozen_amount: 2000,
          },
        ],
      });

      const accountInfo = await accountService.getAccountInfo(1);

      expect(accountInfo).toBeDefined();
      expect(accountInfo.user_id).toBe(1);
      expect(accountInfo.balance).toBe(10000);
    });

    test('账户不存在时应该抛出错误', async () => {
      mockQuery.mockResolvedValue({ rows: [] });

      await expect(accountService.getAccountInfo(999)).rejects.toThrow('账户不存在');
    });
  });

  describe('verifyBalanceConsistency', () => {
    test('余额一致时应该通过验证', async () => {
      mockQuery
        .mockResolvedValueOnce({
          rows: [
            {
              balance: 10000,
              realized_pl: 500,
              frozen_amount: 2000,
            },
          ],
        })
        .mockResolvedValueOnce({
          rows: [
            {
              total_amount: 9500,
            },
          ],
        });

      const result = await accountService.verifyBalanceConsistency(1);

      expect(result.consistent).toBe(true);
      expect(result.difference).toBeLessThan(0.01);
    });

    test('余额不一致时应该拒绝', async () => {
      mockQuery
        .mockResolvedValueOnce({
          rows: [
            {
              balance: 10000,
              realized_pl: 500,
              frozen_amount: 2000,
            },
          ],
        })
        .mockResolvedValueOnce({
          rows: [
            {
              total_amount: 8000,
            },
          ],
        });

      const result = await accountService.verifyBalanceConsistency(1);

      expect(result.consistent).toBe(false);
      expect(result.difference).toBeGreaterThan(0.01);
    });
  });
});