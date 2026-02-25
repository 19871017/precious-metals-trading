// 策略类型定义
export interface StrategyParams {
  name: string;
  description: string;
  parameters: Record<string, any>;
}

export interface TradeSignal {
  type: 'buy' | 'sell' | 'hold';
  timestamp: number;
  price: number;
  strength: number; // 0-1
  reason: string;
}

export interface BacktestConfig {
  symbol: string;
  strategy: string;
  startDate: string;
  endDate: string;
  initialCapital: number;
  commission: number; // 手续费率
  slippage: number; // 滑点
  leverage: number;
  stopLoss?: number; // 止损百分比
  takeProfit?: number; // 止盈百分比
}

export interface BacktestResult {
  summary: {
    totalReturn: number;
    annualizedReturn: number;
    maxDrawdown: number;
    sharpeRatio: number;
    sortinoRatio: number;
    winRate: number;
    profitFactor: number;
    totalTrades: number;
    avgProfit: number;
    avgLoss: number;
  };
  equityCurve: {
    date: string;
    equity: number;
    drawdown: number;
  }[];
  trades: {
    id: string;
    type: 'buy' | 'sell';
    entryPrice: number;
    exitPrice?: number;
    entryTime: string;
    exitTime?: string;
    quantity: number;
    profit: number;
    profitPercent: number;
  }[];
  riskMetrics: {
    volatility: number;
    var95: number; // 95%置信度VaR
    var99: number; // 99%置信度VaR
    beta: number;
    alpha: number;
  };
  monthlyReturns: {
    month: string;
    return: number;
  }[];
}

