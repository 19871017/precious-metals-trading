// 测试修正后的品种代码
const axios = require('axios');

async function testCorrectedCodes() {
  console.log('========================================');
  console.log('  测试修正后的品种代码');
  console.log('========================================\n');

  // 所有品种的数海代码（已修正）
  const allSymbols = {
    'DAX': 'CEDAXA0',    // 德指
    'HSI': 'HIHHI01',    // 恒指 (已修正)
    'NQ': 'CENQA0',      // 小纳指
    'MHSI': 'HIMCH01',   // 小恒指 (已修正)
    'USOIL': 'NECLA0',   // 原油
    'GOLD': 'CMGCA0',    // 黄金
  };

  const symbols = Object.values(allSymbols).join(',');
  const url = `http://ds.cnshuhai.com/stock.php?type=stock&u=wu123&p=wu123&symbol=${symbols}`;

  console.log(`请求URL: ${url}\n`);
  console.log('请求品种:');
  Object.entries(allSymbols).forEach(([name, code]) => {
    console.log(`  - ${name}: ${code}`);
  });
  console.log('');

  try {
    const response = await axios.get(url);

    if (response.status === 200 && Array.isArray(response.data)) {
      console.log('========================================');
      console.log('  ✅ 请求成功！');
      console.log('========================================\n');

      console.log(`返回品种数量: ${response.data.length}\n`);

      response.data.forEach((item, index) => {
        console.log(`${index + 1}. [${item.Symbol}] ${item.Name}`);
        console.log(`   最新价: ${item.NewPrice}`);
        console.log(`   昨收价: ${item.LastClose}`);
        console.log(`   涨跌幅: ${item.PriceChangeRatio}%`);
        console.log('');
      });

      // 验证所有品种
      console.log('========================================');
      console.log('  品种验证');
      console.log('========================================\n');

      Object.entries(allSymbols).forEach(([name, code]) => {
        const found = response.data.find(item => item.Symbol === code);
        if (found) {
          console.log(`✅ ${name} (${code}): ${found.NewPrice} - ${found.Name}`);
        } else {
          console.log(`❌ ${name} (${code}): 未返回`);
        }
      });

      console.log('\n========================================');
      console.log('  ✅ 所有品种测试完成！');
      console.log('========================================');
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

testCorrectedCodes();
