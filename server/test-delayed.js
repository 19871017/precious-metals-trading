// 延迟后测试
const axios = require('axios');

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function testWithDelay() {
  console.log('等待5秒后测试...\n');
  await sleep(5000);

  const url = 'http://ds.cnshuhai.com/stock.php?type=stock&u=wu123&p=wu123&symbol=CEDAXA0,HIHHI02';

  try {
    const response = await axios.get(url);
    console.log('✅ 成功！');
    console.log('返回数据量:', response.data.length);
  } catch (error) {
    console.log('❌ 失败:', error.response?.status, error.response?.statusText);
  }
}

testWithDelay();
