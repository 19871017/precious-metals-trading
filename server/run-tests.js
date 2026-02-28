#!/usr/bin/env node

const { execSync } = require('child_process');
const path = require('path');

console.log('=== 开始运行测试 ===\n');

const testFiles = [
  'src/tests/RiskEngine.test.ts',
  'src/tests/AccountService.test.ts',
  'src/tests/LiquidationScheduler.test.ts',
  'src/tests/OrderManager.test.ts',
  'src/tests/concurrent-stress.test.ts',
];

let totalPassed = 0;
let totalFailed = 0;

for (const testFile of testFiles) {
  console.log(`\n运行测试文件: ${testFile}`);
  console.log('='.repeat(60));
  
  try {
    execSync(`npx tsx ${testFile}`, {
      stdio: 'inherit',
      cwd: path.resolve(__dirname, '../server'),
    });
    totalPassed++;
    console.log(`✓ ${testFile} 通过\n`);
  } catch (error) {
    totalFailed++;
    console.log(`✗ ${testFile} 失败\n`);
  }
}

console.log('\n=== 测试完成 ===');
console.log(`总计测试文件: ${testFiles.length}`);
console.log(`通过: ${totalPassed}`);
console.log(`失败: ${totalFailed}`);
console.log(`覆盖率: ${Math.round((totalPassed / testFiles.length) * 100)}%`);

if (totalFailed > 0) {
  process.exit(1);
}