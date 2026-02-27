import { socketService } from './socket.service';
import { autoTradingEngine, TradeSignal } from './auto-trading-engine.service';
import { generateStrategySignals, KLineData } from './strategy.service';
import logger from '../utils/logger';

export interface MarketData {
  symbol: string;
  price: number;
  change: number;
  changePercent: number;
  high24h: number;
  low24h: number;
  volume24h: number;
  timestamp: number;
}

export interface SignalConfig {
  strategyId: string;
  symbols: string[];
  enabled: boolean;
  parameters?: Record<string, any>;
}

export class MarketMonitor {
  private monitoring: boolean = false;
  private subscribedSymbols: Set<string> = new Set();
  private marketDataCache: Map<string, MarketData> = new Map();
  private klineDataCache: Map<string, KLineData[]> = new Map();
  private lastSignalTime: Map<string, number> = new Map();
  private cooldownPeriod = 30000; // 30秒冷却期

  /**
   * 开始监听市场数据
   */
  public async start(config: SignalConfig): Promise<void> {
    if (this.monitoring) {
      logger.warn('[MarketMonitor] Already monitoring');
      return;
    }

    if (!config.enabled) {
      logger.warn('[MarketMonitor] Signal config is disabled');
      return;
    }

    try {
      this.monitoring = true;

      const symbols = config.symbols;
      this.subscribedSymbols = new Set(symbols);

      logger.info('[MarketMonitor] Starting to monitor', { symbols, strategyId: config.strategyId });

      await this.subscribeToMarket(symbols);
      await this.loadInitialKLineData(symbols);

      this.setupSignalGeneration(config);

      logger.info('[MarketMonitor] Monitoring started successfully');
    } catch (error) {
      this.monitoring = false;
      logger.error('[MarketMonitor] Failed to start monitoring:', error);
      throw error;
    }
  }

  /**
   * 停止监听
   */
  public async stop(): Promise<void> {
    if (!this.monitoring) {
      return;
    }

    try {
      this.monitoring = false;

      await this.unsubscribeFromMarket();

      this.subscribedSymbols.clear();
      this.marketDataCache.clear();
      this.klineDataCache.clear();
      this.lastSignalTime.clear();

      logger.info('[MarketMonitor] Monitoring stopped');
    } catch (error) {
      logger.error('[MarketMonitor] Failed to stop monitoring:', error);
    }
  }

  /**
   * 订阅市场数据
   */
  private async subscribeToMarket(symbols: string[]): Promise<void> {
    return new Promise((resolve, reject) => {
      try {
        const handleMessage = (data: any) => {
          if (data.type === 'update' || data.type === 'data') {
            this.handleMarketDataUpdate(data);
          }
        };

        socketService.subscribeMarket(symbols, handleMessage);
        resolve();
      } catch (error) {
        reject(error);
      }
    });
  }

  /**
   * 取消订阅
   */
  private async unsubscribeFromMarket(): Promise<void> {
    try {
      socketService.unsubscribeMarket();
    } catch (error) {
      logger.error('[MarketMonitor] Failed to unsubscribe:', error);
    }
  }

  /**
   * 加载初始K线数据
   */
  private async loadInitialKLineData(symbols: string[]): Promise<void> {
    try {
      for (const symbol of symbols) {
        const klineData = await this.fetchKLineData(symbol, 200);
        if (klineData.length > 0) {
          this.klineDataCache.set(symbol, klineData);
        }
      }

      logger.info('[MarketMonitor] Initial K-line data loaded', { 
        symbols: symbols.length,
        dataPoints: Array.from(this.klineDataCache.values()).reduce((sum, arr) => sum + arr.length, 0)
      });
    } catch (error) {
      logger.error('[MarketMonitor] Failed to load initial K-line data:', error);
    }
  }

  /**
   * 获取K线数据
   */
  private async fetchKLineData(symbol: string, limit: number = 200): Promise<KLineData[]> {
    try {
      const response = await fetch(`/api/market/kline?symbol=${symbol}&period=1h&limit=${limit}`);
      if (response.ok) {
        const data = await response.json();
        if (data.code === 0 && data.data) {
          return data.data;
        }
      }
      return [];
    } catch (error) {
      logger.error(`[MarketMonitor] Failed to fetch K-line data for ${symbol}:`, error);
      return [];
    }
  }

  /**
   * 处理市场数据更新
   */
  private handleMarketDataUpdate(data: any): void {
    if (!data.data || !Array.isArray(data.data)) {
      return;
    }

    data.data.forEach((item: any) => {
      const marketData: MarketData = {
        symbol: item.productCode,
        price: item.lastPrice || item.price,
        change: item.change || 0,
        changePercent: item.changePercent || 0,
        high24h: item.high24h || 0,
        low24h: item.low24h || 0,
        volume24h: item.volume24h || 0,
        timestamp: Date.now(),
      };

      this.marketDataCache.set(marketData.symbol, marketData);

      this.updateKLineData(marketData);
      this.updateEnginePrice(marketData.symbol, marketData.price);
    });
  }

