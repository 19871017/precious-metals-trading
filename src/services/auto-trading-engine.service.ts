import { EventEmitter } from 'events';
import logger from '../utils/logger';

export enum TradingStatus {
  IDLE = 'idle',
  RUNNING = 'running',
  PAUSED = 'paused',
  STOPPED = 'stopped',
  ERROR = 'error',
}

export interface AutoTradingConfig {
  strategyId: string;
  strategyName: string;
  symbols: string[];
  initialCapital: number;
  maxPositionSize: number;
  maxDailyLoss: number;
  maxDrawdown: number;
  autoStopLoss: boolean;
  autoTakeProfit: boolean;
  stopLossPercent: number;
  takeProfitPercent: number;
  leverage: number;
  enabled: boolean;
}

export interface TradeSignal {
  id: string;
  timestamp: number;
  symbol: string;
  type: 'buy' | 'sell' | 'close';
  price: number;
  quantity: number;
  strategy: string;
  confidence: number;
  reason: string;
  stopLoss?: number;
  takeProfit?: number;
}

export interface AutoPosition {
  id: string;
  symbol: string;
  type: 'long' | 'short';
  quantity: number;
  entryPrice: number;
  stopLoss?: number;
  takeProfit?: number;
  leverage: number;
  openedAt: number;
  currentPrice: number;
  profitLoss: number;
  profitLossPercent: number;
}

export interface TradingLog {
  id: string;
  timestamp: number;
  type: 'info' | 'success' | 'warning' | 'error' | 'signal';
  message: string;
  data?: any;
}

export interface TradingStats {
  totalTrades: number;
  winningTrades: number;
  losingTrades: number;
  totalProfit: number;
  totalLoss: number;
  winRate: number;
  maxDrawdown: number;
  currentDrawdown: number;
  peakEquity: number;
  startTime: number;
  uptime: number;
}

export class AutoTradingEngine extends EventEmitter {
  private config: AutoTradingConfig | null = null;
  private status: TradingStatus = TradingStatus.IDLE;
  private positions: Map<string, AutoPosition> = new Map();
  private logs: TradingLog[] = [];
  private stats: TradingStats = this.createInitialStats();
  private monitorInterval: NodeJS.Timeout | null = null;
  private startTime: number = 0;
  private initialEquity: number = 0;

  constructor() {
    super();
    this.setMaxListeners(50);
  }

  private createInitialStats(): TradingStats {
    return {
      totalTrades: 0,
      winningTrades: 0,
      losingTrades: 0,
      totalProfit: 0,
      totalLoss: 0,
      winRate: 0,
      maxDrawdown: 0,
      currentDrawdown: 0,
      peakEquity: 0,
      startTime: 0,
      uptime: 0,
    };
  }

  /**
   * 启动自动交易
   */
  public async start(config: AutoTradingConfig): Promise<void> {
    if (this.status === TradingStatus.RUNNING) {
      logger.warn('[AutoTrading] Already running');
      return;
    }

    if (!config.enabled) {
      logger.warn('[AutoTrading] Strategy is disabled');
      return;
    }

    try {
      this.config = config;
      this.status = TradingStatus.RUNNING;
      this.startTime = Date.now();
      this.initialEquity = config.initialCapital;
      this.stats.peakEquity = config.initialCapital;

      this.addLog('info', `自动交易已启动 - 策略: ${config.strategyName}`, { config });

      this.emit('statusChanged', { status: this.status, config });

      this.startMonitoring();

      logger.info('[AutoTrading] Started successfully', { config: config.strategyId });
    } catch (error) {
      this.handleError(error as Error, '启动失败');
    }
  }

  /**
   * 停止自动交易
   */
  public async stop(): Promise<void> {
    if (this.status === TradingStatus.IDLE || this.status === TradingStatus.STOPPED) {
      return;
    }

    try {
      this.addLog('info', '正在停止自动交易...');

      this.stopMonitoring();

      this.status = TradingStatus.STOPPED;

      this.addLog('success', '自动交易已停止');
      this.emit('statusChanged', { status: this.status });

      logger.info('[AutoTrading] Stopped');
    } catch (error) {
      this.handleError(error as Error, '停止失败');
    }
  }

  /**
   * 暂停自动交易
   */
  public async pause(): Promise<void> {
    if (this.status !== TradingStatus.RUNNING) {
      logger.warn('[AutoTrading] Cannot pause, not running');
      return;
    }

    this.status = TradingStatus.PAUSED;
    this.addLog('warning', '自动交易已暂停');
    this.emit('statusChanged', { status: this.status });
  }

