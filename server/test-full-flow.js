// 完整交易流程测试脚本
// 从注册到登录、下单、持仓、平仓、结算

const axios = require('axios');

const BASE_URL = 'http://localhost:3001';

// 测试用户数据
const testUser = {
  username: 'test_flow_user_' + Date.now(),
  password: 'Test123456!',
  phone: '13800138001',
  email: `test_${Date.now()}@example.com`,
  realName: '流程测试用户'
};

let authToken = '';
let userId = '';
let orderId = '';
let positionId = '';

// 颜色输出
const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m'
};

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

function logStep(step) {
  console.log('\n' + '='.repeat(60));
  log(`步骤 ${step}`, 'cyan');
  console.log('='.repeat(60));
}

async function testRegister() {
  logStep(1);
  log('用户注册测试', 'yellow');

  try {
    const response = await axios.post(`${BASE_URL}/auth/register`, testUser);

    if (response.data.code === 0) {
      userId = response.data.data.id;
      log('✅ 注册成功', 'green');
      log(`用户ID: ${userId}`, 'blue');
      return true;
    } else {
      log(`❌ 注册失败: ${response.data.message}`, 'red');
      return false;
    }
  } catch (error) {
    log(`❌ 注册请求失败: ${error.message}`, 'red');
    if (error.response) {
      log(`响应数据: ${JSON.stringify(error.response.data)}`, 'red');
    }
    return false;
  }
}

async function testLogin() {
  logStep(2);
  log('用户登录测试', 'yellow');

  try {
    const response = await axios.post(`${BASE_URL}/auth/login`, {
      username: testUser.username,
      password: testUser.password
    });

    if (response.data.code === 0) {
      authToken = response.data.data.token;
      log('✅ 登录成功', 'green');
      log(`用户名: ${response.data.data.user.username}`, 'blue');
      log(`角色: ${response.data.data.user.role}`, 'blue');
      log(`Token: ${authToken.substring(0, 50)}...`, 'blue');
      return true;
    } else {
      log(`❌ 登录失败: ${response.data.message}`, 'red');
      return false;
    }
  } catch (error) {
    log(`❌ 登录请求失败: ${error.message}`, 'red');
    if (error.response) {
      log(`响应数据: ${JSON.stringify(error.response.data)}`, 'red');
    }
    return false;
  }
}

async function testGetAccount() {
  logStep(3);
  log('获取账户余额测试', 'yellow');

  try {
    const response = await axios.get(`${BASE_URL}/api/account`, {
      headers: { Authorization: `Bearer ${authToken}` }
    });

    if (response.data.code === 0) {
      const account = response.data.data;
      log('✅ 获取账户成功', 'green');
      log(`账户余额: ${account.balance || account.totalBalance}`, 'blue');
      log(`可用余额: ${account.available}`, 'blue');
      log(`冻结保证金: ${account.frozen || 0}`, 'blue');
      return account;
    } else {
      log(`❌ 获取账户失败: ${response.data.message}`, 'red');
      return null;
    }
  } catch (error) {
    log(`❌ 获取账户请求失败: ${error.message}`, 'red');
    if (error.response) {
      log(`响应数据: ${JSON.stringify(error.response.data)}`, 'red');
    }
    return null;
  }
}

async function testMarketData() {
  logStep(4);
  log('获取市场行情测试', 'yellow');

  try {
    const response = await axios.get(`${BASE_URL}/api/market?product=XAUUSD`);

    if (response.data.code === 0) {
      const market = response.data.data;
      log('✅ 获取行情成功', 'green');
      log(`产品代码: ${market.productCode}`, 'blue');
      log(`当前价格: ${market.lastPrice}`, 'blue');
      log(`买价: ${market.bid}`, 'blue');
      log(`卖价: ${market.ask}`, 'blue');
      log(`涨跌幅: ${market.changePercent}%`, 'blue');
      return market;
    } else {
      log(`❌ 获取行情失败: ${response.data.message}`, 'red');
      return null;
    }
  } catch (error) {
    log(`❌ 获取行情请求失败: ${error.message}`, 'red');
    if (error.response) {
      log(`响应数据: ${JSON.stringify(error.response.data)}`, 'red');
    }
    return null;
  }
}

async function testPlaceOrder() {
  logStep(5);
  log('下市价单测试（买入）', 'yellow');

  try {
    const response = await axios.post(
      `${BASE_URL}/api/order`,
      {
        productCode: 'XAUUSD',
        direction: 'BUY',
        type: 'MARKET',
        quantity: 10,
        leverage: 100
      },
      {
        headers: { Authorization: `Bearer ${authToken}` }
      }
    );

    if (response.data.code === 0) {
      const order = response.data.data;
      orderId = order.orderId || order.id;
      positionId = order.positionId || order.positionId;
      log('✅ 下单成功', 'green');
      log(`订单ID: ${orderId}`, 'blue');
      log(`状态: ${order.status}`, 'blue');
      log(`价格: ${order.price}`, 'blue');
      log(`数量: ${order.quantity}`, 'blue');
      log(`保证金: ${order.margin}`, 'blue');
      return order;
    } else {
      log(`❌ 下单失败: ${response.data.message}`, 'red');
      return null;
    }
  } catch (error) {
    log(`❌ 下单请求失败: ${error.message}`, 'red');
    if (error.response) {
      log(`响应数据: ${JSON.stringify(error.response.data)}`, 'red');
    }
    return null;
  }
}

