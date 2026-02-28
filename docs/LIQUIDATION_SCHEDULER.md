# 自动强平调度系统 (Auto Liquidation Scheduler)

## 概述

自动强平调度系统是贵金属交易平台的核心风控模块,负责实时监控所有持仓账户的保证金率,自动检测触发强平的持仓,并异步执行强平操作。

## 功能特性

### 核心功能

✅ **高频扫描** - 每 500ms 扫描一次所有持仓账户保证金率  
✅ **风险账户标记** - 自动标记风险账户到 Redis  
✅ **强平队列** - 自动将触发强平的持仓加入队列  
✅ **分布式锁** - 使用分布式锁保护强平操作  
✅ **原子操作** - 原子扣减持仓,同步更新账户余额  
✅ **强平日志** - 完整记录所有强平操作  

### 风险等级

- **SAFE**: 保证金使用率 < 50%
- **WARNING**: 50% ≤ 保证金使用率 < 80%
- **DANGER**: 80% ≤ 保证金使用率 < 100%
- **CRITICAL**: 保证金使用率 ≥ 100% 或权益 ≤ 0

## 架构设计

```
┌─────────────────────────────────────────────────────────────┐
│              强平调度器 (LiquidationScheduler)               │
│  ┌─────────────────────────────────────────────────────┐   │
│  │  scanLoop() - 主扫描循环                           │   │
│  │    ↓                                               │   │
│  │  scanAccountsMargin() - 扫描账户保证金率            │   │
│  │    ↓                                               │   │
│  │  markRiskAccounts() - 标记风险账户                 │   │
│  │    ↓                                               │   │
│  │  queueLiquidations() - 加入强平队列                 │   │
│  └─────────────────────────────────────────────────────┘   │
└────────────────────────────┬────────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────┐
│                  BullMQ 强平队列                            │
│           (orders:queue:liquidation)                       │
└────────────────────────────┬────────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────┐
│              强平 Worker (10并发)                         │
│  ┌─────────────────────────────────────────────────────┐   │
│  │  processLiquidation() - 处理强平任务               │   │
│  │    ↓                                               │   │
│  │  acquirePositionLock() - 获取分布式锁             │   │
│  │    ↓                                               │   │
│  │  executeLiquidationInternal() - 执行强平           │   │
│  │    ↓                                               │   │
│  │  TRANSACTION START                                   │   │
│  │    ↓                                               │   │
│  │  1. FOR UPDATE 锁定持仓                            │   │
│  │  2. 更新持仓状态为强平                            │   │
│  │  3. 计算未实现盈亏                                │   │
│  │  4. 更新账户余额                                   │   │
│  │  5. 释放保证金                                     │   │
│  │  6. 记录审计日志                                  │   │
│  │  7. 记录强平日志                                  │   │
│  │    ↓                                               │   │
│  │  TRANSACTION COMMIT                                 │   │
│  │    ↓                                               │   │
│  │  releasePositionLock() - 释放分布式锁             │   │
│  └─────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
```

## 扫描流程

```
启动调度器
    ↓
每 500ms 执行一次扫描循环
    ↓
┌─────────────────────────────────┐
│  1. 扫描所有账户              │
│     - 获取所有账户            │
│     - 获取账户所有持仓        │
│     - 获取实时行情            │
└─────────────────────────────────┘
    ↓
┌─────────────────────────────────┐
│  2. 计算账户权益和保证金率    │
│     - 计算未实现盈亏          │
│     - 计算账户权益            │
│     - 计算保证金使用率        │
│     - 确定风险等级            │
└─────────────────────────────────┘
    ↓
┌─────────────────────────────────┐
│  3. 标记风险账户              │
│     - CRITICAL/DANGER账户存入Redis │
│     - 设置60秒过期            │
└─────────────────────────────────┘
    ↓
┌─────────────────────────────────┐
│  4. 检查是否需要强平          │
│     - 检查持仓强平价格        │
│     - 判断是否触发            │
└─────────────────────────────────┘
    ↓
┌─────────────────────────────────┐
│  5. 加入强平队列              │
│     - 触发强平的持仓加入队列 │
│     - 记录强平原因            │
└─────────────────────────────────┘
    ↓
继续下一轮扫描
```

## 强平流程

