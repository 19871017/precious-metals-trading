// 直接测试数海 API
const crypto = require('crypto');
const axios = require('axios');

const SHUHAI_API_BASE = 'http://ds.cnshuhai.com/stock.php';
const SHUHAI_USERNAME = 'wu123';
const SHUHAI_PASSWORD = 'wu123456';

function generateSignature(timestamp) {
  const stringA = `u=${SHUHAI_USERNAME}&p=${SHUHAI_PASSWORD}&stamp=${timestamp}`;
  return crypto.createHash('md5').update(stringA).digest('hex');
}

async function testShuhaiAPI() {
  console.log('========================================');
  console.log('测试数海 API 直接访问');
  console.log('========================================\n');

  // 测试签名生成
  const timestamp = Math.floor(Date.now() / 1000);
  const sign = generateSignature(timestamp);
  const stringA = `u=${SHUHAI_USERNAME}&p=${SHUHAI_PASSWORD}&stamp=${timestamp}`;

  console.log('1. 签名测试:');
  console.log('   字符串:', stringA);
  console.log('   时间戳:', timestamp);
  console.log('   签名:', sign);
  console.log();

  // 测试获取实时行情
  const codes = ['CL', 'GC', 'DAX', 'HSI'];
  
  for (const code of codes) {
    console.log(`2. 测试获取 ${code} 实时行情:`);
    
    const url = `${SHUHAI_API_BASE}?u=${SHUHAI_USERNAME}&stamp=${timestamp}&sign=${sign}&func=getQuote&code=${code}`;
    console.log('   URL:', url);
    
    try {
      const response = await axios.get(url, {
        timeout: 10000,
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
          'Accept': 'application/json, text/plain, */*'
        }
      });
      
      console.log('   状态码:', response.status);
      console.log('   响应头:', JSON.stringify(response.headers, null, 2));
      console.log('   响应数据:', JSON.stringify(response.data, null, 2));
    } catch (error) {
      console.log('   错误:', error.message);
      if (error.response) {
        console.log('   响应状态:', error.response.status);
        console.log('   响应数据:', error.response.data);
      }
    }
    console.log();
  }

  // 测试 K 线数据
  console.log('3. 测试获取 CL K线数据:');
  const klineUrl = `${SHUHAI_API_BASE}?u=${SHUHAI_USERNAME}&stamp=${timestamp}&sign=${sign}&func=getKLine&code=CL&period=60&count=100`;
  console.log('   URL:', klineUrl);
  
  try {
    const response = await axios.get(klineUrl, {
      timeout: 10000,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Accept': 'application/json, text/plain, */*'
      }
    });
    
    console.log('   状态码:', response.status);
    console.log('   响应数据类型:', typeof response.data);
    console.log('   响应数据:', JSON.stringify(response.data, null, 2));
  } catch (error) {
    console.log('   错误:', error.message);
    if (error.response) {
      console.log('   响应状态:', error.response.status);
      console.log('   响应数据:', error.response.data);
    }
  }

  console.log('\n========================================');
  console.log('测试完成');
  console.log('========================================');
}

testShuhaiAPI().catch(console.error);
