import { query, transaction } from '../config/database';
import redis from '../utils/redis';
import logger from '../utils/logger';
import { acquireBalanceLock } from '../utils/distributed-lock';
import { RiskEngineQueueProducer, riskEngineQueueProducer } from './RiskEngineQueueProducer';
import {
  RiskCheckJobData,
  RiskEngineWorkerPool,
  riskEngineWorkerPool,
} from './RiskEngineWorkerPool';

// ============================================
// 风险检查结果类型定义
// ============================================

export interface RiskCheckRequest {
  userId: number;
  productCode: string;
  operation: 'OPEN' | 'ADD' | 'CLOSE' | 'LIQUIDATE';
  quantity?: number;
  leverage?: number;
  price?: number;
  direction?: 'LONG' | 'SHORT';
}

export interface RiskCheckResult {
  passed: boolean;
  riskLevel: 'SAFE' | 'WARNING' | 'DANGER' | 'CRITICAL';
  message: string;
  errorCode?: string;
  data?: {
    equity: number;
    availableBalance: number;
    marginUsage: number;
    maxPositionSize?: number;
    cooldownRemaining?: number;
  };
}

export interface RiskConfig {
  MAX_LEVERAGE: number;
  MAX_POSITION_SIZE: number;
  MAX_POSITION_PER_USER: number;
  MAX_POSITION_PER_PRODUCT: number;
  MAX_PLATFORM_EXPOSURE: number;
  MIN_MARGIN_RATIO: number;
  WARNING_MARGIN_RATIO: number;
  DANGER_MARGIN_RATIO: number;
  ORDER_RATE_LIMIT: number;
  ORDER_COOLDOWN: number;
}

// ============================================
// 风险引擎
// ============================================

export class RiskEngine {
  private config: RiskConfig;

  constructor(config?: Partial<RiskConfig>) {
    this.config = {
      MAX_LEVERAGE: 100,
      MAX_POSITION_SIZE: 100,
      MAX_POSITION_PER_USER: 10,
      MAX_POSITION_PER_PRODUCT: 1000,
      MAX_PLATFORM_EXPOSURE: 10000000,
      MIN_MARGIN_RATIO: 0.005,
      WARNING_MARGIN_RATIO: 0.5,
      DANGER_MARGIN_RATIO: 0.8,
      ORDER_RATE_LIMIT: 5,
      ORDER_COOLDOWN: 1000,
      ...config,
    };
  }

  /**
   * 统一风控检查入口
   */
  async validate(request: RiskCheckRequest): Promise<RiskCheckResult> {
    try {
      logger.info('[RiskEngine] 执行风控检查:', request);

      const result = await this.validateInternal(request);

      logger.info('[RiskEngine] 风控检查结果:', result);

      return result;
    } catch (error) {
      logger.error('[RiskEngine] 风控检查异常:', error);

      return {
        passed: false,
        riskLevel: 'CRITICAL',
        message: '风控检查失败',
        errorCode: 'RISK_CHECK_ERROR',
      };
    }
  }

  /**
   * 内部风控检查逻辑
   */
  private async validateInternal(request: RiskCheckRequest): Promise<RiskCheckResult> {
    if (request.operation === 'OPEN' || request.operation === 'ADD') {
      return await this.validateOpenPosition(request);
    } else if (request.operation === 'CLOSE') {
      return await this.validateClosePosition(request);
    } else if (request.operation === 'LIQUIDATE') {
      return await this.validateLiquidate(request);
    }

    return {
      passed: false,
      riskLevel: 'CRITICAL',
      message: '不支持的操作类型',
      errorCode: 'INVALID_OPERATION',
    };
  }

