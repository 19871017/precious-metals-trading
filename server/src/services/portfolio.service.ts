import { query, findOne } from '../config/database';
import logger from '../utils/logger';

/**
 * 投资组合接口
 */
export interface Portfolio {
  userId: number;
  totalValue: number;
  totalCost: number;
  totalPnL: number;
  totalPnLPercent: number;
  positions: PositionSummary[];
  allocation: Allocation[];
}

/**
 * 持仓汇总
 */
export interface PositionSummary {
  positionId: number;
  productCode: string;
  productName: string;
  direction: number;
  quantity: number;
  openPrice: number;
  currentPrice: number;
  marketValue: number;
  costBasis: number;
  unrealizedPnL: number;
  unrealizedPnLPercent: number;
  weight: number;
  leverage: number;
  openedAt: string;
}

/**
 * 资产配置
 */
export interface Allocation {
  category: string;
  productCode: string;
  productName: string;
  value: number;
  weight: number;
  profit: number;
  profitPercent: number;
}

/**
 * 风险敞口
 */
export interface RiskExposure {
  totalValue: number;
  longValue: number;
  shortValue: number;
  netExposure: number;
  leverage: number;
  riskLevel: 'low' | 'medium' | 'high';
}

/**
 * 投资组合分析
 */
export interface PortfolioAnalysis {
  portfolio: Portfolio;
  exposure: RiskExposure;
  sectorAllocation: Allocation[];
  currencyExposure: Allocation[];
  performance: PerformanceMetrics;
}

/**
 * 性能指标
 */
export interface PerformanceMetrics {
  totalReturn: number;
  totalReturnPercent: number;
  winRate: number;
  maxDrawdown: number;
  sharpeRatio: number;
  totalTrades: number;
  profitableTrades: number;
}

/**
 * 获取用户投资组合
 */
export async function getPortfolio(userId: number): Promise<Portfolio> {
  try {
    // 获取持仓列表
    const positionsResult = await query(
      `SELECT
        p.id,
        p.user_id,
        p.product_id,
        pr.symbol AS product_code,
        pr.name AS product_name,
        p.direction,
        p.quantity,
        p.open_price,
        p.leverage,
        p.margin_used,
        p.unrealized_pnl,
        p.created_at AS opened_at,
        mr.last_price AS current_price
       FROM positions p
       JOIN products pr ON p.product_id = pr.id
       LEFT JOIN market_rates mr ON pr.id = mr.product_id
       WHERE p.user_id = $1 AND p.status = 1`,
      [userId]
    );

    const positions = positionsResult.rows.map(row => ({
      positionId: row.id,
      productCode: row.product_code,
      productName: row.product_name,
      direction: row.direction,
      quantity: parseFloat(row.quantity),
      openPrice: parseFloat(row.open_price),
      currentPrice: row.current_price ? parseFloat(row.current_price) : parseFloat(row.open_price),
      marketValue: row.current_price ? parseFloat(row.current_price) * parseFloat(row.quantity) : 0,
      costBasis: parseFloat(row.open_price) * parseFloat(row.quantity),
      unrealizedPnL: parseFloat(row.unrealized_pnl || 0),
      unrealizedPnLPercent: row.current_price ?
        ((parseFloat(row.current_price) - parseFloat(row.open_price)) / parseFloat(row.open_price) * 100 * (row.direction === 1 ? 1 : -1)) : 0,
      weight: 0,
      leverage: parseFloat(row.leverage),
      openedAt: row.opened_at
    }));

    // 计算总价值和总成本
    const totalValue = positions.reduce((sum, p) => sum + p.marketValue, 0);
    const totalCost = positions.reduce((sum, p) => sum + p.costBasis, 0);
    const totalPnL = positions.reduce((sum, p) => sum + p.unrealizedPnL, 0);
    const totalPnLPercent = totalCost > 0 ? (totalPnL / totalCost * 100) : 0;

    // 计算权重
    const weightedPositions = positions.map(p => ({
      ...p,
      weight: totalValue > 0 ? (p.marketValue / totalValue * 100) : 0
    }));

    // 计算资产配置
    const allocationMap = new Map<string, Allocation>();

    weightedPositions.forEach(p => {
      const category = p.productCode.includes('XAU') || p.productCode.includes('XAG') ? '贵金属' : '其他';
      const key = `${category}-${p.productCode}`;

      if (allocationMap.has(key)) {
        const existing = allocationMap.get(key)!;
        existing.value += p.marketValue;
        existing.profit += p.unrealizedPnL;
      } else {
        allocationMap.set(key, {
          category,
          productCode: p.productCode,
          productName: p.productName,
          value: p.marketValue,
          weight: 0,
          profit: p.unrealizedPnL,
          profitPercent: p.costBasis > 0 ? (p.unrealizedPnL / p.costBasis * 100) : 0
        });
      }
    });

    const allocation = Array.from(allocationMap.values()).map(a => ({
      ...a,
      weight: totalValue > 0 ? (a.value / totalValue * 100) : 0
    }));

    return {
      userId,
      totalValue,
      totalCost,
      totalPnL,
      totalPnLPercent,
      positions: weightedPositions,
      allocation
    };
  } catch (error) {
    logger.error('获取投资组合失败:', error);
    throw error;
  }
}

