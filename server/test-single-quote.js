// 测试单个品种代码
import axios from 'axios';
import http from 'http';
import https from 'https';

const SHUHAI_API_BASE = 'http://ds.cnshuhai.com/stock.php';
const SHUHAI_USERNAME = 'wu123';
const SHUHAI_PASSWORD = 'wu123';

// 测试代码列表
const TEST_CODES = [
  'CEDAXA0',  // 德指
  'CENQA0',   // 小纳指
  'HIHHI01',  // 恒指
  'HIMCH01',  // 小恒指
  'CMGCA0',   // 美黄金
  'NECLA0',   // 美原油
];

const shuhaiAxios = axios.create({
  timeout: 15000,
  httpAgent: new http.Agent({ keepAlive: true, rejectUnauthorized: false }),
  httpsAgent: new https.Agent({ keepAlive: true, rejectUnauthorized: false }),
  proxy: false,
  decompress: true,
});

async function testQuote(code) {
  try {
    const queryParams = new URLSearchParams();
    queryParams.append('type', 'stock');
    queryParams.append('u', SHUHAI_USERNAME);
    queryParams.append('p', SHUHAI_PASSWORD);
    queryParams.append('symbol', code);

    const url = `${SHUHAI_API_BASE}?${queryParams.toString()}`;

    console.log(`测试代码: ${code}`);
    console.log(`请求URL: ${url}`);

    const response = await shuhaiAxios.get(url);

    console.log(`响应状态: ${response.status}`);
    console.log(`响应数据:`, response.data);

    if (response.data.info && typeof response.data.info === 'string') {
      console.log(`❌ 错误: ${response.data.info}`);
      return false;
    }

    if (!response.data || (Array.isArray(response.data) && response.data.length === 0)) {
      console.log(`❌ 空数据`);
      return false;
    }

    console.log(`✅ 成功`);
    return true;
  } catch (error) {
    console.log(`❌ 请求失败:`, error.message);
    if (error.response) {
      console.log(`   响应状态: ${error.response.status}`);
      console.log(`   响应数据:`, error.response.data);
    }
    return false;
  }
}

async function main() {
  console.log('========================================');
  console.log('  数海API品种代码测试');
  console.log('========================================\n');

  const results = [];

  for (const code of TEST_CODES) {
    console.log('\n----------------------------------------');
    const success = await testQuote(code);
    results.push({ code, success });
    await new Promise(resolve => setTimeout(resolve, 1000)); // 延迟1秒
  }

  console.log('\n========================================');
  console.log('  测试结果汇总');
  console.log('========================================');

  results.forEach(({ code, success }) => {
    console.log(`${success ? '✅' : '❌'} ${code}`);
  });

  const failed = results.filter(r => !r.success);
  if (failed.length > 0) {
    console.log('\n失败的代码:');
    failed.forEach(f => console.log(`  - ${f.code}`));
  }
}

main().catch(console.error);
