// 清除缓存并重新测试
const axios = require('axios');

const BASE_URL = 'http://localhost:3001';

async function testWithCacheClear() {
  console.log('========================================');
  console.log('  清除缓存并测试');
  console.log('========================================\n');

  try {
    // 1. 清除缓存
    console.log('1. 清除数海API缓存...');
    await axios.delete(`${BASE_URL}/shuhai/cache`);
    console.log('   ✅ 缓存已清除\n');

    // 2. 等待数据更新
    console.log('2. 等待2秒让数据更新...');
    await new Promise(resolve => setTimeout(resolve, 2000));
    console.log('   ✅ 等待完成\n');

    // 3. 获取品种列表
    console.log('3. 获取数海品种列表...');
    const symbols = await axios.get(`${BASE_URL}/shuhai/symbols`);
    console.log(`   ✅ 返回 ${symbols.data.data.length} 个品种:`);
    symbols.data.data.forEach(s => {
      console.log(`      - ${s.symbol} (${s.name}): ${s.shuhaiCode} [${s.market}]`);
    });
    console.log('');

    // 4. 测试获取黄金行情
    console.log('4. 测试获取黄金行情...');
    const goldQuote = await axios.get(`${BASE_URL}/shuhai/quote?code=GOLD`);
    console.log('   ✅ 黄金行情:');
    console.log(`      名称: ${goldQuote.data.data.name}`);
    console.log(`      最新价: ${goldQuote.data.data.price}`);
    console.log(`      涨跌幅: ${goldQuote.data.data.changePercent}%`);

    if (goldQuote.data.data.price === 0) {
      console.log('   ⚠️  价格为0，可能是缓存或API问题');
    } else {
      console.log('   ✅ 价格正常！');
    }
    console.log('');

    // 5. 测试获取恒指行情
    console.log('5. 测试获取恒指行情...');
    const hsiQuote = await axios.get(`${BASE_URL}/shuhai/quote?code=HSI`);
    console.log('   ✅ 恒指行情:');
    console.log(`      名称: ${hsiQuote.data.data.name}`);
    console.log(`      最新价: ${hsiQuote.data.data.price}`);
    console.log(`      涨跌幅: ${hsiQuote.data.data.changePercent}%`);
    console.log('');

    // 6. 测试批量获取
    console.log('6. 测试批量获取行情...');
    const batchCodes = ['DAX', 'HSI', 'NQ', 'MHSI', 'USOIL', 'GOLD'].join(',');
    const batchQuotes = await axios.get(`${BASE_URL}/shuhai/batch-quotes?codes=${batchCodes}`);
    console.log(`   ✅ 批量行情返回: ${batchQuotes.data.data.length} 个品种`);
    batchQuotes.data.data.forEach(q => {
      console.log(`      ${q.code}: ${q.price}`);
    });

    console.log('\n========================================');
    console.log('  ✅ 测试完成！');
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

testWithCacheClear();
