# 贵金属交易平台 - 系统重构架构说明文档

## 文档信息

- **版本**: 1.0
- **日期**: 2026-02-28
- **重构阶段**: 第一阶段
- **目标**: 对核心交易链路进行稳定性修复,确保订单、持仓、资金三大模块具备生产级一致性

---

## 1. 重构背景

### 1.1 当前架构问题

#### 订单系统问题
1. **同步撮合阻塞**: 所有订单使用同步方式处理,导致高并发场景下响应延迟增加
2. **缺少状态机**: 订单状态转换不可控,可能出现非法状态
3. **无幂等性保护**: 重复请求可能导致订单重复执行
4. **缺少重试机制**: 订单处理失败后无法自动重试

#### 持仓系统问题
1. **无并发控制**: 平仓操作没有分布式锁保护,可能重复平仓
2. **事务边界不清**: 平仓失败时无法完整回滚
3. **盈亏计算不确定**: 依赖实时行情数据,导致盈亏计算结果不一致

#### 资金系统问题
1. **事务不完整**: 部分资金操作缺少事务保护
2. **无审计日志**: 缺少完整的资金变动追踪
3. **并发安全性差**: 账户余额缺少并发控制机制
4. **缺少冻结机制**: 无法在风控时冻结部分资金

### 1.2 重构目标

1. **订单系统**: 引入异步队列处理,实现订单状态机,确保幂等性
2. **持仓系统**: 增加分布式锁保护,实现事务化平仓,盈亏计算解耦
3. **资金系统**: 所有操作事务化,增加审计日志,实现冻结机制

---

## 2. 重构后架构设计

### 2.1 整体架构图

```
┌─────────────────────────────────────────────────────────────────┐
│                        客户端层                                 │
│                  (Web / Mobile / API)                          │
└────────────────────────────┬────────────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────────┐
│                      API 网关层                                 │
│              (Express + Rate Limiting + CORS)                   │
└────────────────────────────┬────────────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────────┐
│                    订单队列层 (BullMQ)                          │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐             │
│  │ orders:queue│  │delayed queue│  │failed queue │             │
│  └─────────────┘  └─────────────┘  └─────────────┘             │
└────────────────────────────┬────────────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────────┐
│                    订单处理层 (Workers)                         │
│  ┌─────────────────────────────────────────────────────────┐  │
│  │           订单状态机 (OrderStateMachine)                 │  │
│  │  CREATED → PROCESSING → FILLED/FAILED → CLOSED           │  │
│  └─────────────────────────────────────────────────────────┘  │
│  ┌─────────────────────────────────────────────────────────┐  │
│  │           撮合引擎 (Matching Engine)                     │  │
│  │  - 获取价格快照                                         │  │
│  │  - 执行撮合逻辑                                         │  │
│  │  - 创建交易记录                                         │  │
│  └─────────────────────────────────────────────────────────┘  │
└────────────────────────────┬────────────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────────┐
│                    业务服务层                                   │
│  ┌─────────────────────────────────────────────────────────┐  │
│  │         持仓管理服务 (PositionService)                  │  │
│  │  - 平仓处理器 (使用分布式锁)                            │  │
│  │  - 盈亏计算器 (使用价格快照)                            │  │
│  └─────────────────────────────────────────────────────────┘  │
│  ┌─────────────────────────────────────────────────────────┐  │
│  │         资金管理服务 (FinanceService)                   │  │
│  │  - 资金操作管理器 (事务化)                             │  │
│  │  - 审计日志服务                                        │  │
│  │  - 账户冻结/解冻                                       │  │
│  └─────────────────────────────────────────────────────────┘  │
└────────────────────────────┬────────────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────────┐
│                      数据存储层                                 │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐             │
│  │ PostgreSQL  │  │   Redis     │  │   RabbitMQ   │             │
│  │ (主数据库)  │  │ (缓存+队列)  │  │ (消息队列)   │             │
│  └─────────────┘  └─────────────┘  └─────────────┘             │
└─────────────────────────────────────────────────────────────────┘
```

### 2.2 核心模块设计

#### 2.2.1 订单队列模块

**队列结构**:
- `orders:queue` - 主订单队列
- `orders:delayed` - 延迟订单队列
- `orders:failed` - 失败订单队列

**状态机设计**:
```
CREATED (订单已创建)
    ↓
PROCESSING (订单处理中)
    ↓
    ├─→ FILLED (订单已成交)
    │       ↓
    │   CLOSED (订单已关闭)
    │
    └─→ FAILED (订单失败)
```

