// 数海API测试 - 仅HTTP协议
const axios = require('axios');

const SHUHAI_API_BASE = 'http://ds.cnshuhai.com/stock.php';
const SHUHAI_USERNAME = 'wu123';
const SHUHAI_PASSWORD = 'wu123';

const TEST_SYMBOLS = [
  { code: 'CEDAXA0', name: '德指' },
  { code: 'HIHHI02', name: '恒指' },
  { code: 'CENQA0', name: '纳指' },
  { code: 'NECLA0', name: '原油' },
];

async function testHTTPOnly() {
  console.log('========================================');
  console.log('  数海API HTTP接口测试');
  console.log('========================================\n');

  const url = `${SHUHAI_API_BASE}?type=stock&u=${SHUHAI_USERNAME}&p=${SHUHAI_PASSWORD}&symbol=`;

  // 测试HTTP协议
  console.log(`✅ 测试HTTP协议: ${SHUHAI_API_BASE}`);

  try {
    const symbols = TEST_SYMBOLS.map(s => s.code).join(',');
    const fullUrl = url + symbols;
    console.log(`请求URL: ${fullUrl}\n`);

    const response = await axios.get(fullUrl, {
      timeout: 10000,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Accept': 'application/json, text/plain, */*',
      }
    });

    if (response.status === 200) {
      console.log(`✅ 请求成功！\n`);
      console.log(`状态码: ${response.status}`);
      console.log(`返回数据类型: ${Array.isArray(response.data) ? '数组' : typeof response.data}`);

      if (Array.isArray(response.data)) {
        console.log(`\n获取到 ${response.data.length} 个品种的行情数据:\n`);
        response.data.forEach((item, index) => {
          console.log(`  ${index + 1}. [${item.code}] ${item.name}`);
          console.log(`     最新价: ${item.price}, 昨收: ${item.prevClose}, 涨跌: ${item.changePercent || ((item.price - item.prevClose) / item.prevClose * 100).toFixed(2)}%\n`);
        });
      }
    } else {
      console.log(`❌ 请求失败，状态码: ${response.status}`);
    }
  } catch (error) {
    console.log('❌ 请求失败:');
    if (error.response) {
      console.log(`   状态码: ${error.response.status}`);
      console.log(`   错误信息: ${error.response.data}`);
    } else if (error.request) {
      console.log(`   网络错误: ${error.message}`);
    } else {
      console.log(`   ${error.message}`);
    }
  }

  console.log('\n========================================');
  console.log('  测试完成');
  console.log('========================================');
}

testHTTPOnly();