  /**
   * 验证开仓/加仓
   */
  private async validateOpenPosition(
    request: RiskCheckRequest
  ): Promise<RiskCheckResult> {
    const { userId, productCode, quantity, leverage, price, direction } = request;

    if (!quantity || !leverage || !price || !direction) {
      return {
        passed: false,
        riskLevel: 'CRITICAL',
        message: '参数不完整',
        errorCode: 'MISSING_PARAMS',
      };
    }

    const account = await this.getAccountData(userId);
    if (!account) {
      return {
        passed: false,
        riskLevel: 'CRITICAL',
        message: '账户不存在',
        errorCode: 'ACCOUNT_NOT_FOUND',
      };
    }

    const equity = account.balance + account.frozen_amount;

    const requiredMargin = this.calculateMargin(price, quantity, leverage);

    if (requiredMargin > account.available_balance) {
      const maxQuantity = this.calculateMaxQuantity(
        account.available_balance,
        price,
        leverage
      );

      return {
        passed: false,
        riskLevel: 'DANGER',
        message: '可用余额不足',
        errorCode: 'INSUFFICIENT_BALANCE',
        data: {
          equity,
          availableBalance: account.available_balance,
          marginUsage: 0,
          maxPositionSize: maxQuantity,
        },
      };
    }

    const checkResults = await Promise.all([
      this.checkLeverage(leverage),
      this.checkMaxPositionSize(quantity),
      this.checkPositionLimit(userId),
      this.checkProductExposure(productCode, quantity),
      this.checkPlatformExposure(quantity * price),
      this.checkOrderRateLimit(userId),
      this.checkOrderCooldown(userId),
    ]);

    for (const result of checkResults) {
      if (!result.passed) {
        return {
          ...result,
          data: {
            equity,
            availableBalance: account.available_balance,
            marginUsage: account.frozen_amount / equity,
            maxPositionSize: result.data?.maxPositionSize,
          },
        };
      }
    }

    const marginUsage = (account.frozen_amount + requiredMargin) / equity;

    return {
      passed: true,
      riskLevel: this.getRiskLevel(marginUsage),
      message: '风控检查通过',
      data: {
        equity,
        availableBalance: account.available_balance,
        marginUsage,
      },
    };
  }

  /**
   * 验证平仓
   */
  private async validateClosePosition(
    request: RiskCheckRequest
  ): Promise<RiskCheckResult> {
    const { userId, productCode, quantity } = request;

    const account = await this.getAccountData(userId);
    if (!account) {
      return {
        passed: false,
        riskLevel: 'CRITICAL',
        message: '账户不存在',
        errorCode: 'ACCOUNT_NOT_FOUND',
      };
    }

    const equity = account.balance + account.frozen_amount;

    return {
      passed: true,
      riskLevel: 'SAFE',
      message: '风控检查通过',
      data: {
        equity,
        availableBalance: account.available_balance,
        marginUsage: account.frozen_amount / equity,
      },
    };
  }

  /**
   * 验证强平
   */
  private async validateLiquidate(request: RiskCheckRequest): Promise<RiskCheckResult> {
    const { userId } = request;

    const account = await this.getAccountData(userId);
    if (!account) {
      return {
        passed: false,
        riskLevel: 'CRITICAL',
        message: '账户不存在',
        errorCode: 'ACCOUNT_NOT_FOUND',
      };
    }

    const equity = account.balance + account.frozen_amount;

    if (equity <= 0) {
      return {
        passed: true,
        riskLevel: 'CRITICAL',
        message: '触发强平',
        errorCode: 'LIQUIDATION_TRIGGERED',
        data: {
          equity,
          availableBalance: account.available_balance,
          marginUsage: 1,
        },
      };
    }

    return {
      passed: false,
      riskLevel: 'DANGER',
      message: '未触发强平',
      data: {
        equity,
        availableBalance: account.available_balance,
        marginUsage: account.frozen_amount / equity,
      },
    };
  }

  /**
   * 检查杠杆上限
   */
  private async checkLeverage(leverage: number): Promise<RiskCheckResult> {
    if (leverage > this.config.MAX_LEVERAGE) {
      return {
        passed: false,
        riskLevel: 'DANGER',
        message: `杠杆倍数不能超过 ${this.config.MAX_LEVERAGE}x`,
        errorCode: 'LEVERAGE_EXCEEDED',
        data: {
          maxPositionSize: this.config.MAX_LEVERAGE,
        },
      };
    }

    return { passed: true, riskLevel: 'SAFE', message: '杠杆检查通过' };
  }