/**
 * 获取风险敞口
 */
export async function getRiskExposure(userId: number): Promise<RiskExposure> {
  try {
    const portfolio = await getPortfolio(userId);

    const longValue = portfolio.positions
      .filter(p => p.direction === 1)
      .reduce((sum, p) => sum + p.marketValue, 0);

    const shortValue = portfolio.positions
      .filter(p => p.direction === 2)
      .reduce((sum, p) => sum + p.marketValue, 0);

    const netExposure = longValue - shortValue;
    const leverage = portfolio.positions.length > 0 ?
      portfolio.positions.reduce((sum, p) => sum + p.leverage, 0) / portfolio.positions.length : 1;

    // 判断风险等级
    let riskLevel: 'low' | 'medium' | 'high' = 'low';
    if (Math.abs(netExposure) / portfolio.totalValue > 0.7 || leverage > 50) {
      riskLevel = 'high';
    } else if (Math.abs(netExposure) / portfolio.totalValue > 0.5 || leverage > 30) {
      riskLevel = 'medium';
    }

    return {
      totalValue: portfolio.totalValue,
      longValue,
      shortValue,
      netExposure,
      leverage,
      riskLevel
    };
  } catch (error) {
    logger.error('获取风险敞口失败:', error);
    throw error;
  }
}

/**
 * 获取性能指标
 */
export async function getPerformanceMetrics(userId: number, days: number = 30): Promise<PerformanceMetrics> {
  try {
    // 获取指定天数内的交易记录
    const tradesResult = await query(
      `SELECT
        SUM(CASE WHEN realized_pnl > 0 THEN 1 ELSE 0 END) AS profitable_trades,
        COUNT(*) AS total_trades,
        SUM(realized_pnl) AS total_pnl,
        SUM(margin_used) AS total_margin
       FROM positions
       WHERE user_id = $1
         AND status = 2
         AND closed_at >= NOW() - INTERVAL '${days} days'`,
      [userId]
    );

    const trades = tradesResult.rows[0];
    const totalTrades = parseInt(trades.total_trades) || 0;
    const profitableTrades = parseInt(trades.profitable_trades) || 0;
    const totalReturn = parseFloat(trades.total_pnl) || 0;
    const totalMargin = parseFloat(trades.total_margin) || 0;

    const winRate = totalTrades > 0 ? (profitableTrades / totalTrades * 100) : 0;
    const totalReturnPercent = totalMargin > 0 ? (totalReturn / totalMargin * 100) : 0;

    // 简化的夏普比率计算 (年化收益率 / 年化波动率)
    const sharpeRatio = totalMargin > 0 ? (totalReturnPercent / 100 / (winRate / 100 || 0.01)) : 0;

    // 最大回撤 (简化计算)
    const maxDrawdown = totalReturn < 0 ? Math.abs(totalReturnPercent) : 0;

    return {
      totalReturn,
      totalReturnPercent,
      winRate,
      maxDrawdown,
      sharpeRatio,
      totalTrades,
      profitableTrades
    };
  } catch (error) {
    logger.error('获取性能指标失败:', error);
    throw error;
  }
}

/**
 * 获取投资组合分析
 */
export async function getPortfolioAnalysis(userId: number, days: number = 30): Promise<PortfolioAnalysis> {
  try {
    const [portfolio, exposure, performance] = await Promise.all([
      getPortfolio(userId),
      getRiskExposure(userId),
      getPerformanceMetrics(userId, days)
    ]);

    return {
      portfolio,
      exposure,
      sectorAllocation: portfolio.allocation,
      currencyExposure: [], // 暂时留空,需要根据实际币种计算
      performance
    };
  } catch (error) {
    logger.error('获取投资组合分析失败:', error);
    throw error;
  }
}