```
强平任务从队列中取出
    ↓
获取分布式锁 (lock:position:{id}:{user})
    ↓
检查持仓状态
    ↓
┌─────────────────────────────────┐
│  TRANSACTION START            │
│    ↓                           │
│  1. FOR UPDATE 锁定持仓       │
│  2. 验证持仓状态 (status=1)   │
│  3. 计算未实现盈亏           │
│  4. 更新持仓状态为CLOSED(2)   │
│     - current_price           │
│     - unrealized_pl           │
│     - realized_pl             │
│     - closed_at              │
│  5. 更新账户余额             │
│     - balance += unrealized_pl │
│     - available_balance += unrealized_pl + margin │
│     - frozen_amount -= margin │
│     - realized_pl += unrealized_pl │
│  6. 记录审计日志             │
│     - operation: LIQUIDATION  │
│     - amount: unrealized_pl    │
│     - positionId             │
│     - reason: 强平原因        │
│  7. 记录强平日志             │
│     - state_from: OPEN        │
│     - state_to: LIQUIDATED    │
│     - metadata: 详细信息      │
│    ↓                           │
│  TRANSACTION COMMIT           │
└─────────────────────────────────┘
    ↓
释放分布式锁
    ↓
强平完成
```

## 使用示例

### 1. 启动强平调度器

```typescript
import { liquidationScheduler } from './services/LiquidationSchedulerV2';

// 启动调度器(默认500ms扫描间隔)
await liquidationScheduler.start();
```

### 2. 手动触发强平

```typescript
await liquidationScheduler.forceLiquidate(
  1,          // userId
  123,        // positionId
  'XAUUSD',   // productCode
  2300,       // currentPrice
  '手动强平'   // reason
);
```

### 3. 获取队列统计

```typescript
const stats = await liquidationScheduler.getQueueStats();
console.log('队列统计:', stats);
// {
//   waiting: 5,
//   active: 2,
//   completed: 100,
//   failed: 3,
//   delayed: 0
// }
```

### 4. 获取风险账户统计

```typescript
const stats = await liquidationScheduler.getRiskAccountStats();
console.log('风险账户统计:', stats);
// {
//   totalAccounts: 100,
//   safeAccounts: 80,
//   warningAccounts: 15,
//   dangerAccounts: 3,
//   criticalAccounts: 2
// }
```

### 5. 停止调度器

```typescript
await liquidationScheduler.stop();
```

## API 接口

### 获取队列统计

```http
GET /liquidation/queue/stats
```

**响应示例**:
```json
{
  "code": 0,
  "message": "success",
  "data": {
    "waiting": 5,
    "active": 2,
    "completed": 100,
    "failed": 3,
    "delayed": 0
  },
  "timestamp": 1709140800000
}
```

### 获取风险账户统计

```http
GET /liquidation/risk/stats
```

**响应示例**:
```json
{
  "code": 0,
  "message": "success",
  "data": {
    "totalAccounts": 100,
    "safeAccounts": 80,
    "warningAccounts": 15,
    "dangerAccounts": 3,
    "criticalAccounts": 2
  },
  "timestamp": 1709140800000
}
```

### 启动调度器

```http
POST /liquidation/start
Content-Type: application/json

{
  "interval": 500
}
```

**响应示例**:
```json
{
  "code": 0,
  "message": "强平调度器已启动",
  "data": {
    "interval": 500
  },
  "timestamp": 1709140800000
}
```

### 停止调度器

```http
POST /liquidation/stop
```

### 手动触发强平

```http
POST /liquidation/force
Content-Type: application/json

{
  "userId": 1,
  "positionId": 123,
  "productCode": "XAUUSD",
  "currentPrice": 2300,
  "reason": "手动强平"
}
```

### 获取调度器状态

```http
GET /liquidation/status
```

**响应示例**:
```json
{
  "code": 0,
  "message": "success",
  "data": {
    "queue": {
      "waiting": 5,
      "active": 2,
      "completed": 100,
      "failed": 3,
      "delayed": 0
    },
    "risk": {
      "totalAccounts": 100,
      "safeAccounts": 80,
      "warningAccounts": 15,
      "dangerAccounts": 3,
      "criticalAccounts": 2
    }
  },
  "timestamp": 1709140800000
}
```

## 配置说明

### 扫描间隔

- 默认: 500ms
- 范围: 100ms - 10000ms
- 建议: 500ms - 1000ms

