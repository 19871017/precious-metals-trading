// 测试CMGCA0黄金品种
const axios = require('axios');

async function testGoldCMGCA0() {
  console.log('========================================');
  console.log('  测试黄金品种 CMGCA0');
  console.log('========================================\n');

  // 批量请求包含黄金
  const symbols = 'CEDAXA0,HIHHI02,CMGCA0';
  const url = `http://ds.cnshuhai.com/stock.php?type=stock&u=wu123&p=wu123&symbol=${symbols}`;

  console.log(`请求URL: ${url}\n`);

  try {
    const response = await axios.get(url);

    if (response.status === 200 && Array.isArray(response.data)) {
      console.log('✅ 请求成功！\n');
      console.log(`返回品种数量: ${response.data.length}\n`);

      response.data.forEach((item, index) => {
        console.log(`${index + 1}. [${item.Symbol}] ${item.Name}`);
        console.log(`   最新价: ${item.NewPrice}`);
        console.log(`   昨收价: ${item.LastClose}`);
        console.log(`   涨跌幅: ${item.PriceChangeRatio}%\n`);
      });

      // 检查黄金数据
      const goldData = response.data.find(item => item.Symbol === 'CMGCA0');
      if (goldData) {
        console.log('========================================');
        console.log('  ✅ 黄金数据已成功返回！');
        console.log('========================================');
        console.log(`品种名称: ${goldData.Name}`);
        console.log(`最新价格: ${goldData.NewPrice}`);
        console.log(`昨收价格: ${goldData.LastClose}`);
        console.log(`涨跌幅: ${goldData.PriceChangeRatio}%`);
        console.log(`\n完整数据: ${JSON.stringify(goldData, null, 2)}`);
      } else {
        console.log('❌ 黄金数据未返回');
        console.log(`返回的品种: ${response.data.map(d => d.Symbol).join(', ')}`);
      }
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

testGoldCMGCA0();
