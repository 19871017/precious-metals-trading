/**
 * 正式上线前验证脚本
 * 用于快速检查系统关键功能
 */

const API_BASE = 'http://localhost:3001';

// 测试结果统计
let totalTests = 0;
let passedTests = 0;
let failedTests = 0;

// 颜色输出
const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m'
};

// 测试函数
async function test(name: string, fn: () => Promise<void>) {
  totalTests++;
  process.stdout.write(`${colors.blue}[TEST ${totalTests}]${colors.reset} ${name}... `);

  try {
    await fn();
    passedTests++;
    console.log(`${colors.green}✓ PASSED${colors.reset}`);
  } catch (error: any) {
    failedTests++;
    console.log(`${colors.red}✗ FAILED${colors.reset}`);
    console.log(`  ${colors.yellow}Error:${colors.reset}`, error.message);
  }
}

// 断言函数
function assert(condition: boolean, message: string) {
  if (!condition) {
    throw new Error(message);
  }
}

// ============================================
// 测试套件
// ============================================

async function runTests() {
  console.log('\n' + colors.cyan + '='.repeat(60) + colors.reset);
  console.log(colors.cyan + '  贵金属期货交易系统 - 正式上线前验证' + colors.reset);
  console.log(colors.cyan + '='.repeat(60) + colors.reset + '\n');

  // 1. 健康检查
  console.log(colors.cyan + '[1] 健康检查测试' + colors.reset);
  await test('服务健康检查', async () => {
    const response = await fetch(`${API_BASE}/health`);
    const data = await response.json();
    assert(data.code === 0, '健康检查返回错误');
    assert(data.data.status === 'ok', '服务状态异常');
  });

  // 2. 用户认证测试
  console.log('\n' + colors.cyan + '[2] 用户认证测试' + colors.reset);

  await test('用户登录', async () => {
    const response = await fetch(`${API_BASE}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: 'admin', password: 'admin123' })
    });
    const data = await response.json();
    assert(data.code === 0, '登录失败');
    assert(data.data.token, '未返回token');
  });

  await test('JWT验证', async () => {
    const loginResponse = await fetch(`${API_BASE}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: 'admin', password: 'admin123' })
    });
    const loginData = await loginResponse.json();
    const token = loginData.data.token;

    const accountResponse = await fetch(`${API_BASE}/api/account/info`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    const accountData = await accountResponse.json();
    assert(accountData.code === 0, 'JWT验证失败');
  });

  // 3. 行情API测试
  console.log('\n' + colors.cyan + '[3] 行情API测试' + colors.reset);

  await test('获取单个产品行情', async () => {
    const response = await fetch(`${API_BASE}/api/market/ticker?product=XAUUSD`);
    const data = await response.json();
    assert(data.code === 0, '获取行情失败');
    assert(data.data.productCode === 'XAUUSD', '产品代码错误');
    assert(data.data.lastPrice > 0, '价格异常');
  });

  await test('获取所有产品行情', async () => {
    const response = await fetch(`${API_BASE}/api/market/ticker`);
    const data = await response.json();
    assert(data.code === 0, '获取所有行情失败');
    assert(Array.isArray(data.data), '数据格式错误');
    assert(data.data.length > 0, '行情数据为空');
  });

  await test('获取K线数据', async () => {
    const response = await fetch(`${API_BASE}/api/market/kline?product=XAUUSD&period=1h&limit=100`);
    const data = await response.json();
    assert(data.code === 0, '获取K线数据失败');
    assert(data.data.data.length === 100, 'K线数据数量不正确');
    assert(data.data.data[0].open > 0, 'K线数据异常');
  });

  // 4. 账户API测试
  console.log('\n' + colors.cyan + '[4] 账户API测试' + colors.reset);

  await test('获取账户信息', async () => {
    const loginResponse = await fetch(`${API_BASE}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: 'admin', password: 'admin123' })
    });
    const loginData = await loginResponse.json();
    const token = loginData.data.token;

    const accountResponse = await fetch(`${API_BASE}/api/account/info`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    const accountData = await accountResponse.json();
    assert(accountData.code === 0, '获取账户信息失败');
    assert(accountData.data.totalBalance >= 0, '余额异常');
  });

  await test('获取账户余额', async () => {
    const response = await fetch(`${API_BASE}/api/account/balance`);
    const data = await response.json();
    assert(data.code === 0, '获取余额失败');
    assert(data.data.availableBalance >= 0, '可用余额异常');
  });

  // 5. 交易API测试
  console.log('\n' + colors.cyan + '[5] 交易API测试' + colors.reset);

  await test('获取持仓列表', async () => {
    const loginResponse = await fetch(`${API_BASE}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: 'admin', password: 'admin123' })
    });
    const loginData = await loginResponse.json();
    const token = loginData.data.token;

    const positionsResponse = await fetch(`${API_BASE}/api/positions`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    const positionsData = await positionsResponse.json();
    assert(positionsData.code === 0, '获取持仓失败');
    assert(Array.isArray(positionsData.data), '持仓数据格式错误');
  });

  // 6. 参数验证测试
  console.log('\n' + colors.cyan + '[6] 参数验证测试' + colors.reset);

  await test('缺少必要参数应返回错误', async () => {
    const loginResponse = await fetch(`${API_BASE}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: 'admin' }) // 缺少密码
    });
    const loginData = await loginResponse.json();
    assert(loginData.code !== 0, '应该返回错误');
  });

  await test('无效的产品代码应返回错误', async () => {
    const response = await fetch(`${API_BASE}/api/market/ticker?product=INVALID`);
    const data = await response.json();
    assert(data.code !== 0, '应该返回错误');
  });

  // 7. 错误处理测试
  console.log('\n' + colors.cyan + '[7] 错误处理测试' + colors.reset);

  await test('无效的JWT应返回401', async () => {
    const response = await fetch(`${API_BASE}/api/account/info`, {
      headers: { 'Authorization': 'Bearer invalid_token' }
    });
    assert(response.status === 401, '应该返回401状态码');
  });

  await test('不存在的账户应返回404', async () => {
    const loginResponse = await fetch(`${API_BASE}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: 'nonexistent', password: '123456' })
    });
    const loginData = await loginResponse.json();
    assert(loginData.code !== 0, '应该返回错误');
  });

  // ============================================
  // 测试结果汇总
  // ============================================

  console.log('\n' + colors.cyan + '='.repeat(60) + colors.reset);
  console.log(colors.cyan + '  测试结果汇总' + colors.reset);
  console.log(colors.cyan + '='.repeat(60) + colors.reset + '\n');

  console.log(`总测试数: ${totalTests}`);
  console.log(`${colors.green}通过: ${passedTests}${colors.reset}`);
  console.log(`${colors.red}失败: ${failedTests}${colors.reset}`);

  const passRate = ((passedTests / totalTests) * 100).toFixed(1);
  console.log(`通过率: ${passRate}%`);

  if (failedTests === 0) {
    console.log(`\n${colors.green}✓ 所有测试通过！系统可以上线。${colors.reset}\n`);
    process.exit(0);
  } else {
    console.log(`\n${colors.red}✗ 有 ${failedTests} 个测试失败，请修复后再上线。${colors.reset}\n`);
    process.exit(1);
  }
}

// 运行测试
runTests().catch(error => {
  console.error(colors.red + '\n测试运行出错:', error + colors.reset);
  process.exit(1);
});
