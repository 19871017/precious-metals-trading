/**
 * 技术指标计算服务
 * 提供常用的技术分析指标计算功能
 */

export interface KLineData {
  time: number;
  open: number;
  close: number;
  high: number;
  low: number;
  volume: number;
}

export interface TechnicalIndicators {
  // 趋势指标
  ma5: number;
  ma10: number;
  ma20: number;
  ma60: number;
  
  // 动量指标
  macd: {
    dif: number;
    dea: number;
    macd: number;
    signal: 'buy' | 'sell' | 'neutral';
  };
  
  rsi: {
    value: number;
    signal: 'buy' | 'sell' | 'neutral';
  };
  
  kdj: {
    k: number;
    d: number;
    j: number;
    signal: 'buy' | 'sell' | 'neutral';
  };
  
  // 波动率指标
  bollinger: {
    upper: number;
    middle: number;
    lower: number;
    width: number;
  };
  
  atr: number;
  
  // 成交量指标
  volumeMA: number;
  volumeRatio: number;
}

/**
 * 计算移动平均线 (MA)
 */
export function calculateMA(data: KLineData[], period: number): number {
  if (data.length < period) return 0;
  
  const sum = data.slice(-period).reduce((acc, item) => acc + item.close, 0);
  return sum / period;
}

/**
 * 计算 MACD (指数平滑异同移动平均线)
 */
export function calculateMACD(data: KLineData[]): {
  dif: number;
  dea: number;
  macd: number;
  signal: 'buy' | 'sell' | 'neutral';
} {
  if (data.length < 26) {
    return { dif: 0, dea: 0, macd: 0, signal: 'neutral' };
  }
  
  const shortPeriod = 12;
  const longPeriod = 26;
  const signalPeriod = 9;
  
  // 计算短期 EMA
  const emaShort = calculateEMA(data.map(d => d.close), shortPeriod);
  // 计算长期 EMA
  const emaLong = calculateEMA(data.map(d => d.close), longPeriod);
  
  const dif = emaShort - emaLong;
  
  // 简化处理：用最近N个DIF计算DEA
  const recentData = data.slice(-signalPeriod);
  const dea = calculateEMA(Array(signalPeriod).fill(dif), signalPeriod);
  
  const macd = (dif - dea) * 2;
  
  let signal: 'buy' | 'sell' | 'neutral';
  if (dif > 0 && macd > 0) {
    signal = 'buy';
  } else if (dif < 0 && macd < 0) {
    signal = 'sell';
  } else {
    signal = 'neutral';
  }
  
  return { dif, dea, macd, signal };
}

/**
 * 计算 EMA (指数移动平均)
 */
function calculateEMA(data: number[], period: number): number {
  if (data.length < period) return data[data.length - 1] || 0;
  
  const k = 2 / (period + 1);
  let ema = data[0];
  
  for (let i = 1; i < data.length; i++) {
    ema = data[i] * k + ema * (1 - k);
  }
  
  return ema;
}

/**
 * 计算 RSI (相对强弱指标)
 */
export function calculateRSI(data: KLineData[], period: number = 14): {
  value: number;
  signal: 'buy' | 'sell' | 'neutral';
} {
  if (data.length < period + 1) {
    return { value: 50, signal: 'neutral' };
  }
  
  let gains = 0;
  let losses = 0;
  
  // 计算初始平均涨跌
  for (let i = data.length - period; i < data.length; i++) {
    const change = data[i].close - data[i - 1].close;
    if (change > 0) {
      gains += change;
    } else {
      losses += Math.abs(change);
    }
  }
  
  const avgGain = gains / period;
  const avgLoss = losses / period;
  
  const rs = avgLoss === 0 ? 100 : avgGain / avgLoss;
  const rsi = 100 - (100 / (1 + rs));
  
  let signal: 'buy' | 'sell' | 'neutral';
  if (rsi < 30) {
    signal = 'buy'; // 超卖
  } else if (rsi > 70) {
    signal = 'sell'; // 超买
  } else {
    signal = 'neutral';
  }
  
  return { value: rsi, signal };
}