**幂等性实现**:
- 使用订单号 (order_number) 作为唯一标识
- Redis 存储已处理订单ID集合 (`processed:{order_number}`)
- 缓存处理结果 (`result:{order_number}`)

#### 2.2.2 持仓管理模块

**分布式锁设计**:
- 锁命名规则: `lock:position:{position_id}:{user_id}`
- 锁超时时间: 30秒
- 重试机制: 3次,每次间隔100ms
- 使用 Redlock 算法保证分布式一致性

**平仓事务设计**:
```
1. 获取分布式锁
2. 在事务内使用 FOR UPDATE 锁定持仓记录
3. 检查持仓状态,防止重复平仓
4. 使用价格快照计算盈亏
5. 更新持仓状态为 CLOSED
6. 调用资金服务更新余额和释放保证金
7. 记录审计日志
8. 释放分布式锁
```

**盈亏计算解耦**:
- 创建价格快照表 (price_snapshots)
- 定时任务每分钟创建价格快照
- 平仓时使用快照价格计算盈亏,确保确定性

#### 2.2.3 资金管理模块

**事务化操作**:
```
1. 获取分布式锁
2. 在事务内使用 FOR UPDATE 锁定账户记录
3. 使用乐观锁(version 字段)防止并发修改
4. 更新账户余额和冻结金额
5. 调用审计日志服务记录操作
6. 释放分布式锁
```

**账户冻结机制**:
- 新增 `frozen_amount` 字段
- 冻结时减少 `available_balance`,增加 `frozen_amount`
- 解冻时增加 `available_balance`,减少 `frozen_amount`
- 所有冻结/解冻操作都有审计日志

**审计日志设计**:
- 记录所有资金变动操作
- 包含操作类型、金额、操作前后余额、关联订单/持仓
- 审计日志独立存储,不可篡改

---

## 3. 数据库设计变更

### 3.1 新增表

#### 价格快照表 (price_snapshots)
```sql
CREATE TABLE price_snapshots (
  id BIGSERIAL PRIMARY KEY,
  product_id INTEGER NOT NULL REFERENCES products(id),
  price DECIMAL(20,8) NOT NULL,
  snapshot_time TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  source VARCHAR(50),
  metadata JSONB,
  UNIQUE(product_id, snapshot_time)
);
```

#### 审计日志表 (audit_logs)
```sql
CREATE TABLE audit_logs (
  id BIGSERIAL PRIMARY KEY,
  user_id BIGINT NOT NULL REFERENCES users(id),
  operation_type VARCHAR(50) NOT NULL,
  amount DECIMAL(20,8) NOT NULL,
  before_balance DECIMAL(20,8) NOT NULL,
  after_balance DECIMAL(20,8) NOT NULL,
  related_order_id BIGINT REFERENCES orders(id),
  related_position_id BIGINT REFERENCES positions(id),
  description TEXT,
  metadata JSONB,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  created_by VARCHAR(50) DEFAULT 'SYSTEM'
);
```

#### 订单处理日志表 (order_processing_logs)
```sql
CREATE TABLE order_processing_logs (
  id BIGSERIAL PRIMARY KEY,
  order_id BIGINT NOT NULL REFERENCES orders(id),
  job_id VARCHAR(64),
  state_from VARCHAR(20),
  state_to VARCHAR(20),
  processing_time INTEGER,
  error_message TEXT,
  metadata JSONB,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);
```

### 3.2 表结构变更

#### 订单表 (orders) 变更
- 新增 `state` 字段: 订单状态机状态
- 新增 `state_history` 字段: 状态转换历史(JSONB)
- 新增 `idempotency_key` 字段: 幂等性键(唯一)

#### 持仓表 (positions) 变更
- 新增 `snapshot_id` 字段: 引用价格快照

#### 账户表 (accounts) 变更
- 新增 `frozen_amount` 字段: 冻结金额
- 新增 `version` 字段: 乐观锁版本号

---

## 4. 关键技术实现

### 4.1 分布式锁实现

使用 Redlock 算法实现分布式锁:

```typescript
// 获取锁
async function acquireLock(lockKey: string, ttl: number): Promise<boolean> {
  const lockValue = `${Date.now()}-${Math.random()}`;

  const result = await redis.set(lockKey, lockValue, 'PX', ttl, 'NX');

  return result === 'OK';
}

// 释放锁(Lua脚本保证原子性)
async function releaseLock(lockKey: string, lockValue: string): Promise<boolean> {
  const script = `
    if redis.call("get", KEYS[1]) == ARGV[1] then
      return redis.call("del", KEYS[1])
    else
      return 0
    end
  `;

  const result = await redis.eval(script, 1, lockKey, lockValue);

  return result === 1;
}
```

