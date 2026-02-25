// 测试黄金的不同代码
const axios = require('axios');

const SHUHAI_API_BASE = 'http://ds.cnshuhai.com/stock.php';
const SHUHAI_USERNAME = 'wu123';
const SHUHAI_PASSWORD = 'wu123';

// 可能的黄金代码
const GOLD_SYMBOLS = [
  'NEGCZ0',    // 美黄金
  'CEGC0',     // 欧洲市场黄金
  'CMGC0',     // 商品市场黄金
  'GC',        // 黄金期货
  'GOLD',      // 黄金
  'XAUUSD',    // 现货黄金
  'GCZ4',      // 黄金主力合约
];

async function testGoldCodes() {
  console.log('========================================');
  console.log('测试黄金品种代码');
  console.log('========================================\n');

  let successCount = 0;
  let foundCode = null;

  for (const symbol of GOLD_SYMBOLS) {
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
        const name = data.Name || symbol;

        console.log(`✅ 找到黄金代码！`);
        console.log(`   代码: [${symbol}]`);
        console.log(`   名称: ${name}`);
        console.log(`   最新价: ${price}`);
        console.log('');

        successCount++;
        foundCode = { code: symbol, name: name, price: price };
        break; // 找到第一个可用代码就停止
      } else if (response.data.info) {
        console.log(`❌ [${symbol}] - ${response.data.info}`);
      } else {
        console.log(`❌ [${symbol}] - 未知响应`);
      }
    } catch (error) {
      console.log(`❌ [${symbol}] - 请求失败: ${error.message}`);
    }

    console.log('');

    // 避免频率限制
    await new Promise(resolve => setTimeout(resolve, 300));
  }

  console.log('========================================');
  if (foundCode) {
    console.log(`成功找到黄金品种！`);
    console.log(`代码: ${foundCode.code}`);
    console.log(`名称: ${foundCode.name}`);
    console.log(`最新价: ${foundCode.price}`);
    console.log('\n请使用以下配置：');
    console.log(`  'GOLD': '${foundCode.code}',  // 黄金 ✅`);
  } else {
    console.log('未找到可用的黄金代码');
    console.log('建议：');
    console.log('1. 检查数海账号是否购买了黄金市场权限');
    console.log('2. 在数海官网查询正确的黄金品种代码');
    console.log('3. 或者暂时从列表中移除黄金品种');
  }
  console.log('========================================');

  return foundCode;
}

testGoldCodes();
