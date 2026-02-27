import {
  Account,
  Position,
  PositionStatus,
  RiskLevel,
  MarketData,
  LiquidationRecord
} from '../types';
import { Calculator } from '../utils/calculator';
import { PositionManager } from './OrderManager';
import { positionLock } from '../utils/lock';
import logger from '../utils/logger';

// ============================================
// 风险管理器
// ============================================

export interface RiskCheckResult {
  canTrade: boolean;
  riskLevel: RiskLevel;
  message: string;
  maxOrderSize?: number;
}

export class RiskManager {
  private accounts: Map<string, Account> = new Map();
  private positionManager: PositionManager;
  
  // 风险阈值配置
  private readonly RISK_THRESHOLDS = {
    WARNING_MARGIN_USAGE: 0.5,  // 50% 保证金使用率触发警告
    DANGER_MARGIN_USAGE: 0.8,   // 80% 保证金使用率触发危险
    MAX_LEVERAGE: 100,          // 最大杠杆倍数
    MIN_MARGIN_RATE: 0.005      // 最小维持保证金率 0.5%
  };

  constructor(positionManager: PositionManager) {
    this.positionManager = positionManager;
  }

  /**
   * 创建账户
   */
  createAccount(userId: string, initialBalance: number = 100000): Account {
    const account: Account = {
      userId,
      totalBalance: initialBalance,
      availableBalance: initialBalance,
      frozenMargin: 0,
      unrealizedPnl: 0,
      realizedPnl: 0,
      positions: new Map(),
      riskLevel: RiskLevel.SAFE
    };

    this.accounts.set(userId, account);
    return account;
  }

  /**
   * 获取账户
   */
  getAccount(userId: string): Account | undefined {
    return this.accounts.get(userId);
  }

  /**
   * 检查是否可以下单
   */
  checkOrderRisk(
    userId: string,
    requiredMargin: number,
    leverage: number
  ): RiskCheckResult {
    const account = this.accounts.get(userId);
    if (!account) {
      return {
        canTrade: false,
        riskLevel: RiskLevel.DANGER,
        message: '账户不存在'
      };
    }

    // 检查杠杆倍数
    if (leverage > this.RISK_THRESHOLDS.MAX_LEVERAGE) {
      return {
        canTrade: false,
        riskLevel: RiskLevel.DANGER,
        message: `杠杆倍数不能超过 ${this.RISK_THRESHOLDS.MAX_LEVERAGE}x`
      };
    }

    // 检查风险等级
    if (account.riskLevel === RiskLevel.DANGER) {
      return {
        canTrade: false,
        riskLevel: RiskLevel.DANGER,
        message: '账户风险等级过高，禁止新开仓。请追加保证金或减仓。'
      };
    }

    // 检查可用余额
    if (account.availableBalance < requiredMargin) {
      return {
        canTrade: false,
        riskLevel: account.riskLevel,
        message: `可用余额不足。需要: ${requiredMargin.toFixed(2)}, 可用: ${account.availableBalance.toFixed(2)}`,
        maxOrderSize: Calculator.calculateMaxQuantity(
          account.availableBalance,
          requiredMargin / leverage, // 反推价格
          leverage
        )
      };
    }

    return {
      canTrade: true,
      riskLevel: account.riskLevel,
      message: '风险检查通过'
    };
  }

  /**
   * 冻结保证金
   */
  freezeMargin(userId: string, margin: number): boolean {
    const account = this.accounts.get(userId);
    if (!account) return false;

    if (account.availableBalance < margin) {
      return false;
    }

    account.availableBalance -= margin;
    account.frozenMargin += margin;

    return true;
  }

  /**
   * 释放保证金
   */
  releaseMargin(userId: string, margin: number): boolean {
    const account = this.accounts.get(userId);
    if (!account) return false;

    if (account.frozenMargin < margin) {
      return false;
    }

    account.frozenMargin -= margin;
    account.availableBalance += margin;

    return true;
  }

  /**
   * 更新账户权益和盈亏
   */
  updateAccountEquity(userId: string, marketData: Map<string, MarketData>): void {
    const account = this.accounts.get(userId);
    if (!account) return;

    // 获取用户所有持仓
    const positions = this.positionManager.getUserPositions(userId);
    
    let totalUnrealizedPnl = 0;

    for (const position of positions) {
      if (position.status !== PositionStatus.OPEN) continue;

      const market = marketData.get(position.productCode);
      if (!market) continue;

      // 更新仓位未实现盈亏
      this.positionManager.updateUnrealizedPnl(position.id, market.lastPrice);
      
      totalUnrealizedPnl += position.unrealizedPnl;
    }

    // 更新账户未实现盈亏
    account.unrealizedPnl = totalUnrealizedPnl;

    // 重新计算风险等级
    account.riskLevel = Calculator.calculateRiskLevel(
      account.totalBalance,
      account.frozenMargin,
      account.unrealizedPnl
    );
  }