### Worker 并发数

- 默认: 10
- 范围: 5 - 20
- 建议: 根据服务器性能调整

### 队列限流

- 每秒最大处理数: 50
- 用于防止系统过载

## 性能指标

| 指标 | 目标值 | 说明 |
|------|--------|------|
| 扫描间隔 | 500ms | 每500ms扫描一次 |
| 单次扫描耗时 | < 100ms | 扫描所有账户的时间 |
| 强平任务处理时间 | < 500ms | 单个强平任务的处理时间 |
| 分布式锁获取时间 | < 10ms | 获取分布式锁的时间 |
| 事务执行时间 | < 100ms | 强平事务的执行时间 |

## 监控指标

### 扫描监控

- 扫描循环执行次数
- 每次扫描耗时
- 发现的风险账户数
- 加入队列的强平任务数

### 队列监控

- 等待处理的任务数
- 正在处理的任务数
- 已完成的任务数
- 失败的任务数
- 延迟的任务数

### 强平监控

- 强平成功率
- 强平失败率
- 平均强平耗时
- 强平原因分布

### 风险账户监控

- 总账户数
- 安全账户数
- 警告账户数
- 危险账户数
- 严重账户数

## 分布式锁

### 锁命名规则

```
lock:position:{positionId}:{userId}
```

### 锁配置

- 超时时间: 30秒
- 重试次数: 3次
- 重试延迟: 100ms

### 锁使用场景

- 强平操作前获取锁
- 操作完成后释放锁
- 防止同一持仓被同时强平

## 强平日志

### 审计日志

记录到 `audit_logs` 表:

```sql
INSERT INTO audit_logs (
  user_id, operation_type, amount, before_balance, after_balance,
  related_position_id, description, created_by
) VALUES (
  ?, 'LIQUIDATION', ?, ?, ?, ?, ?, 'SYSTEM'
)
```

### 订单处理日志

记录到 `order_processing_logs` 表:

```sql
INSERT INTO order_processing_logs (
  order_id, state_from, state_to, processing_time, metadata
) VALUES (
  NULL, 'OPEN', 'LIQUIDATED', ?, ?
)
```

### 元数据包含

```json
{
  "positionId": 123,
  "liquidationPrice": 2300,
  "unrealizedPnl": -5000,
  "marginReleased": 10000,
  "reason": "保证金不足触发强平"
}
```

## 部署指南

### 1. 集成到主程序

```typescript
// src/index.ts
import { createLiquidationRouter } from './routes/liquidation';
import { liquidationScheduler } from './services/LiquidationSchedulerV2';

// 添加强平路由
app.use('/liquidation', createLiquidationRouter());

// 启动强平调度器
await liquidationScheduler.start();

// 优雅关闭
process.on('SIGTERM', async () => {
  console.log('正在关闭服务...');

  await liquidationScheduler.stop();

  process.exit(0);
});
```

### 2. 配置环境变量

```bash
# 强平调度器配置
LIQUIDATION_SCAN_INTERVAL=500
LIQUIDATION_WORKER_CONCURRENCY=10
LIQUIDATION_QUEUE_LIMIT=50
```

### 3. 监控告警

建议监控以下指标:

- 强平队列堆积数 > 10
- 严重账户数 > 5
- 强平失败率 > 5%
- 扫描耗时 > 200ms

## 注意事项

1. **扫描间隔**: 扫描间隔不宜过短,避免系统负载过高
2. **并发控制**: Worker 并发数应合理设置,避免数据库压力过大
3. **分布式锁**: 确保分布式锁正确释放,避免死锁
4. **事务处理**: 强平必须在事务中完成,确保数据一致性
5. **日志记录**: 完整记录强平日志,便于问题排查
6. **监控告警**: 密切监控强平指标,及时发现异常

## 后续优化

- [ ] 支持动态调整扫描间隔
- [ ] 实现智能强平策略(按风险等级分批强平)
- [ ] 优化扫描性能(增量扫描)
- [ ] 添加强平预警功能
- [ ] 实现强平复盘分析
- [ ] 支持多级强平(部分强平)

## 文档索引

- [强平调度器实现](../server/src/services/LiquidationSchedulerV2.ts)
- [API 路由定义](../server/src/routes/liquidation.ts)
- [使用示例](../server/src/examples/liquidation-scheduler.example.ts)
