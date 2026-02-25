// 验证所有品种
const axios = require('axios');

const SHUHAI_API_BASE = 'http://ds.cnshuhai.com/stock.php';
const SHUHAI_USERNAME = 'wu123';
const SHUHAI_PASSWORD = 'wu123';

const ALL_SYMBOLS = [
  { code: 'CEDAXA0', name: '德指', ourCode: 'DAX' },
  { code: 'HIHHI02', name: '恒指', ourCode: 'HSI' },
  { code: 'CENQA0', name: '纳指', ourCode: 'NQ' },
  { code: 'CEESA0', name: '小标普', ourCode: 'ES' },
  { code: 'CEYMA0', name: '小道琼', ourCode: 'YM' },
  { code: 'NEGCZ0', name: '美黄金', ourCode: 'GOLD' },
  { code: 'NECLA0', name: '美原油', ourCode: 'USOIL' },
  { code: 'CMSI0', name: '美白银', ourCode: 'XAGUSD' },
  { code: 'CMHG0', name: '美精铜', ourCode: 'HG' },
];

async function testAllSymbols() {
  console.log('========================================');
  console.log('测试所有品种');
  console.log('========================================\n');

  let successCount = 0;
  let failCount = 0;
  const results = [];

  for (const symbol of ALL_SYMBOLS) {
    const url = `${SHUHAI_API_BASE}?type=stock&u=${SHUHAI_USERNAME}&p=${SHUHAI_PASSWORD}&symbol=${symbol.code}`;

    try {
      const response = await axios.get(url, {
        timeout: 5000,
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        }
      });

      if (Array.isArray(response.data) && response.data.length > 0) {
        const data = response.data[0];
        const price = data.NewPrice || data.Price;
        const lastClose = data.LastClose;
        const change = price && lastClose ? ((price - lastClose) / lastClose * 100).toFixed(2) : 0;
        const changeStr = change > 0 ? `+${change}%` : `${change}%`;

        console.log(`✅ [${symbol.code}] ${symbol.name} (${symbol.ourCode})`);
        console.log(`   最新价: ${price}, 涨跌: ${changeStr}`);
        console.log(`   数据源: ${data.Name || 'N/A'}`);

        successCount++;
        results.push({ ...symbol, status: 'success', price, change: changeStr });
      } else if (response.data.info) {
        console.log(`⚠️  [${symbol.code}] ${symbol.name} (${symbol.ourCode})`);
        console.log(`   错误: ${response.data.info}`);

        failCount++;
        results.push({ ...symbol, status: 'error', error: response.data.info });
      } else {
        console.log(`❌ [${symbol.code}] ${symbol.name} (${symbol.ourCode})`);
        console.log(`   未知响应格式`);

        failCount++;
        results.push({ ...symbol, status: 'error', error: '未知响应格式' });
      }
    } catch (error) {
      console.log(`❌ [${symbol.code}] ${symbol.name} (${symbol.ourCode})`);
      console.log(`   请求失败: ${error.message}`);

      failCount++;
      results.push({ ...symbol, status: 'error', error: error.message });
    }

    console.log('');

    // 避免频率限制
    await new Promise(resolve => setTimeout(resolve, 200));
  }

  console.log('========================================');
  console.log(`测试完成: 成功 ${successCount} 个, 失败 ${failCount} 个`);
  console.log('========================================');

  return results;
}

testAllSymbols();