/**
 * 计算 KDJ (随机指标)
 */
export function calculateKDJ(data: KLineData[], period: number = 9): {
  k: number;
  d: number;
  j: number;
  signal: 'buy' | 'sell' | 'neutral';
} {
  if (data.length < period + 2) {
    return { k: 50, d: 50, j: 50, signal: 'neutral' };
  }
  
  // 取最近period根K线
  const recentData = data.slice(-period);
  
  const high = Math.max(...recentData.map(d => d.high));
  const low = Math.min(...recentData.map(d => d.low));
  const close = recentData[recentData.length - 1].close;
  
  const rsv = high === low ? 50 : ((close - low) / (high - low)) * 100;
  
  // 简化处理：使用固定值模拟K、D、J
  const k = rsv * (1 / 3) + 50 * (2 / 3);
  const d = k * (1 / 3) + 50 * (2 / 3);
  const j = 3 * k - 2 * d;
  
  let signal: 'buy' | 'sell' | 'neutral';
  if (k < 20 && d < 20) {
    signal = 'buy'; // 超卖
  } else if (k > 80 && d > 80) {
    signal = 'sell'; // 超买
  } else if (k > d && j > k) {
    signal = 'buy'; // 金叉
  } else if (k < d && j < k) {
    signal = 'sell'; // 死叉
  } else {
    signal = 'neutral';
  }
  
  return { k, d, j, signal };
}

/**
 * 计算布林带 (BOLL)
 */
export function calculateBollinger(data: KLineData[], period: number = 20): {
  upper: number;
  middle: number;
  lower: number;
  width: number;
} {
  if (data.length < period) {
    const price = data[data.length - 1]?.close || 0;
    return { upper: price, middle: price, lower: price, width: 0 };
  }
  
  const recentData = data.slice(-period);
  const middle = recentData.reduce((acc, d) => acc + d.close, 0) / period;
  
  // 计算标准差
  const variance = recentData.reduce((acc, d) => acc + Math.pow(d.close - middle, 2), 0) / period;
  const stdDev = Math.sqrt(variance);
  
  const upper = middle + 2 * stdDev;
  const lower = middle - 2 * stdDev;
  const width = middle === 0 ? 0 : ((upper - lower) / middle) * 100;
  
  return { upper, middle, lower, width };
}

/**
 * 计算 ATR (平均真实波幅)
 */
export function calculateATR(data: KLineData[], period: number = 14): number {
  if (data.length < period + 1) return 0;
  
  const trValues: number[] = [];
  
  for (let i = 1; i < data.length; i++) {
    const high = data[i].high;
    const low = data[i].low;
    const prevClose = data[i - 1].close;
    
    const tr = Math.max(high - low, Math.abs(high - prevClose), Math.abs(low - prevClose));
    trValues.push(tr);
  }
  
  // 使用最近period个TR值
  const recentTR = trValues.slice(-period);
  return recentTR.reduce((acc, val) => acc + val, 0) / period;
}

/**
 * 计算成交量均线
 */
export function calculateVolumeMA(data: KLineData[], period: number = 5): number {
  if (data.length < period) return 0;
  
  const sum = data.slice(-period).reduce((acc, item) => acc + item.volume, 0);
  return sum / period;
}

/**
 * 计算成交量比率
 */
export function calculateVolumeRatio(data: KLineData[]): number {
  if (data.length < 5) return 1;
  
  const currentVolume = data[data.length - 1].volume;
  const volumeMA = calculateVolumeMA(data, 5);
  
  return volumeMA === 0 ? 1 : currentVolume / volumeMA;
}

/**
 * 计算所有技术指标
 */
export function calculateAllIndicators(data: KLineData[]): TechnicalIndicators {
  return {
    ma5: calculateMA(data, 5),
    ma10: calculateMA(data, 10),
    ma20: calculateMA(data, 20),
    ma60: calculateMA(data, 60),
    macd: calculateMACD(data),
    rsi: calculateRSI(data, 14),
    kdj: calculateKDJ(data, 9),
    bollinger: calculateBollinger(data, 20),
    atr: calculateATR(data, 14),
    volumeMA: calculateVolumeMA(data, 5),
    volumeRatio: calculateVolumeRatio(data)
  };
}

