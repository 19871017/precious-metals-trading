// 测试不包含黄金的请求
const axios = require('axios');

async function testNoGold() {
  console.log('测试不含黄金的请求...\n');

  const symbols = 'CEDAXA0,HIHHI02';
  const url = `http://ds.cnshuhai.com/stock.php?type=stock&u=wu123&p=wu123&symbol=${symbols}`;

  try {
    const response = await axios.get(url);
    console.log('✅ 成功！');
    console.log('返回数据:', response.data.map(d => `${d.Symbol}:${d.Name}`));
  } catch (error) {
    console.log('❌ 失败:', error.response?.status);
  }
}

testNoGold();
