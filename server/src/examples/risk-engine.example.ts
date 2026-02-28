import { riskEngine, RiskCheckRequest } from '../services/RiskEngine';
import { liquidationScheduler } from '../services/LiquidationScheduler';
import logger from '../utils/logger';

/**
 * 风险引擎集成示例
 */
export async function riskEngineExample() {
  logger.info('[RiskEngineExample] 开始运行风控引擎示例');

  const userId = 1;
  const productCode = 'XAUUSD';
  const quantity = 10;
  const leverage = 10;
  const price = 2345.67;

  logger.info('[RiskEngineExample] 测试开仓风控检查...');

  const openRequest: RiskCheckRequest = {
    userId,
    productCode,
    operation: 'OPEN',
    quantity,
    leverage,
    price,
    direction: 'LONG',
  };

  const openResult = await riskEngine.validate(openRequest);

  logger.info('[RiskEngineExample] 开仓风控检查结果:', openResult);

  logger.info('[RiskEngineExample] 测试平仓风控检查...');

  const closeRequest: RiskCheckRequest = {
    userId,
    productCode,
    operation: 'CLOSE',
    quantity,
  };

  const closeResult = await riskEngine.validate(closeRequest);

  logger.info('[RiskEngineExample] 平仓风控检查结果:', closeResult);

  logger.info('[RiskEngineExample] 获取账户实时权益...');

  try {
    const equity = await riskEngine.getAccountEquity(userId);

    logger.info(`[RiskEngineExample] 账户 ${userId} 实时权益: ${equity}`);
  } catch (error) {
    logger.error('[RiskEngineExample] 获取账户权益失败:', error);
  }

  logger.info('[RiskEngineExample] 获取平台风险统计...');

  const stats = await riskEngine.getPlatformRiskStats();

  logger.info('[RiskEngineExample] 平台风险统计:', stats);

  logger.info('[RiskEngineExample] 获取风控配置...');

  const config = riskEngine.getConfig();

  logger.info('[RiskEngineExample] 风控配置:', config);

  logger.info('[RiskEngineExample] 风控引擎示例运行完成');
}

/**
 * 强平调度器集成示例
 */
export async function liquidationSchedulerExample() {
  logger.info('[LiquidationSchedulerExample] 开始运行强平调度器示例');

  logger.info('[LiquidationSchedulerExample] 启动强平调度器...');

  await liquidationScheduler.start(5000);

  logger.info('[LiquidationSchedulerExample] 等待10秒...');

  await new Promise(resolve => setTimeout(resolve, 10000));

  logger.info('[LiquidationSchedulerExample] 获取队列统计...');

  const queueStats = await liquidationScheduler.getQueueStats();

  logger.info('[LiquidationSchedulerExample] 队列统计:', queueStats);

  logger.info('[LiquidationSchedulerExample] 停止强平调度器...');

  await liquidationScheduler.stop();

  logger.info('[LiquidationSchedulerExample] 强平调度器示例运行完成');
}

/**
 * 运行所有示例
 */
export async function runRiskEngineExamples() {
  try {
    await riskEngineExample();
    await liquidationSchedulerExample();
  } catch (error) {
    logger.error('[RiskEngineExamples] 示例运行失败:', error);
  }
}

if (require.main === module) {
  runRiskEngineExamples();
}
