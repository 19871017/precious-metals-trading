#!/usr/bin/env node

console.log('========================================');
console.log('    开始运行测试套件');
console.log('========================================\n');

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const testFiles = [
  {
    name: 'RiskEngine (风险引擎)',
    file: 'src/tests/RiskEngine.test.ts',
  },
  {
    name: 'RiskEngine Worker Pool',
    file: 'src/tests/RiskEngineWorkerPool.test.ts',
  },
  {
    name: 'RiskEngine Worker Pool Manager',
    file: 'src/tests/RiskEngineWorkerPoolManager.test.ts',
  },
  {
    name: 'RiskManager',
    file: 'src/tests/RiskManager.test.ts',
  },
  {
    name: 'LiquidationScheduler (强平调度器)',
    file: 'src/tests/LiquidationScheduler.test.ts',
  },
  {
    name: 'LiquidationScheduler V2',
    file: 'src/tests/LiquidationSchedulerV2.test.ts',
  },
  {
    name: 'LiquidationPriorityScheduler',
    file: 'src/tests/LiquidationPriorityScheduler.test.ts',
  },
  {
    name: 'StopLossTakeProfitService',
    file: 'src/tests/StopLossTakeProfitService.test.ts',
  },
  {
    name: 'AccountService (账户服务)',
    file: 'src/tests/AccountService.test.ts',
  },
  {
    name: 'Finance Service',
    file: 'src/tests/finance.service.test.ts',
  },
  {
    name: 'AuditLog Service',
    file: 'src/tests/AuditLogService.test.ts',
  },
  {
    name: 'OrderManager (订单管理器)',
    file: 'src/tests/OrderManager.test.ts',
  },
  {
    name: '并发压力测试',
    file: 'src/tests/concurrent-stress.test.ts',
  },
];

let totalPassed = 0;
let totalFailed = 0;

console.log('测试环境信息:');
console.log(`Node.js: ${process.version}`);
console.log(`工作目录: ${process.cwd()}`);
console.log('\n开始执行测试...\n');

for (const test of testFiles) {
  console.log('\n' + '='.repeat(70));
  console.log(`测试模块: ${test.name}`);
  console.log('='.repeat(70));
  
  try {
    execSync(`npx jest --testPathPatterns="${test.file}" --preset=ts-jest --passWithNoTests`, {
      stdio: 'pipe',
      cwd: path.resolve(__dirname, '.'),
      encoding: 'utf8',
      timeout: 60000,
    });
    
    console.log(`\n✓ ${test.name} - 所有测试通过`);
    totalPassed++;
  } catch (error) {
    console.log(`\n✗ ${test.name} - 部分测试失败`);
    console.log(error.stdout || '');
    console.log(error.stderr || '');
    totalFailed++;
  }
}

console.log('\n' + '='.repeat(70));
console.log('测试完成');
console.log('='.repeat(70));

console.log('\n汇总结果:');
console.log(`总模块数: ${testFiles.length}`);
console.log(`通过: ${totalPassed}`);
console.log(`失败: ${totalFailed}`);
console.log(`覆盖率: ${Math.round((totalPassed / testFiles.length) * 100)}%`);

if (totalFailed > 0) {
  console.log('\n状态: ✗ 部分测试失败');
  process.exit(1);
} else {
  console.log('\n状态: ✓ 所有测试通过');
  
  console.log('\n正在生成覆盖率报告...');
  try {
    execSync('node generate-test-report.cjs', {
      stdio: 'inherit',
      cwd: path.resolve(__dirname, '.'),
    });
    console.log('✓ 覆盖率报告已生成: test-coverage-report.md');
  } catch (error) {
    console.log('✗ 覆盖率报告生成失败');
  }
}
