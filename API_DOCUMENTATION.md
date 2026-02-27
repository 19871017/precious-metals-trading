# 贵金属期货交易系统 - API 文档

## 基本信息

| 项目 | 值 |
|------|------|
| API 版本 | 1.0.0 |
| 基础 URL | `/api` |
| 数据格式 | JSON |
| 字符编码 | UTF-8 |

## 响应格式

所有 API 响应统一使用以下格式：

```json
{
  "code": 0,
  "message": "操作成功",
  "data": { ... },
  "timestamp": 1234567890
}
```

| 状态码 | 说明 |
|--------|------|
| 0 | 成功 |
| 1001 | 参数错误 |
| 1002 | Token 缺失 |
| 1003 | Token 无效 |
| 1004 | Token 已过期 |
| 1005 | 余额不足 |
| 1006 | 保证金不足 |
| 1007 | 杠杆倍数无效 |
| 1008 | 订单不存在 |
| 1009 | 订单状态不允许取消 |
| 1010 | 持仓不存在 |
| 1011 | 持仓状态不允许平仓 |
| 1012 | 资源不存在 |
| 1999 | 系统内部错误 |

---

## 认证接口

### POST /auth/register

注册新用户。

**请求参数：**

| 参数名 | 类型 | 必填 | 说明 |
|--------|------|--------|------|
| username | string | 是 | 用户名（3-20字符）|
| password | string | 是 | 密码（最少6字符）|
| phone | string | 否 | 手机号 |
| email | string | 否 | 邮箱 |
| agentCode | string | 否 | 代理邀请码 |

**响应示例：**

```json
{
  "code": 0,
  "message": "注册成功",
  "data": {
    "id": "user-123",
    "username": "testuser"
  },
  "timestamp": 1234567890
}
```

---

### POST /auth/login

用户登录。

**请求参数：**

| 参数名 | 类型 | 必填 | 说明 |
|--------|------|--------|------|
| username | string | 是 | 用户名 |
| password | string | 是 | 密码 |

**请求头：**

```
Content-Type: application/json
```

**响应示例：**

```json
{
  "code": 0,
  "message": "登录成功",
  "data": {
    "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "user": {
      "id": "user-123",
      "username": "testuser",
      "role": "USER",
      "realName": "张三",
      "phone": "13800138000",
      "email": "test@example.com"
    }
  },
  "timestamp": 1234567890
}
```

---

### POST /auth/logout

用户登出。

**请求头：**

```
Authorization: Bearer {token}
```

---

### GET /auth/me

获取当前用户信息。

**请求头：**

```
Authorization: Bearer {token}
```

**响应示例：**

```json
{
  "code": 0,
  "message": "操作成功",
  "data": {
    "id": "user-123",
    "username": "testuser",
    "role": "USER",
    "realName": "张三",
    "phone": "13800138000",
    "email": "test@example.com"
  },
  "timestamp": 1234567890
}
```

---

## 行情接口

### GET /api/market/ticker

获取市场行情数据。

**请求参数：** 无

**响应示例：**

```json
{
  "code": 0,
  "message": "操作成功",
  "data": [
    {
      "productCode": "GOLD",
      "productName": "黄金",
      "bid": 1850.50,
      "ask": 1851.50,
      "lastPrice": 1851.00,
      "openPrice": 1845.00,
      "high24h": 1860.00,
      "low24h": 1840.00,
      "volume24h": 125000,
      "change": 6.00,
      "changePercent": 0.32,
      "timestamp": "2024-01-15T10:30:00.000Z"
    }
  ],
  "timestamp": 1234567890
}
```

---

### GET /api/market/kline

获取 K 线数据。

**请求参数：**

| 参数名 | 类型 | 必填 | 说明 |
|--------|------|--------|------|
| symbol | string | 是 | 产品代码 |
| period | string | 是 | 周期（1m, 5m, 15m, 1h, 4h, 1d）|
| limit | number | 否 | 数量限制（默认 100）|

---

## 交易接口

### POST /api/order/create

创建新订单。

**请求头：**

```
Authorization: Bearer {token}
Content-Type: application/json
X-CSRF-Token: {csrf_token}
```

**请求参数：**

| 参数名 | 类型 | 必填 | 说明 |
|--------|------|--------|------|
| productCode | string | 是 | 产品代码（GOLD, DAX, HSI, NQ, MHSI, USOIL）|
| type | string | 是 | 订单类型（MARKET, LIMIT）|
| direction | string | 是 | 方向（BUY, SELL）|
| quantity | number | 是 | 数量 |
| leverage | number | 是 | 杠杆倍数（1, 2, 5, 10, 20, 50, 100）|
| price | number | 否 | 限价单价格（限价单必填）|
| stopLoss | number | 否 | 止损价 |
| takeProfit | number | 否 | 止盈价 |

**响应示例：**

```json
{
  "code": 0,
  "message": "订单创建成功",
  "data": {
    "id": "order-123",
    "userId": "user-123",
    "productCode": "GOLD",
    "type": "MARKET",
    "direction": "BUY",
    "quantity": 10,
    "leverage": 10,
    "price": null,
    "margin": 18500.00,
    "status": "CREATED",
    "filledQuantity": 0,
    "createdAt": "2024-01-15T10:30:00.000Z",
    "updatedAt": "2024-01-15T10:30:00.000Z"
  },
  "timestamp": 1234567890
}
```

