// 测试不同的参数名称
const axios = require('axios');

const SHUHAI_API_BASE = 'http://ds.cnshuhai.com/stock.php';
const SHUHAI_USERNAME = 'wu123';
const SHUHAI_PASSWORD = 'wu123456';

async function testParams(params, testName) {
  console.log(`\n${testName}:`);
  console.log(`参数: ${JSON.stringify(params)}`);

  const url = `${SHUHAI_API_BASE}?${new URLSearchParams(params).toString()}`;
  console.log(`URL: ${url}`);

  try {
    const response = await axios.get(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0'
      }
    });
    console.log(`✅ 成功! 状态码: ${response.status}`);
    console.log(`响应: ${JSON.stringify(response.data).substring(0, 300)}`);
    return response.data;
  } catch (error) {
    if (error.response) {
      console.log(`❌ 失败! 状态码: ${error.response.status}`);
      console.log(`响应: ${JSON.stringify(error.response.data)}`);
    } else {
      console.log(`❌ 失败! 错误: ${error.message}`);
    }
    return null;
  }
}

async function runTests() {
  console.log('========================================');
  console.log('测试不同的参数名称和格式');
  console.log('========================================');

  // 测试不同的 func 参数值
  const funcValues = ['getQuote', 'quote', 'get_quote', 'GetQuote', 'getquote'];
  for (const func of funcValues) {
    await testParams({
      u: SHUHAI_USERNAME,
      p: SHUHAI_PASSWORD,
      func: func,
      code: 'CL'
    }, `测试 func=${func}`);
  }

  // 测试不同的 code 参数名称
  const codeParams = ['code', 'symbol', 'product', 's'];
  for (const param of codeParams) {
    const params = {
      u: SHUHAI_USERNAME,
      p: SHUHAI_PASSWORD,
      func: 'getQuote',
      code: 'CL'
    };
    if (param !== 'code') {
      delete params.code;
      params[param] = 'CL';
    }
    await testParams(params, `测试参数名 ${param}`);
  }

  console.log('\n========================================');
  console.log('测试完成');
  console.log('========================================');
}

runTests().catch(console.error);