### 4.2 订单幂等性实现

```typescript
// 检查幂等性
async function checkIdempotency(orderNumber: string): Promise<any> {
  const isProcessed = await redis.exists(`processed:${orderNumber}`);

  if (isProcessed) {
    const result = await redis.get(`result:${orderNumber}`);
    return JSON.parse(result || '{}');
  }

  return null;
}

// 标记为已处理
async function markProcessed(orderNumber: string, result: any): Promise<void> {
  await redis.set(`processed:${orderNumber}`, '1', 'EX', 86400); // 24小时
  await redis.set(`result:${orderNumber}`, JSON.stringify(result), 'EX', 86400);
}
```

### 4.3 盈亏计算解耦

```typescript
// 使用价格快照计算盈亏
async function calculatePnlWithSnapshot(
  position: Position,
  snapshotTime: Date
): Promise<number> {
  // 获取价格快照
  const snapshot = await query(`
    SELECT price FROM price_snapshots
    WHERE product_id = $1 AND snapshot_time <= $2
    ORDER BY snapshot_time DESC LIMIT 1
  `, [position.productId, snapshotTime]);

  const currentPrice = snapshot.rows[0].price;

  // 使用快照价格计算盈亏
  const pnl = Calculator.calculatePnl(
    position.direction,
    position.entryPrice,
    currentPrice,
    position.lotSize,
    position.leverage
  );

  return pnl;
}
```

---

## 5. API 兼容性保证

### 5.1 保持接口不变

所有现有 API 接口保持不变,内部实现切换到异步处理:

```typescript
// 原接口(保持不变)
router.post('/order/create', authenticateUser, async (req, res) => {
  const userId = req.userId;
  const orderData = req.body;

  // 提交到队列,立即返回订单ID
  const result = await orderQueueProducer.addOrder({
    userId,
    ...orderData,
    orderNumber: generateOrderNumber(),
  });

  res.json({
    code: 0,
    message: 'Order created successfully',
    data: {
      orderId: result.orderId,
      status: 'processing',
    },
  });
});
```

### 5.2 新增查询接口

```typescript
// 新增: 查询订单状态
router.get('/order/status/:orderId', authenticateUser, async (req, res) => {
  const orderId = req.params.orderId;

  const status = await orderQueueProducer.getOrderStatus(orderId);

  res.json({
    code: 0,
    message: 'success',
    data: status,
  });
});
```

---

## 6. 性能优化措施

### 6.1 队列性能优化
- 调整队列并发处理参数 (concurrency)
- 优化队列任务超时时间
- 优化重试策略和退避算法
- 添加队列性能监控指标

### 6.2 数据库优化
- 为新增字段创建索引
- 分析慢查询并优化
- 添加查询性能监控
- 优化事务隔离级别

### 6.3 缓存优化
- 使用 Redis 缓存价格快照
- 缓存用户账户信息
- 缓存订单状态信息

---

## 7. 监控和告警

### 7.1 队列监控
- 队列堆积监控
- 订单处理失败率监控
- 订单处理延迟监控

### 7.2 分布式锁监控
- 锁等待时间监控
- 锁超时次数监控
- 锁获取失败率监控

### 7.3 资金操作监控
- 资金操作成功率监控
- 资金操作失败率监控
- 异常资金变动告警

---

## 8. 部署和运维

### 8.1 部署步骤

1. **安装依赖**:
   ```bash
   npm install bullmq ioredis
   ```

2. **数据库迁移**:
   ```bash
   psql -U postgres -d precious_metals_trading -f database/migrate_refactor.sql
   ```

3. **配置环境变量**:
   ```bash
   REDIS_HOST=localhost
   REDIS_PORT=6379
   ```

4. **启动服务**:
   ```bash
   npm run dev
   ```

### 8.2 回滚方案

如果重构后出现问题,可以通过以下步骤回滚:

1. 停止队列 Worker
2. 回滚代码到重构前版本
3. 恢复数据库(如有必要)
4. 重启服务

---

## 9. 总结

本次重构通过引入异步队列、分布式锁、事务化处理和审计日志等技术手段,解决了订单、持仓、资金三大模块的稳定性问题,为系统提供了生产级的一致性保障。

重构后的架构具备以下优势:

1. **高可用性**: 异步处理避免阻塞,系统吞吐量显著提升
2. **数据一致性**: 分布式锁和事务化操作确保数据一致性
3. **可追溯性**: 审计日志和订单处理日志提供完整的操作追踪
4. **可维护性**: 状态机和模块化设计提高代码可维护性
5. **可扩展性**: 队列架构支持横向扩展

---

**文档结束**