  /**
   * 检查单笔持仓大小
   */
  private async checkMaxPositionSize(
    quantity: number
  ): Promise<RiskCheckResult> {
    if (quantity > this.config.MAX_POSITION_SIZE) {
      return {
        passed: false,
        riskLevel: 'DANGER',
        message: `单笔持仓不能超过 ${this.config.MAX_POSITION_SIZE}`,
        errorCode: 'POSITION_SIZE_EXCEEDED',
        data: {
          maxPositionSize: this.config.MAX_POSITION_SIZE,
        },
      };
    }

    return { passed: true, riskLevel: 'SAFE', message: '持仓大小检查通过' };
  }

  /**
   * 检查单用户最大持仓数量
   */
  private async checkPositionLimit(userId: number): Promise<RiskCheckResult> {
    const result = await query(
      `SELECT COUNT(*) as count FROM positions
       WHERE user_id = $1 AND status = 1`,
      [userId]
    );

    const currentPositionCount = parseInt(result.rows[0].count);

    if (currentPositionCount >= this.config.MAX_POSITION_PER_USER) {
      return {
        passed: false,
        riskLevel: 'DANGER',
        message: `持仓数量已达上限 ${this.config.MAX_POSITION_PER_USER}`,
        errorCode: 'POSITION_LIMIT_EXCEEDED',
      };
    }

    return { passed: true, riskLevel: 'SAFE', message: '持仓数量检查通过' };
  }

  /**
   * 检查单品种最大风险敞口
   */
  private async checkProductExposure(
    productCode: string,
    quantity: number
  ): Promise<RiskCheckResult> {
    const result = await query(
      `SELECT SUM(p.lot_size) as total_quantity
       FROM positions p
       JOIN products pr ON p.product_id = pr.id
       WHERE pr.symbol = $1 AND p.status = 1`,
      [productCode]
    );

    const currentExposure = parseFloat(result.rows[0].total_quantity || 0);

    if (currentExposure + quantity > this.config.MAX_POSITION_PER_PRODUCT) {
      return {
        passed: false,
        riskLevel: 'DANGER',
        message: `该品种风险敞口已达上限 ${this.config.MAX_POSITION_PER_PRODUCT}`,
        errorCode: 'PRODUCT_EXPOSURE_EXCEEDED',
      };
    }

    return { passed: true, riskLevel: 'SAFE', message: '品种敞口检查通过' };
  }

  /**
   * 检查总平台风险敞口
   */
  private async checkPlatformExposure(totalValue: number): Promise<RiskCheckResult> {
    const result = await query(
      `SELECT SUM(p.margin) as total_margin
       FROM positions p
       WHERE p.status = 1`
    );

    const currentExposure = parseFloat(result.rows[0].total_margin || 0);

    if (currentExposure + totalValue > this.config.MAX_PLATFORM_EXPOSURE) {
      return {
        passed: false,
        riskLevel: 'CRITICAL',
        message: `平台风险敞口已达上限`,
        errorCode: 'PLATFORM_EXPOSURE_EXCEEDED',
      };
    }

    return { passed: true, riskLevel: 'SAFE', message: '平台敞口检查通过' };
  }

  /**
   * 检查高频交易限流
   */
  private async checkOrderRateLimit(userId: number): Promise<RiskCheckResult> {
    const key = `rate:order:${userId}`;
    const count = await redis.incr(key);

    if (count === 1) {
      await redis.expire(key, 1);
    }

    if (count > this.config.ORDER_RATE_LIMIT) {
      return {
        passed: false,
        riskLevel: 'WARNING',
        message: `操作过于频繁，请稍后再试`,
        errorCode: 'RATE_LIMIT_EXCEEDED',
      };
    }

    return { passed: true, riskLevel: 'SAFE', message: '限流检查通过' };
  }

