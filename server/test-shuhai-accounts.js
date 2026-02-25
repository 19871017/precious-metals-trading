// 测试不同的账号格式
const axios = require('axios');

const SHUHAI_API_BASE = 'http://ds.cnshuhai.com/stock.php';

async function testAccount(username, password, testName) {
  console.log(`\n${testName}:`);
  console.log(`账号: ${username}, 密码: ${password}`);

  const url = `${SHUHAI_API_BASE}?u=${username}&p=${password}&func=getQuote&code=CL`;
  console.log(`URL: ${url}`);

  try {
    const response = await axios.get(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0'
      }
    });
    console.log(`✅ 成功! 状态码: ${response.status}`);
    const data = response.data;
    if (data.info && data.info === 'error type value') {
      console.log(`⚠️  认证失败: ${JSON.stringify(data)}`);
      return false;
    } else {
      console.log(`✅ 成功获取数据: ${JSON.stringify(data).substring(0, 200)}`);
      return true;
    }
  } catch (error) {
    if (error.response) {
      console.log(`❌ 失败! 状态码: ${error.response.status}`);
      console.log(`响应: ${JSON.stringify(error.response.data)}`);
    } else {
      console.log(`❌ 失败! 错误: ${error.message}`);
    }
    return false;
  }
}

async function runTests() {
  console.log('========================================');
  console.log('测试不同的账号格式');
  console.log('========================================');

  const accounts = [
    ['wu123', 'wu123456'],
    ['wu123', 'wu123'],
    ['WU123', 'wu123456'],
    ['WU123', 'WU123456'],
  ];

  for (const [username, password] of accounts) {
    await testAccount(username, password, `账号: ${username} / ${password}`);
  }

  console.log('\n========================================');
  console.log('测试完成');
  console.log('========================================');
  
  console.log('\n\n总结：');
  console.log('如果所有账号都返回 "error type value"，可能的原因：');
  console.log('1. 账号或密码不正确');
  console.log('2. 账号需要激活或充值');
  console.log('3. API 服务暂时不可用');
  console.log('4. 需要联系数海客服获取正确的账号信息');
}

runTests().catch(console.error);