  /**
   * 更新K线数据
   */
  private updateKLineData(marketData: MarketData): void {
    let klineData = this.klineDataCache.get(marketData.symbol) || [];

    const lastKline = klineData.length > 0 ? klineData[klineData.length - 1] : null;

    if (lastKline) {
      const lastTimestamp = lastKline.timestamp;
      const currentTimestamp = Date.now();

      if (currentTimestamp - lastTimestamp > 3600000) {
        klineData.push({
          timestamp: currentTimestamp,
          open: marketData.price,
          high: marketData.price,
          low: marketData.price,
          close: marketData.price,
          volume: Math.random() * 1000,
        });
      } else {
        lastKline.close = marketData.price;
        if (marketData.price > lastKline.high) {
          lastKline.high = marketData.price;
        }
        if (marketData.price < lastKline.low) {
          lastKline.low = marketData.price;
        }
      }
    } else {
      klineData.push({
        timestamp: Date.now(),
        open: marketData.price,
        high: marketData.price,
        low: marketData.price,
        close: marketData.price,
        volume: Math.random() * 1000,
      });
    }

    if (klineData.length > 500) {
      klineData = klineData.slice(-200);
    }

    this.klineDataCache.set(marketData.symbol, klineData);
  }

  /**
   * 更新引擎价格
   */
  private updateEnginePrice(symbol: string, price: number): void {
    autoTradingEngine.updatePrice(symbol, price);
  }

  /**
   * 设置信号生成
   */
  private setupSignalGeneration(config: SignalConfig): void {
    const intervalId = setInterval(() => {
      if (!this.monitoring || autoTradingEngine.getStatus() !== 'running') {
        return;
      }

      this.generateSignals(config);
    }, 10000);

    logger.info('[MarketMonitor] Signal generation configured');
  }

  /**
   * 生成交易信号
   */
  private async generateSignals(config: SignalConfig): Promise<void> {
    try {
      for (const symbol of config.symbols) {
        if (this.isInCooldown(symbol)) {
          continue;
        }

        const klineData = this.klineDataCache.get(symbol);

        if (!klineData || klineData.length < 50) {
          continue;
        }

        const signals = generateStrategySignals(klineData, config.parameters || {});

        for (const signal of signals) {
          if (signal.type !== 'hold') {
            const tradeSignal: TradeSignal = {
              id: `signal_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
              timestamp: Date.now(),
              symbol: symbol,
              type: signal.type,
              price: signal.price,
              quantity: this.calculateQuantity(signal.price),
              strategy: config.strategyId,
              confidence: signal.strength,
              reason: signal.reason,
              stopLoss: this.calculateStopLoss(signal.price, signal.type),
              takeProfit: this.calculateTakeProfit(signal.price, signal.type),
            };

            await autoTradingEngine.handleSignal(tradeSignal);

            this.setCooldown(symbol);

            logger.info('[MarketMonitor] Signal generated and sent to engine', {
              symbol,
              type: signal.type,
              price: signal.price,
            });
          }
        }
      }
    } catch (error) {
      logger.error('[MarketMonitor] Failed to generate signals:', error);
    }
  }

  /**
   * 计算交易数量
   */
  private calculateQuantity(price: number): number {
    const capital = 100000;
    const leverage = 10;
    const positionValue = capital * 0.3;

    return Math.floor(positionValue / price / leverage);
  }

  /**
   * 计算止损价格
   */
  private calculateStopLoss(price: number, type: 'buy' | 'sell'): number {
    const stopLossPercent = 0.02;

    if (type === 'buy') {
      return price * (1 - stopLossPercent);
    } else {
      return price * (1 + stopLossPercent);
    }
  }

  /**
   * 计算止盈价格
   */
  private calculateTakeProfit(price: number, type: 'buy' | 'sell'): number {
    const takeProfitPercent = 0.05;

    if (type === 'buy') {
      return price * (1 + takeProfitPercent);
    } else {
      return price * (1 - takeProfitPercent);
    }
  }

  /**
   * 检查是否在冷却期
   */
  private isInCooldown(symbol: string): boolean {
    const lastTime = this.lastSignalTime.get(symbol) || 0;
    const now = Date.now();
    return (now - lastTime) < this.cooldownPeriod;
  }

  /**
   * 设置冷却期
   */
  private setCooldown(symbol: string): void {
    this.lastSignalTime.set(symbol, Date.now());
  }

  /**
   * 获取缓存的市场数据
   */
  public getMarketData(symbol: string): MarketData | undefined {
    return this.marketDataCache.get(symbol);
  }

  /**
   * 获取所有市场数据
   */
  public getAllMarketData(): MarketData[] {
    return Array.from(this.marketDataCache.values());
  }

  /**
   * 获取K线数据
   */
  public getKLineData(symbol: string): KLineData[] | undefined {
    return this.klineDataCache.get(symbol);
  }

  /**
   * 检查是否正在监听
   */
  public isMonitoring(): boolean {
    return this.monitoring;
  }
}

export const marketMonitor = new MarketMonitor();