/**
 * 生成技术分析摘要
 */
export function generateTechnicalSummary(indicators: TechnicalIndicators, currentPrice: number): {
  trend: string;
  signal: 'buy' | 'sell' | 'neutral';
  strength: number; // 0-100
  support: number[];
  resistance: number[];
  summary: string;
} {
  const signals = {
    buy: 0,
    sell: 0,
    neutral: 0
  };
  
  // 统计各个指标的信号
  if (indicators.macd.signal === 'buy') signals.buy++;
  if (indicators.macd.signal === 'sell') signals.sell++;
  
  if (indicators.rsi.signal === 'buy') signals.buy++;
  if (indicators.rsi.signal === 'sell') signals.sell++;
  
  if (indicators.kdj.signal === 'buy') signals.buy++;
  if (indicators.kdj.signal === 'sell') signals.sell++;
  
  // 均线排列
  if (indicators.ma5 > indicators.ma10 && indicators.ma10 > indicators.ma20) {
    signals.buy++; // 多头排列
  } else if (indicators.ma5 < indicators.ma10 && indicators.ma10 < indicators.ma20) {
    signals.sell++; // 空头排列
  } else {
    signals.neutral++; // 震荡
  }
  
  // 价格与均线关系
  if (currentPrice > indicators.ma20) signals.buy++;
  else if (currentPrice < indicators.ma20) signals.sell++;
  else signals.neutral++;
  
  // 综合判断
  let signal: 'buy' | 'sell' | 'neutral';
  let trend: string;
  let strength: number;
  
  const maxSignals = Math.max(signals.buy, signals.sell, signals.neutral);
  
  if (signals.buy >= signals.sell && signals.buy >= signals.neutral) {
    signal = 'buy';
    trend = signals.buy === 5 ? '强势上涨' : signals.buy >= 3 ? '温和上涨' : '震荡偏多';
    strength = Math.round((signals.buy / 5) * 100);
  } else if (signals.sell >= signals.buy && signals.sell >= signals.neutral) {
    signal = 'sell';
    trend = signals.sell === 5 ? '强势下跌' : signals.sell >= 3 ? '温和下跌' : '震荡偏空';
    strength = Math.round((signals.sell / 5) * 100);
  } else {
    signal = 'neutral';
    trend = '横盘震荡';
    strength = 50;
  }
  
  // 计算支撑阻力位
  const support = [
    indicators.bollinger.lower,
    currentPrice - indicators.atr,
    currentPrice - indicators.atr * 2
  ].filter(v => v > 0).sort((a, b) => b - a);
  
  const resistance = [
    indicators.bollinger.upper,
    currentPrice + indicators.atr,
    currentPrice + indicators.atr * 2
  ].filter(v => v > 0).sort((a, b) => a - b);
  
  // 生成分析摘要
  const summary = `当前价格 ${currentPrice.toFixed(2)}，
    ${trend}趋势（强度${strength}%）。
    MACD显示${indicators.macd.signal === 'buy' ? '多头' : indicators.macd.signal === 'sell' ? '空头' : '中性'}信号，
    RSI ${indicators.rsi.value.toFixed(1)}（${indicators.rsi.value < 30 ? '超卖' : indicators.rsi.value > 70 ? '超买' : '中性'}），
    KDJ ${indicators.kdj.signal === 'buy' ? '金叉' : indicators.kdj.signal === 'sell' ? '死叉' : '中性'}。
    关键支撑位：${support.slice(0, 2).map(v => v.toFixed(2)).join(', ')}，
    关键阻力位：${resistance.slice(0, 2).map(v => v.toFixed(2)).join(', ')}。`;
  
  return {
    trend,
    signal,
    strength,
    support,
    resistance,
    summary
  };
}
