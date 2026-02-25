// 测试不同签名格式
const crypto = require('crypto');
const axios = require('axios');

const SHUHAI_API_BASE = 'http://ds.cnshuhai.com/stock.php';
const SHUHAI_USERNAME = 'wu123';
const SHUHAI_PASSWORD = 'wu123456';

function md5(str) {
  return crypto.createHash('md5').update(str).digest('hex');
}

async function testSignatureFormat(formatName, formatString, getSignFunc) {
  console.log(`\n测试 ${formatName}:`);
  console.log(`格式字符串: ${formatString}`);

  const timestamp = Math.floor(Date.now() / 1000);
  const sign = getSignFunc ? getSignFunc(timestamp) : md5(formatString.replace('{timestamp}', timestamp.toString()));

  console.log(`签名: ${sign}`);

  const url = `${SHUHAI_API_BASE}?u=${SHUHAI_USERNAME}&stamp=${timestamp}&sign=${sign}&func=getQuote&code=CL`;
  console.log(`URL: ${url}`);

  try {
    const response = await axios.get(url, {
      timeout: 10000,
      headers: {
        'User-Agent': 'Mozilla/5.0',
        'Accept': 'application/json'
      }
    });

    console.log(`✅ 成功! 状态码: ${response.status}`);
    console.log(`响应: ${JSON.stringify(response.data).substring(0, 200)}`);
    return true;
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
  console.log('测试不同的签名格式');
  console.log('========================================');

  const timestamp = Math.floor(Date.now() / 1000);

  // 格式 1: u={user}&p={password}&stamp={timestamp}
  await testSignatureFormat(
    '格式 1: u=user&p=password&stamp=timestamp',
    `u=${SHUHAI_USERNAME}&p=${SHUHAI_PASSWORD}&stamp=${timestamp}`,
    null
  );

  // 格式 2: stamp={timestamp}&u={user}&p={password}
  await testSignatureFormat(
    '格式 2: stamp=timestamp&u=user&p=password',
    `stamp=${timestamp}&u=${SHUHAI_USERNAME}&p=${SHUHAI_PASSWORD}`,
    null
  );

  // 格式 3: user={user}&password={password}&timestamp={timestamp}
  await testSignatureFormat(
    '格式 3: user=user&password=password&timestamp=timestamp',
    `user=${SHUHAI_USERNAME}&password=${SHUHAI_PASSWORD}&timestamp=${timestamp}`,
    null
  );

  // 格式 4: {username}{password}{timestamp} (直接拼接)
  await testSignatureFormat(
    '格式 4: username+password+timestamp',
    `${SHUHAI_USERNAME}${SHUHAI_PASSWORD}${timestamp}`,
    null
  );

  // 格式 5: {timestamp}{username}{password}
  await testSignatureFormat(
    '格式 5: timestamp+username+password',
    `${timestamp}${SHUHAI_USERNAME}${SHUHAI_PASSWORD}`,
    null
  );

  // 格式 6: md5(username + password) + timestamp
  await testSignatureFormat(
    '格式 6: md5(username+password)+timestamp',
    `${md5(SHUHAI_USERNAME + SHUHAI_PASSWORD)}${timestamp}`,
    null
  );

  // 格式 7: 只用密码
  await testSignatureFormat(
    '格式 7: p=password&stamp=timestamp',
    `p=${SHUHAI_PASSWORD}&stamp=${timestamp}`,
    null
  );

  console.log('\n========================================');
  console.log('测试完成');
  console.log('========================================');
}

runTests().catch(console.error);