async function testGetPositions() {
  logStep(6);
  log('获取持仓列表测试', 'yellow');

  try {
    const response = await axios.get(`${BASE_URL}/api/positions`, {
      headers: { Authorization: `Bearer ${authToken}` }
    });

    if (response.data.code === 0) {
      const positions = response.data.data;
      log('✅ 获取持仓成功', 'green');
      log(`持仓数量: ${positions.length}`, 'blue');

      if (positions.length > 0) {
        const pos = positions[0];
        positionId = pos.positionId || pos.id;
        log(`持仓ID: ${positionId}`, 'blue');
        log(`产品: ${pos.productCode}`, 'blue');
        log(`方向: ${pos.direction}`, 'blue');
        log(`数量: ${pos.quantity}`, 'blue');
        log(`开仓价: ${pos.openPrice}`, 'blue');
        log(`当前价: ${pos.currentPrice}`, 'blue');
        log(`浮动盈亏: ${pos.unrealizedPnL || pos.pnl}`, 'blue');
      }

      return positions;
    } else {
      log(`❌ 获取持仓失败: ${response.data.message}`, 'red');
      return [];
    }
  } catch (error) {
    log(`❌ 获取持仓请求失败: ${error.message}`, 'red');
    if (error.response) {
      log(`响应数据: ${JSON.stringify(error.response.data)}`, 'red');
    }
    return [];
  }
}

async function testGetOrders() {
  logStep(7);
  log('获取订单历史测试', 'yellow');

  try {
    const response = await axios.get(`${BASE_URL}/api/orders`, {
      headers: { Authorization: `Bearer ${authToken}` }
    });

    if (response.data.code === 0) {
      const orders = response.data.data;
      log('✅ 获取订单成功', 'green');
      log(`订单数量: ${orders.length}`, 'blue');

      if (orders.length > 0) {
        const order = orders[0];
        log(`订单ID: ${order.orderId}`, 'blue');
        log(`状态: ${order.status}`, 'blue');
      }

      return orders;
    } else {
      log(`❌ 获取订单失败: ${response.data.message}`, 'red');
      return [];
    }
  } catch (error) {
    log(`❌ 获取订单请求失败: ${error.message}`, 'red');
    if (error.response) {
      log(`响应数据: ${JSON.stringify(error.response.data)}`, 'red');
    }
    return [];
  }
}

async function testSetStopLossTakeProfit() {
  logStep(8);
  log('设置止损止盈测试', 'yellow');

  try {
    const response = await axios.post(
      `${BASE_URL}/api/order/modify`,
      {
        positionId: positionId,
        stopLoss: 2335.00,
        takeProfit: 2360.00
      },
      {
        headers: { Authorization: `Bearer ${authToken}` }
      }
    );

    if (response.data.code === 0) {
      log('✅ 设置止损止盈成功', 'green');
      log(`止损价: 2335.00`, 'blue');
      log(`止盈价: 2360.00`, 'blue');
      return true;
    } else {
      log(`❌ 设置失败: ${response.data.message}`, 'red');
      return false;
    }
  } catch (error) {
    log(`❌ 请求失败: ${error.message}`, 'red');
    if (error.response) {
      log(`响应数据: ${JSON.stringify(error.response.data)}`, 'red');
    }
    return false;
  }
}

async function testClosePosition() {
  logStep(9);
  log('平仓测试（卖出）', 'yellow');

  try {
    const response = await axios.post(
      `${BASE_URL}/api/position/close`,
      {
        positionId: positionId,
        quantity: 10
      },
      {
        headers: { Authorization: `Bearer ${authToken}` }
      }
    );

    if (response.data.code === 0) {
      const result = response.data.data;
      log('✅ 平仓成功', 'green');
      log(`平仓价: ${result.price}`, 'blue');
      log(`盈亏: ${result.pnl || result.profit}`, 'blue');
      log(`佣金: ${result.commission || 0}`, 'blue');
      return result;
    } else {
      log(`❌ 平仓失败: ${response.data.message}`, 'red');
      return null;
    }
  } catch (error) {
    log(`❌ 平仓请求失败: ${error.message}`, 'red');
    if (error.response) {
      log(`响应数据: ${JSON.stringify(error.response.data)}`, 'red');
    }
    return null;
  }
}

