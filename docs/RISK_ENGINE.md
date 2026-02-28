# 风险控制引擎 (Risk Engine)

## 概述

风险控制引擎是贵金属交易平台的核心风控模块,提供统一的风险检查接口,确保所有交易操作都经过严格的风控验证。

## 功能特性

### 1. 统一风控检查

所有下单、加仓、平仓、强平操作必须统一走 `riskEngine.validate()` 进行风控检查。

### 2. 风控检查项目

- ✅ **账户权益实时计算**: 余额 + 浮盈亏
- ✅ **保证金占用比例**: 实时计算保证金使用率
- ✅ **杠杆上限校验**: 防止超出最大杠杆
- ✅ **单用户最大持仓限制**: 限制用户持仓数量
- ✅ **单品种最大风险敞口**: 限制单个品种的风险
- ✅ **总平台风险敞口统计**: 监控平台整体风险
- ✅ **高频交易限流**: 每秒下单次数限制
- ✅ **冷却时间机制**: 防止刷单攻击

### 3. 强平调度器

- ✅ **自动强平检测**: 定期检查触发强平的持仓
- ✅ **异步强平执行**: 使用队列异步执行强平
- ✅ **脱离用户操作**: 强平完全由系统调度器执行
- ✅ **重试机制**: 强平失败自动重试

## 架构设计

```
┌─────────────────────────────────────────────────────────────┐
│                     API 层                                  │
│              (下单/加仓/平仓/强平)                         │
└────────────────────────────┬────────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────┐
│                 风险控制引擎 (RiskEngine)                   │
│  ┌───────────────────────────────────────────────────────┐  │
│  │  validate() - 统一风控检查入口                       │  │
│  └───────────────────────────────────────────────────────┘  │
│  ┌───────────────────────────────────────────────────────┐  │
│  │  账户权益实时计算                                     │  │
│  │  保证金占用比例                                       │  │
│  │  杠杆上限校验                                         │  │
│  │  持仓限制检查                                         │  │
│  │  风险敞口检查                                         │  │
│  │  高频限流检查                                         │  │
│  │  冷却时间检查                                         │  │
│  └───────────────────────────────────────────────────────┘  │
└────────────────────────────┬────────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────┐
│                强平调度器 (LiquidationScheduler)              │
│  ┌───────────────────────────────────────────────────────┐  │
│  │  checkAndQueueLiquidations() - 检查并排队强平        │  │
│  │  processLiquidation() - 处理强平任务                  │  │
│  └───────────────────────────────────────────────────────┘  │
└────────────────────────────┬────────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────┐
│                     BullMQ 队列                            │
│              (orders:queue:liquidation)                    │
└─────────────────────────────────────────────────────────────┘
```

## 使用示例

### 1. 风控检查

```typescript
import { riskEngine } from './services/RiskEngine';

// 开仓风控检查
const result = await riskEngine.validate({
  userId: 1,
  productCode: 'XAUUSD',
  operation: 'OPEN',
  quantity: 10,
  leverage: 10,
  price: 2345.67,
  direction: 'LONG',
});

if (result.passed) {
  console.log('风控检查通过', result.data);
} else {
  console.error('风控检查失败', result.message, result.errorCode);
}
```

### 2. 获取账户实时权益

```typescript
const equity = await riskEngine.getAccountEquity(userId);
console.log('账户实时权益:', equity);
```

### 3. 获取平台风险统计

```typescript
const stats = await riskEngine.getPlatformRiskStats();
console.log('平台风险统计:', stats);
// {
//   totalUsers: 100,
//   totalPositions: 500,
//   totalExposure: 5000000,
//   avgMarginUsage: 0.35,
//   dangerAccounts: 5
// }
```

### 4. 更新风控配置

```typescript
riskEngine.updateConfig({
  MAX_LEVERAGE: 50,
  MAX_POSITION_SIZE: 50,
  ORDER_RATE_LIMIT: 10,
});
```

### 5. 启动强平调度器

```typescript
import { liquidationScheduler } from './services/LiquidationScheduler';

// 启动调度器,每5秒检查一次
await liquidationScheduler.start(5000);
```

### 6. 手动添加强平任务

```typescript
const jobId = await liquidationScheduler.addLiquidationJob({
  userId: 1,
  positionId: 123,
  productCode: 'XAUUSD',
  liquidationPrice: 2300,
  reason: '手动强平',
});
```

## API 接口

### 获取风控配置

```
GET /risk/engine/config
```

**响应示例**:
```json
{
  "code": 0,
  "message": "success",
  "data": {
    "MAX_LEVERAGE": 100,
    "MAX_POSITION_SIZE": 100,
    "MAX_POSITION_PER_USER": 10,
    "MAX_POSITION_PER_PRODUCT": 1000,
    "MAX_PLATFORM_EXPOSURE": 10000000,
    "MIN_MARGIN_RATIO": 0.005,
    "WARNING_MARGIN_RATIO": 0.5,
    "DANGER_MARGIN_RATIO": 0.8,
    "ORDER_RATE_LIMIT": 5,
    "ORDER_COOLDOWN": 1000
  },
  "timestamp": 1709140800000
}
```

### 执行风控检查

```
POST /risk/validate
Content-Type: application/json

{
  "userId": 1,
  "productCode": "XAUUSD",
  "operation": "OPEN",
  "quantity": 10,
  "leverage": 10,
  "price": 2345.67,
  "direction": "LONG"
}
```

