// 测试前端API调用
async function testAPI() {
  const symbols = ['DAX', 'NQ', 'HSI', 'MHSI', 'GOLD', 'USOIL'];

  for (const symbol of symbols) {
    try {
      console.log(`测试 ${symbol}...`);
      const response = await fetch(`http://localhost:3001/shuhai/quote?code=${symbol}`);
      const data = await response.json();
      console.log(`${symbol}:`, data.code === 0 ? '✅' : '❌', data.data?.price);
    } catch (error) {
      console.error(`${symbol} 失败:`, error);
    }
  }
}

testAPI();