  /**
   * 检查冷却时间
   */
  private async checkOrderCooldown(userId: number): Promise<RiskCheckResult> {
    const key = `cooldown:order:${userId}`;
    const lastOrderTime = await redis.get(key);

    if (lastOrderTime) {
      const elapsed = Date.now() - parseInt(lastOrderTime);

      if (elapsed < this.config.ORDER_COOLDOWN) {
        const cooldownRemaining =
          this.config.ORDER_COOLDOWN - elapsed;

        return {
          passed: false,
          riskLevel: 'WARNING',
          message: `请稍后再试`,
          errorCode: 'COOLDOWN_ACTIVE',
          data: {
            cooldownRemaining,
          },
        };
      }
    }

    await redis.set(key, Date.now().toString(), 'PX', this.config.ORDER_COOLDOWN);

    return { passed: true, riskLevel: 'SAFE', message: '冷却时间检查通过' };
  }

  /**
   * 获取账户数据
   */
  private async getAccountData(userId: number): Promise<any> {
    const result = await query(
      `SELECT * FROM accounts WHERE user_id = $1`,
      [userId]
    );

    return result.rows[0];
  }

  /**
   * 计算保证金
   */
  private calculateMargin(
    price: number,
    quantity: number,
    leverage: number
  ): number {
    return (price * quantity) / leverage;
  }

  /**
   * 计算最大持仓数量
   */
  private calculateMaxQuantity(
    availableBalance: number,
    price: number,
    leverage: number
  ): number {
    return Math.floor((availableBalance * leverage) / price);
  }

  /**
   * 获取风险等级
   */
  private getRiskLevel(marginUsage: number): 'SAFE' | 'WARNING' | 'DANGER' | 'CRITICAL' {
    if (marginUsage >= this.config.DANGER_MARGIN_RATIO) {
      return 'DANGER';
    } else if (marginUsage >= this.config.WARNING_MARGIN_RATIO) {
      return 'WARNING';
    } else if (marginUsage >= this.config.MIN_MARGIN_RATIO) {
      return 'SAFE';
    } else {
      return 'CRITICAL';
    }
  }

  /**
   * 获取账户实时权益
   */
  async getAccountEquity(userId: number): Promise<number> {
    const account = await this.getAccountData(userId);

    if (!account) {
      throw new Error('账户不存在');
    }

    const positions = await query(
      `SELECT * FROM positions
       WHERE user_id = $1 AND status = 1`,
      [userId]
    );

    let totalUnrealizedPnl = 0;

    for (const position of positions.rows) {
      const marketData = await this.getMarketData(position.product_code);

      if (marketData) {
        const pnl = this.calculateUnrealizedPnl(position, marketData.last_price);
        totalUnrealizedPnl += pnl;
      }
    }

    return account.balance + totalUnrealizedPnl;
  }

  /**
   * 获取市场数据
   */
  private async getMarketData(productCode: string): Promise<any> {
    const result = await query(
      `SELECT * FROM market_quotes
       WHERE product_id = (SELECT id FROM products WHERE symbol = $1)
       ORDER BY timestamp DESC LIMIT 1`,
      [productCode]
    );

    return result.rows[0];
  }

  /**
   * 计算未实现盈亏
   */
  private calculateUnrealizedPnl(position: any, currentPrice: number): number {
    const priceDiff = currentPrice - position.entry_price;

    if (position.direction === 1) {
      return priceDiff * position.lot_size * position.leverage;
    } else {
      return -priceDiff * position.lot_size * position.leverage;
    }
  }

  /**
   * 更新配置
   */
  updateConfig(config: Partial<RiskConfig>): void {
    this.config = {
      ...this.config,
      ...config,
    };

    logger.info('[RiskEngine] 配置已更新:', this.config);
  }

