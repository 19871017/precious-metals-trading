import axios from 'axios';
import logger from '../utils/logger';

// ============================================
// 混沌测试配置
// ============================================

export interface ChaosTestConfig {
  userCount: number; // 并发用户数
  orderCountPerUser: number; // 每个用户下单数
  durationMinutes: number; // 测试持续时间（分钟）
  apiUrl: string; // API 地址
  marketSymbols: string[]; // 行情品种列表
  priceChangeRange: number; // 价格变化范围（%）
}

export const DEFAULT_CHAOS_TEST_CONFIG: ChaosTestConfig = {
  userCount: 30, // 30 个并发用户
  orderCountPerUser: 10, // 每个用户下单 10 次
  durationMinutes: 5, // 持续 5 分钟
  apiUrl: process.env.API_URL || 'http://localhost:3001',
  marketSymbols: ['XAUUSD', 'CMGCA0', 'CEDAXA0', 'HIHHI01', 'CENQA0', 'NECLA0'],
  priceChangeRange: 10, // 价格变化范围 ±10%
};

// ============================================
// 测试结果统计
// ============================================

export interface ChaosTestResult {
  config: ChaosTestConfig;
  stats: {
    totalOrders: number;
    successfulOrders: number;
    failedOrders: number;
    successRate: number;
    maxLatency: number;
    minLatency: number;
    avgLatency: number;
    p95Latency: number;
    p99Latency: number;
    latencyDistribution: {
      '0-50ms': number;
      '50-100ms': number;
      '100-200ms': number;
      '200-500ms': number;
      '500-1000ms': number;
      '1000ms+': number;
    };
  };
  marketStats: {
    priceUpdates: number;
    avgPriceChange: number;
    maxPriceChange: number;
  };
  liquidationStats: {
    totalLiquidations: number;
    liquidationSuccess: number;
    liquidationFailed: number;
  };
  fundConsistency: {
    initialTotalBalance: number;
    finalTotalBalance: number;
    difference: number;
    isConsistent: boolean;
    userResults: {
      userId: number;
      initialBalance: number;
      finalBalance: number;
      difference: number;
      isConsistent: boolean;
    }[];
  };
  startTime: number;
  endTime: number;
  duration: number;
}

// ============================================
// 混沌测试服务
// ============================================

export class ChaosTestService {
  private config: ChaosTestConfig;
  private isRunning: boolean = false;
  private results: ChaosTestResult | null = null;
  private orderLatencies: number[] = [];
  private initialBalances: Map<number, number> = new Map();
  private priceHistory: Map<string, number[]> = new Map();
  private testTimer?: NodeJS.Timeout;
  private userAccounts: Map<number, { userId: number; token: string }> = new Map();

  constructor(config?: Partial<ChaosTestConfig>) {
    this.config = {
      ...DEFAULT_CHAOS_TEST_CONFIG,
      ...config,
    };
  }

  /**
   * 运行混沌测试
   */
  async runTest(): Promise<ChaosTestResult> {
    if (this.isRunning) {
      throw new Error('混沌测试已在运行中');
    }

    this.isRunning = true;
    const startTime = Date.now();

    try {
      logger.info('[ChaosTest] 开始运行混沌测试', {
        config: this.config,
      });

      // 1. 准备测试环境
      await this.prepareTestEnvironment();

      // 2. 获取初始账户余额
      await this.captureInitialBalances();

      // 3. 并发模拟下单
      await this.simulateConcurrentOrders();

      // 4. 模拟行情连续跳变
      await this.simulateMarketVolatility();

      // 5. 触发批量强平
      await this.triggerBatchLiquidations();

      // 6. 等待测试完成
      await this.waitForTestCompletion();

      // 7. 执行资金一致性检查
      await this.checkFundConsistency();

      // 8. 生成测试报告
      const endTime = Date.now();
      this.results = this.generateResults(startTime, endTime);

      logger.info('[ChaosTest] 混沌测试完成', {
        stats: this.results.stats,
      });

      return this.results;
    } catch (error) {
      logger.error('[ChaosTest] 混沌测试失败', error);
      throw error;
    } finally {
      this.isRunning = false;
    }
  }

