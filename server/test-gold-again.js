// 重新测试黄金品种
const axios = require('axios');

async function testGold() {
  console.log('========================================');
  console.log('  测试黄金品种数据');
  console.log('========================================\n');

  const symbols = 'CEDAXA0,HIHHI02,NEGCZ0'; // 包含黄金
  const url = `http://ds.cnshuhai.com/stock.php?type=stock&u=wu123&p=wu123&symbol=${symbols}`;

  console.log(`请求URL: ${url}\n`);

  try {
    const response = await axios.get(url);

    if (response.status === 200 && Array.isArray(response.data)) {
      console.log('✅ 请求成功！\n');
      console.log(`返回品种数量: ${response.data.length}\n`);

      response.data.forEach((item) => {
        console.log(`[${item.Symbol}] ${item.Name}`);
        console.log(`  最新价: ${item.NewPrice}`);
        console.log(`  昨收价: ${item.LastClose}`);
        console.log(`  涨跌幅: ${item.PriceChangeRatio}%\n`);
      });

      // 检查是否有黄金数据
      const hasGold = response.data.some(item => item.Symbol === 'NEGCZ0');
      console.log(`\n${hasGold ? '✅' : '❌'} 黄金数据: ${hasGold ? '已返回' : '未返回'}`);
    }
  } catch (error) {
    console.log('❌ 请求失败:');
    if (error.response) {
      console.log(`   状态码: ${error.response.status}`);
      console.log(`   错误: ${error.response.statusText}`);
    } else {
      console.log(`   ${error.message}`);
    }
  }
}

testGold();
