// 对比测试：模拟其他程序的调用方式
const axios = require('axios');

// 方式1：直接调用axios.get（测试脚本使用的方式）
async function testMethod1() {
  console.log('方式1：直接调用 axios.get');
  try {
    const response = await axios.get('http://ds.cnshuhai.com/stock.php?type=stock&u=wu123&p=wu123&symbol=CEDAXA0,HIHHI02');
    console.log('✅ 成功，返回数据量:', response.data.length);
    return true;
  } catch (error) {
    console.log('❌ 失败:', error.message);
    return false;
  }
}

// 方式2：使用axios实例（后端代码使用的方式）
async function testMethod2() {
  console.log('\n方式2：使用 axios.create() 实例');
  try {
    const shuhaiAxios = axios.create({
      timeout: 10000,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'application/json, text/plain, */*',
      }
    });
    const response = await shuhaiAxios.get('http://ds.cnshuhai.com/stock.php?type=stock&u=wu123&p=wu123&symbol=CEDAXA0,HIHHI02');
    console.log('✅ 成功，返回数据量:', response.data.length);
    return true;
  } catch (error) {
    console.log('❌ 失败:', error.message);
    return false;
  }
}

// 方式3：使用axios实例 + 完整配置对象
async function testMethod3() {
  console.log('\n方式3：使用 axios 实例 + 完整配置对象');
  try {
    const shuhaiAxios = axios.create({
      timeout: 10000,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'application/json, text/plain, */*',
      }
    });
    const response = await shuhaiAxios.get('http://ds.cnshuhai.com/stock.php', {
      params: {
        type: 'stock',
        u: 'wu123',
        p: 'wu123',
        symbol: 'CEDAXA0,HIHHI02'
      }
    });
    console.log('✅ 成功，返回数据量:', response.data.length);
    return true;
  } catch (error) {
    console.log('❌ 失败:', error.message);
    return false;
  }
}

// 方式4：不设置headers
async function testMethod4() {
  console.log('\n方式4：不设置任何 headers');
  try {
    const response = await axios.get('http://ds.cnshuhai.com/stock.php?type=stock&u=wu123&p=wu123&symbol=CEDAXA0,HIHHI02', {
      timeout: 10000
    });
    console.log('✅ 成功，返回数据量:', response.data.length);
    return true;
  } catch (error) {
    console.log('❌ 失败:', error.message);
    return false;
  }
}

// 方式5：使用fetch (Node.js 18+)
async function testMethod5() {
  console.log('\n方式5：使用 fetch API');
  try {
    const response = await fetch('http://ds.cnshuhai.com/stock.php?type=stock&u=wu123&p=wu123&symbol=CEDAXA0,HIHHI02', {
      timeout: 10000
    });
    const data = await response.json();
    console.log('✅ 成功，返回数据量:', data.length);
    return true;
  } catch (error) {
    console.log('❌ 失败:', error.message);
    return false;
  }
}

async function runAllTests() {
  console.log('========================================');
  console.log('  数海API多种调用方式对比测试');
  console.log('========================================\n');

  const results = [];
  results.push(await testMethod1());
  results.push(await testMethod2());
  results.push(await testMethod3());
  results.push(await testMethod4());

  try {
    await testMethod5();
  } catch (e) {
    // fetch 可能不支持
  }

  console.log('\n========================================');
  console.log('  测试结果汇总');
  console.log('========================================');
  console.log(`方式1（直接axios.get）: ${results[0] ? '✅' : '❌'}`);
  console.log(`方式2（axios实例）: ${results[1] ? '✅' : '❌'}`);
  console.log(`方式3（params对象）: ${results[2] ? '✅' : '❌'}`);
  console.log(`方式4（无headers）: ${results[3] ? '✅' : '❌'}`);
}

runAllTests();
