// 测试NE市场的所有品种
const axios = require('axios');

async function testNEMarket() {
  console.log('测试NE市场的品种（包含黄金）...\n');

  // 测试多个可能的黄金品种代码
  const goldCodes = [
    'NEGCZ0',    // 当前使用的代码
    'NEGCZ1',    // 可能是次主力合约
    'NEGCZ2',    // 可能是次次主力
    'NEGCZ',     // 可能是主连
    'NEGCZ00',   // 另一种格式
  ];

  // 先用已知可用的品种配对
  const baseSymbols = 'CEDAXA0,HIHHI02';

  for (const goldCode of goldCodes) {
    const symbols = `${baseSymbols},${goldCode}`;
    const url = `http://ds.cnshuhai.com/stock.php?type=stock&u=wu123&p=wu123&symbol=${symbols}`;

    console.log(`\n测试代码: ${goldCode}`);

    try {
      const response = await axios.get(url);

      if (response.status === 200 && Array.isArray(response.data)) {
        const found = response.data.find(item => item.Symbol === goldCode);

        if (found) {
          console.log(`  ✅ 成功！返回: ${found.Name}`);
          console.log(`     最新价: ${found.NewPrice}`);
        } else {
          console.log(`  ❌ 未在返回数据中找到 ${goldCode}`);
          console.log(`     返回的品种: ${response.data.map(d => d.Symbol).join(', ')}`);
        }
      }
    } catch (error) {
      if (error.response?.status === 407) {
        console.log(`  ❌ 407错误 - 频率限制或认证问题`);
      } else {
        console.log(`  ❌ 错误: ${error.message}`);
      }
    }

    // 延迟避免频率限制
    await new Promise(resolve => setTimeout(resolve, 2000));
  }
}

testNEMarket();
