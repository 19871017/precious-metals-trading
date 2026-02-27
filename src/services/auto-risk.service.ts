import logger from '../utils/logger';
import { autoOrderService, AutoPosition } from './auto-order.service';
import { NotificationIcon } from 'tdesign-icons-react';

export interface RiskConfig {
  enabled: boolean;
  maxDailyLoss: number;
  maxDrawdown: number;
  maxPositions: number;
  maxPositionSize: number;
  autoStopLoss: boolean;
  stopLossPercent: number;
  autoTakeProfit: boolean;
  takeProfitPercent: number;
  liquidationThreshold: number;
  notificationEnabled: boolean;
}

export interface RiskAlert {
  id: string;
  timestamp: number;
  type: 'warning' | 'danger' | 'info';
  level: 'low' | 'medium' | 'high' | 'critical';
  category: 'daily_loss' | 'drawdown' | 'position_size' | 'liquidation' | 'margin_call';
  symbol?: string;
  message: string;
  value: number;
  threshold: number;
  actions: string[];
}

export interface DailyLossTracker {
  date: string;
  startEquity: number;
  currentEquity: number;
  totalLoss: number;
  lossPercent: number;
  trades: number;
}

export class AutoRiskService {
  private config: RiskConfig | null = null;
  private alerts: RiskAlert[] = [];
  private dailyLossTracker: Map<string, DailyLossTracker> = new Map();
  private initialEquity: number = 0;
  private peakEquity: number = 0;

  /**
   * 初始化风控配置
   */
  public initialize(config: RiskConfig): void {
    this.config = config;
    this.initialEquity = config.maxDailyLoss * 10;
    this.peakEquity = this.initialEquity;

    this.initializeDailyTracker();
    this.startMonitoring();

    logger.info('[AutoRisk] Initialized with config', config);
  }

  /**
   * 更新风控配置
   */
  public updateConfig(config: Partial<RiskConfig>): void {
    if (!this.config) {
      this.config = {
        enabled: true,
        maxDailyLoss: 100000,
        maxDrawdown: 20,
        maxPositions: 5,
        maxPositionSize: 100000,
        autoStopLoss: true,
        stopLossPercent: 2,
        autoTakeProfit: true,
        takeProfitPercent: 5,
        liquidationThreshold: 0.8,
        notificationEnabled: true,
      };
    }

    this.config = { ...this.config, ...config };

    logger.info('[AutoRisk] Config updated', this.config);
  }

  /**
   * 检查持仓风控
   */
  public async checkPositionRisk(position: AutoPosition): Promise<RiskAlert | null> {
    if (!this.config || !this.config.enabled) {
      return null;
    }

    try {
      const alerts: RiskAlert[] = [];

      const positionValue = Math.abs(position.quantity * position.entryPrice);

      if (this.config.maxPositionSize > 0 && positionValue > this.config.maxPositionSize) {
        alerts.push({
          id: `risk_size_${position.id}`,
          timestamp: Date.now(),
          type: 'warning',
          level: 'medium',
          category: 'position_size',
          symbol: position.symbol,
          message: `持仓价值超过限制: ¥${positionValue.toLocaleString()} > ¥${this.config.maxPositionSize.toLocaleString()}`,
          value: positionValue,
          threshold: this.config.maxPositionSize,
          actions: ['减仓', '调整止损'],
        });
      }

      if (position.profitLossPercent < -20) {
        alerts.push({
          id: `risk_loss_${position.id}`,
          timestamp: Date.now(),
          type: 'danger',
          level: 'high',
          category: 'liquidation',
          symbol: position.symbol,
          message: `持仓亏损超过20%: ${position.profitLossPercent.toFixed(2)}%`,
          value: Math.abs(position.profitLossPercent),
          threshold: 20,
          actions: ['立即平仓', '追加保证金'],
        });
      }

      if (position.profitLossPercent < -10) {
        alerts.push({
          id: `risk_warn_${position.id}`,
          timestamp: Date.now(),
          type: 'warning',
          level: 'low',
          category: 'margin_call',
          symbol: position.symbol,
          message: `持仓亏损超过10%: ${position.profitLossPercent.toFixed(2)}%`,
          value: Math.abs(position.profitLossPercent),
          threshold: 10,
          actions: ['设置止损', '考虑平仓'],
        });
      }

      for (const alert of alerts) {
        this.alerts.push(alert);
        this.emitAlert(alert);
      }

      const criticalAlert = alerts.find(a => a.level === 'critical' || a.level === 'high');

      if (criticalAlert && this.config.autoStopLoss) {
        await this.handleCriticalRisk(position, criticalAlert);
      }

      return criticalAlert || alerts[0] || null;
    } catch (error) {
      logger.error('[AutoRisk] Failed to check position risk:', error);
      return null;
    }
  }