  /**
   * 处理平仓后的资金结算
   */
  settlePosition(userId: string, realizedPnl: number, marginReleased: number): void {
    const account = this.accounts.get(userId);
    if (!account) return;

    // 释放保证金
    account.frozenMargin -= marginReleased;
    account.availableBalance += marginReleased;

    // 结算盈亏
    account.realizedPnl += realizedPnl;
    account.totalBalance += realizedPnl;
    account.availableBalance += realizedPnl;
  }

  /**
   * 检查并执行强平（使用锁防止重复强平）
   */
  async checkAndLiquidate(
    userId: string,
    marketData: Map<string, MarketData>
  ): Promise<LiquidationRecord[]> {
    const account = this.accounts.get(userId);
    if (!account) return [];

    const liquidations: LiquidationRecord[] = [];
    const positions = this.positionManager.getUserPositions(userId);

    for (const position of positions) {
      if (position.status !== PositionStatus.OPEN) continue;

      const market = marketData.get(position.productCode);
      if (!market) continue;

      // 检查是否触发强平
      const shouldLiquidate = Calculator.checkLiquidation(
        position.liquidationPrice,
        market.lastPrice,
        position.direction
      );

      if (shouldLiquidate) {
        // 使用锁防止重复强平同一仓位
        const record = await positionLock.runWithLock(`liquidate_${position.id}`, async () => {
          // 再次检查仓位状态，可能已被其他线程强平
          const currentPosition = this.positionManager.getPosition(position.id);
          if (!currentPosition || currentPosition.status !== PositionStatus.OPEN) {
            return null;
          }
          return this.positionManager.liquidatePosition(
            position.id,
            market.lastPrice,
            '保证金不足触发强平'
          );
        });

        if (record) {
          liquidations.push(record);

          // 结算账户
          this.settlePosition(userId, -record.marginLost, record.marginLost);
        }
      }

      // 检查止盈止损
      if (position.stopLoss || position.takeProfit) {
        const shouldClose = this.checkSlTpTrigger(position, market.lastPrice);

        if (shouldClose) {
          // 使用锁防止重复平仓
          const closedPosition = await positionLock.runWithLock(`sltp_${position.id}`, async () => {
            // 再次检查仓位状态，可能已被其他操作平仓
            const currentPosition = this.positionManager.getPosition(position.id);
            if (!currentPosition || currentPosition.status !== PositionStatus.OPEN) {
              return null;
            }
            // 执行平仓
            return this.positionManager.closePosition(position.id, market.lastPrice);
          });

          if (closedPosition) {
            const reason = position.stopLoss && market.lastPrice <= position.stopLoss ? '止损触发' : '止盈触发';
            logger.info(`[RiskManager] ${reason}平仓: 仓位${position.id}, 价格${market.lastPrice}`);
            // 结算账户
            this.settlePosition(userId, closedPosition.realizedPnl, closedPosition.marginUsed);
          }
        }
      }
    }

    return liquidations;
  }

  /**
   * 检查止盈止损触发
   */
  private checkSlTpTrigger(position: Position, currentPrice: number): boolean {
    if (position.direction === 'LONG') {
      // 多头：价格 <= 止损价 或 价格 >= 止盈价
      if (position.stopLoss && currentPrice <= position.stopLoss) return true;
      if (position.takeProfit && currentPrice >= position.takeProfit) return true;
    } else {
      // 空头：价格 >= 止损价 或 价格 <= 止盈价
      if (position.stopLoss && currentPrice >= position.stopLoss) return true;
      if (position.takeProfit && currentPrice <= position.takeProfit) return true;
    }
    return false;
  }

  /**
   * 获取账户风险预览
   */
  getRiskPreview(userId: string): {
    totalBalance: number;
    availableBalance: number;
    frozenMargin: number;
    unrealizedPnl: number;
    realizedPnl: number;
    riskLevel: RiskLevel;
    marginUsage: number;
    equity: number;
  } | null {
    const account = this.accounts.get(userId);
    if (!account) return null;

    const equity = account.totalBalance + account.unrealizedPnl;
    const marginUsage = equity > 0 ? account.frozenMargin / equity : 0;

    return {
      totalBalance: account.totalBalance,
      availableBalance: account.availableBalance,
      frozenMargin: account.frozenMargin,
      unrealizedPnl: account.unrealizedPnl,
      realizedPnl: account.realizedPnl,
      riskLevel: account.riskLevel,
      marginUsage,
      equity
    };
  }

  /**
   * 获取所有账户（用于风控监控）
   */
  getAllAccounts(): Account[] {
    return Array.from(this.accounts.values());
  }

  /**
   * 充值（模拟）
   */
  deposit(userId: string, amount: number): boolean {
    const account = this.accounts.get(userId);
    if (!account) return false;

    account.totalBalance += amount;
    account.availableBalance += amount;

    return true;
  }

  /**
   * 提现（模拟）
   */
  withdraw(userId: string, amount: number): boolean {
    const account = this.accounts.get(userId);
    if (!account) return false;

    if (account.availableBalance < amount) {
      return false;
    }

    account.totalBalance -= amount;
    account.availableBalance -= amount;

    return true;
  }
}