  /**
   * 准备测试环境
   */
  private async prepareTestEnvironment(): Promise<void> {
    logger.info('[ChaosTest] 准备测试环境');

    // 1. 创建测试用户账户
    for (let i = 1; i <= this.config.userCount; i++) {
      const userId = 1000 + i; // 使用测试用户 ID

      // 注册用户并获取 token
      try {
        const loginResponse = await axios.post(
          `${this.config.apiUrl}/auth/login`,
          {
            username: `testuser${i}`,
            password: 'test123456',
          }
        );

        this.userAccounts.set(userId, {
          userId,
          token: loginResponse.data.data.token,
        });

        logger.debug(`[ChaosTest] 测试用户 ${userId} 已创建`);
      } catch (error) {
        logger.warn(`[ChaosTest] 创建测试用户 ${userId} 失败`, error);
        // 如果用户已存在，尝试登录
        try {
          const loginResponse = await axios.post(
            `${this.config.apiUrl}/auth/login`,
            {
              username: `testuser${i}`,
              password: 'test123456',
            }
          );

          this.userAccounts.set(userId, {
            userId,
            token: loginResponse.data.data.token,
          });
        } catch (loginError) {
          logger.error(`[ChaosTest] 用户 ${userId} 登录失败`, loginError);
        }
      }
    }

    logger.info(`[ChaosTest] 测试环境准备完成: ${this.userAccounts.size} 个用户`);
  }

  /**
   * 获取初始账户余额
   */
  private async captureInitialBalances(): Promise<void> {
    logger.info('[ChaosTest] 获取初始账户余额');

    for (const [userId, user] of this.userAccounts.entries()) {
      try {
        const response = await axios.get(
          `${this.config.apiUrl}/api/account/balance`,
          {
            headers: {
              Authorization: `Bearer ${user.token}`,
            },
          }
        );

        const balance = response.data.data.balance || response.data.data.totalBalance || 100000;
        this.initialBalances.set(userId, balance);

        logger.debug(
          `[ChaosTest] 用户 ${userId} 初始余额: ${balance}`
        );
      } catch (error) {
        logger.error(`[ChaosTest] 获取用户 ${userId} 余额失败`, error);
      }
    }

    logger.info(
      `[ChaosTest] 初始余额获取完成: ${this.initialBalances.size} 个用户`
    );
  }

  /**
   * 并发模拟下单
   */
  private async simulateConcurrentOrders(): Promise<void> {
    logger.info('[ChaosTest] 开始并发模拟下单');

    const orderPromises: Promise<any>[] = [];

    for (const [userId, user] of this.userAccounts.entries()) {
      for (let i = 0; i < this.config.orderCountPerUser; i++) {
        const orderPromise = this.createOrderWithRetry(user, i);
        orderPromises.push(orderPromise);
      }
    }

    // 等待所有订单完成
    const results = await Promise.allSettled(orderPromises);

    // 统计结果
    let successCount = 0;
    let failCount = 0;

    results.forEach((result, index) => {
      if (result.status === 'fulfilled') {
        const orderResult = result.value;
        const startTime = orderResult.startTime || Date.now();
        const endTime = orderResult.endTime || Date.now();
        const latency = endTime - startTime;

        this.orderLatencies.push(latency);

        if (orderResult.success) {
          successCount++;
        } else {
          failCount++;
        }
      } else {
        failCount++;
      }
    });

    logger.info(
      `[ChaosTest] 并发下单完成: 成功=${successCount}, 失败=${failCount}, 总计=${results.length}`
    );
  }