  /**
   * 检查整体风控
   */
  public async checkOverallRisk(positions: AutoPosition[]): Promise<RiskAlert | null> {
    if (!this.config || !this.config.enabled) {
      return null;
    }

    try {
      const currentEquity = this.initialEquity + positions.reduce((sum, p) => sum + p.profitLoss, 0);
      const totalDrawdown = this.calculateDrawdown(currentEquity);
      const totalLoss = Math.abs(Math.min(0, currentEquity - this.initialEquity));

      const alerts: RiskAlert[] = [];

      if (this.config.maxDailyLoss > 0 && totalLoss >= this.config.maxDailyLoss) {
        alerts.push({
          id: 'risk_daily_loss',
          timestamp: Date.now(),
          type: 'danger',
          level: 'critical',
          category: 'daily_loss',
          message: `触发日亏损限制: ¥${totalLoss.toLocaleString()} >= ¥${this.config.maxDailyLoss.toLocaleString()}`,
          value: totalLoss,
          threshold: this.config.maxDailyLoss,
          actions: ['停止所有交易', '平仓所有持仓'],
        });
      }

      if (this.config.maxDrawdown > 0 && totalDrawdown >= this.config.maxDrawdown) {
        alerts.push({
          id: 'risk_drawdown',
          timestamp: Date.now(),
          type: 'danger',
          level: 'critical',
          category: 'drawdown',
          message: `触发最大回撤限制: ${totalDrawdown.toFixed(2)}% >= ${this.config.maxDrawdown}%`,
          value: totalDrawdown,
          threshold: this.config.maxDrawdown,
          actions: ['停止所有交易', '平仓所有持仓'],
        });
      }

      if (this.config.maxPositions > 0 && positions.length >= this.config.maxPositions) {
        alerts.push({
          id: 'risk_max_positions',
          timestamp: Date.now(),
          type: 'warning',
          level: 'medium',
          category: 'position_size',
          message: `持仓数量达到限制: ${positions.length} / ${this.config.maxPositions}`,
          value: positions.length,
          threshold: this.config.maxPositions,
          actions: ['暂停开仓', '平仓部分持仓'],
        });
      }

      for (const alert of alerts) {
        this.alerts.push(alert);
        this.emitAlert(alert);
      }

      const criticalAlert = alerts.find(a => a.level === 'critical');

      if (criticalAlert) {
        await this.handleCriticalRiskOverall(criticalAlert);
      }

      return criticalAlert || alerts[0] || null;
    } catch (error) {
      logger.error('[AutoRisk] Failed to check overall risk:', error);
      return null;
    }
  }

  /**
   * 处理关键风险（单个持仓）
   */
  private async handleCriticalRisk(position: AutoPosition, alert: RiskAlert): Promise<void> {
    logger.warn('[AutoRisk] Handling critical risk for position', {
      symbol: position.symbol,
      alert: alert.message,
    });

    await autoOrderService.closePosition(position.symbol, alert.message);
  }

  /**
   * 处理关键风险（整体）
   */
  private async handleCriticalRiskOverall(alert: RiskAlert): Promise<void> {
    logger.warn('[AutoRisk] Handling critical risk overall', {
      alert: alert.message,
    });

    const positions = autoOrderService.getPositions();

    for (const position of positions) {
      await autoOrderService.closePosition(position.symbol, alert.message);
    }
  }

  /**
   * 计算回撤
   */
  private calculateDrawdown(currentEquity: number): number {
    if (currentEquity > this.peakEquity) {
      this.peakEquity = currentEquity;
      return 0;
    }

    const drawdown = ((this.peakEquity - currentEquity) / this.peakEquity) * 100;
    return drawdown;
  }

