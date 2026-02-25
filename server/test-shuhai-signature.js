// 测试不同的签名格式
const crypto = require('crypto');

const SHUHAI_USERNAME = 'wu123';
const SHUHAI_PASSWORD = 'wu123456';

function md5(str) {
  return crypto.createHash('md5').update(str).digest('hex');
}

console.log('========================================');
console.log('测试不同的签名格式');
console.log('========================================\n');

const timestamp = Math.floor(Date.now() / 1000);
console.log('时间戳:', timestamp);
console.log();

// 格式 1: u={user}&p={password}&stamp={timestamp}
const format1 = `u=${SHUHAI_USERNAME}&p=${SHUHAI_PASSWORD}&stamp=${timestamp}`;
console.log('格式 1:', format1);
console.log('MD5:', md5(format1));
console.log();

// 格式 2: stamp={timestamp}&u={user}&p={password}
const format2 = `stamp=${timestamp}&u=${SHUHAI_USERNAME}&p=${SHUHAI_PASSWORD}`;
console.log('格式 2:', format2);
console.log('MD5:', md5(format2));
console.log();

// 格式 3: u={user}&p={password}&stamp={timestamp} (无空格)
const format3 = `u=${SHUHAI_USERNAME}&p=${SHUHAI_PASSWORD}&stamp=${timestamp}`;
console.log('格式 3:', format3);
console.log('MD5:', md5(format3));
console.log();

// 格式 4: 仅密码和时间戳
const format4 = `p=${SHUHAI_PASSWORD}&stamp=${timestamp}`;
console.log('格式 4:', format4);
console.log('MD5:', md5(format4));
console.log();

// 格式 5: user={user}&password={password}&timestamp={timestamp}
const format5 = `user=${SHUHAI_USERNAME}&password=${SHUHAI_PASSWORD}&timestamp=${timestamp}`;
console.log('格式 5:', format5);
console.log('MD5:', md5(format5));
console.log();

// 格式 6: 用户名+密码+时间戳拼接
const format6 = `${SHUHAI_USERNAME}${SHUHAI_PASSWORD}${timestamp}`;
console.log('格式 6:', format6);
console.log('MD5:', md5(format6));
console.log();

// 格式 7: 时间戳+用户名+密码
const format7 = `${timestamp}${SHUHAI_USERNAME}${SHUHAI_PASSWORD}`;
console.log('格式 7:', format7);
console.log('MD5:', md5(format7));
console.log();

console.log('========================================');