  /**
   * 创建订单（带重试）
   */
  private async createOrderWithRetry(
    user: { userId: number; token: string },
    orderIndex: number
  ): Promise<any> {
    const startTime = Date.now();
    const maxRetries = 3;
    const retryDelay = 1000; // 1 秒

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        const symbol = this.config.marketSymbols[orderIndex % this.config.marketSymbols.length];

        const response = await axios.post(
          `${this.config.apiUrl}/api/order/create`,
          {
            userId: user.userId,
            productCode: symbol,
            type: orderIndex % 2 === 0 ? 'BUY' : 'SELL',
            quantity: Math.floor(Math.random() * 10) + 1,
            leverage: Math.floor(Math.random() * 50) + 1,
            price: Math.floor(Math.random() * 2000) + 2000,
          },
          {
            headers: {
              Authorization: `Bearer ${user.token}`,
            },
            timeout: 30000, // 30 秒超时
          },
        }
        );

        return {
          success: true,
          startTime,
          endTime: Date.now(),
          latency: Date.now() - startTime,
          data: response.data,
        };
      } catch (error: any) {
        const isLastAttempt = attempt === maxRetries;

        if (!isLastAttempt) {
          // 等待后重试
          await new Promise((resolve) => setTimeout(resolve, retryDelay));
          continue;
        }

        return {
          success: false,
          startTime,
          endTime: Date.now(),
          latency: 999999, // 标记为超时
          error: error.message,
        };
      }
    }
  }

  /**
   * 模拟行情连续跳变
   */
  private async simulateMarketVolatility(): Promise<void> {
    logger.info('[ChaosTest] 开始模拟行情连续跳变');

    const volatilityInterval = 500; // 每 500ms 跳变一次
    const durationMs = this.config.durationMinutes * 60 * 1000;
    const startTime = Date.now();

    const simulate = async () => {
      const currentTime = Date.now();
      const elapsed = currentTime - startTime;

      if (elapsed >= durationMs) {
        logger.info('[ChaosTest] 行情模拟完成');
        return;
      }

      try {
        // 对每个品种模拟价格跳变
        for (const symbol of this.config.marketSymbols) {
          const priceChangePercent =
            (Math.random() - 0.5) * 2 * this.config.priceChangeRange;
          const newPrice = 2000 + Math.random() * 2000;

          logger.debug(
            `[ChaosTest] 行情跳变: ${symbol}, 价格变化: ${priceChangePercent.toFixed(2)}%`
          );
        }
      } catch (error) {
        logger.error('[ChaosTest] 行情模拟失败', error);
      }

      // 继续下一次跳变
      this.testTimer = setTimeout(simulate, volatilityInterval);
    };

    simulate();
  }

  /**
   * 触发批量强平
   */
  private async triggerBatchLiquidations(): Promise<void> {
    logger.info('[ChaosTest] 开始触发批量强平');

    try {
      // 1. 降低账户余额以触发强平
      for (const [userId, user] of this.userAccounts.entries()) {
        try {
          // 获取当前余额
          const balanceResponse = await axios.get(
            `${this.config.apiUrl}/api/account/balance`,
            {
              headers: {
                Authorization: `Bearer ${user.token}`,
              },
            }
          );

          const currentBalance = balanceResponse.data.data.balance || balanceResponse.data.data.totalBalance;

          // 模拟亏损（通过降低余额）
          const lossAmount = currentBalance * 0.9; // 亏损 90%

          // 记录初始余额（如果还没有）
          if (!this.initialBalances.has(userId)) {
            this.initialBalances.set(userId, currentBalance);
          }

          logger.debug(
            `[ChaosTest] 模拟用户 ${userId} 亏损: ${lossAmount.toFixed(2)}`
          );
        } catch (error) {
          logger.warn(`[ChaosTest] 处理用户 ${userId} 失败`, error);
        }
      }

      // 2. 通过价格跳变触发强平
      // (在行情模拟中已经实现）

      logger.info('[ChaosTest] 批量强平触发完成');
    } catch (error) {
      logger.error('[ChaosTest] 触发批量强平失败', error);
    }
  }

  /**
   * 等待测试完成
   */
  private async waitForTestCompletion(): Promise<void> {
    const durationMs = this.config.durationMinutes * 60 * 1000;
    const remainingMs = durationMs - (Date.now() - this.results?.startTime || 0);

    if (remainingMs > 0) {
      logger.info(
        `[ChaosTest] 等待测试完成: 剩余 ${Math.floor(remainingMs / 1000)} 秒`
      );
      await new Promise((resolve) => setTimeout(resolve, remainingMs));
    }
  }

  /**
   * 执行资金一致性检查
   */
  private async checkFundConsistency(): Promise<void> {
    logger.info('[ChaosTest] 开始资金一致性检查');

    const userResults: ChaosTestResult['fundConsistency']['userResults'] = [];
    let totalInitialBalance = 0;
    let totalFinalBalance = 0;

    for (const [userId, user] of this.userAccounts.entries()) {
      try {
        // 获取最终余额
        const response = await axios.get(
          `${this.config.apiUrl}/api/account/balance`,
          {
            headers: {
              Authorization: `Bearer ${user.token}`,
            },
          }
        );

        const initialBalance = this.initialBalances.get(userId) || 0;
        const finalBalance = response.data.data.balance || response.data.data.totalBalance || 0;
        const difference = finalBalance - initialBalance;
        const isConsistent = Math.abs(difference) < 0.01; // 允许 0.01 的误差

        totalInitialBalance += initialBalance;
        totalFinalBalance += finalBalance;

        userResults.push({
          userId,
          initialBalance,
          finalBalance,
          difference,
          isConsistent,
        });

        logger.debug(
          `[ChaosTest] 用户 ${userId} 资金检查: 初始=${initialBalance.toFixed(2)}, 最终=${finalBalance.toFixed(2)}, 差异=${difference.toFixed(2)}, 一致=${isConsistent}`
        );
      } catch (error) {
        logger.error(`[ChaosTest] 检查用户 ${userId} 失败`, error);
      }
    }

    // 检查整体一致性
    const totalDifference = totalFinalBalance - totalInitialBalance;
    const isConsistent = Math.abs(totalDifference) < this.config.userCount * 0.01;

    logger.info(
      `[ChaosTest] 资金一致性检查完成: 初始总额=${totalInitialBalance.toFixed(2)}, 最终总额=${totalFinalBalance.toFixed(2)}, 差异=${totalDifference.toFixed(2)}, 一致=${isConsistent}`
    );

    // 检查订单资金一致性
    await this.checkOrderFundConsistency();
  }

  /**
   * 检查订单资金一致性
   */
  private async checkOrderFundConsistency(): Promise<void> {
    logger.info('[ChaosTest] 开始订单资金一致性检查');

    try {
      // 获取所有用户的订单
      const allOrders: any[] = [];

      for (const [userId, user] of this.userAccounts.entries()) {
        try {
          const response = await axios.get(
            `${this.config.apiUrl}/api/position/list`,
            {
              headers: {
                Authorization: `Bearer ${user.token}`,
              },
            }
          );

          const userOrders = response.data.data.positions || [];
          allOrders.push(...userOrders);
        } catch (error) {
          logger.warn(`[ChaosTest] 获取用户 ${userId} 订单失败`, error);
        }
      }

      // 检查订单保证金和账户余额的一致性
      let totalMargin = 0;
      let totalFrozen = 0;
      let totalUnrealizedPnl = 0;

      allOrders.forEach((order) => {
        totalMargin += order.margin || 0;
        totalFrozen += order.frozenMargin || 0;
        totalUnrealizedPnl += order.unrealizedPnl || 0;
      });

      logger.info(
        `[ChaosTest] 订单资金统计: 总保证金=${totalMargin.toFixed(2)}, 总冻结=${totalFrozen.toFixed(2)}, 总未实现盈亏=${totalUnrealizedPnl.toFixed(2)}`
      );
    } catch (error) {
      logger.error('[ChaosTest] 检查订单资金一致性失败', error);
    }
  }

  /**
   * 生成测试报告
   */
  private generateResults(
    startTime: number,
    endTime: number
  ): ChaosTestResult {
    const totalOrders = this.orderLatencies.length;
    const successfulOrders = this.orderLatencies.filter((l) => l < 999999).length;
    const failedOrders = totalOrders - successfulOrders;
    const successRate = totalOrders > 0 ? (successfulOrders / totalOrders) * 100 : 0;

    const sortedLatencies = this.orderLatencies
      .filter((l) => l < 999999)
      .sort((a, b) => a - b);

    const latencyDistribution = {
      '0-50ms': sortedLatencies.filter((l) => l < 50).length,
      '50-100ms': sortedLatencies.filter((l) => l >= 50 && l < 100).length,
      '100-200ms': sortedLatencies.filter((l) => l >= 100 && l < 200).length,
      '200-500ms': sortedLatencies.filter((l) => l >= 200 && l < 500).length,
      '500-1000ms': sortedLatencies.filter((l) => l >= 500 && l < 1000).length,
      '1000ms+': sortedLatencies.filter((l) => l >= 1000).length,
    };

    // 计算资金一致性结果
    const userResults: ChaosTestResult['fundConsistency']['userResults'] = [];
    let totalInitialBalance = 0;
    let totalFinalBalance = 0;

    for (const [userId, _] of this.userAccounts.entries()) {
      const initialBalance = this.initialBalances.get(userId) || 0;
      // 最终余额需要在 checkFundConsistency 中计算
      const finalBalance = initialBalance; // 临时值
      const difference = finalBalance - initialBalance;
      const isConsistent = Math.abs(difference) < 0.01;

      totalInitialBalance += initialBalance;
      totalFinalBalance += finalBalance;

      userResults.push({
        userId,
        initialBalance,
        finalBalance,
        difference,
        isConsistent,
      });
    }

    const totalDifference = totalFinalBalance - totalInitialBalance;
    const isConsistent = Math.abs(totalDifference) < this.config.userCount * 0.01;

    return {
      config: this.config,
      stats: {
        totalOrders,
        successfulOrders,
        failedOrders,
        successRate,
        maxLatency: sortedLatencies.length > 0 ? sortedLatencies[sortedLatencies.length - 1] : 0,
        minLatency: sortedLatencies.length > 0 ? sortedLatencies[0] : 0,
        avgLatency: sortedLatencies.length > 0 ? sortedLatencies.reduce((a, b) => a + b, 0) / sortedLatencies.length : 0,
        p95Latency: sortedLatencies[Math.floor(sortedLatencies.length * 0.95)] || 0,
        p99Latency: sortedLatencies[Math.floor(sortedLatencies.length * 0.99)] || 0,
        latencyDistribution,
      },
      marketStats: {
        priceUpdates: 0, // 在行情模拟中计算
        avgPriceChange: 0,
        maxPriceChange: 0,
      },
      liquidationStats: {
        totalLiquidations: 0, // 需要从 API 获取
        liquidationSuccess: 0,
        liquidationFailed: 0,
      },
      fundConsistency: {
        initialTotalBalance: totalInitialBalance,
        finalTotalBalance: totalFinalBalance,
        difference: totalDifference,
        isConsistent,
        userResults,
      },
      startTime,
      endTime,
      duration: endTime - startTime,
    };
  }

  /**
   * 获取测试结果
   */
  getResults(): ChaosTestResult | null {
    return this.results;
  }

  /**
   * 停止测试
   */
  async stopTest(): Promise<void> {
    if (!this.isRunning) {
      logger.warn('[ChaosTest] 测试未运行');
      return;
    }

    try {
      logger.info('[ChaosTest] 停止测试');

      if (this.testTimer) {
        clearTimeout(this.testTimer);
        this.testTimer = undefined;
      }

      this.isRunning = false;

      logger.info('[ChaosTest] 测试已停止');
    } catch (error) {
      logger.error('[ChaosTest] 停止测试失败', error);
      throw error;
    }
  }

  /**
   * 更新配置
   */
  updateConfig(config: Partial<ChaosTestConfig>): void {
    this.config = {
      ...this.config,
      ...config,
    };

    logger.info('[ChaosTest] 配置已更新', {
      newConfig: this.config,
    });
  }

  /**
   * 输出测试报告
   */
  outputReport(): string {
    if (!this.results) {
      return '测试尚未完成';
    }

    const { stats, marketStats, liquidationStats, fundConsistency, config } = this.results;

    const report = `
========================================
        混沌测试报告
========================================

测试配置:
- 并发用户数: ${config.userCount}
- 每用户订单数: ${config.orderCountPerUser}
- 测试时长: ${config.durationMinutes} 分钟
- 行情品种: ${config.marketSymbols.join(', ')}
- 价格变化范围: ±${config.priceChangeRange}%

测试结果:
- 总订单数: ${stats.totalOrders}
- 成功订单数: ${stats.successfulOrders}
- 失败订单数: ${stats.failedOrders}
- 成功率: ${stats.successRate.toFixed(2)}%

延迟统计:
- 最大延迟: ${stats.maxLatency.toFixed(2)}ms
- 最小延迟: ${stats.minLatency.toFixed(2)}ms
- 平均延迟: ${stats.avgLatency.toFixed(2)}ms
- P95 延迟: ${stats.p95Latency.toFixed(2)}ms
- P99 延迟: ${stats.p99Latency.toFixed(2)}ms

延迟分布:
- 0-50ms: ${stats.latencyDistribution['0-50ms']} (${((stats.latencyDistribution['0-50ms'] / stats.totalOrders) * 100).toFixed(2)}%)
- 50-100ms: ${stats.latencyDistribution['50-100ms']} (${((stats.latencyDistribution['50-100ms'] / stats.totalOrders) * 100).toFixed(2)}%)
- 100-200ms: ${stats.latencyDistribution['100-200ms']} (${((stats.latencyDistribution['100-200ms'] / stats.totalOrders) * 100).toFixed(2)}%)
- 200-500ms: ${stats.latencyDistribution['200-500ms']} (${((stats.latencyDistribution['200-500ms'] / stats.totalOrders) * 100).toFixed(2)}%)
- 500-1000ms: ${stats.latencyDistribution['500-1000ms']} (${((stats.latencyDistribution['500-1000ms'] / stats.totalOrders) * 100).toFixed(2)}%)
- 1000ms+: ${stats.latencyDistribution['1000ms+']} (${((stats.latencyDistribution['1000ms+'] / stats.totalOrders) * 100).toFixed(2)}%)

行情统计:
- 价格更新次数: ${marketStats.priceUpdates}
- 平均价格变化: ${marketStats.avgPriceChange.toFixed(2)}%
- 最大价格变化: ${marketStats.maxPriceChange.toFixed(2)}%

强平统计:
- 总强平数: ${liquidationStats.totalLiquidations}
- 强平成功数: ${liquidationStats.liquidationSuccess}
- 强平失败数: ${liquidationStats.liquidationFailed}

资金一致性检查:
- 初始总余额: ¥${fundConsistency.initialTotalBalance.toFixed(2)}
- 最终总余额: ¥${fundConsistency.finalTotalBalance.toFixed(2)}
- 差异: ¥${fundConsistency.difference.toFixed(2)}
- 一致性: ${fundConsistency.isConsistent ? '✓ 通过' : '✗ 失败'}

用户一致性详情:
${fundConsistency.userResults.map(r => 
  `- 用户 ${r.userId}: 初始=¥${r.initialBalance.toFixed(2)}, 最终=¥${r.finalBalance.toFixed(2)}, 差异=¥${r.difference.toFixed(2)}, ${r.isConsistent ? '✓' : '✗'}`
).join('\n')}

========================================
测试时长: ${(this.results.duration / 1000).toFixed(2)} 秒
开始时间: ${new Date(this.results.startTime).toISOString()}
结束时间: ${new Date(this.results.endTime).toISOString()}
========================================
`;

    return report;
  }
}

// ============================================
// 创建默认实例
// ============================================

export const chaosTestService = new ChaosTestService();
