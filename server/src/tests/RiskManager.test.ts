import { describe, beforeEach, test, expect } from '@jest/globals';
import { RiskManager } from '../core/RiskManager';
import { OrderManager, PositionManager } from '../core/OrderManager';
import { OrderType, OrderDirection } from '../types';

describe('RiskManager', () => {
  let positionManager: PositionManager;
  let orderManager: OrderManager;
  let riskManager: RiskManager;

  beforeEach(() => {
    positionManager = new PositionManager();
    orderManager = new OrderManager(positionManager);
    riskManager = new RiskManager(positionManager);
  });

  test('createAccount 与 getAccount 应该正常工作', () => {
    const account = riskManager.createAccount('user-1', 1000);
    expect(account.userId).toBe('user-1');
    expect(riskManager.getAccount('user-1')).toEqual(account);
    expect(riskManager.getAccount('missing')).toBeUndefined();
  });

  test('checkOrderRisk 应处理杠杆、余额和风险等级限制', () => {
    riskManager.createAccount('user-1', 500);

    let result = riskManager.checkOrderRisk('user-1', 1000, 10);
    expect(result.canTrade).toBe(false);
    expect(result.message).toContain('可用余额不足');

    result = riskManager.checkOrderRisk('user-1', 100, 200);
    expect(result.canTrade).toBe(false);
    expect(result.message).toContain('杠杆倍数');

    const missing = riskManager.checkOrderRisk('missing', 10, 1);
    expect(missing.canTrade).toBe(false);
    expect(missing.message).toContain('账户不存在');
  });

  test('freezeMargin 与 releaseMargin 应更新账户余额', () => {
    riskManager.createAccount('user-1', 1000);
    expect(riskManager.freezeMargin('user-1', 200)).toBe(true);
    expect(riskManager.freezeMargin('user-1', 900)).toBe(false);
    expect(riskManager.releaseMargin('user-1', 100)).toBe(true);
    expect(riskManager.releaseMargin('user-1', 500)).toBe(false);
  });

  test('updateAccountEquity 应基于仓位更新风险等级', () => {
    const account = riskManager.createAccount('user-1', 1000);
    const order = orderManager.createOrder(
      'user-1',
      'XAUUSD',
      OrderType.MARKET,
      OrderDirection.BUY,
      1,
      10,
      undefined,
      undefined,
      undefined
    );
    orderManager.matchOrder(order.id, { productId: 1, symbol: 'XAUUSD', bid: 100, ask: 101, lastPrice: 100 });

    const marketData = new Map<string, any>();
    marketData.set('XAUUSD', { lastPrice: 80 });

    riskManager.updateAccountEquity('user-1', marketData);
    expect(account.unrealizedPnl).toBeLessThan(0);
  });

  test('settlePosition 应释放保证金并更新盈亏', () => {
    const account = riskManager.createAccount('user-1', 1000);
    riskManager.freezeMargin('user-1', 200);
    riskManager.settlePosition('user-1', -50, 200);
    expect(account.frozenMargin).toBe(0);
    expect(account.realizedPnl).toBe(-50);
  });
});
