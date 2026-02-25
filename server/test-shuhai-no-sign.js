// 测试不使用签名的情况
const axios = require('axios');

const SHUHAI_API_BASE = 'http://ds.cnshuhai.com/stock.php';

async function testWithoutSignature() {
  console.log('========================================');
  console.log('测试不使用签名的情况');
  console.log('========================================\n');

  // 测试 1: 完全不带认证参数
  console.log('测试 1: 不带任何认证参数');
  try {
    const url = `${SHUHAI_API_BASE}?func=getQuote&code=CL`;
    console.log('URL:', url);
    const response = await axios.get(url);
    console.log('成功! 响应:', JSON.stringify(response.data));
  } catch (error) {
    console.log('失败!', error.response?.status, error.response?.data || error.message);
  }
  console.log();

  // 测试 2: 只有用户名
  console.log('测试 2: 只有用户名');
  try {
    const url = `${SHUHAI_API_BASE}?u=wu123&func=getQuote&code=CL`;
    console.log('URL:', url);
    const response = await axios.get(url);
    console.log('成功! 响应:', JSON.stringify(response.data));
  } catch (error) {
    console.log('失败!', error.response?.status, error.response?.data || error.message);
  }
  console.log();

  // 测试 3: 用户名和密码
  console.log('测试 3: 用户名和密码');
  try {
    const url = `${SHUHAI_API_BASE}?u=wu123&p=wu123456&func=getQuote&code=CL`;
    console.log('URL:', url);
    const response = await axios.get(url);
    console.log('成功! 响应:', JSON.stringify(response.data));
  } catch (error) {
    console.log('失败!', error.response?.status, error.response?.data || error.message);
  }
  console.log();

  // 测试 4: 用户名和签名（无密码）
  console.log('测试 4: 用户名和签名（无密码）');
  const timestamp = Math.floor(Date.now() / 1000);
  const crypto = require('crypto');
  const sign = crypto.createHash('md5').update(`u=wu123&stamp=${timestamp}`).digest('hex');
  const url4 = `${SHUHAI_API_BASE}?u=wu123&stamp=${timestamp}&sign=${sign}&func=getQuote&code=CL`;
  console.log('URL:', url4);
  try {
    const response = await axios.get(url4);
    console.log('成功! 响应:', JSON.stringify(response.data));
  } catch (error) {
    console.log('失败!', error.response?.status, error.response?.data || error.message);
  }
  console.log();

  // 测试 5: 检查是否需要 POST 请求
  console.log('测试 5: 使用 POST 请求');
  try {
    const url = `${SHUHAI_API_BASE}`;
    const params = {
      u: 'wu123',
      p: 'wu123456',
      stamp: Math.floor(Date.now() / 1000),
      func: 'getQuote',
      code: 'CL'
    };
    const response = await axios.post(url, new URLSearchParams(params).toString(), {
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded'
      }
    });
    console.log('成功! 响应:', JSON.stringify(response.data));
  } catch (error) {
    console.log('失败!', error.response?.status, error.response?.data || error.message);
  }
  console.log();

  console.log('========================================');
  console.log('测试完成');
  console.log('========================================');
}

testWithoutSignature().catch(console.error);