  /**
   * 初始化每日追踪器
   */
  private initializeDailyTracker(): void {
    const today = new Date().toISOString().split('T')[0];

    if (!this.dailyLossTracker.has(today)) {
      this.dailyLossTracker.set(today, {
        date: today,
        startEquity: this.initialEquity,
        currentEquity: this.initialEquity,
        totalLoss: 0,
        lossPercent: 0,
        trades: 0,
      });
    }
  }

  /**
   * 更新每日追踪器
   */
  public updateDailyTracker(profit: number): void {
    const today = new Date().toISOString().split('T')[0];
    const tracker = this.dailyLossTracker.get(today);

    if (!tracker) {
      this.initializeDailyTracker();
      return;
    }

    tracker.currentEquity += profit;
    tracker.trades++;

    if (profit < 0) {
      tracker.totalLoss += Math.abs(profit);
    }

    tracker.lossPercent = (tracker.totalLoss / tracker.startEquity) * 100;

    this.dailyLossTracker.set(today, tracker);
  }

  /**
   * 启动监控
   */
  private startMonitoring(): void {
    setInterval(() => {
      try {
        this.checkDailyRisk();
        this.cleanupOldAlerts();
      } catch (error) {
        logger.error('[AutoRisk] Monitoring error:', error);
      }
    }, 60000);

    logger.info('[AutoRisk] Monitoring started');
  }

  /**
   * 检查每日风险
   */
  private checkDailyRisk(): void {
    if (!this.config || !this.config.enabled) {
      return;
    }

    const today = new Date().toISOString().split('T')[0];
    const tracker = this.dailyLossTracker.get(today);

    if (!tracker) {
      return;
    }

    if (this.config.maxDailyLoss > 0 && tracker.totalLoss >= this.config.maxDailyLoss) {
      const alert: RiskAlert = {
        id: 'risk_daily_limit',
        timestamp: Date.now(),
        type: 'danger',
        level: 'critical',
        category: 'daily_loss',
        message: `日亏损已达限制: ¥${tracker.totalLoss.toLocaleString()} / ¥${this.config.maxDailyLoss.toLocaleString()}`,
        value: tracker.totalLoss,
        threshold: this.config.maxDailyLoss,
        actions: ['停止所有交易'],
      };

      this.alerts.push(alert);
      this.emitAlert(alert);
    }
  }

  /**
   * 清理旧警报
   */
  private cleanupOldAlerts(): void {
    const oneHourAgo = Date.now() - 3600000;

    this.alerts = this.alerts.filter(alert => alert.timestamp > oneHourAgo);
  }

  /**
   * 发出警报
   */
  private emitAlert(alert: RiskAlert): void {
    if (this.config && this.config.notificationEnabled) {
      this.showNotification(alert);
    }
  }

  /**
   * 显示通知
   */
  private showNotification(alert: RiskAlert): void {
    if (typeof window !== 'undefined' && 'Notification' in window) {
      try {
        if (Notification.permission === 'granted') {
          new Notification(`${alert.level === 'critical' ? '⚠️' : 'ℹ️'} 风控预警`, {
            body: alert.message,
            icon: '/favicon.ico',
          });
        }
      } catch (error) {
        logger.warn('[AutoRisk] Notification failed:', error);
      }
    }
  }

  /**
   * 获取所有警报
   */
  public getAlerts(): RiskAlert[] {
    return this.alerts.slice(-100);
  }

  /**
   * 获取最新警报
   */
  public getLatestAlerts(limit: number = 10): RiskAlert[] {
    return this.alerts.slice(-limit);
  }

  /**
   * 获取每日追踪器
   */
  public getDailyTracker(): DailyLossTracker | null {
    const today = new Date().toISOString().split('T')[0];
    return this.dailyLossTracker.get(today) || null;
  }

  /**
   * 获取配置
   */
  public getConfig(): RiskConfig | null {
    return this.config;
  }

  /**
   * 清除警报
   */
  public clearAlerts(): void {
    this.alerts = [];
    logger.info('[AutoRisk] All alerts cleared');
  }
}

export const autoRiskService = new AutoRiskService();
