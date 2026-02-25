const bcrypt = require('bcryptjs');

// 生成密码哈希
async function generatePasswordHash(password) {
  const hash = await bcrypt.hash(password, 10);
  console.log('Password:', password);
  console.log('Hash:', hash);
  console.log('');
  return hash;
}

// 生成测试密码的哈希
generatePasswordHash('agent123').then(() => {
  generatePasswordHash('123456');
});