  /**
   * 恢复自动交易
   */
  public async resume(): Promise<void> {
    if (this.status !== TradingStatus.PAUSED) {
      logger.warn('[AutoTrading] Cannot resume, not paused');
      return;
    }

    this.status = TradingStatus.RUNNING;
    this.addLog('success', '自动交易已恢复');
    this.emit('statusChanged', { status: this.status });
  }

  /**
   * 处理交易信号
   */
  public async handleSignal(signal: TradeSignal): Promise<void> {
    if (this.status !== TradingStatus.RUNNING) {
      logger.warn('[AutoTrading] Ignoring signal, not running');
      return;
    }

    if (!this.config || !this.config.symbols.includes(signal.symbol)) {
      return;
    }

    try {
      this.addLog('signal', `收到交易信号: ${signal.type.toUpperCase()} ${signal.symbol}`, signal);

      if (signal.type === 'buy' || signal.type === 'sell') {
        await this.openPosition(signal);
      } else if (signal.type === 'close') {
        await this.closePosition(signal.symbol);
      }

      this.emit('signalProcessed', signal);
    } catch (error) {
      this.handleError(error as Error, '信号处理失败');
    }
  }

  /**
   * 更新市场价格
   */
  public updatePrice(symbol: string, price: number): void {
    const position = this.positions.get(symbol);
    if (!position) {
      return;
    }

    const oldPrice = position.currentPrice;
    position.currentPrice = price;

    const priceChange = price - position.entryPrice;
    const profitLoss = priceChange * position.quantity * (position.type === 'long' ? 1 : -1);
    const profitLossPercent = (priceChange / position.entryPrice) * 100;

    position.profitLoss = profitLoss;
    position.profitLossPercent = profitLossPercent;

    this.positions.set(symbol, position);

    this.emit('positionUpdated', { symbol, position });

    if (this.status === TradingStatus.RUNNING) {
      this.checkStopLossAndTakeProfit(position);
    }
  }

  /**
   * 获取当前状态
   */
  public getStatus(): TradingStatus {
    return this.status;
  }

  /**
   * 获取配置
   */
  public getConfig(): AutoTradingConfig | null {
    return this.config;
  }

  /**
   * 获取所有持仓
   */
  public getPositions(): AutoPosition[] {
    return Array.from(this.positions.values());
  }

  /**
   * 获取日志
   */
  public getLogs(limit: number = 100): TradingLog[] {
    return this.logs.slice(-limit);
  }

  /**
   * 获取统计信息
   */
  public getStats(): TradingStats {
    const uptime = this.startTime > 0 ? Date.now() - this.startTime : 0;

    const stats = { ...this.stats };
    stats.uptime = uptime;

    return stats;
  }

  /**
   * 添加日志
   */
  private addLog(type: TradingLog['type'], message: string, data?: any): void {
    const log: TradingLog = {
      id: `log_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      timestamp: Date.now(),
      type,
      message,
      data,
    };

    this.logs.push(log);
    this.emit('logAdded', log);

    if (this.logs.length > 1000) {
      this.logs = this.logs.slice(-500);
    }
  }

  /**
   * 错误处理
   */
  private handleError(error: Error, context: string): void {
    logger.error(`[AutoTrading] ${context}:`, error);
    this.addLog('error', `${context}: ${error.message}`);
    this.status = TradingStatus.ERROR;
    this.emit('error', { error, context });
  }

  /**
   * 开仓
   */
  private async openPosition(signal: TradeSignal): Promise<void> {
    if (this.positions.has(signal.symbol)) {
      this.addLog('warning', `已有${signal.symbol}持仓,跳过开仓`);
      return;
    }

    if (!this.config) {
      return;
    }

    const position: AutoPosition = {
      id: `pos_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      symbol: signal.symbol,
      type: signal.type === 'buy' ? 'long' : 'short',
      quantity: signal.quantity,
      entryPrice: signal.price,
      leverage: this.config.leverage,
      openedAt: Date.now(),
      currentPrice: signal.price,
      profitLoss: 0,
      profitLossPercent: 0,
    };

    if (signal.stopLoss) {
      position.stopLoss = signal.stopLoss;
    }
    if (signal.takeProfit) {
      position.takeProfit = signal.takeProfit;
    }

    this.positions.set(signal.symbol, position);

    this.stats.totalTrades++;
    this.addLog('success', `开仓成功: ${signal.type === 'buy' ? '做多' : '做空'} ${signal.symbol} ${signal.quantity}手 @ ${signal.price}`, {
      position,
    });

    this.emit('positionOpened', position);
  }