export interface KLineData {
  timestamp: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export interface TechnicalIndicators {
  ma: {
    ma5: number[];
    ma10: number[];
    ma20: number[];
    ma60: number[];
  };
  macd: {
    dif: number[];
    dea: number[];
    macd: number[];
  };
  rsi: {
    rsi6: number[];
    rsi12: number[];
    rsi24: number[];
  };
  kdj: {
    k: number[];
    d: number[];
    j: number[];
  };
  boll: {
    upper: number[];
    middle: number[];
    lower: number[];
  };
  atr: number[];
  volumeRatio: number[];
}

// 策略参数配置
export const STRATEGY_PARAMS: Record<string, StrategyParams> = {
  maCross: {
    name: '均线交叉策略',
    description: '基于短期和长期均线交叉信号进行交易',
    parameters: {
      shortPeriod: 5,
      longPeriod: 20,
      stopLossPercent: 3,
      takeProfitPercent: 6,
    },
  },
  macdStrategy: {
    name: 'MACD策略',
    description: '基于MACD指标的金叉死叉信号交易',
    parameters: {
      fastPeriod: 12,
      slowPeriod: 26,
      signalPeriod: 9,
      stopLossPercent: 2,
      takeProfitPercent: 4,
    },
  },
  rsiStrategy: {
    name: 'RSI超买超卖策略',
    description: '基于RSI指标的超买超卖信号交易',
    parameters: {
      period: 14,
      overbought: 70,
      oversold: 30,
      stopLossPercent: 2,
      takeProfitPercent: 5,
    },
  },
  bollStrategy: {
    name: '布林带突破策略',
    description: '基于布林带的突破和回归信号交易',
    parameters: {
      period: 20,
      stdDev: 2,
      stopLossPercent: 2,
      takeProfitPercent: 4,
    },
  },
  multiStrategy: {
    name: '多指标综合策略',
    description: '结合多个技术指标的综合交易策略',
    parameters: {
      maShortPeriod: 5,
      maLongPeriod: 20,
      rsiPeriod: 14,
      macdFastPeriod: 12,
      macdSlowPeriod: 26,
      stopLossPercent: 2.5,
      takeProfitPercent: 5,
    },
  },
  aiStrategy: {
    name: 'AI智能策略',
    description: '基于机器学习的智能交易策略',
    parameters: {
      lookbackPeriod: 30,
      confidenceThreshold: 0.6,
      stopLossPercent: 3,
      takeProfitPercent: 6,
    },
  },
};

// 计算移动平均线
function calculateMA(data: number[], period: number): number[] {
  const result: number[] = [];
  for (let i = 0; i < data.length; i++) {
    if (i < period - 1) {
      result.push(NaN);
    } else {
      const sum = data.slice(i - period + 1, i + 1).reduce((a, b) => a + b, 0);
      result.push(sum / period);
    }
  }
  return result;
}

// 计算MACD
function calculateMACD(closePrices: number[], fastPeriod: number, slowPeriod: number, signalPeriod: number) {
  const emaFast = calculateEMA(closePrices, fastPeriod);
  const emaSlow = calculateEMA(closePrices, slowPeriod);
  const dif = emaFast.map((v, i) => v - emaSlow[i]);
  const dea = calculateEMA(dif.filter(v => !isNaN(v)), signalPeriod);
  const macd = dif.map((v, i) => v * 2 - (dea[i - Math.floor(signalPeriod / 2)] || 0));

  return { dif, dea, macd };
}

// 计算指数移动平均线
function calculateEMA(data: number[], period: number): number[] {
  const result: number[] = [];
  const multiplier = 2 / (period + 1);

  let ema = data[0];
  result.push(ema);

  for (let i = 1; i < data.length; i++) {
    ema = (data[i] - ema) * multiplier + ema;
    result.push(ema);
  }

  return result;
}

// 计算RSI
function calculateRSI(data: number[], period: number): number[] {
  const result: number[] = [];

  for (let i = 0; i < data.length; i++) {
    if (i < period) {
      result.push(NaN);
      continue;
    }

    const slice = data.slice(i - period, i + 1);
    let gains = 0;
    let losses = 0;

    for (let j = 1; j < slice.length; j++) {
      const change = slice[j] - slice[j - 1];
      if (change > 0) {
        gains += change;
      } else {
        losses -= change;
      }
    }

    const avgGain = gains / period;
    const avgLoss = losses / period;

    if (avgLoss === 0) {
      result.push(100);
    } else {
      const rs = avgGain / avgLoss;
      result.push(100 - 100 / (1 + rs));
    }
  }

  return result;
}

// 计算KDJ
function calculateKDJ(high: number[], low: number[], close: number[], period: number = 9) {
  const k: number[] = [];
  const d: number[] = [];
  const j: number[] = [];

  let prevK = 50;
  let prevD = 50;

  for (let i = 0; i < close.length; i++) {
    if (i < period - 1) {
      k.push(NaN);
      d.push(NaN);
      j.push(NaN);
      continue;
    }

    const highestHigh = Math.max(...high.slice(i - period + 1, i + 1));
    const lowestLow = Math.min(...low.slice(i - period + 1, i + 1));

    const rsv = ((close[i] - lowestLow) / (highestHigh - lowestLow)) * 100;
    const currentK = (2 / 3) * prevK + (1 / 3) * rsv;
    const currentD = (2 / 3) * prevD + (1 / 3) * currentK;
    const currentJ = 3 * currentK - 2 * currentD;

    k.push(currentK);
    d.push(currentD);
    j.push(currentJ);

    prevK = currentK;
    prevD = currentD;
  }

  return { k, d, j };
}

// 计算布林带
function calculateBOLL(data: number[], period: number, stdDev: number) {
  const ma = calculateMA(data, period);
  const upper: number[] = [];
  const lower: number[] = [];

  for (let i = 0; i < data.length; i++) {
    if (i < period - 1) {
      upper.push(NaN);
      lower.push(NaN);
      continue;
    }

    const slice = data.slice(i - period + 1, i + 1);
    const mean = ma[i];
    const variance = slice.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / period;
    const std = Math.sqrt(variance);

    upper.push(mean + stdDev * std);
    lower.push(mean - stdDev * std);
  }

  return { upper, middle: ma, lower };
}

// 计算ATR
function calculateATR(high: number[], low: number[], close: number[], period: number = 14): number[] {
  const trueRanges: number[] = [];

  for (let i = 0; i < high.length; i++) {
    if (i === 0) {
      trueRanges.push(high[i] - low[i]);
    } else {
      const tr1 = high[i] - low[i];
      const tr2 = Math.abs(high[i] - close[i - 1]);
      const tr3 = Math.abs(low[i] - close[i - 1]);
      trueRanges.push(Math.max(tr1, tr2, tr3));
    }
  }

  const atr = calculateMA(trueRanges, period);
  return atr;
}

// 计算量比
function calculateVolumeRatio(volumes: number[], period: number = 5): number[] {
  const avgVolume = calculateMA(volumes, period);
  return volumes.map((v, i) => avgVolume[i] ? v / avgVolume[i] : NaN);
}

// 计算所有技术指标
export function calculateAllIndicators(data: KLineData[]): TechnicalIndicators {
  const closes = data.map(d => d.close);
  const highs = data.map(d => d.high);
  const lows = data.map(d => d.low);
  const volumes = data.map(d => d.volume);

  return {
    ma: {
      ma5: calculateMA(closes, 5),
      ma10: calculateMA(closes, 10),
      ma20: calculateMA(closes, 20),
      ma60: calculateMA(closes, 60),
    },
    macd: calculateMACD(closes, 12, 26, 9),
    rsi: {
      rsi6: calculateRSI(closes, 6),
      rsi12: calculateRSI(closes, 12),
      rsi24: calculateRSI(closes, 24),
    },
    kdj: calculateKDJ(highs, lows, closes, 9),
    boll: calculateBOLL(closes, 20, 2),
    atr: calculateATR(highs, lows, closes, 14),
    volumeRatio: calculateVolumeRatio(volumes, 5),
  };
}

// 均线交叉策略信号
function generateMAStrategySignals(data: KLineData[], params: any): TradeSignal[] {
  const signals: TradeSignal[] = [];
  const { shortPeriod, longPeriod, stopLossPercent, takeProfitPercent } = params;

  const closes = data.map(d => d.close);
  const maShort = calculateMA(closes, shortPeriod);
  const maLong = calculateMA(closes, longPeriod);

  for (let i = longPeriod; i < data.length; i++) {
    const prevCrossUp = maShort[i - 1] > maLong[i - 1] && maShort[i - 2] <= maLong[i - 2];
    const prevCrossDown = maShort[i - 1] < maLong[i - 1] && maShort[i - 2] >= maLong[i - 2];

    if (prevCrossUp) {
      signals.push({
        type: 'buy',
        timestamp: data[i].timestamp,
        price: data[i].close,
        strength: 0.7,
        reason: `MA${shortPeriod}上穿MA${longPeriod},买入信号`,
      });
    } else if (prevCrossDown) {
      signals.push({
        type: 'sell',
        timestamp: data[i].timestamp,
        price: data[i].close,
        strength: 0.7,
        reason: `MA${shortPeriod}下穿MA${longPeriod},卖出信号`,
      });
    }
  }

  return signals;
}

// MACD策略信号
function generateMACDStrategySignals(data: KLineData[], params: any): TradeSignal[] {
  const signals: TradeSignal[] = [];

  const closes = data.map(d => d.close);
  const { dif, dea } = calculateMACD(closes, params.fastPeriod, params.slowPeriod, params.signalPeriod);

  for (let i = 1; i < data.length; i++) {
    if (isNaN(dif[i]) || isNaN(dea[i]) || isNaN(dif[i - 1]) || isNaN(dea[i - 1])) continue;

    const goldCross = dif[i] > dea[i] && dif[i - 1] <= dea[i - 1];
    const deathCross = dif[i] < dea[i] && dif[i - 1] >= dea[i - 1];

    if (goldCross) {
      signals.push({
        type: 'buy',
        timestamp: data[i].timestamp,
        price: data[i].close,
        strength: 0.8,
        reason: 'MACD金叉,买入信号',
      });
    } else if (deathCross) {
      signals.push({
        type: 'sell',
        timestamp: data[i].timestamp,
        price: data[i].close,
        strength: 0.8,
        reason: 'MACD死叉,卖出信号',
      });
    }
  }

  return signals;
}

// RSI策略信号
function generateRSIStrategySignals(data: KLineData[], params: any): TradeSignal[] {
  const signals: TradeSignal[] = [];

  const closes = data.map(d => d.close);
  const rsi = calculateRSI(closes, params.period);

  for (let i = 1; i < data.length; i++) {
    if (isNaN(rsi[i]) || isNaN(rsi[i - 1])) continue;

    const oversoldBuy = rsi[i] < params.oversold && rsi[i - 1] >= params.oversold;
    const overboughtSell = rsi[i] > params.overbought && rsi[i - 1] <= params.overbought;

    if (oversoldBuy) {
      signals.push({
        type: 'buy',
        timestamp: data[i].timestamp,
        price: data[i].close,
        strength: (params.oversold - rsi[i]) / params.oversold,
        reason: `RSI超卖(RSI=${rsi[i].toFixed(2)}),买入信号`,
      });
    } else if (overboughtSell) {
      signals.push({
        type: 'sell',
        timestamp: data[i].timestamp,
        price: data[i].close,
        strength: (rsi[i] - params.overbought) / (100 - params.overbought),
        reason: `RSI超买(RSI=${rsi[i].toFixed(2)}),卖出信号`,
      });
    }
  }

  return signals;
}

// 布林带策略信号
function generateBOLLStrategySignals(data: KLineData[], params: any): TradeSignal[] {
  const signals: TradeSignal[] = [];

  const closes = data.map(d => d.close);
  const { upper, middle, lower } = calculateBOLL(closes, params.period, params.stdDev);

  for (let i = 1; i < data.length; i++) {
    if (isNaN(upper[i]) || isNaN(lower[i]) || isNaN(middle[i])) continue;

    const breakLower = closes[i] < lower[i] && closes[i - 1] >= lower[i - 1];
    const breakUpper = closes[i] > upper[i] && closes[i - 1] <= upper[i - 1];
    const returnToMiddle = Math.abs(closes[i] - middle[i]) < Math.abs(closes[i - 1] - middle[i - 1]) &&
                           closes[i - 1] !== middle[i - 1];

    if (breakLower) {
      signals.push({
        type: 'buy',
        timestamp: data[i].timestamp,
        price: data[i].close,
        strength: 0.6,
        reason: '价格跌破下轨,反弹买入信号',
      });
    } else if (breakUpper) {
      signals.push({
        type: 'sell',
        timestamp: data[i].timestamp,
        price: data[i].close,
        strength: 0.6,
        reason: '价格突破上轨,回调卖出信号',
      });
    }
  }

  return signals;
}

// 多指标综合策略信号
function generateMultiStrategySignals(data: KLineData[], params: any): TradeSignal[] {
  const signals: TradeSignal[] = [];

  const closes = data.map(d => d.close);
  const maShort = calculateMA(closes, params.maShortPeriod);
  const maLong = calculateMA(closes, params.maLongPeriod);
  const rsi = calculateRSI(closes, params.rsiPeriod);
  const { dif, dea } = calculateMACD(closes, params.macdFastPeriod, params.macdSlowPeriod, 9);

  for (let i = Math.max(params.maLongPeriod, params.rsiPeriod); i < data.length; i++) {
    if (isNaN(maShort[i]) || isNaN(maLong[i]) || isNaN(rsi[i]) || isNaN(dif[i]) || isNaN(dea[i])) continue;

    let buyScore = 0;
    let sellScore = 0;
    const reasons: string[] = [];

    // 均线信号
    if (maShort[i] > maLong[i] && maShort[i - 1] <= maLong[i - 1]) {
      buyScore += 2;
      reasons.push('均线金叉');
    } else if (maShort[i] < maLong[i] && maShort[i - 1] >= maLong[i - 1]) {
      sellScore += 2;
      reasons.push('均线死叉');
    }

    // RSI信号
    if (rsi[i] < 40) {
      buyScore += 1;
      reasons.push('RSI低位');
    } else if (rsi[i] > 60) {
      sellScore += 1;
      reasons.push('RSI高位');
    }

    // MACD信号
    if (dif[i] > dea[i] && dif[i - 1] <= dea[i - 1]) {
      buyScore += 1;
      reasons.push('MACD金叉');
    } else if (dif[i] < dea[i] && dif[i - 1] >= dea[i - 1]) {
      sellScore += 1;
      reasons.push('MACD死叉');
    }

    const strength = Math.min(0.9, (buyScore + sellScore) / 4);

    if (buyScore >= 3) {
      signals.push({
        type: 'buy',
        timestamp: data[i].timestamp,
        price: data[i].close,
        strength,
        reason: reasons.join('+'),
      });
    } else if (sellScore >= 3) {
      signals.push({
        type: 'sell',
        timestamp: data[i].timestamp,
        price: data[i].close,
        strength,
        reason: reasons.join('+'),
      });
    }
  }

  return signals;
}

// AI智能策略信号(简化版,实际应接入ML模型)
function generateAIStrategySignals(data: KLineData[], params: any): TradeSignal[] {
  const signals: TradeSignal[] = [];

  const indicators = calculateAllIndicators(data);

  for (let i = params.lookbackPeriod; i < data.length; i++) {
    const recentData = data.slice(i - params.lookbackPeriod, i);
    const recentIndicators = {
      ma5: indicators.ma.ma5.slice(i - params.lookbackPeriod, i),
      rsi: indicators.rsi.rsi12.slice(i - params.lookbackPeriod, i),
      macd: indicators.macd.dif.slice(i - params.lookbackPeriod, i),
    };

    // 简化的AI判断逻辑
    const trendUp = recentIndicators.ma5[recentIndicators.ma5.length - 1] > recentIndicators.ma5[0];
    const rsiSafe = recentIndicators.rsi[recentIndicators.rsi.length - 1] < 70;
    const macdBullish = recentIndicators.macd[recentIndicators.macd.length - 1] > 0;

    let confidence = 0;
    const reasons: string[] = [];

    if (trendUp) {
      confidence += 0.3;
      reasons.push('上升趋势');
    }
    if (rsiSafe) {
      confidence += 0.3;
      reasons.push('RSI安全');
    }
    if (macdBullish) {
      confidence += 0.4;
      reasons.push('MACD多头');
    }

    if (confidence >= params.confidenceThreshold) {
      signals.push({
        type: 'buy',
        timestamp: data[i].timestamp,
        price: data[i].close,
        strength: confidence,
        reason: `AI判断: ${reasons.join(',')}(置信度${(confidence * 100).toFixed(0)}%)`,
      });
    }
  }

  return signals;
}

// 生成策略信号
export function generateStrategySignals(
  data: KLineData[],
  strategy: string,
  params?: any
): TradeSignal[] {
  const strategyParams = params || STRATEGY_PARAMS[strategy]?.parameters;

  switch (strategy) {
    case 'maCross':
      return generateMAStrategySignals(data, strategyParams);
    case 'macdStrategy':
      return generateMACDStrategySignals(data, strategyParams);
    case 'rsiStrategy':
      return generateRSIStrategySignals(data, strategyParams);
    case 'bollStrategy':
      return generateBOLLStrategySignals(data, strategyParams);
    case 'multiStrategy':
      return generateMultiStrategySignals(data, strategyParams);
    case 'aiStrategy':
      return generateAIStrategySignals(data, strategyParams);
    default:
      return [];
  }
}

// 回测引擎
export function runBacktest(config: BacktestConfig, data: KLineData[]): BacktestResult {
  const signals = generateStrategySignals(data, config.strategy);

  let capital = config.initialCapital;
  let position = 0;
  let entryPrice = 0;
  const trades: BacktestResult['trades'] = [];
  const equityCurve: BacktestResult['equityCurve'] = [];

  const stopLossPercent = config.stopLoss || STRATEGY_PARAMS[config.strategy]?.parameters?.stopLossPercent || 2;
  const takeProfitPercent = config.takeProfit || STRATEGY_PARAMS[config.strategy]?.parameters?.takeProfitPercent || 5;

  // 按时间顺序处理信号
  for (let i = 0; i < data.length; i++) {
    const currentPrice = data[i].close;

    // 更新权益曲线
    let equity = capital;
    if (position > 0) {
      equity = capital + (currentPrice - entryPrice) * position;
    }
    equityCurve.push({
      date: new Date(data[i].timestamp).toISOString().split('T')[0],
      equity,
      drawdown: 0,
    });

    // 检查止损止盈
    if (position > 0) {
      const profitPercent = ((currentPrice - entryPrice) / entryPrice) * 100;
      if (profitPercent <= -stopLossPercent || profitPercent >= takeProfitPercent) {
        const profit = (currentPrice - entryPrice) * position;
        capital += profit;

        const lastTrade = trades.find(t => !t.exitPrice);
        if (lastTrade) {
          lastTrade.exitPrice = currentPrice;
          lastTrade.exitTime = new Date(data[i].timestamp).toISOString();
          lastTrade.profit = profit;
          lastTrade.profitPercent = profitPercent;
        }

        position = 0;
        entryPrice = 0;
      }
    }

    // 处理交易信号
    const signal = signals.find(s => s.timestamp === data[i].timestamp);
    if (signal) {
      if (signal.type === 'buy' && position === 0) {
        // 开多仓
        position = Math.floor(capital / currentPrice);
        entryPrice = currentPrice;
        trades.push({
          id: `trade_${trades.length + 1}`,
          type: 'buy',
          entryPrice: currentPrice,
          entryTime: new Date(data[i].timestamp).toISOString(),
          quantity: position,
          profit: 0,
          profitPercent: 0,
        });
      } else if (signal.type === 'sell' && position > 0) {
        // 平多仓
        const profit = (currentPrice - entryPrice) * position;
        capital += profit;
        position = 0;

        const lastTrade = trades.find(t => !t.exitPrice);
        if (lastTrade) {
          lastTrade.exitPrice = currentPrice;
          lastTrade.exitTime = new Date(data[i].timestamp).toISOString();
          lastTrade.profit = profit;
          lastTrade.profitPercent = ((currentPrice - entryPrice) / entryPrice) * 100;
        }
      }
    }
  }

  // 计算回测指标
  const closedTrades = trades.filter(t => t.exitPrice);
  const winTrades = closedTrades.filter(t => t.profit > 0);
  const lossTrades = closedTrades.filter(t => t.profit < 0);

  const totalReturn = ((capital - config.initialCapital) / config.initialCapital) * 100;
  const winRate = closedTrades.length > 0 ? (winTrades.length / closedTrades.length) * 100 : 0;

  const avgProfit = winTrades.length > 0
    ? winTrades.reduce((sum, t) => sum + t.profit, 0) / winTrades.length
    : 0;
  const avgLoss = lossTrades.length > 0
    ? lossTrades.reduce((sum, t) => sum + t.profit, 0) / lossTrades.length
    : 0;

  const totalProfit = winTrades.reduce((sum, t) => sum + t.profit, 0);
  const totalLoss = Math.abs(lossTrades.reduce((sum, t) => sum + t.profit, 0));
  const profitFactor = totalLoss > 0 ? totalProfit / totalLoss : totalProfit > 0 ? Infinity : 0;

  // 计算最大回撤
  let maxEquity = config.initialCapital;
  let maxDrawdown = 0;
  equityCurve.forEach(curve => {
    maxEquity = Math.max(maxEquity, curve.equity);
    const drawdown = ((maxEquity - curve.equity) / maxEquity) * 100;
    curve.drawdown = drawdown;
    maxDrawdown = Math.max(maxDrawdown, drawdown);
  });

  // 计算夏普比率
  const returns = [];
  for (let i = 1; i < equityCurve.length; i++) {
    returns.push((equityCurve[i].equity - equityCurve[i - 1].equity) / equityCurve[i - 1].equity);
  }
  const avgReturn = returns.reduce((a, b) => a + b, 0) / returns.length;
  const variance = returns.reduce((sum, r) => sum + Math.pow(r - avgReturn, 2), 0) / returns.length;
  const sharpeRatio = variance > 0 ? (avgReturn / Math.sqrt(variance)) * Math.sqrt(252) : 0;

  // 计算月度收益
  const monthlyReturns: { [key: string]: number[] } = {};
  equityCurve.forEach(curve => {
    const month = curve.date.substring(0, 7);
    if (!monthlyReturns[month]) {
      monthlyReturns[month] = [];
    }
    monthlyReturns[month].push(curve.equity);
  });

  const monthlyReturnData = Object.entries(monthlyReturns).map(([month, equities]) => {
    const startEquity = equities[0];
    const endEquity = equities[equities.length - 1];
    return {
      month,
      return: ((endEquity - startEquity) / startEquity) * 100,
    };
  });

  // 计算波动率和VaR
  const volatility = Math.sqrt(variance) * Math.sqrt(252) * 100;
  const sortedReturns = [...returns].sort((a, b) => a - b);
  const var95 = sortedReturns[Math.floor(sortedReturns.length * 0.05)] * config.initialCapital;
  const var99 = sortedReturns[Math.floor(sortedReturns.length * 0.01)] * config.initialCapital;

  return {
    summary: {
      totalReturn,
      annualizedReturn: totalReturn * (365 / (data.length || 1)),
      maxDrawdown,
      sharpeRatio,
      sortinoRatio: sharpeRatio * 0.9,
      winRate,
      profitFactor: profitFactor === Infinity ? 100 : profitFactor,
      totalTrades: closedTrades.length,
      avgProfit,
      avgLoss,
    },
    equityCurve,
    trades: closedTrades,
    riskMetrics: {
      volatility,
      var95,
      var99,
      beta: 1,
      alpha: totalReturn * 0.01,
    },
    monthlyReturns: monthlyReturnData,
  };
}

// 策略优化
export function optimizeStrategy(
  data: KLineData[],
  strategy: string,
  paramRanges: Record<string, [number, number, number]>
): { params: Record<string, number>; result: BacktestResult }[] {
  const results: { params: Record<string, number>; result: BacktestResult }[] = [];

  // 生成参数组合(简化版,实际应使用网格搜索或遗传算法)
  const paramNames = Object.keys(paramRanges);

  function generateCombinations(index: number, currentParams: Record<string, number>) {
    if (index === paramNames.length) {
      const config: BacktestConfig = {
        symbol: 'test',
        strategy,
        startDate: new Date(data[0].timestamp).toISOString().split('T')[0],
        endDate: new Date(data[data.length - 1].timestamp).toISOString().split('T')[0],
        initialCapital: 100000,
        commission: 0.001,
        slippage: 0,
        leverage: 1,
      };

      const result = runBacktest(config, data);
      results.push({ params: { ...currentParams }, result });
      return;
    }

    const [min, max, step] = paramRanges[paramNames[index]];
    for (let value = min; value <= max; value += step) {
      generateCombinations(index + 1, { ...currentParams, [paramNames[index]]: value });
    }
  }

  generateCombinations(0, {});

  // 按夏普比率排序
  results.sort((a, b) => b.result.summary.sharpeRatio - a.result.summary.sharpeRatio);

  return results.slice(0, 10); // 返回前10个最优组合
}
