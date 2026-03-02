import { describe, beforeEach, test, expect, jest } from '@jest/globals';
import { StopLossTakeProfitService } from '../services/StopLossTakeProfitService';
import { query, pool } from '../config/database';

const queryMock = query as unknown as jest.Mock;
const poolConnectMock = pool.connect as unknown as jest.Mock;

describe('StopLossTakeProfitService', () => {
  let service: StopLossTakeProfitService;

  beforeEach(() => {
    jest.useFakeTimers();
    service = new StopLossTakeProfitService();
    queryMock.mockReset();
    poolConnectMock.mockReset();
  });

  test('start 与 stop 应该管理定时器', () => {
    const intervalSpy = jest.spyOn(global, 'setInterval');
    const clearSpy = jest.spyOn(global, 'clearInterval');

    service.start();
    service.start(); // second call should warn but not create new interval
    expect(intervalSpy).toHaveBeenCalledTimes(1);

    service.stop();
    expect(clearSpy).toHaveBeenCalled();
  });

  test('checkAndExecuteStopLossTakeProfit 应在触发条件时平仓', async () => {
    const closeSpy = jest
      .spyOn(service as any, 'closePosition')
      .mockResolvedValue(undefined);

    queryMock
      .mockResolvedValueOnce({
        rows: [
          {
            id: 1,
            symbol: 'XAUUSD',
            direction: 'BUY',
            entry_price: 2000,
            quantity: 1,
            stop_loss: 1900,
            take_profit: null,
          },
        ],
      })
      .mockResolvedValueOnce({
        rows: [{ last_price: 1850 }],
      });

    await (service as any).checkAndExecuteStopLossTakeProfit();
    expect(closeSpy).toHaveBeenCalledWith(expect.any(Object), 1900, '止损触发');
  });

  test('closePosition 应执行数据库更新与账户调整', async () => {
    const mockClient = {
      query: jest.fn()
        .mockResolvedValueOnce({
          rows: [{ id: 1, status: 1, direction: 'BUY', entry_price: 2000, quantity: 1, margin: 100, user_id: 1 }],
        })
        .mockResolvedValue({ rows: [] }),
    };

    poolConnectMock.mockResolvedValue(mockClient);

    await (service as any).closePosition(
      { id: 1, symbol: 'XAUUSD', user_id: 1 },
      1900,
      '止损触发'
    );

    expect(mockClient.query).toHaveBeenCalled();
  });
});
