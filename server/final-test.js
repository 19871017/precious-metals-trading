// 最终测试脚本 - 验证数海API集成
const axios = require('axios');

console.log('========================================');
console.log('数海API集成最终验证');
console.log('========================================\n');

// 测试1: 基础连接测试
console.log('【测试1】基础连接测试');
console.log('----------------------------------------');
const testURL = 'http://ds.cnshuhai.com/stock.php?type=stock&u=wu123&p=wu123&symbol=CEDAXA0,HIHHI02,CENQA0';

axios.get(testURL, {
  timeout: 10000,
  headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' }
})
  .then(response => {
    console.log('✅ 连接成功！');
    console.log(`返回数据类型: ${Array.isArray(response.data) ? '数组' : typeof response.data}`);
    console.log(`数据量: ${Array.isArray(response.data) ? response.data.length : 1}`);

    if (Array.isArray(response.data)) {
      console.log('\n行情数据:\n');
      response.data.forEach((item, index) => {
        const price = item.NewPrice || item.Price;
        const lastClose = item.LastClose;
        const change = price && lastClose ? ((price - lastClose) / lastClose * 100).toFixed(2) : 0;
        console.log(`${index + 1}. [${item.Symbol}] ${item.Name}`);
        console.log(`   最新价: ${price}, 昨收: ${lastClose}, 涨跌: ${change > 0 ? '+' : ''}${change}%\n`);
      });
    }
  })
  .catch(error => {
    console.log('❌ 连接失败:', error.message);
  })
  .then(() => {
    console.log('\n========================================');
    console.log('修复总结:');
    console.log('========================================');
    console.log('1. API地址改为: http://ds.cnshuhai.com/stock.php');
    console.log('2. 密码改为: wu123 (原wu123456)');
    console.log('3. 可用品种: DAX(德指)、HSI(恒指)、NQ(纳指)');
    console.log('4. 请求方式: type=stock&u=username&p=password&symbol=品种代码(逗号分隔)');
    console.log('5. 无需签名验证');
    console.log('========================================\n');
  });