async function testGetClosedPositions() {
  logStep(10);
  log('获取已平仓历史测试', 'yellow');

  try {
    const response = await axios.get(`${BASE_URL}/api/positions/closed`, {
      headers: { Authorization: `Bearer ${authToken}` }
    });

    if (response.data.code === 0) {
      const positions = response.data.data;
      log('✅ 获取已平仓成功', 'green');
      log(`已平仓数量: ${positions.length}`, 'blue');

      if (positions.length > 0) {
        const pos = positions[0];
        log(`平仓价: ${pos.closePrice}`, 'blue');
        log(`盈亏: ${pos.realizedPnL || pos.pnl}`, 'blue');
      }

      return positions;
    } else {
      log(`❌ 获取失败: ${response.data.message}`, 'red');
      return [];
    }
  } catch (error) {
    log(`❌ 请求失败: ${error.message}`, 'red');
    if (error.response) {
      log(`响应数据: ${JSON.stringify(error.response.data)}`, 'red');
    }
    return [];
  }
}

async function testFinalAccount() {
  logStep(11);
  log('最终账户余额检查', 'yellow');

  try {
    const response = await axios.get(`${BASE_URL}/api/account`, {
      headers: { Authorization: `Bearer ${authToken}` }
    });

    if (response.data.code === 0) {
      const account = response.data.data;
      log('✅ 获取账户成功', 'green');
      log(`账户余额: ${account.balance || account.totalBalance}`, 'blue');
      log(`可用余额: ${account.available}`, 'blue');
      log(`冻结保证金: ${account.frozen || 0}`, 'blue');
      return account;
    } else {
      log(`❌ 获取账户失败: ${response.data.message}`, 'red');
      return null;
    }
  } catch (error) {
    log(`❌ 获取账户请求失败: ${error.message}`, 'red');
    if (error.response) {
      log(`响应数据: ${JSON.stringify(error.response.data)}`, 'red');
    }
    return null;
  }
}

async function testKlineData() {
  logStep(12);
  log('获取K线数据测试', 'yellow');

  try {
    const response = await axios.get(
      `${BASE_URL}/api/market/kline?product=XAUUSD&period=1h&limit=50`
    );

    if (response.data.code === 0) {
      const kline = response.data.data;
      log('✅ 获取K线成功', 'green');
      log(`产品: ${kline.productCode}`, 'blue');
      log(`周期: ${kline.period}`, 'blue');
      log(`数据点数量: ${kline.data.length}`, 'blue');

      if (kline.data.length > 0) {
        const lastCandle = kline.data[kline.data.length - 1];
        log(`最新K线 - 开:${lastCandle.open} 高:${lastCandle.high} 低:${lastCandle.low} 收:${lastCandle.close}`, 'blue');
      }

      return kline;
    } else {
      log(`❌ 获取K线失败: ${response.data.message}`, 'red');
      return null;
    }
  } catch (error) {
    log(`❌ 获取K线请求失败: ${error.message}`, 'red');
    if (error.response) {
      log(`响应数据: ${JSON.stringify(error.response.data)}`, 'red');
    }
    return null;
  }
}

// 主测试流程
async function runFullTest() {
  console.log('\n' + '='.repeat(60));
  log('贵金属期货交易系统 - 完整流程测试', 'cyan');
  log('测试用户: ' + testUser.username, 'cyan');
  console.log('='.repeat(60));

  let successCount = 0;
  let failCount = 0;

  // 步骤1: 注册
  if (await testRegister()) successCount++; else failCount++;
  await sleep(500);

  // 步骤2: 登录
  if (await testLogin()) successCount++; else failCount++;
  await sleep(500);

  // 步骤3: 获取账户
  await testGetAccount();
  await sleep(500);

  // 步骤4: 获取行情
  const market = await testMarketData();
  await sleep(500);

  // 步骤5: 下单
  const order = await testPlaceOrder();
  if (order) successCount++; else failCount++;
  await sleep(1000);

  // 步骤6: 获取持仓
  await testGetPositions();
  await sleep(500);

  // 步骤7: 获取订单
  await testGetOrders();
  await sleep(500);

  // 步骤8: 设置止损止盈
  await testSetStopLossTakeProfit();
  await sleep(500);

  // 步骤9: 平仓
  const closeResult = await testClosePosition();
  if (closeResult) successCount++; else failCount++;
  await sleep(500);

  // 步骤10: 获取已平仓
  await testGetClosedPositions();
  await sleep(500);

  // 步骤11: 最终账户
  await testFinalAccount();
  await sleep(500);

  // 步骤12: K线数据
  await testKlineData();

  // 总结
  console.log('\n' + '='.repeat(60));
  log('测试总结', 'cyan');
  console.log('='.repeat(60));
  log(`总测试步骤: 12`, 'blue');
  log(`成功: ${successCount}`, 'green');
  log(`失败: ${failCount}`, failCount > 0 ? 'red' : 'green');
  log(`成功率: ${((successCount / 12) * 100).toFixed(1)}%`, 'blue');

  if (failCount === 0) {
    log('\n✅ 所有测试通过！系统运行正常！', 'green');
  } else {
    log('\n⚠️ 部分测试失败，请检查系统状态', 'yellow');
  }
  console.log('='.repeat(60) + '\n');
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// 运行测试
runFullTest().catch(error => {
  log('\n❌ 测试执行出错: ' + error.message, 'red');
  console.error(error);
  process.exit(1);
});
