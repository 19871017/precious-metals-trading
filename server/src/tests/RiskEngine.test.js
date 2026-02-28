import { jest } from '@jest/globals';
import { RiskEngine } from '../services/RiskEngine.js';

console.log('=== RiskEngine 测试开始 ===\n');

const riskEngine = new RiskEngine();
let passedTests = 0;
let failedTests = 0;

async function runTest(name: string, testFn: () => Promise<void>) {
  try {
    console.log(`运行测试: ${name}`);
    await testFn();
    passedTests++;
    console.log(`✓ ${name} 通过\n`);
  } catch (error) {
    failedTests++;
    console.error(`✗ ${name} 失败: ${error}\n`);
  }
}

async function expect(condition: boolean, message: string) {
  if (!condition) {
    throw new Error(message);
  }
}

console.log('=== 测试完成 ===');
console.log(`通过: ${passedTests}`);
console.log(`失败: ${failedTests}`);
console.log(`总计: ${passedTests + failedTests}`);
console.log(`覆盖率: ${Math.round((passedTests / (passedTests + failedTests)) * 100)}%`);