  /**
   * 平仓
   */
  private async closePosition(symbol: string, reason: string = '手动平仓'): Promise<void> {
    const position = this.positions.get(symbol);
    if (!position) {
      return;
    }

    const profit = position.profitLoss;
    const profitPercent = position.profitLossPercent;

    if (profit > 0) {
      this.stats.winningTrades++;
      this.stats.totalProfit += profit;
    } else if (profit < 0) {
      this.stats.losingTrades++;
      this.stats.totalLoss += Math.abs(profit);
    }

    this.positions.delete(symbol);

    const result = profit >= 0 ? '盈利' : '亏损';
    this.addLog('info', `平仓: ${symbol} ${result} ¥${profit.toFixed(2)} (${profitPercent.toFixed(2)}%) - ${reason}`, {
      symbol,
      profit,
      profitPercent,
      reason,
    });

    this.emit('positionClosed', { symbol, position, reason });
  }

  /**
   * 检查止损止盈
   */
  private checkStopLossAndTakeProfit(position: AutoPosition): void {
    if (!this.config || !this.config.autoStopLoss && !this.config.autoTakeProfit) {
      return;
    }

    let shouldClose = false;
    let reason = '';

    if (this.config.autoStopLoss && position.stopLoss) {
      const hitStopLoss = position.type === 'long'
        ? position.currentPrice <= position.stopLoss
        : position.currentPrice >= position.stopLoss;

      if (hitStopLoss) {
        shouldClose = true;
        reason = '止损触发';
      }
    }

    if (!shouldClose && this.config.autoTakeProfit && position.takeProfit) {
      const hitTakeProfit = position.type === 'long'
        ? position.currentPrice >= position.takeProfit
        : position.currentPrice <= position.takeProfit;

      if (hitTakeProfit) {
        shouldClose = true;
        reason = '止盈触发';
      }
    }

    if (shouldClose) {
      this.closePosition(position.symbol, reason);
    }
  }

  /**
   * 检查风控
   */
  private checkRiskControl(): void {
    if (!this.config) {
      return;
    }

    const totalProfit = Array.from(this.positions.values()).reduce((sum, p) => sum + p.profitLoss, 0);
    const currentEquity = this.initialEquity + totalProfit;
    const drawdownPercent = ((this.stats.peakEquity - currentEquity) / this.stats.peakEquity) * 100;

    this.stats.currentDrawdown = drawdownPercent;

    if (drawdownPercent > this.stats.maxDrawdown) {
      this.stats.maxDrawdown = drawdownPercent;
    }

    if (currentEquity > this.stats.peakEquity) {
      this.stats.peakEquity = currentEquity;
    }

    if (Math.abs(totalProfit) > this.config.maxDailyLoss) {
      this.addLog('warning', `触发日亏损限制: ¥${Math.abs(totalProfit).toFixed(2)},停止所有交易`);
      this.stop();
    }

    if (this.config.maxDrawdown > 0 && drawdownPercent > this.config.maxDrawdown) {
      this.addLog('warning', `触发最大回撤限制: ${drawdownPercent.toFixed(2)}%,停止所有交易`);
      this.stop();
    }
  }

  /**
   * 启动监控
   */
  private startMonitoring(): void {
    if (this.monitorInterval) {
      clearInterval(this.monitorInterval);
    }

    this.monitorInterval = setInterval(() => {
      try {
        this.checkRiskControl();
        this.updateStats();
      } catch (error) {
        this.handleError(error as Error, '监控失败');
      }
    }, 1000);

    this.addLog('info', '监控循环已启动');
  }

  /**
   * 停止监控
   */
  private stopMonitoring(): void {
    if (this.monitorInterval) {
      clearInterval(this.monitorInterval);
      this.monitorInterval = null;
      this.addLog('info', '监控循环已停止');
    }
  }

  /**
   * 更新统计
   */
  private updateStats(): void {
    const totalTrades = this.stats.winningTrades + this.stats.losingTrades;
    this.stats.winRate = totalTrades > 0 ? (this.stats.winningTrades / totalTrades) * 100 : 0;
  }
}

export const autoTradingEngine = new AutoTradingEngine();