**响应示例**:
```json
{
  "code": 0,
  "message": "风控检查通过",
  "data": {
    "passed": true,
    "riskLevel": "SAFE",
    "message": "风控检查通过",
    "data": {
      "equity": 100000,
      "availableBalance": 50000,
      "marginUsage": 0.5
    }
  },
  "timestamp": 1709140800000
}
```

### 获取账户实时权益

```
GET /risk/account/:userId/equity
```

### 获取平台风险统计

```
GET /risk/platform/stats
```

### 启动强平调度器

```
POST /risk/liquidation/start
Content-Type: application/json

{
  "interval": 5000
}
```

### 手动添加强平任务

```
POST /risk/liquidation/add
Content-Type: application/json

{
  "userId": 1,
  "positionId": 123,
  "productCode": "XAUUSD",
  "liquidationPrice": 2300,
  "reason": "手动强平"
}
```

## 风控规则

### 1. 杠杆上限

- 默认最大杠杆: 100x
- 可通过配置动态调整

### 2. 持仓限制

- 单笔最大持仓: 100 手
- 单用户最大持仓数: 10 个
- 单品种最大风险敞口: 1000 手
- 平台最大总敞口: 10,000,000

### 3. 保证金比例

- 最小维持保证金率: 0.5%
- 警告保证金使用率: 50%
- 危险保证金使用率: 80%

### 4. 限流和冷却

- 每秒最大下单次数: 5 次
- 下单冷却时间: 1000 ms

### 5. 风险等级

- **SAFE**: 保证金使用率 < 50%
- **WARNING**: 50% ≤ 保证金使用率 < 80%
- **DANGER**: 保证金使用率 ≥ 80%
- **CRITICAL**: 触发强平

## 配置说明

### RiskConfig

| 参数 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| MAX_LEVERAGE | number | 100 | 最大杠杆倍数 |
| MAX_POSITION_SIZE | number | 100 | 单笔最大持仓 |
| MAX_POSITION_PER_USER | number | 10 | 单用户最大持仓数 |
| MAX_POSITION_PER_PRODUCT | number | 1000 | 单品种最大风险敞口 |
| MAX_PLATFORM_EXPOSURE | number | 10000000 | 平台最大总敞口 |
| MIN_MARGIN_RATIO | number | 0.005 | 最小维持保证金率 |
| WARNING_MARGIN_RATIO | number | 0.5 | 警告保证金使用率 |
| DANGER_MARGIN_RATIO | number | 0.8 | 危险保证金使用率 |
| ORDER_RATE_LIMIT | number | 5 | 每秒最大下单次数 |
| ORDER_COOLDOWN | number | 1000 | 下单冷却时间(ms) |

## 性能指标

- 风控检查响应时间: < 10ms
- 账户权益计算: < 20ms
- 平台风险统计: < 100ms
- 强平调度器检查间隔: 5 秒 (可配置)

## 监控指标

- 风控检查通过率
- 风控检查失败原因分布
- 高频交易拦截次数
- 冷却时间触发次数
- 强平任务排队数
- 强平任务执行成功率
- 平台风险敞口趋势
- 高风险账户数量

## 部署指南

### 1. 集成到主程序

```typescript
// src/index.ts
import { createRiskRouter } from './routes/risk';
import { liquidationScheduler } from './services/LiquidationScheduler';

// 添加风险路由
app.use('/risk', createRiskRouter());

// 启动强平调度器
await liquidationScheduler.start(5000);
```

### 2. 在订单创建时使用风控检查

```typescript
// src/routes/api.ts
import { riskEngine } from '../services/RiskEngine';

router.post('/order/create', async (req, res) => {
  const { userId, productCode, type, direction, quantity, leverage, price } = req.body;

  // 执行风控检查
  const riskResult = await riskEngine.validate({
    userId,
    productCode,
    operation: 'OPEN',
    quantity,
    leverage,
    price,
    direction,
  });

  if (!riskResult.passed) {
    return res.status(400).json({
      code: 400,
      message: riskResult.message,
      data: null,
      timestamp: Date.now(),
    });
  }

  // 继续执行订单创建逻辑...
});
```

### 3. 优雅关闭

```typescript
process.on('SIGTERM', async () => {
  console.log('正在关闭服务...');

  // 停止强平调度器
  await liquidationScheduler.stop();

  process.exit(0);
});
```

## 测试

运行示例代码:

```bash
npx tsx src/examples/risk-engine.example.ts
```

## 注意事项

1. **风控检查是强制性的**: 所有交易操作必须经过风控检查,不能绕过
2. **强平调度器独立运行**: 强平调度器应独立启动,不受用户操作影响
3. **配置动态调整**: 风控参数应根据市场情况动态调整
4. **监控告警**: 密切关注平台风险指标,及时调整风控策略
5. **数据一致性**: 风控检查依赖数据库和 Redis,确保数据一致性

## 后续优化

- [ ] 支持更复杂的风控规则配置
- [ ] 实现风控规则的热更新
- [ ] 添加风控检查的性能监控
- [ ] 优化高频限流算法
- [ ] 实现智能风险预警
- [ ] 支持多级风控策略
- [ ] 添加风控审计日志

## 文档索引

- [风险引擎实现](../server/src/services/RiskEngine.ts)
- [强平调度器实现](../server/src/services/LiquidationScheduler.ts)
- [API 路由定义](../server/src/routes/risk.ts)
- [使用示例](../server/src/examples/risk-engine.example.ts)
