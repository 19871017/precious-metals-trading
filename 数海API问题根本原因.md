# 数海API问题根本原因分析

## 问题发现过程

### 对比测试结果

经过对比测试，发现了关键问题：

| 调用方式 | 结果 | 说明 |
|---------|------|------|
| 直接 `axios.get(url)` | ✅ 成功 | 简单直接 |
| `axios.create()` 实例 + 直接URL | ❌ 407错误 | **触发代理认证** |
| `axios.create()` 实例 + params对象 | ✅ 成功 | 需要配置params |
| 无headers | ❌ 407错误 | 可能被服务器拦截 |
| fetch API | ✅ 成功 | 浏览器风格 |

### 根本原因

数海API服务器对以下情况返回407错误：

1. **使用 `axios.create()` 创建实例时，不使用 params 对象传参**
   ```javascript
   // ❌ 错误 - 会触发407
   const instance = axios.create({...});
   await instance.get('http://ds.cnshuhai.com/stock.php?type=stock&u=wu123&p=wu123&symbol=xxx');

   // ✅ 正确 - 使用 params 对象
   const instance = axios.create({...});
   await instance.get('http://ds.cnshuhai.com/stock.php', {
     params: { type: 'stock', u: 'wu123', p: 'wu123', symbol: 'xxx' }
   });
   ```

2. **请求频率过高** - "Exorbitant Frequency"
   - 数海API有频率限制
   - 频繁请求会触发407限流

## 修复方案

### 方案1：不使用axios实例（已采用）

直接使用 `axios.get()` 传入完整URL：

```javascript
// ✅ 已修复 - MarketDataService.ts, shuhai.ts
const response = await axios.get(
  `${SHUHAI_API_BASE}?type=stock&u=${SHUHAI_USERNAME}&p=${SHUHAI_PASSWORD}&symbol=${symbols}`
);
```

### 方案2：使用params对象

如果必须使用axios实例，必须使用params配置：

```javascript
// ✅ 可选方案
const instance = axios.create({
  timeout: 10000,
  headers: { 'User-Agent': '...' }
});

const response = await instance.get(SHUHAI_API_BASE, {
  params: {
    type: 'stock',
    u: 'wu123',
    p: 'wu123',
    symbol: 'CEDAXA0,HIHHI02'
  }
});
```

## 已修复的文件

1. **server/src/services/MarketDataService.ts**
   - 移除 `axios.create()` 实例
   - 直接使用 `axios.get(url)`

2. **server/src/routes/shuhai.ts**
   - 移除 `axios.create()` 实例
   - 直接使用 `axios.get(url)`

## 注意事项

1. **频率限制** - 数海API有频率限制，避免频繁请求
2. **批量请求** - 至少需要2个品种，单个品种返回407
3. **HTTP协议** - 只支持HTTP，不支持HTTPS
4. **调用方式** - 不要用axios实例直接传URL参数

## 为什么其他程序能用？

其他程序可能使用了以下方式之一：

1. **不使用axios实例** - 直接调用 `axios.get()`
2. **使用params对象** - 配置了正确的params传参
3. **使用fetch或其他HTTP库** - 没有axios实例的问题
4. **请求频率控制** - 实现了缓存和限流机制

## 建议配置

```javascript
// 推荐配置
const SHUHAI_API_BASE = 'http://ds.cnshuhai.com/stock.php';
const SHUHAI_USERNAME = 'wu123';
const SHUHAI_PASSWORD = 'wu123';
const CACHE_TTL = 5000; // 5秒缓存
const UPDATE_INTERVAL = 30000; // 30秒更新间隔
```

## 验证测试

运行以下测试脚本验证修复：

```bash
node "c:/Users/WY/Desktop/precious-metals-trading/server/对比测试.js"
```

预期结果：
- 方式1（直接axios.get）: ✅
- 方式2（axios实例）: ❌
- 方式3（params对象）: ✅
- 方式4（无headers）: ❌
- 方式5（fetch API）: ✅
