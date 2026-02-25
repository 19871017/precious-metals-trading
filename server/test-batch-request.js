// 测试批量请求
const axios = require('axios');

const SHUHAI_API_BASE = 'http://ds.cnshuhai.com/stock.php';
const SHUHAI_USERNAME = 'wu123';
const SHUHAI_PASSWORD = 'wu123';

// 可用的品种
const AVAILABLE_SYMBOLS = [
  'CEDAXA0',  // 德指 ✅
  'HIHHI02',  // 恒指 ✅
  'CENQA0',   // 纳指 ✅
];

async function testBatchRequest() {
  console.log('========================================');
  console.log('测试批量请求');
  console.log('========================================\n');

  const symbols = AVAILABLE_SYMBOLS.join(',');
  const url = `${SHUHAI_API_BASE}?type=stock&u=${SHUHAI_USERNAME}&p=${SHUHAI_PASSWORD}&symbol=${symbols}`;

  console.log(`请求品种: ${symbols}`);
  console.log(`请求URL: ${url}\n`);

  try {
    const response = await axios.get(url, {
      timeout: 10000,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      }
    });

    console.log('✅ 批量请求成功！\n');
    console.log(`返回 ${response.data.length} 个品种的数据:\n`);

    response.data.forEach((item, index) => {
      const symbol = item.Symbol;
      const name = item.Name;
      const price = item.NewPrice || item.Price;
      const lastClose = item.LastClose;
      const change = price && lastClose ? ((price - lastClose) / lastClose * 100).toFixed(2) : 0;
      const changeStr = change > 0 ? `+${change}%` : `${change}%`;

      console.log(`  ${index + 1}. [${symbol}] ${name}`);
      console.log(`     最新价: ${price}`);
      console.log(`     昨收: ${lastClose}`);
      console.log(`     涨跌: ${changeStr}`);
      console.log('');
    });

    console.log('========================================');
    console.log('结论: 数海API已修复！');
    console.log('- API地址: http://ds.cnshuhai.com/stock.php');
    console.log('- 账号: wu123 / wu123');
    console.log('- 可用品种: 德指、恒指、纳指');
    console.log('- 请求方式: type=stock&u=username&p=password&symbol=品种代码(逗号分隔)');
    console.log('========================================');

  } catch (error) {
    console.error('❌ 批量请求失败:', error.message);
    if (error.response) {
      console.error(`   状态码: ${error.response.status}`);
    }
  }
}

testBatchRequest();
