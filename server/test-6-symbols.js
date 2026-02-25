// 测试6个指定的品种
const axios = require('axios');

const SHUHAI_API_BASE = 'http://ds.cnshuhai.com/stock.php';
const SHUHAI_USERNAME = 'wu123';
const SHUHAI_PASSWORD = 'wu123';

// 用户指定的6个品种
const TEST_SYMBOLS = [
  { code: 'CEDAXA0', name: '德指', ourCode: 'DAX' },
  { code: 'HIHHI02', name: '恒指', ourCode: 'HSI' },
  { code: 'CENQA0', name: '纳指', ourCode: 'NQ' },
  { code: 'NEGCZ0', name: '黄金', ourCode: 'GOLD' },
  { code: 'NECLA0', name: '原油', ourCode: 'USOIL' },
  { code: 'HIHHI01', name: '小恒指', ourCode: 'MHSI' },
];

async function test6Symbols() {
  console.log('========================================');
  console.log('测试6个指定品种');
  console.log('========================================\n');

  let successCount = 0;
  let failCount = 0;
  const availableSymbols = [];
  const unavailableSymbols = [];

  for (const symbol of TEST_SYMBOLS) {
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
        console.log(`   数据源: ${data.Name || 'N/A'}\n`);

        successCount++;
        availableSymbols.push(symbol);
      } else if (response.data.info) {
        console.log(`⚠️  [${symbol.code}] ${symbol.name} (${symbol.ourCode})`);
        console.log(`   错误: ${response.data.info}\n`);

        failCount++;
        unavailableSymbols.push({ ...symbol, error: response.data.info });
      } else {
        console.log(`❌ [${symbol.code}] ${symbol.name} (${symbol.ourCode})`);
        console.log(`   未知响应格式\n`);

        failCount++;
        unavailableSymbols.push({ ...symbol, error: '未知响应格式' });
      }
    } catch (error) {
      console.log(`❌ [${symbol.code}] ${symbol.name} (${symbol.ourCode})`);
      console.log(`   请求失败: ${error.message}\n`);

      failCount++;
      unavailableSymbols.push({ ...symbol, error: error.message });
    }

    // 避免频率限制
    await new Promise(resolve => setTimeout(resolve, 300));
  }

  console.log('========================================');
  console.log(`测试结果: 成功 ${successCount} 个, 失败 ${failCount} 个`);
  console.log('========================================\n');

  if (availableSymbols.length > 0) {
    console.log('可用品种：');
    availableSymbols.forEach((s, i) => {
      console.log(`  ${i + 1}. ${s.ourCode} - ${s.name} (${s.code})`);
    });
    console.log('');
  }

  if (unavailableSymbols.length > 0) {
    console.log('不可用品种：');
    unavailableSymbols.forEach((s, i) => {
      console.log(`  ${i + 1}. ${s.ourCode} - ${s.name} (${s.code}) - ${s.error}`);
    });
    console.log('');
  }

  // 批量测试
  if (availableSymbols.length > 0) {
    console.log('========================================');
    console.log('批量获取测试');
    console.log('========================================\n');

    const symbols = availableSymbols.map(s => s.code).join(',');
    const batchUrl = `${SHUHAI_API_BASE}?type=stock&u=${SHUHAI_USERNAME}&p=${SHUHAI_PASSWORD}&symbol=${symbols}`;

    console.log(`请求品种: ${symbols}\n`);

    try {
      const response = await axios.get(batchUrl, {
        timeout: 10000,
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        }
      });

      console.log(`✅ 批量获取成功！返回 ${response.data.length} 个品种的数据:\n`);

      response.data.forEach((item, index) => {
        const price = item.NewPrice || item.Price;
        const lastClose = item.LastClose;
        const change = price && lastClose ? ((price - lastClose) / lastClose * 100).toFixed(2) : 0;
        const changeStr = change > 0 ? `+${change}%` : `${change}%`;

        console.log(`  ${index + 1}. [${item.Symbol}] ${item.Name}`);
        console.log(`     最新价: ${price}, 昨收: ${lastClose}, 涨跌: ${changeStr}`);
      });

      console.log('\n========================================');
      console.log('结论: 批量请求可以同时获取多个品种数据');
      console.log('========================================');
    } catch (error) {
      console.error('❌ 批量请求失败:', error.message);
    }
  }

  return { successCount, failCount, availableSymbols, unavailableSymbols };
}

test6Symbols();
