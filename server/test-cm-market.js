// 测试CM市场的所有品种（商品期货）
const axios = require('axios');

const SHUHAI_API_BASE = 'http://ds.cnshuhai.com/stock.php';
const SHUHAI_USERNAME = 'wu123';
const SHUHAI_PASSWORD = 'wu123';

// CM市场（商品期货）可能的各种品种代码
const CM_SYMBOLS = [
  'CMGC0',     // 黄金连续
  'CMGCM6',    // 黄金主力合约
  'CMGCQ1',    // 黄金季度合约
  'CMSI0',     // 白银连续
  'CMHG0',     // 精铜连续
  'CMHGQ1',    // 精铜季度合约
  'CMCL0',     // 原油连续
  'CMNG0',     // 天然气连续
  'CMXAU0',    // 黄金现货
  'CMGOLD',    // 黄金
];

async function testCMMarket() {
  console.log('========================================');
  console.log('测试CM市场（商品期货）品种');
  console.log('========================================\n');

  let successCount = 0;
  const foundSymbols = [];

  for (const symbol of CM_SYMBOLS) {
    const url = `${SHUHAI_API_BASE}?type=stock&u=${SHUHAI_USERNAME}&p=${SHUHAI_PASSWORD}&symbol=${symbol}`;

    try {
      const response = await axios.get(url, {
        timeout: 5000,
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        }
      });

      if (Array.isArray(response.data) && response.data.length > 0) {
        const data = response.data[0];
        const price = data.NewPrice || data.Price;
        const lastClose = data.LastClose;
        const change = price && lastClose ? ((price - lastClose) / lastClose * 100).toFixed(2) : 0;
        const changeStr = change > 0 ? `+${change}%` : `${change}%`;

        console.log(`✅ 找到可用品种！`);
        console.log(`   数海代码: [${data.Symbol}]`);
        console.log(`   品种名称: ${data.Name}`);
        console.log(`   最新价: ${price}, 涨跌: ${changeStr}`);
        console.log('');

        successCount++;
        foundSymbols.push({
          code: data.Symbol,
          name: data.Name,
          price: price,
          change: changeStr
        });
      } else if (response.data.info) {
        console.log(`❌ [${symbol}] - ${response.data.info}`);
      } else {
        console.log(`❌ [${symbol}] - 未知响应`);
      }
    } catch (error) {
      if (error.response && error.response.status === 407) {
        console.log(`❌ [${symbol}] - 需要407代理认证`);
      } else {
        console.log(`❌ [${symbol}] - 请求失败: ${error.message}`);
      }
    }

    console.log('');
    await new Promise(resolve => setTimeout(resolve, 300));
  }

  console.log('========================================');
  console.log(`测试完成: 找到 ${successCount} 个可用品种`);
  console.log('========================================\n');

  if (foundSymbols.length > 0) {
    console.log('可用品种列表：');
    foundSymbols.forEach((s, i) => {
      console.log(`  ${i + 1}. ${s.name} (${s.code}) - 最新价: ${s.price}, 涨跌: ${s.change}`);
    });
    console.log('');

    console.log('黄金品种配置建议：');
    const goldSymbol = foundSymbols.find(s =>
      s.name.includes('金') ||
      s.name.includes('Gold') ||
      s.name.toLowerCase().includes('gc') ||
      s.code.toLowerCase().includes('gc')
    );
    if (goldSymbol) {
      console.log(`  'GOLD': '${goldSymbol.code}',  // 黄金 ✅ - ${goldSymbol.name}`);
    }
  } else {
    console.log('未找到可用的CM市场品种');
    console.log('');
    console.log('建议：');
    console.log('1. 检查数海后台确认CM市场是否包含黄金');
    console.log('2. 在数海官网查看CM市场的完整品种列表');
    console.log('3. 或者使用其他市场的黄金品种（如NE市场的NEGCZ0）');
  }

  return foundSymbols;
}

testCMMarket();
