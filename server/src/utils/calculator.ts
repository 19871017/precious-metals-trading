import Decimal from 'decimal.js';
import { OrderDirection, PositionDirection, RiskLevel } from '../types';

// ============================================
// 保证金与杠杆计算工具
// ============================================

export class Calculator {
  // 维持保证金率（默认 0.5% = 0.005）
  private static MAINTENANCE_MARGIN_RATE = 0.005;
  
  // 风险缓冲区
  private static RISK_BUFFER = 0.001;

  /**
   * 计算开仓保证金
   * margin = (price × quantity) / leverage
   */
  static calculateMargin(price: number, quantity: number, leverage: number): number {
    return new Decimal(price)
      .mul(quantity)
      .div(leverage)
      .toNumber();
  }

  /**
   * 计算强平价
   * 多单: liquidation = open_price × (1 - (1 / leverage) + maintenance_margin)
   * 空单: liquidation = open_price × (1 + (1 / leverage) - maintenance_margin)
   */
  static calculateLiquidationPrice(
    openPrice: number,
    leverage: number,
    direction: PositionDirection
  ): number {
    const liquidationThreshold = new Decimal(1).div(leverage).sub(this.MAINTENANCE_MARGIN_RATE);
    
    if (direction === PositionDirection.LONG) {
      return new Decimal(openPrice)
        .mul(new Decimal(1).sub(liquidationThreshold))
        .toNumber();
    } else {
      return new Decimal(openPrice)
        .mul(new Decimal(1).add(liquidationThreshold))
        .toNumber();
    }
  }

  /**
   * 计算未实现盈亏
   * 多单: (current_price - open_price) × quantity
   * 空单: (open_price - current_price) × quantity
   */
  static calculateUnrealizedPnl(
    openPrice: number,
    currentPrice: number,
    quantity: number,
    direction: PositionDirection
  ): number {
    if (direction === PositionDirection.LONG) {
      return new Decimal(currentPrice).sub(openPrice).mul(quantity).toNumber();
    } else {
      return new Decimal(openPrice).sub(currentPrice).mul(quantity).toNumber();
    }
  }

  /**
   * 计算盈亏率
   */
  static calculatePnlRate(
    openPrice: number,
    currentPrice: number,
    direction: PositionDirection
  ): number {
    const pnl = this.calculateUnrealizedPnl(openPrice, currentPrice, 1, direction);
    return new Decimal(pnl).div(openPrice).toNumber();
  }

  /**
   * 计算风险等级
   */
  static calculateRiskLevel(
    totalBalance: number,
    frozenMargin: number,
    unrealizedPnl: number
  ): RiskLevel {
    const equity = new Decimal(totalBalance).add(unrealizedPnl);
    const usedMargin = new Decimal(frozenMargin);
    
    if (usedMargin.isZero()) {
      return RiskLevel.SAFE;
    }
    
    // 保证金使用率 = 已用保证金 / 权益
    const marginUsage = usedMargin.div(equity);
    
    if (marginUsage.lessThan(0.5)) {
      return RiskLevel.SAFE;
    } else if (marginUsage.lessThan(0.8)) {
      return RiskLevel.WARNING;
    } else {
      return RiskLevel.DANGER;
    }
  }

  /**
   * 检查是否触发强平
   */
  static checkLiquidation(
    liquidationPrice: number,
    currentPrice: number,
    direction: PositionDirection
  ): boolean {
    if (direction === PositionDirection.LONG) {
      return currentPrice <= liquidationPrice;
    } else {
      return currentPrice >= liquidationPrice;
    }
  }

  /**
   * 计算交易手续费（示例：0.05%）
   */
  static calculateFee(price: number, quantity: number): number {
    return new Decimal(price).mul(quantity).mul(0.0005).toNumber();
  }

  /**
   * 计算最大可开仓数量
   */
  static calculateMaxQuantity(
    availableBalance: number,
    price: number,
    leverage: number
  ): number {
    const marginPerUnit = new Decimal(price).div(leverage);
    return new Decimal(availableBalance).div(marginPerUnit).toNumber();
  }

  /**
   * 计算风险预览
   */
  static calculateRiskPreview(
    price: number,
    quantity: number,
    leverage: number,
    direction: PositionDirection
  ): {
    marginRequired: number;
    liquidationPrice: number;
    maxLoss: number;
  } {
    const marginRequired = this.calculateMargin(price, quantity, leverage);
    const liquidationPrice = this.calculateLiquidationPrice(price, leverage, direction);
    
    // 最大亏损 = 保证金 + 可能的手续费
    const fee = this.calculateFee(price, quantity);
    const maxLoss = new Decimal(marginRequired).add(fee).toNumber();

    return {
      marginRequired,
      liquidationPrice,
      maxLoss
    };
  }
}
