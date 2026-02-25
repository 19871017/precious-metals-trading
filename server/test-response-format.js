// 查看数海API返回的原始数据格式
const axios = require('axios');

const SHUHAI_API_BASE = 'http://ds.cnshuhai.com/stock.php';
const SHUHAI_USERNAME = 'wu123';
const SHUHAI_PASSWORD = 'wu123';

async function testResponseFormat() {
  console.log('测试单个品种数据格式...\n');

  const url = `${SHUHAI_API_BASE}?type=stock&u=${SHUHAI_USERNAME}&p=${SHUHAI_PASSWORD}&symbol=CEDAXA0`;
  console.log(`请求URL: ${url}\n`);

  try {
    const response = await axios.get(url);
    console.log('原始返回数据:');
    console.log(JSON.stringify(response.data, null, 2));
  } catch (error) {
    console.log('错误:', error.message);
  }
}

testResponseFormat();
