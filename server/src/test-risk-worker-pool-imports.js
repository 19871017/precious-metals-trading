// ============================================
// Risk Engine Worker Pool 测试脚本
// ============================================

// 测试所有模块的导入是否正确
console.log('开始测试 Risk Engine Worker Pool 模块导入...');

try {
  // 测试 1: 导入 RiskEngineWorkerPool
  const RiskEngineWorkerPoolModule = require('./services/RiskEngineWorkerPool');
  console.log('✅ RiskEngineWorkerPool 导入成功');
  console.log('   - 导出的内容:', Object.keys(RiskEngineWorkerPoolModule).join(', '));

  // 测试 2: 导入 RiskEngineQueueProducer
  const RiskEngineQueueProducerModule = require('./services/RiskEngineQueueProducer');
  console.log('✅ RiskEngineQueueProducer 导入成功');
  console.log('   - 导出的内容:', Object.keys(RiskEngineQueueProducerModule).join(', '));

  // 测试 3: 导入 RiskEngineWorkerPoolManager
  const RiskEngineWorkerPoolManagerModule = require('./services/RiskEngineWorkerPoolManager');
  console.log('✅ RiskEngineWorkerPoolManager 导入成功');
  console.log('   - 导出的内容:', Object.keys(RiskEngineWorkerPoolManagerModule).join(', '));

  // 测试 4: 导入 RiskEngine
  const RiskEngineModule = require('./services/RiskEngine');
  console.log('✅ RiskEngine 导入成功');
  console.log('   - 导出的内容:', Object.keys(RiskEngineModule).join(', '));

  // 测试 5: 导入路由
  const RiskWorkerPoolRoute = require('./routes/risk-worker-pool');
  console.log('✅ risk-worker-pool 路由导入成功');
  console.log('   - 导出的类型:', typeof RiskWorkerPoolRoute);

  console.log('\n========================================');
  console.log('所有模块导入测试通过！');
  console.log('========================================');

  process.exit(0);
} catch (error) {
  console.error('\n❌ 模块导入测试失败！');
  console.error('错误信息:', error.message);
  console.error('错误堆栈:', error.stack);
  process.exit(1);
}
