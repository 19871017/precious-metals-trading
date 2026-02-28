import { liquidationScheduler } from '../services/LiquidationSchedulerV2';
import logger from '../utils/logger';

/**
 * 自动强平调度系统示例
 */
export async function liquidationSchedulerExample() {
  logger.info('[LiquidationSchedulerExample] 开始运行自动强平调度系统示例');

  try {
    logger.info('[LiquidationSchedulerExample] 1. 获取队列统计...');
    const queueStats = await liquidationScheduler.getQueueStats();
    logger.info('[LiquidationSchedulerExample] 队列统计:', queueStats);

    logger.info('[LiquidationSchedulerExample] 2. 获取风险账户统计...');
    const riskStats = await liquidationScheduler.getRiskAccountStats();
    logger.info('[LiquidationSchedulerExample] 风险账户统计:', riskStats);

    logger.info('[LiquidationSchedulerExample] 3. 启动强平调度器...');
    await liquidationScheduler.start();

    logger.info('[LiquidationSchedulerExample] 调度器运行中,等待30秒...');

    for (let i = 1; i <= 6; i++) {
      await new Promise(resolve => setTimeout(resolve, 5000));

      const stats = await liquidationScheduler.getQueueStats();
      const riskStats2 = await liquidationScheduler.getRiskAccountStats();

      logger.info(
        `[LiquidationSchedulerExample] 第${i}次检查: 队列waiting=${stats.waiting}, 风险CRITICAL=${riskStats2.criticalAccounts}`
      );
    }

    logger.info('[LiquidationSchedulerExample] 4. 停止强平调度器...');
    await liquidationScheduler.stop();

    logger.info('[LiquidationSchedulerExample] 自动强平调度系统示例运行完成');
  } catch (error) {
    logger.error('[LiquidationSchedulerExample] 示例运行失败:', error);
  }
}

/**
 * 手动强平示例
 */
export async function manualLiquidationExample() {
  logger.info('[ManualLiquidationExample] 开始运行手动强平示例');

  const userId = 1;
  const positionId = 123;
  const productCode = 'XAUUSD';
  const currentPrice = 2300;

  try {
    logger.info(
      `[ManualLiquidationExample] 手动触发强平: userId=${userId}, positionId=${positionId}, price=${currentPrice}`
    );

    await liquidationScheduler.forceLiquidate(
      userId,
      positionId,
      productCode,
      currentPrice,
      '手动强平测试'
    );

    logger.info('[ManualLiquidationExample] 手动强平任务已添加到队列');
  } catch (error) {
    logger.error('[ManualLiquidationExample] 手动强平失败:', error);
  }

  logger.info('[ManualLiquidationExample] 手动强平示例运行完成');
}

/**
 * 运行所有示例
 */
export async function runLiquidationSchedulerExamples() {
  try {
    await liquidationSchedulerExample();
    await manualLiquidationExample();
  } catch (error) {
    logger.error('[LiquidationSchedulerExamples] 示例运行失败:', error);
  }
}

if (require.main === module) {
  runLiquidationSchedulerExamples();
}
