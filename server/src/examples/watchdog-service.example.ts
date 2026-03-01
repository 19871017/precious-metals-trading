// ============================================
// Watchdog 服务使用示例
// ============================================

import { watchdogService, BlockEventType } from '../services/WatchdogService';
import logger from '../utils/logger';

// ============================================
// 示例 1: 基本使用 - 启动和停止 Watchdog
// ============================================

async function example1() {
  logger.info('[Example 1] 基本使用 - 启动和停止 Watchdog');

  try {
    // 启动 Watchdog 服务
    await watchdogService.start();
    logger.info('[Example 1] Watchdog 服务已启动');

    // 等待一段时间...
    await new Promise((resolve) => setTimeout(resolve, 5000));

    // 获取状态
    const status = watchdogService.getStatus();
    logger.info('[Example 1] Watchdog 服务状态', status);

    // 停止 Watchdog 服务
    await watchdogService.stop();
    logger.info('[Example 1] Watchdog 服务已停止');
  } catch (error) {
    logger.error('[Example 1] Watchdog 服务操作失败', error);
  }
}

// ============================================
// 示例 2: 订单处理跟踪
// ============================================

async function example2() {
  logger.info('[Example 2] 订单处理跟踪');

  try {
    const orderId = 1001;
    const userId = 1;
    const productCode = 'XAUUSD';

    // 启动 Watchdog 服务
    await watchdogService.start();

    try {
      // 开始跟踪订单处理
      watchdogService.startTrackingOrder(orderId, userId, productCode);
      logger.info(`[Example 2] 开始跟踪订单: ${orderId}`);

      // 模拟订单处理
      await new Promise((resolve) => setTimeout(resolve, 1000));
      watchdogService.updateOrderPhase(orderId, 'VALIDATION');
      logger.info(`[Example 2] 订单阶段: VALIDATION`);

      await new Promise((resolve) => setTimeout(resolve, 1000));
      watchdogService.updateOrderPhase(orderId, 'MATCHING');
      logger.info(`[Example 2] 订单阶段: MATCHING`);

      await new Promise((resolve) => setTimeout(resolve, 1000));
      watchdogService.updateOrderPhase(orderId, 'NOTIFICATION');
      logger.info(`[Example 2] 订单阶段: NOTIFICATION`);

      // 订单处理完成
      logger.info(`[Example 2] 订单处理完成: ${orderId}`);
    } finally {
      // 停止跟踪订单
      watchdogService.stopTrackingOrder(orderId);

      // 停止 Watchdog 服务
      await watchdogService.stop();
    }
  } catch (error) {
    logger.error('[Example 2] 订单跟踪失败', error);
  }
}

// ============================================
// 示例 3: 模拟慢速订单处理
// ============================================

async function example3() {
  logger.info('[Example 3] 模拟慢速订单处理');

  try {
    // 启动 Watchdog 服务
    await watchdogService.start();

    try {
      // 更新配置，降低阈值以便测试
      watchdogService.updateConfig({
        orderProcessingThreshold: 3000, // 3 秒
      });

      const orderId = 1002;
      const userId = 2;

      // 开始跟踪订单处理
      watchdogService.startTrackingOrder(orderId, userId);
      logger.info(`[Example 3] 开始跟踪订单: ${orderId}`);

      // 模拟慢速订单处理（超过阈值）
      await new Promise((resolve) => setTimeout(resolve, 5000));
      logger.info(`[Example 3] 慢速订单处理完成: ${orderId}`);

      // 等待 Watchdog 检测
      await new Promise((resolve) => setTimeout(resolve, 3000));

      // 停止跟踪订单
      watchdogService.stopTrackingOrder(orderId);
    } finally {
      // 停止 Watchdog 服务
      await watchdogService.stop();
    }
  } catch (error) {
    logger.error('[Example 3] 模拟慢速订单处理失败', error);
  }
}

// ============================================
// 示例 4: 获取阻塞事件历史
// ============================================

