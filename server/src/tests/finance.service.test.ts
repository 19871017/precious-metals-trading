import { describe, beforeEach, test, expect, jest } from '@jest/globals';
import redis from '../utils/redis';
import { query, findOne } from '../config/database';
import * as financeService from '../services/finance.service';
import {
  TransactionType,
  DepositStatus,
  WithdrawStatus,
} from '../services/finance.service';

const queryMock = query as unknown as jest.Mock;
const findOneMock = findOne as unknown as jest.Mock;
const redisMock = redis as unknown as jest.Mocked<typeof redis>;

describe('finance.service', () => {
  beforeEach(() => {
    queryMock.mockReset();
    findOneMock.mockReset();
    redisMock.get.mockReset();
    redisMock.set.mockReset();
  });

  test('updateAccountBalance 应更新账户并写入流水/缓存', async () => {
    const client = {
      query: jest.fn()
        .mockResolvedValueOnce({
          rows: [{ balance: 1000, available_balance: 1000, frozen_amount: 0, realized_pl: 0, total_commission: 0 }],
        })
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [{ id: 1, balance: 1100 }] }),
    };

    await financeService.updateAccountBalance(
      client,
      1,
      100,
      TransactionType.DEPOSIT,
      10,
      '充值'
    );

    expect(client.query).toHaveBeenCalledTimes(4);
    expect(redisMock.set).toHaveBeenCalledWith(expect.stringContaining('user:1:account'), expect.any(String), 300);
  });

  test('getAccount 应优先使用缓存并在 miss 时写入缓存', async () => {
    redisMock.get.mockResolvedValueOnce(null);
    findOneMock.mockResolvedValueOnce({ id: 1, balance: 2000 });

    const first = await financeService.getAccount(1);
    expect(first).toEqual({ id: 1, balance: 2000 });
    expect(redisMock.set).toHaveBeenCalled();

    redisMock.get.mockResolvedValueOnce(JSON.stringify({ id: 1, balance: 3000 }));
    const second = await financeService.getAccount(1);
    expect(second.balance).toBe(3000);
  });

  test('createDeposit 应校验最小金额并创建订单', async () => {
    findOneMock.mockResolvedValueOnce({ config_value: '50' }); // MIN_DEPOSIT
    queryMock.mockResolvedValueOnce({
      rows: [{ id: 1, order_number: 'ORD1', user_id: 1 }],
    });

    const order = await financeService.createDeposit({
      user_id: 1,
      amount: 100,
      payment_method: 1,
    });

    expect(order.id).toBe(1);
    expect(queryMock).toHaveBeenCalledWith(expect.stringContaining('INSERT INTO deposit_orders'), expect.any(Array));
  });

  test('approveDeposit 通过审核时应调用 updateAccountBalance', async () => {
    const depositOrder = { id: 1, user_id: 2, amount: 500 };
    const mockClient = {
      query: jest.fn()
        .mockResolvedValueOnce({ rows: [depositOrder] })
        .mockResolvedValue({ rows: [] }),
    };

    queryMock.mockImplementationOnce(async (callback: any) => {
      await callback(mockClient);
      return { rows: [depositOrder] };
    });

    const updateSpy = jest.spyOn(financeService, 'updateAccountBalance').mockResolvedValue(undefined as any);

    await financeService.approveDeposit(1, true, 99, 'ok');

    expect(updateSpy).toHaveBeenCalledWith(
      mockClient,
      depositOrder.user_id,
      depositOrder.amount,
      TransactionType.DEPOSIT_SUCCESS,
      depositOrder.id,
      expect.any(String)
    );

    updateSpy.mockRestore();
  });

  test('createWithdraw 应校验余额并计算手续费', async () => {
    findOneMock
      .mockResolvedValueOnce({ config_value: '50' }) // MIN_WITHDRAW
      .mockResolvedValueOnce({ available_balance: 1000 }) // account
      .mockResolvedValueOnce({ config_value: '0.01' }); // fee rate

    queryMock.mockResolvedValueOnce({
      rows: [{ id: 1, amount: 100 }],
    });

    const withdraw = await financeService.createWithdraw({
      user_id: 1,
      amount: 200,
      payment_method: 1,
    });

    expect(withdraw.amount).toBe(200);
    expect(queryMock).toHaveBeenCalledWith(expect.stringContaining('INSERT INTO withdraw_orders'), expect.any(Array));
  });

  test('approveWithdraw 通过审核时应扣减余额并更新统计', async () => {
    const withdrawOrder = { id: 10, user_id: 5, amount: 300 };
    const mockClient = {
      query: jest.fn()
        .mockResolvedValueOnce({ rows: [withdrawOrder] })
        .mockResolvedValue({ rows: [] }),
    };

    queryMock.mockImplementationOnce(async (callback: any) => {
      await callback(mockClient);
      return { rows: [withdrawOrder] };
    });

    const updateSpy = jest.spyOn(financeService, 'updateAccountBalance').mockResolvedValue(undefined as any);

    await financeService.approveWithdraw(10, true, 99, 'ok');

    expect(updateSpy).toHaveBeenCalledWith(
      mockClient,
      withdrawOrder.user_id,
      -withdrawOrder.amount,
      TransactionType.WITHDRAW_SUCCESS,
      withdrawOrder.id,
      expect.any(String)
    );

    updateSpy.mockRestore();
  });
});
