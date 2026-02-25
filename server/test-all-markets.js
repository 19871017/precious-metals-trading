// 测试所有市场的可用品种
const axios = require('axios');

const SHUHAI_API_BASE = 'http://ds.cnshuhai.com/stock.php';
const SHUHAI_USERNAME = 'wu123';
const SHUHAI_PASSWORD = 'wu123';

// 尝试所有已知品种
const ALL_TEST_SYMBOLS = [
  // CE 市场（欧洲期货）- 已确认可用
  { code: 'CEDAXA0', name: '德指', market: 'CE' },
  { code: 'CENQA0', name: '纳指', market: 'CE' },
  { code: 'CEESA0', name: '小标普', market: 'CE' },
  { code: 'CEYMA0', name: '小道琼', market: 'CE' },

  // HI 市场（恒指期货）- 已确认可用
  { code: 'HIHHI02', name: '恒指', market: 'HI' },
  { code: 'HIHHI01', name: '小恒指', market: 'HI' },

  // NE 市场（美期货）- 部分可用
  { code: 'NEGCZ0', name: '美黄金', market: 'NE' },
  { code: 'NECLA0', name: '美原油', market: 'NE' },

  // CM 市场（商品期货）- 需要代理
  { code: 'CMGC0', name: '黄金连续', market: 'CM' },
  { code: 'CMSI0', name: '白银连续', market: 'CM' },
  { code: 'CMHG0', name: '精铜连续', market: 'CM' },
  { code: 'CMCL0', name: '原油连续', market: 'CM' },

  // 其他可能的黄金代码
  { code: 'GC', name: '黄金期货', market: 'ALL' },
  { code: 'GOLD', name: '黄金', market: 'ALL' },
  { code: 'XAUUSD', name: '国际黄金', market: 'ALL' },
  { code: 'XAU/USD', name: '黄金外汇', market: 'ALL' },

  // 尝试产品类型查询
  { code: 'type=product', name: '产品列表查询', market: 'API' },
  { code: 'type=market', name: '市场列表查询', market: 'API' },
];

async function testAllMarkets() {
  console.log('========================================');
  console.log('测试所有市场的可用品种');
  console.log('========================================\n');

  const results = {
    CE: [],
    HI: [],
    NE: [],
    CM: [],
    OTHER: []
  };

  for (const symbol of ALL_TEST_SYMBOLS) {
    let url;
    if (symbol.code.startsWith('type=')) {
      url = `${SHUHAI_API_BASE}?${symbol.code}&u=${SHUHAI_USERNAME}&p=${SHUHAI_PASSWORD}`;
    } else {
      url = `${SHUHAI_API_BASE}?type=stock&u=${SHUHAI_USERNAME}&p=${SHUHAI_PASSWORD}&symbol=${symbol.code}`;
    }

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

        const result = {
          code: data.Symbol,
          name: data.Name || symbol.name,
          price: price,
          change: changeStr,
          market: symbol.market
        };

        if (results[symbol.market]) {
          results[symbol.market].push(result);
        } else {
          results.OTHER.push(result);
        }

        console.log(`✅ [${data.Symbol}] ${data.Name || symbol.name}`);
        console.log(`   市场: ${symbol.market}, 最新价: ${price}, 涨跌: ${changeStr}`);
      } else if (typeof response.data === 'object' && response.data.info) {
        console.log(`❌ [${symbol.code}] - ${response.data.info}`);
      } else if (typeof response.data === 'string') {
        console.log(`ℹ️  [${symbol.code}] - ${response.data}`);
      } else {
        console.log(`❌ [${symbol.code}] - 未知响应`);
      }
    } catch (error) {
      if (error.response && error.response.status === 407) {
        console.log(`🔒 [${symbol.code}] ${symbol.name} - 需要407代理认证`);
      } else if (error.response && error.response.status === 406) {
        console.log(`🔒 [${symbol.code}] ${symbol.name} - 需要406认证`);
      } else {
        console.log(`❌ [${symbol.code}] ${symbol.name} - ${error.message}`);
      }
    }

    console.log('');
    await new Promise(resolve => setTimeout(resolve, 200));
  }

  console.log('========================================');
  console.log('按市场分类的可用品种：');
  console.log('========================================\n');

  for (const [market, symbols] of Object.entries(results)) {
    if (symbols.length > 0) {
      console.log(`【${market}市场】 (${symbols.length}个品种)`);
      symbols.forEach((s, i) => {
        console.log(`  ${i + 1}. ${s.name} (${s.code}) - 最新价: ${s.price}, 涨跌: ${s.change}`);
      });
      console.log('');
    }
  }

  console.log('========================================');
  console.log('黄金品种查找结果：');

  const goldSymbols = [];
  Object.values(results).flat().forEach(s => {
    const name = (s.name || '').toLowerCase();
    const code = (s.code || '').toLowerCase();
    if (name.includes('金') ||
        name.includes('gold') ||
        code.includes('gc') ||
        code.includes('xau') ||
        code.includes('gcm')) {
      goldSymbols.push(s);
    }
  });

  if (goldSymbols.length > 0) {
    console.log(`找到 ${goldSymbols.length} 个黄金相关品种：\n`);
    goldSymbols.forEach((s, i) => {
      console.log(`  ${i + 1}. ${s.name} (${s.code})`);
      console.log(`     市场: ${s.market}, 最新价: ${s.price}, 涨跌: ${s.change}`);
      console.log(`     配置: 'GOLD': '${s.code}'  // 黄金 ✅`);
      console.log('');
    });
  } else {
    console.log('未找到黄金品种！');
    console.log('');
    console.log('可能的原因：');
    console.log('1. 账号虽然购买了市场，但可能需要等待权限生效');
    console.log('2. 黄金品种的代码可能不同（需要联系数海客服）');
    console.log('3. 可能在后台需要额外配置才能访问特定品种');
    console.log('');
    console.log('建议操作：');
    console.log('- 登录数海官网，查看已购买市场的品种列表');
    console.log('- 检查是否有黄金相关的品种代码');
    console.log('- 联系数海客服确认黄金品种的访问方式');
  }

  console.log('========================================');

  return results;
}

testAllMarkets();
