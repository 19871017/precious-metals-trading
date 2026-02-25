// 测试单个数海品种代码
const axios = require('axios');

const SHUHAI_API_BASE = 'http://ds.cnshuhai.com/stock.php';
const SHUHAI_USERNAME = 'wu123';
const SHUHAI_PASSWORD = 'wu123';

// 从命令行参数获取品种代码
const shuhaiCode = process.argv[2];

if (!shuhaiCode) {
  console.log('使用方法: node test-single-symbol.js <数海代码>');
  console.log('');
  console.log('示例:');
  console.log('  node test-single-symbol.js CEESA0  # 测试小标普');
  console.log('  node test-single-symbol.js CEGC0   # 测试黄金(欧洲市场)');
  console.log('');
  process.exit(1);
}

async function testSymbol(code) {
  console.log('========================================');
  console.log(`测试数海品种: ${code}`);
  console.log('========================================\n');

  const url = `${SHUHAI_API_BASE}?type=stock&u=${SHUHAI_USERNAME}&p=${SHUHAI_PASSWORD}&symbol=${code}`;

  console.log(`请求URL: ${url}\n`);

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
      const open = data.Open;
      const high = data.High;
      const low = data.Low;
      const volume = data.Volume;
      const change = price && lastClose ? ((price - lastClose) / lastClose * 100).toFixed(2) : 0;
      const changeStr = change > 0 ? `+${change}%` : `${change}%`;

      console.log('✅ 品种可用！');
      console.log('');
      console.log('品种信息:');
      console.log(`  数海代码: ${data.Symbol}`);
      console.log(`  品种名称: ${data.Name}`);
      console.log(`  最新价: ${price}`);
      console.log(`  开盘价: ${open}`);
      console.log(`  最高价: ${high}`);
      console.log(`  最低价: ${low}`);
      console.log(`  昨收盘: ${lastClose}`);
      console.log(`  涨跌幅: ${changeStr}`);
      console.log(`  成交量: ${volume}`);
      console.log('');
      console.log('请在后台管理中使用以下配置:');
      console.log(`  code: <自定义代码，如: ES>`);
      console.log(`  name: "${data.Name}"`);
      console.log(`  shuhaiCode: "${data.Symbol}"`);
      console.log(`  market: "${data.Symbol.substring(0, 2)}"  # 取前两位`);
      console.log('');

    } else if (response.data.info) {
      console.log('❌ 品种不可用');
      console.log(`   错误信息: ${response.data.info}`);
      console.log('');
      console.log('可能的原因:');
      console.log('  1. 账号没有该市场的数据权限');
      console.log('  2. 数海代码不正确');
      console.log('  3. 该品种已下架');
      console.log('');

    } else {
      console.log('❌ 未知响应格式');
      console.log('   响应数据:', JSON.stringify(response.data).substring(0, 200));
      console.log('');
    }
  } catch (error) {
    if (error.response && error.response.status === 407) {
      console.log('❌ 需要代理认证');
      console.log('   说明: 该品种需要特殊的市场权限');
      console.log('');
    } else if (error.response && error.response.status === 406) {
      console.log('❌ 请求被拒绝');
      console.log('   说明: 可能是签名或认证问题');
      console.log('');
    } else {
      console.log('❌ 请求失败');
      console.log(`   错误信息: ${error.message}`);
      console.log('');
    }
  }

  console.log('========================================');
}

testSymbol(shuhaiCode);
