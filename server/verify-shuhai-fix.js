// 验证数海API修复
const axios = require('axios');

const SHUHAI_API_BASE = 'http://ds.cnshuhai.com/stock.php';
const SHUHAI_USERNAME = 'wu123';
const SHUHAI_PASSWORD = 'wu123';

const TEST_SYMBOLS = [
  'CEDAXA0',  // 德指
  'HIHHI02',  // 恒指
  'CENQA0',   // 纳指
  'CEESA0',   // 小标普
  'CEYMA0',   // 小道琼
];

async function testAPI() {
  console.log('========================================');
  console.log('数海API验证测试');
  console.log('========================================\n');

  const symbols = TEST_SYMBOLS.join(',');
  const url = `${SHUHAI_API_BASE}?type=stock&u=${SHUHAI_USERNAME}&p=${SHUHAI_PASSWORD}&symbol=${symbols}`;

  console.log(`请求URL: ${url}\n`);

  try {
    const response = await axios.get(url, {
      timeout: 10000,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      }
    });

    console.log('✅ 请求成功！');
    console.log(`状态码: ${response.status}`);
    console.log(`返回数据类型: ${Array.isArray(response.data) ? '数组' : typeof response.data}`);

    if (Array.isArray(response.data)) {
      console.log(`\n获取到 ${response.data.length} 个品种的行情数据:\n`);

      response.data.forEach((item, index) => {
        const symbol = item.Symbol;
        const name = item.Name;
        const price = item.NewPrice || item.Price;
        const lastClose = item.LastClose;
        const change = price ? ((price - lastClose) / lastClose * 100).toFixed(2) : 0;
        const changeStr = change > 0 ? `+${change}%` : `${change}%`;

        console.log(`  ${index + 1}. [${symbol}] ${name}`);
        console.log(`     最新价: ${price}, 昨收: ${lastClose}, 涨跌: ${changeStr}`);
      });
    } else if (response.data.info) {
      console.log(`\n⚠️  API返回信息: ${response.data.info}`);
    } else {
      console.log(`\n⚠️  未知响应格式:`, JSON.stringify(response.data).substring(0, 200));
    }

  } catch (error) {
    console.error('❌ 请求失败:', error.message);
    if (error.response) {
      console.error(`   状态码: ${error.response.status}`);
      console.error(`   响应数据:`, JSON.stringify(error.response.data).substring(0, 200));
    }
  }

  console.log('\n========================================');
}

testAPI();
