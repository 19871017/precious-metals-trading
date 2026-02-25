// 测试修复后的API调用方式
const axios = require('axios');

const SHUHAI_API_BASE = 'http://ds.cnshuhai.com/stock.php';
const SHUHAI_USERNAME = 'wu123';
const SHUHAI_PASSWORD = 'wu123';

async function testFixedAPI() {
  console.log('========================================');
  console.log('  测试修复后的数海API调用');
  console.log('========================================\n');

  // 模拟 MarketDataService.ts 中的调用方式
  const symbols = 'CEDAXA0,HIHHI02,CENQA0,NECLA0';
  const url = `${SHUHAI_API_BASE}?type=stock&u=${SHUHAI_USERNAME}&p=${SHUHAI_PASSWORD}&symbol=${symbols}`;

  console.log('调用方式: axios.get(url)');
  console.log(`请求URL: ${url}\n`);

  try {
    const response = await axios.get(url);

    if (response.status === 200) {
      console.log('✅ 请求成功！\n');
      console.log(`状态码: ${response.status}`);
      console.log(`返回数据量: ${response.data.length}\n`);

      response.data.forEach((item, index) => {
        console.log(`${index + 1}. [${item.Symbol}] ${item.Name}`);
        console.log(`   最新价: ${item.NewPrice}`);
        console.log(`   昨收价: ${item.LastClose}`);
        console.log(`   涨跌幅: ${item.PriceChangeRatio}%\n`);
      });

      return true;
    } else {
      console.log(`❌ 状态码: ${response.status}`);
      return false;
    }
  } catch (error) {
    console.log('❌ 请求失败:');
    if (error.response) {
      console.log(`   状态码: ${error.response.status}`);
      console.log(`   错误: ${error.response.statusText}`);
    } else {
      console.log(`   ${error.message}`);
    }
    return false;
  }
}

testFixedAPI();
