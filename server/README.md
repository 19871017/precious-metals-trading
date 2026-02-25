# 贵金属期货交易系统 - 后端服务

## 系统架构

```
┌─────────────────────────────────────────────────────────────┐
│                      API 层 (Express)                        │
├─────────────────────────────────────────────────────────────┤
│  账户API  │  行情API  │  交易API  │  持仓API  │  风控API    │
├─────────────────────────────────────────────────────────────┤
│                    业务逻辑层                               │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────┐     │
│  │  订单管理器  │  │  仓位管理器  │  │    风险管理器    │     │
│  │ OrderManager│  │PositionManager│  │   RiskManager   │     │
│  └─────────────┘  └─────────────┘  └─────────────────┘     │
├─────────────────────────────────────────────────────────────┤
│                    工具层                                   │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────┐     │
│  │  计算器     │  │  行情服务   │  │    工具函数      │     │
│  │ Calculator  │  │ MarketService│  │    Utils        │     │
│  └─────────────┘  └─────────────┘  └─────────────────┘     │
└─────────────────────────────────────────────────────────────┘
```

## 快速开始

### 1. 安装依赖

```bash
cd server
npm install
```

### 2. 启动开发服务器

```bash
npm run dev
```

### 3. 构建生产版本

```bash
npm run build
npm start
```

## API 接口文档

### 账户类

#### GET /api/account/info
获取账户信息

**响应示例：**
```json
{
  "code": 0,
  "message": "success",
  "data": {
    "userId": "demo-user",
    "totalBalance": 1000000,
    "availableBalance": 950000,
    "frozenMargin": 50000,
    "unrealizedPnl": 1250,
    "realizedPnl": 0,
    "riskLevel": "SAFE"
  }
}
```

#### GET /api/account/balance
获取账户余额

#### GET /api/account/risk-level
获取账户风险等级

### 行情类

#### GET /api/market/ticker
获取行情数据

**参数：**
- `product` (可选): 产品代码，如 XAUUSD

**响应示例：**
```json
{
  "code": 0,
  "message": "success",
  "data": {
    "productCode": "XAUUSD",
    "bid": 2345.7,
    "ask": 2345.9,
    "lastPrice": 2345.8,
    "high24h": 2392.71,
    "low24h": 2298.88,
    "volume24h": 125680,
    "timestamp": "2024-01-15T10:30:00.000Z"
  }
}
```

#### GET /api/market/kline
获取K线数据

**参数：**
- `product`: 产品代码
- `period`: 周期 (1m, 5m, 15m, 1h, 4h, 1d)
- `limit`: 返回条数 (默认100)

### 交易类

#### POST /api/order/create
创建订单

**请求体：**
```json
{
  "productCode": "XAUUSD",
  "type": "MARKET",
  "direction": "BUY",
  "quantity": 1,
  "leverage": 10,
  "stopLoss": 2300,
  "takeProfit": 2400
}
```

**响应示例：**
```json
{
  "code": 0,
  "message": "订单已成交",
  "data": {
    "orderId": "uuid",
    "status": "FILLED",
    "filledPrice": 2345.8,
    "filledQuantity": 1,
    "marginUsed": 234.58,
    "fee": 1.17,
    "tradeId": "uuid"
  }
}
```

#### POST /api/order/cancel
取消订单

**请求体：**
```json
{
  "orderId": "uuid"
}
```

#### GET /api/order/list
获取订单列表

**参数：**
- `status` (可选): 订单状态过滤

#### GET /api/order/detail
获取订单详情

**参数：**
- `orderId`: 订单ID

### 持仓类

#### GET /api/position/list
获取持仓列表

**响应示例：**
```json
{
  "code": 0,
  "message": "success",
  "data": [
    {
      "positionId": "uuid",
      "productCode": "XAUUSD",
      "direction": "LONG",
      "openPrice": 2345.8,
      "quantity": 1,
      "leverage": 10,
      "marginUsed": 234.58,
      "liquidationPrice": 2111.22,
      "stopLoss": 2300,
      "takeProfit": 2400,
      "unrealizedPnl": 125.5,
      "realizedPnl": 0,
      "status": "OPEN",
      "openedAt": "2024-01-15T10:30:00.000Z"
    }
  ]
}
```

#### POST /api/position/close
平仓

**请求体：**
```json
{
  "positionId": "uuid"
}
```

#### POST /api/position/update-sl-tp
修改止盈止损

**请求体：**
```json
{
  "positionId": "uuid",
  "stopLoss": 2280,
  "takeProfit": 2420
}
```

### 风控类

#### GET /api/risk/preview
风险预览

**参数：**
- `productCode`: 产品代码
- `price`: 价格
- `quantity`: 数量
- `leverage`: 杠杆倍数
- `direction`: 方向 (LONG/SHORT)

**响应示例：**
```json
{
  "code": 0,
  "message": "success",
  "data": {
    "marginRequired": 234.58,
    "liquidationPrice": 2111.22,
    "maxLoss": 235.75
  }
}
```

#### GET /api/risk/liquidation-price
计算强平价

**参数：**
- `price`: 开仓价格
- `leverage`: 杠杆倍数
- `direction`: 方向 (LONG/SHORT)

#### GET /api/risk/liquidation-records
强平记录

## 订单生命周期

```
CREATED (创建)
    ↓
PENDING (待成交 - 限价单)
    ↓
FILLED (已成交) / CANCELED (已取消) / REJECTED (被拒绝)
    ↓
Position (生成持仓)
    ↓
CLOSED (平仓) / LIQUIDATED (强平)
```

## 风控规则

### 风险等级

- **SAFE (安全)**: 保证金使用率 < 50%
- **WARNING (关注)**: 保证金使用率 50% - 80%
- **DANGER (高风险)**: 保证金使用率 > 80%

### 风控动作

- **WARNING**: 系统提示，不限制交易
- **DANGER**: 
  - 禁止开新仓
  - 提示追加保证金
- **强平触发**: 
  - 市场价触及强平价
  - 自动执行市价平仓
  - 记录强平日志

### 强平计算

```
多单强平价 = 开仓价 × (1 - (1/杠杆) + 维持保证金率)
空单强平价 = 开仓价 × (1 + (1/杠杆) - 维持保证金率)

维持保证金率 = 0.5%
```

## 系统特性

1. **实时行情**: 每秒更新价格，模拟真实市场波动
2. **自动风控**: 每5秒检查一次账户风险，自动执行强平
3. **完整日志**: 所有成交、强平、资金变动都有记录
4. **数据一致性**: 资金变动使用事务处理，确保数据准确

## 演示账户

- **用户ID**: demo-user
- **初始资金**: ¥1,000,000
- **可用产品**: XAUUSD, XAGUSD, XPTUSD, XPDUSD, AU2406, AG2406
