// 测试黄金的其他代码格式
const axios = require('axios');

async function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function testGoldFormats() {
  console.log('等待10秒避免频率限制...\n');
  await sleep(10000);

  console.log('========================================');
  console.log('  测试黄金品种代码格式');
  console.log('========================================\n');

  // 可能的黄金代码格式
  const testFormats = [
    { code: 'NEGCZ0', desc: 'NEGCZ0 (当前使用)' },
    { code: 'NEGC', desc: 'NEGC (无合约月份)' },
    { code: 'NEGCZ', desc: 'NEGCZ (12月合约)' },
    { code: 'NEG', desc: 'NEG (黄金前缀)' },
    { code: 'NEGC0', desc: 'NEGC0 (另一种格式)' },
    { code: 'NEGCZ00', desc: 'NEGCZ00 (双零)' },
    { code: 'NEGCZ2', desc: 'NEGCZ2 (2月合约)' },
    { code: 'NEGCZ4', desc: 'NEGCZ4 (4月合约)' },
    { code: 'NEGCZ6', desc: 'NEGCZ6 (6月合约)' },
    { code: 'NEGCZ8', desc: 'NEGCZ8 (8月合约)' },
  ];

  const baseSymbol = 'CEDAXA0';

  for (const format of testFormats) {
    const symbols = `${baseSymbol},${format.code}`;
    const url = `http://ds.cnshuhai.com/stock.php?type=stock&u=wu123&p=wu123&symbol=${symbols}`;

    console.log(`\n测试: ${format.desc}`);
    console.log(`代码: ${format.code}`);

    try {
      const response = await axios.get(url);

      if (response.status === 200 && Array.isArray(response.data)) {
        const found = response.data.find(item => item.Symbol === format.code);

        if (found) {
          console.log(`  ✅ 成功！`);
          console.log(`     名称: ${found.Name}`);
          console.log(`     最新价: ${found.NewPrice}`);
          console.log(`     返回数据: ${JSON.stringify(found, null, 2)}`);
          return format.code; // 找到正确的代码
        } else {
          console.log(`  ❌ 未找到，返回: ${response.data.map(d => d.Symbol).join(', ')}`);
        }
      }
    } catch (error) {
      if (error.response?.status === 407) {
        console.log(`  ❌ 407错误`);
      } else {
        console.log(`  ❌ 错误: ${error.message}`);
      }
    }

    await sleep(2000);
  }

  console.log('\n========================================');
  console.log('  所有格式测试完成，未找到黄金品种');
  console.log('========================================');
}

testGoldFormats();