async function example4() {
  logger.info('[Example 4] 获取阻塞事件历史');

  try {
    // 启动 Watchdog 服务
    await watchdogService.start();

    try {
      // 获取所有阻塞事件
      const allEvents = await watchdogService.getBlockEventHistory();
      logger.info('[Example 4] 所有阻塞事件', {
        count: allEvents.length,
      });

      // 获取特定类型的阻塞事件
      const slowOrderEvents = await watchdogService.getBlockEventHistory(
        BlockEventType.ORDER_PROCESSING_SLOW
      );
      logger.info('[Example 4] 慢速订单事件', {
        count: slowOrderEvents.length,
      });

      // 获取最近 10 个事件
      const recentEvents = await watchdogService.getBlockEventHistory(
        undefined,
        10
      );
      logger.info('[Example 4] 最近 10 个事件', {
        events: recentEvents,
      });
    } finally {
      // 停止 Watchdog 服务
      await watchdogService.stop();
    }
  } catch (error) {
    logger.error('[Example 4] 获取阻塞事件历史失败', error);
  }
}

// ============================================
// 示例 5: 生成阻塞事件报告
// ============================================

async function example5() {
  logger.info('[Example 5] 生成阻塞事件报告');

  try {
    // 启动 Watchdog 服务
    await watchdogService.start();

    try {
      // 生成今天的报告
      const today = new Date();
      const startOfDay = new Date(
        today.getFullYear(),
        today.getMonth(),
        today.getDate(),
        0,
        0,
        0
      );

      const report = await watchdogService.generateBlockEventReport(
        startOfDay,
        today
      );

      logger.info('[Example 5] 阻塞事件报告', {
        summary: report.summary,
        byType: report.byType,
        bySeverity: report.bySeverity,
      });

      // 打印统计信息
      console.log('\n========================================');
      console.log('阻塞事件统计');
      console.log('========================================');
      console.log(`总事件数: ${report.summary.total_events}`);
      console.log(`严重程度分布:`);
      console.log(`  - CRITICAL: ${report.summary.critical_count}`);
      console.log(`  - HIGH: ${report.summary.high_count}`);
      console.log(`  - MEDIUM: ${report.summary.medium_count}`);
      console.log(`  - LOW: ${report.summary.low_count}`);
      console.log('\n按类型分布:');
      report.byType.forEach((type: any) => {
        console.log(
          `  - ${type.event_type}: ${type.count} 次, 平均值: ${type.avg_value.toFixed(2)}`
        );
      });
      console.log('========================================\n');
    } finally {
      // 停止 Watchdog 服务
      await watchdogService.stop();
    }
  } catch (error) {
    logger.error('[Example 5] 生成阻塞事件报告失败', error);
  }
}

// ============================================
// 示例 6: 动态调整配置
// ============================================

async function example6() {
  logger.info('[Example 6] 动态调整配置');

  try {
    // 启动 Watchdog 服务
    await watchdogService.start();

    try {
      // 获取当前配置
      const status = watchdogService.getStatus();
      logger.info('[Example 6] 当前配置', status.config);

      // 更新配置 - 降低阈值以便测试
      watchdogService.updateConfig({
        checkInterval: 1000, // 1 秒
        orderProcessingThreshold: 2000, // 2 秒
        dbLockWaitThreshold: 500, // 0.5 秒
        redisLatencyThreshold: 50, // 50ms
        enableAutoUpload: false, // 不自动上传
      });

      logger.info('[Example 6] 配置已更新');

      // 等待一段时间
      await new Promise((resolve) => setTimeout(resolve, 5000));

      // 恢复默认配置
      watchdogService.updateConfig({
        checkInterval: 2000, // 2 秒
        orderProcessingThreshold: 5000, // 5 秒
        dbLockWaitThreshold: 1000, // 1 秒
        redisLatencyThreshold: 100, // 100ms
      });

      logger.info('[Example 6] 配置已恢复');
    } finally {
      // 停止 Watchdog 服务
      await watchdogService.stop();
    }
  } catch (error) {
    logger.error('[Example 6] 动态调整配置失败', error);
  }
}

// ============================================
// 主函数
// ============================================

async function main() {
  try {
    logger.info('[Main] 开始执行 Watchdog 服务示例');

    // 示例 1: 基本使用
    await example1();
    await new Promise((resolve) => setTimeout(resolve, 1000));

    // 示例 2: 订单处理跟踪
    await example2();
    await new Promise((resolve) => setTimeout(resolve, 1000));

    // 示例 3: 模拟慢速订单处理
    await example3();
    await new Promise((resolve) => setTimeout(resolve, 2000));

    // 示例 4: 获取阻塞事件历史
    await example4();
    await new Promise((resolve) => setTimeout(resolve, 1000));

    // 示例 5: 生成阻塞事件报告
    await example5();
    await new Promise((resolve) => setTimeout(resolve, 1000));

    // 示例 6: 动态调整配置
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
