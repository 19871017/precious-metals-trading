// 测试后端API和数海对接
const axios = require('axios');

const BASE_URL = 'http://localhost:3001';

async function testAPI() {
  console.log('========================================');
  console.log('  测试后端API');
  console.log('========================================\n');

  try {
    // 1. 健康检查
    console.log('1. 健康检查...');
    const health = await axios.get(`${BASE_URL}/health`);
    console.log('   ✅', health.data.message);
    console.log('');

    // 2. 获取品种列表
    console.log('2. 获取数海品种列表...');
    const symbols = await axios.get(`${BASE_URL}/shuhai/symbols`);
    console.log(`   ✅ 返回 ${symbols.data.data.length} 个品种:`);
    symbols.data.data.forEach(s => {
      console.log(`      - ${s.symbol} (${s.name}): ${s.shuhaiCode} [${s.market}]`);
    });
    console.log('');

    // 3. 测试获取黄金行情
    console.log('3. 测试获取黄金行情...');
    const goldQuote = await axios.get(`${BASE_URL}/shuhai/quote?code=GOLD`);
    console.log('   ✅ 黄金行情:');
    console.log(`      名称: ${goldQuote.data.data.name}`);
    console.log(`      最新价: ${goldQuote.data.data.price}`);
    console.log(`      涨跌幅: ${goldQuote.data.data.changePercent}%`);
    console.log('');

    // 4. 测试获取恒指行情
    console.log('4. 测试获取恒指行情...');
    const hsiQuote = await axios.get(`${BASE_URL}/shuhai/quote?code=HSI`);
    console.log('   ✅ 恒指行情:');
    console.log(`      名称: ${hsiQuote.data.data.name}`);
    console.log(`      最新价: ${hsiQuote.data.data.price}`);
    console.log(`      涨跌幅: ${hsiQuote.data.data.changePercent}%`);
    console.log('');

    // 5. 测试获取小纳指行情
    console.log('5. 测试获取小纳指行情...');
    const nqQuote = await axios.get(`${BASE_URL}/shuhai/quote?code=NQ`);
    console.log('   ✅ 小纳指行情:');
    console.log(`      名称: ${nqQuote.data.data.name}`);
    console.log(`      最新价: ${nqQuote.data.data.price}`);
    console.log(`      涨跌幅: ${nqQuote.data.data.changePercent}%`);
    console.log('');

    console.log('========================================');
    console.log('  ✅ 所有API测试通过！');
    console.log('========================================');

  } catch (error) {
    console.log('❌ 测试失败:');
    if (error.response) {
      console.log(`   状态码: ${error.response.status}`);
      console.log(`   错误: ${error.response.statusText}`);
      console.log(`   数据:`, error.response.data);
    } else {
      console.log(`   ${error.message}`);
    }
  }
}

testAPI();
