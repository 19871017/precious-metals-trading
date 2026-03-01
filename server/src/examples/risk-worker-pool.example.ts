// ============================================
// Risk Engine Worker Pool 使用示例
// ============================================

import { riskEngine } from '../services/RiskEngine';
import { riskEngineWorkerPoolManager } from '../services/RiskEngineWorkerPoolManager';
import logger from '../utils/logger';

// ============================================
// 示例 1: 使用 Worker Pool 执行风控检查（同步等待结果）
// ============================================

async function example1() {
  logger.info('[Example 1] 使用 Worker Pool 执行风控检查（同步等待结果）');

  try {
    const request = {
      userId: 1,
      productCode: 'XAUUSD',
      operation: 'OPEN' as const,
      quantity: 10,
      leverage: 10,
      price: 2345.67,
      direction: 'LONG' as const,
    };

    // 使用 Worker Pool 执行风控检查，同步等待结果
    const result = await riskEngine.validateAsync(request, 5, 5000);

    logger.info('[Example 1] 风控检查完成', {
      passed: result.passed,
      riskLevel: result.riskLevel,
      message: result.message,
    });
  } catch (error) {
    logger.error('[Example 1] 风控检查失败', error);
  }
}

// ============================================
// 示例 2: 异步提交 + 轮询等待结果
// ============================================

async function example2() {
  logger.info('[Example 2] 异步提交 + 轮询等待结果');

  try {
    const request = {
      userId: 2,
      productCode: 'XAUUSD',
      operation: 'OPEN' as const,
      quantity: 20,
      leverage: 5,
      price: 2345.67,
      direction: 'SHORT' as const,
    };

    // 异步提交风控检查任务
    const { jobId } = await riskEngine.validateWithWorker(request, 3);

    logger.info('[Example 2] 风控检查任务已提交', { jobId });

    // 在后台处理其他任务...
    logger.info('[Example 2] 处理其他任务...');

    // 轮询等待结果
    const result = await riskEngine.waitForValidationResult(jobId, 10000);

    logger.info('[Example 2] 风控检查完成', {
      passed: result.passed,
      riskLevel: result.riskLevel,
      message: result.message,
    });
  } catch (error) {
    logger.error('[Example 2] 风控检查失败', error);
  }
}

// ============================================
// 示例 3: 批量风控检查
// ============================================

async function example3() {
  logger.info('[Example 3] 批量风控检查');

  try {
    const riskRequests = [
      {
        userId: 1,
        productCode: 'XAUUSD',
        operation: 'OPEN' as const,
        quantity: 10,
        leverage: 10,
        price: 2345.67,
        direction: 'LONG' as const,
      },
      {
        userId: 2,
        productCode: 'XAUUSD',
        operation: 'OPEN' as const,
        quantity: 20,
        leverage: 5,
        price: 2345.67,
        direction: 'SHORT' as const,
      },
      {
        userId: 3,
        productCode: 'CMGCA0',
        operation: 'ADD' as const,
        quantity: 15,
        leverage: 8,
        price: 2350.00,
        direction: 'LONG' as const,
      },
    ];

    logger.info('[Example 3] 提交批量风控检查', {
      count: riskRequests.length,
    });

    // 提交所有风控检查任务
    const jobs = await Promise.all(
      riskRequests.map((req) => riskEngine.validateWithWorker(req, 5))
    );

    logger.info('[Example 3] 所有任务已提交', {
      jobIds: jobs.map((j) => j.jobId),
    });

    // 获取所有结果
    const results = await Promise.all(
      jobs.map((job) => riskEngine.waitForValidationResult(job.jobId, 5000))
    );

    logger.info('[Example 3] 批量风控检查完成', {
      total: results.length,
      passed: results.filter((r) => r.passed).length,
      failed: results.filter((r) => !r.passed).length,
    });

    results.forEach((result, index) => {
      logger.info(`[Example 3] 任务 ${index + 1} 结果`, {
        userId: riskRequests[index].userId,
        passed: result.passed,
        riskLevel: result.riskLevel,
        message: result.message,
      });
    });
  } catch (error) {
    logger.error('[Example 3] 批量风控检查失败', error);
  }
}

// ============================================
// 示例 4: 高优先级风控检查（紧急情况）
// ============================================

async function example4() {
  logger.info('[Example 4] 高优先级风控检查（紧急情况）');

  try {
    const request = {
      userId: 1,
      productCode: 'XAUUSD',
      operation: 'LIQUIDATE' as const,
    };

    // 使用高优先级（0）执行风控检查
    const result = await riskEngine.validateAsync(request, 0, 3000);

    logger.info('[Example 4] 紧急风控检查完成', {
      passed: result.passed,
      riskLevel: result.riskLevel,
      message: result.message,
    });
  } catch (error) {
    logger.error('[Example 4] 紧急风控检查失败', error);
  }
}

// ============================================
// 示例 5: 直接使用（不走 Worker Pool）
// ============================================

async function example5() {
  logger.info('[Example 5] 直接使用（不走 Worker Pool）');

  try {
    const request = {
      userId: 1,
      productCode: 'XAUUSD',
      operation: 'OPEN' as const,
      quantity: 10,
      leverage: 10,
      price: 2345.67,
      direction: 'LONG' as const,
    };

    // 直接使用，不走 Worker Pool
    const result = await riskEngine.validate(request);

    logger.info('[Example 5] 风控检查完成', {
      passed: result.passed,
      riskLevel: result.riskLevel,
      message: result.message,
    });
  } catch (error) {
    logger.error('[Example 5] 风控检查失败', error);
  }
}

// ============================================
// 示例 6: 管理 Worker Pool
// ============================================

async function example6() {
  logger.info('[Example 6] 管理 Worker Pool');

  try {
    // 获取 Worker Pool 状态
    const status = riskEngineWorkerPoolManager.getStatus();
    logger.info('[Example 6] Worker Pool 状态', status);

    // 获取队列统计
    const queueStats = await riskEngineWorkerPoolManager.getQueueStats();
    logger.info('[Example 6] 队列统计', queueStats);

    // 暂停队列
    await riskEngineWorkerPoolManager.pauseQueue();
    logger.info('[Example 6] 队列已暂停');

    // 等待一段时间...
    await new Promise((resolve) => setTimeout(resolve, 1000));

    // 恢复队列
    await riskEngineWorkerPoolManager.resumeQueue();
    logger.info('[Example 6] 队列已恢复');
  } catch (error) {
    logger.error('[Example 6] 管理 Worker Pool 失败', error);
  }
}

// ============================================
// 主函数
// ============================================

async function main() {
  try {
    logger.info('[Main] 开始执行 Risk Engine Worker Pool 示例');

    await example1();
    await new Promise((resolve) => setTimeout(resolve, 1000));

    await example2();
    await new Promise((resolve) => setTimeout(resolve, 1000));

    await example3();
    await new Promise((resolve) => setTimeout(resolve, 1000));

    await example4();
    await new Promise((resolve) => setTimeout(resolve, 1000));

    await example5();
    await new Promise((resolve) => setTimeout(resolve, 1000));

    await example6();

    logger.info('[Main] 所有示例执行完成');
  } catch (error) {
    logger.error('[Main] 执行示例失败', error);
  }
}

// 如果直接运行此文件，则执行主函数
if (require.main === module) {
  main();
}

export {
  example1,
  example2,
  example3,
  example4,
  example5,
  example6,
};