---

### POST /api/order/cancel

取消订单。

**请求头：**

```
Authorization: Bearer {token}
Content-Type: application/json
X-CSRF-Token: {csrf_token}
```

**请求参数：**

| 参数名 | 类型 | 必填 | 说明 |
|--------|------|--------|------|
| orderId | string | 是 | 订单 ID |

---

### GET /api/order/list

获取用户订单列表。

**请求头：**

```
Authorization: Bearer {token}
```

**请求参数：**

| 参数名 | 类型 | 必填 | 说明 |
|--------|------|--------|------|
| status | string | 否 | 筛选状态 |
| page | number | 否 | 页码（默认 1）|
| pageSize | number | 否 | 每页数量（默认 20）|

---

## 持仓接口

### GET /api/position/list

获取用户持仓列表。

**请求头：**

```
Authorization: Bearer {token}
```

**请求参数：** 无

**响应示例：**

```json
{
  "code": 0,
  "message": "操作成功",
  "data": [
    {
      "id": "position-123",
      "userId": "user-123",
      "productCode": "GOLD",
      "direction": "LONG",
      "openPrice": 1845.00,
      "quantity": 10,
      "leverage": 10,
      "marginUsed": 18500.00,
      "liquidationPrice": 1660.00,
      "stopLoss": 1800.00,
      "takeProfit": 1900.00,
      "unrealizedPnl": 600.00,
      "realizedPnl": 0,
      "status": "OPEN",
      "openedAt": "2024-01-15T10:30:00.000Z",
      "orders": ["order-123"]
    }
  ],
  "timestamp": 1234567890
}
```

---

### POST /api/position/close

平仓。

**请求头：**

```
Authorization: Bearer {token}
Content-Type: application/json
X-CSRF-Token: {csrf_token}
```

**请求参数：**

| 参数名 | 类型 | 必填 | 说明 |
|--------|------|--------|------|
| positionId | string | 是 | 持仓 ID |

---

### POST /api/position/update-sl-tp

更新止盈止损。

**请求头：**

```
Authorization: Bearer {token}
Content-Type: application/json
X-CSRF-Token: {csrf_token}
```

**请求参数：**

| 参数名 | 类型 | 必填 | 说明 |
|--------|------|--------|------|
| positionId | string | 是 | 持仓 ID |
| stopLoss | number | 否 | 新的止损价 |
| takeProfit | number | 否 | 新的止盈价 |

---

## 账户接口

### GET /api/account/info

获取账户信息。

**请求头：**

```
Authorization: Bearer {token}
```

**响应示例：**

```json
{
  "code": 0,
  "message": "操作成功",
  "data": {
    "userId": "user-123",
    "totalBalance": 1000000.00,
    "availableBalance": 981500.00,
    "frozenMargin": 18500.00,
    "unrealizedPnl": 600.00,
    "realizedPnl": -500.00,
    "riskLevel": "SAFE",
    "positions": {}
  },
  "timestamp": 1234567890
}
```

---

## WebSocket 连接

### 连接地址

```
ws://your-domain.com/socket.io/
```

### 订阅行情

```javascript
const socket = io('ws://your-domain.com/socket.io/');

// 订阅行情
socket.emit('subscribe:market', ['GOLD', 'DAX']);

// 接收行情更新
socket.on('market:update', (data) => {
  console.log('Market update:', data);
});
```

### 订阅持仓更新

```javascript
// 订阅持仓
socket.emit('subscribe:positions', 'user-123');

// 接收持仓更新
socket.on('position:update', (data) => {
  console.log('Position update:', data);
});
```

---

## 产品列表

| 产品代码 | 产品名称 | 数海代码 |
|----------|----------|----------|
| GOLD | 黄金 | CMGCA0 |
| DAX | 德指 | CEDAXA0 |
| HSI | 恒指 | HIHHI01 |
| NQ | 小纳指 | CENQA0 |
| MHSI | 小恒指 | HIMCH01 |
| USOIL | 原油 | NECLA0 |

---

## 杠杆倍数

| 倍数 | 说明 |
|------|------|
| 1 | 1:1（无杠杆）|
| 2 | 2:1 |
| 5 | 5:1 |
| 10 | 10:1 |
| 20 | 20:1 |
| 50 | 50:1 |
| 100 | 100:1 |

---

## 错误处理

### Rate Limiting

| 接口类型 | 限制 |
|----------|------|
| 登录接口 | 5次/15分钟 |
| 认证接口 | 10次/分钟 |
| 交易接口 | 20次/分钟 |
| API通用 | 100次/分钟 |

**超过限制响应：**

```json
{
  "code": 429,
  "message": "请求过于频繁，请稍后再试",
  "data": null,
  "timestamp": 1234567890
}
```

---

## 部署信息

### 开发环境

- 基础 URL: `http://localhost:3001`
- WebSocket: `ws://localhost:3001`

### 生产环境

- 基础 URL: `https://your-domain.com/api`
- WebSocket: `wss://your-domain.com/socket.io/`

---

## 更新日志

### v1.0.0 (2024-01-15)
- 初始版本