  /**
   * 获取当前配置
   */
  getConfig(): RiskConfig {
    return { ...this.config };
  }

  /**
   * 获取平台风险统计
   */
  async getPlatformRiskStats(): Promise<{
    totalUsers: number;
    totalPositions: number;
    totalExposure: number;
    avgMarginUsage: number;
    dangerAccounts: number;
  }> {
    const [userCount, positionCount, exposureResult] = await Promise.all([
      query('SELECT COUNT(DISTINCT user_id) as count FROM positions WHERE status = 1'),
      query('SELECT COUNT(*) as count FROM positions WHERE status = 1'),
      query('SELECT SUM(margin) as total_margin FROM positions WHERE status = 1'),
    ]);

    const totalExposure = parseFloat(exposureResult.rows[0].total_margin || 0);

    const marginUsageResult = await query(`
      SELECT AVG(
        COALESCE(p.margin, 0) /
        NULLIF(a.balance + a.frozen_amount, 0)
      ) as avg_margin_usage
      FROM accounts a
      LEFT JOIN (
        SELECT user_id, SUM(margin) as margin
        FROM positions
        WHERE status = 1
        GROUP BY user_id
      ) p ON a.user_id = p.user_id
      WHERE a.balance > 0
    `);

    const avgMarginUsage = parseFloat(marginUsageResult.rows[0].avg_margin_usage || 0);

    const dangerAccountsResult = await query(`
      SELECT COUNT(DISTINCT p.user_id) as count
      FROM positions p
      JOIN accounts a ON p.user_id = a.user_id
      WHERE p.status = 1
      AND p.margin / NULLIF(a.balance + a.frozen_amount, 0) >= ${this.config.DANGER_MARGIN_RATIO}
    `);

    const dangerAccounts = parseInt(dangerAccountsResult.rows[0].count || 0);

    return {
      totalUsers: parseInt(userCount.rows[0].count || 0),
      totalPositions: parseInt(positionCount.rows[0].count || 0),
      totalExposure,
      avgMarginUsage,
      dangerAccounts,
    };
  }

  /**
   * 通过 Worker Pool 异步执行风控检查
   */
  async validateWithWorker(
    request: RiskCheckRequest,
    priority: number = 5
  ): Promise<{ jobId: string }> {
    try {
      const jobData: RiskCheckJobData = {
        userId: String(request.userId),
        productCode: request.productCode,
        operation: request.operation,
        quantity: request.quantity,
        leverage: request.leverage,
        price: request.price,
        direction: request.direction,
        priority,
      };

      const job = await riskEngineQueueProducer.submitRiskCheck(jobData);

      logger.info('[RiskEngine] 风控检查任务已提交到 Worker Pool', {
        jobId: job.id,
        userId: request.userId,
        operation: request.operation,
      });

      return { jobId: String(job.id) };
    } catch (error) {
      logger.error('[RiskEngine] 提交风控检查任务到 Worker Pool 失败', error);
      throw error;
    }
  }

  /**
   * 等待 Worker Pool 完成风控检查
   */
  async waitForValidationResult(
    jobId: string,
    timeout: number = 5000
  ): Promise<RiskCheckResult> {
    try {
      const result = await riskEngineQueueProducer.waitForResult(jobId, timeout);

      logger.info('[RiskEngine] Worker Pool 风控检查完成', {
        jobId,
        passed: result.passed,
        riskLevel: result.riskLevel,
      });

      return result;
    } catch (error) {
      logger.error('[RiskEngine] 等待 Worker Pool 风控检查结果失败', error);
      throw error;
    }
  }

  /**
   * 通过 Worker Pool 执行风控检查（同步等待结果）
   */
  async validateAsync(
    request: RiskCheckRequest,
    priority: number = 5,
    timeout: number = 5000
  ): Promise<RiskCheckResult> {
    const { jobId } = await this.validateWithWorker(request, priority);
    return await this.waitForValidationResult(jobId, timeout);
  }
}

export const riskEngine = new RiskEngine();
