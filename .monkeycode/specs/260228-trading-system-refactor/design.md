# 交易系统重构 - 第一阶段技术设计

## 1. 架构概述

### 1.1 当前架构问题分析

**订单系统问题**:
- 同步撮合导致订单处理链路阻塞
- 缺少订单状态机,状态转换不可控
- 无幂等性保护,可能重复执行订单

**持仓系统问题**:
- 平仓操作无并发控制,可能导致重复平仓
- 盈亏计算依赖实时行情,不确定性高
- 事务边界不清晰,回滚不完整

**资金系统问题**:
- 部分资金操作缺少事务保护
- 缺少完整的审计日志
- 账户余额缺少并发控制机制

### 1.2 目标架构

采用 **异步队列 + 分布式锁 + 事务化处理** 的架构模式:

```
┌─────────────┐
│   客户端     │
└──────┬──────┘
       │ HTTP/WebSocket
       ▼
┌─────────────────────────────────────────────┐
│              API 层 (Express)                │
│  ┌─────────────────────────────────────────┐ │
│  │  订单控制器                              │ │
│  │  - 接收下单请求                         │ │
│  │  - 基础参数验证                         │ │
│  │  - 提交到 BullMQ 队列                   │ │
│  └─────────────────────────────────────────┘ │
└─────────────────────┬───────────────────────┘
                      │
                      ▼
            ┌──────────────────┐
            │   BullMQ 队列     │
            │  (Redis + Queue)  │
            └────────┬─────────┘
                     │
                     ▼
    ┌──────────────────────────────────────────────┐
    │           订单处理器 (Worker)                │
    │  ┌────────────────────────────────────────┐ │
    │  │  状态机管理                             │ │
    │  │  CREATED → PROCESSING → FILLED/FAILED │ │
    │  └────────────────────────────────────────┘ │
    │  ┌────────────────────────────────────────┐ │
    │  │  撮合引擎                               │ │
    │  │  - 获取市场快照                         │ │
    │  │  - 执行撮合逻辑                         │ │
    │  │  - 创建交易记录                         │ │
    │  └────────────────────────────────────────┘ │
    └─────────────────────┬──────────────────────┘
                          │
                          ▼
    ┌──────────────────────────────────────────────┐
    │          持仓管理服务                         │
    │  ┌────────────────────────────────────────┐ │
    │  │  平仓处理器                             │ │
    │  │  - Redis 分布式锁                     │ │
    │  │  - 状态检查                           │ │
    │  │  - 事务化平仓                         │ │
    │  └────────────────────────────────────────┘ │
    │  ┌────────────────────────────────────────┐ │
    │  │  盈亏计算器                           │ │
    │  │  - 使用价格快照                       │ │
    │  │  - 确定性计算                         │ │
    │  └────────────────────────────────────────┘ │
    └─────────────────────┬──────────────────────┘
                          │
                          ▼
    ┌──────────────────────────────────────────────┐
    │          资金管理服务                         │
    │  ┌────────────────────────────────────────┐ │
    │  │  资金操作管理器                         │ │
    │  │  - 数据库事务                         │ │
    │  │  - 并发控制锁                         │ │
    │  │  - 余额更新                           │ │
    │  └────────────────────────────────────────┘ │
    │  ┌────────────────────────────────────────┐ │
    │  │  审计日志服务                          │ │
    │  │  - 记录所有资金变动                   │ │
    │  │  - 不可篡改存储                       │ │
    │  └────────────────────────────────────────┘ │
    └─────────────────────┬──────────────────────┘
                          │
                          ▼
    ┌──────────────────────────────────────────────┐
    │         PostgreSQL 数据库                      │
    │  ┌────────────────────────────────────────┐ │
    │  │  订单表 (orders)                       │ │
    │  │  持仓表 (positions)                     │ │
    │  │  账户表 (accounts)                     │ │
    │  │  交易表 (trades)                       │ │
    │  │  审计日志表 (audit_logs)               │ │
    │  └────────────────────────────────────────┘ │
    └──────────────────────────────────────────────┘
```

## 2. 模块设计

### 2.1 订单处理队列模块

#### 2.1.1 BullMQ 队列配置

**队列命名**:
- `orders:queue` - 主订单队列
- `orders:delayed` - 延迟订单队列
- `orders:failed` - 失败订单队列

**队列配置**:
```typescript
{
  connection: {
    host: process.env.REDIS_HOST || 'localhost',
    port: parseInt(process.env.REDIS_PORT || '6379'),
  },
  defaultJobOptions: {
    attempts: 3,
    backoff: {
      type: 'exponential',
      delay: 1000,
    },
    removeOnComplete: 1000,
    removeOnFail: 5000,
  },
}
```

#### 2.1.2 订单状态机设计

**状态定义**:
```typescript
enum OrderState {
  CREATED = 'created',       // 订单已创建,等待处理
  PROCESSING = 'processing', // 订单处理中
  FILLED = 'filled',         // 订单已成交
  CLOSED = 'closed',         // 订单已关闭(取消/部分成交关闭)
  FAILED = 'failed',         // 订单失败
}
```

**状态转换规则**:
```
CREATED → PROCESSING → FILLED → CLOSED
  ↓                          ↓
  └───────────────────────→ FAILED
```

**状态转换验证**:
```typescript
const VALID_TRANSITIONS: Record<OrderState, OrderState[]> = {
  [OrderState.CREATED]: [OrderState.PROCESSING, OrderState.FAILED],
  [OrderState.PROCESSING]: [OrderState.FILLED, OrderState.FAILED],
  [OrderState.FILLED]: [OrderState.CLOSED],
  [OrderState.CLOSED]: [],
  [OrderState.FAILED]: [],
};
```

#### 2.1.3 幂等性设计

**实现机制**:
- 使用订单号作为唯一标识
- Redis 记录已处理订单ID集合 (`processed_orders`)
- 处理前检查订单是否已处理
- 重复请求返回原处理结果

**幂等性检查流程**:
```typescript
async function checkIdempotency(orderNumber: string): Promise<boolean> {
  const isProcessed = await redis.exists(`processed:${orderNumber}`);
  if (isProcessed) {
    const result = await redis.get(`result:${orderNumber}`);
    return JSON.parse(result || '{}');
  }
  return null;
}
```

### 2.2 持仓管理模块

#### 2.2.1 平仓分布式锁设计

**锁命名规则**:
```
lock:position:{position_id}:{user_id}
```

**锁配置**:
```typescript
{
  key: `lock:position:${positionId}:${userId}`,
  ttl: 30000,        // 30秒超时
  retryTimes: 3,      // 重试3次
  retryDelay: 100,    // 每次间隔100ms
}
```

**锁实现** (Redlock 算法):
```typescript
async function acquireLock(positionId: number, userId: number): Promise<boolean> {
  const lockKey = `lock:position:${positionId}:${userId}`;
  const lockValue = `${Date.now()}-${Math.random()}`;

  const acquired = await redis.set(
    lockKey,
    lockValue,
    'PX',
    30000,
    'NX'
  );

  return acquired === 'OK';
}

async function releaseLock(positionId: number, userId: number): Promise<boolean> {
  const lockKey = `lock:position:${positionId}:${userId}`;

  // Lua脚本确保只释放自己持有的锁
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

#### 2.2.2 平仓事务设计

**事务边界**:
```typescript
async function closePosition(positionId: number): Promise<CloseResult> {
  return await transaction(async (client) => {
    // 1. 加分布式锁
    const lockAcquired = await acquireLock(positionId, userId);
    if (!lockAcquired) {
      throw new Error('Failed to acquire lock');
    }

    try {
      // 2. 检查持仓状态
      const position = await client.query(
        'SELECT * FROM positions WHERE id = $1 FOR UPDATE',
        [positionId]
      );

      if (position.rows[0].status !== PositionStatus.OPEN) {
        throw new Error('Position already closed');
      }

      // 3. 计算盈亏(使用价格快照)
      const pnl = calculatePnl(position, priceSnapshot);

      // 4. 更新持仓状态
      await client.query(
        'UPDATE positions SET status = $1 WHERE id = $2',
        [PositionStatus.CLOSED, positionId]
      );

      // 5. 更新账户余额(在资金服务中)
      await updateAccountBalance(client, userId, pnl, TransactionType.PROFIT_LOSS);

      // 6. 释放保证金
      await releaseMargin(client, userId, position.rows[0].margin);

      return { success: true, pnl };
    } finally {
      // 7. 释放分布式锁
      await releaseLock(positionId, userId);
    }
  });
}
```

#### 2.2.3 盈亏计算解耦设计

**价格快照表设计**:
```sql
CREATE TABLE price_snapshots (
  id BIGSERIAL PRIMARY KEY,
  product_id INTEGER NOT NULL REFERENCES products(id),
  price DECIMAL(20,8) NOT NULL,
  snapshot_time TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  source VARCHAR(50),
  UNIQUE(product_id, snapshot_time)
);

CREATE INDEX idx_price_snapshots_product_time
  ON price_snapshots(product_id, snapshot_time DESC);
```

**盈亏计算流程**:
```typescript
async function calculatePnl(position: Position, snapshotTime: Date): Promise<number> {
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

### 2.3 资金管理模块

#### 2.3.1 资金操作事务化设计

**事务封装**:
```typescript
async function executeFinancialOperation(
  userId: number,
  operation: FinancialOperation,
  context: OperationContext
): Promise<OperationResult> {
  return await transaction(async (client) => {
    // 1. 加行级锁
    const account = await client.query(
      'SELECT * FROM accounts WHERE user_id = $1 FOR UPDATE',
      [userId]
    );

    // 2. 获取分布式锁
    const lockAcquired = await acquireBalanceLock(userId);
    if (!lockAcquired) {
      throw new Error('Failed to acquire balance lock');
    }

    try {
      // 3. 验证操作
      validateOperation(account.rows[0], operation);

      // 4. 执行资金变动
      const result = await applyFinancialOperation(client, userId, operation, context);

      // 5. 记录审计日志
      await createAuditLog(client, {
        userId,
        operation,
        beforeBalance: account.rows[0].balance,
        afterBalance: result.newBalance,
        context,
      });

      return result;
    } finally {
      // 6. 释放分布式锁
      await releaseBalanceLock(userId);
    }
  });
}
```

#### 2.3.2 账户冻结机制设计

**数据库表更新**:
```sql
ALTER TABLE accounts ADD COLUMN frozen_amount DECIMAL(20,8) DEFAULT 0;

-- 添加索引
CREATE INDEX idx_accounts_frozen ON accounts(user_id, frozen_amount);
```

**冻结/解冻操作**:
```typescript
async function freezeBalance(
  userId: number,
  amount: number,
  reason: string,
  orderId?: number
): Promise<boolean> {
  return await transaction(async (client) => {
    const account = await client.query(
      'SELECT * FROM accounts WHERE user_id = $1 FOR UPDATE',
      [userId]
    );

    if (account.rows[0].available_balance < amount) {
      throw new Error('Insufficient available balance to freeze');
    }

    await client.query(`
      UPDATE accounts
      SET available_balance = available_balance - $1,
          frozen_amount = frozen_amount + $2,
          updated_at = CURRENT_TIMESTAMP
      WHERE user_id = $3
    `, [amount, amount, userId]);

    // 记录冻结日志
    await createAuditLog(client, {
      userId,
      operation: 'FREEZE',
      amount,
      reason,
      orderId,
    });

    return true;
  });
}

async function unfreezeBalance(
  userId: number,
  amount: number,
  reason: string,
  orderId?: number
): Promise<boolean> {
  return await transaction(async (client) => {
    const account = await client.query(
      'SELECT * FROM accounts WHERE user_id = $1 FOR UPDATE',
      [userId]
    );

    if (account.rows[0].frozen_amount < amount) {
      throw new Error('Insufficient frozen amount to unfreeze');
    }

    await client.query(`
      UPDATE accounts
      SET available_balance = available_balance + $1,
          frozen_amount = frozen_amount - $2,
          updated_at = CURRENT_TIMESTAMP
      WHERE user_id = $3
    `, [amount, amount, userId]);

    // 记录解冻日志
    await createAuditLog(client, {
      userId,
      operation: 'UNFREEZE',
      amount,
      reason,
      orderId,
    });

    return true;
  });
}
```

#### 2.3.3 审计日志设计

**审计日志表设计**:
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

CREATE INDEX idx_audit_logs_user_time
  ON audit_logs(user_id, created_at DESC);

CREATE INDEX idx_audit_logs_type_time
  ON audit_logs(operation_type, created_at DESC);
```

**审计日志记录**:
```typescript
async function createAuditLog(
  client: PoolClient,
  log: AuditLogEntry
): Promise<void> {
  await client.query(`
    INSERT INTO audit_logs (
      user_id, operation_type, amount, before_balance, after_balance,
      related_order_id, related_position_id, description, metadata
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
  `, [
    log.userId,
    log.operation,
    log.amount,
    log.beforeBalance,
    log.afterBalance,
    log.orderId || null,
    log.positionId || null,
    log.description || '',
    JSON.stringify(log.metadata || {}),
  ]);
}
```

## 3. 数据库设计

### 3.1 表结构变更

#### 3.1.1 订单表变更
```sql
-- 添加订单状态机相关字段
ALTER TABLE orders ADD COLUMN state VARCHAR(20) DEFAULT 'created';
ALTER TABLE orders ADD COLUMN state_history JSONB DEFAULT '[]';

-- 添加幂等性字段
ALTER TABLE orders ADD COLUMN idempotency_key VARCHAR(64) UNIQUE;

-- 添加索引
CREATE INDEX idx_orders_state ON orders(state, created_at DESC);
CREATE INDEX idx_orders_idempotency ON orders(idempotency_key);
```

#### 3.1.2 持仓表变更
```sql
-- 添加价格快照引用
ALTER TABLE positions ADD COLUMN snapshot_id BIGINT REFERENCES price_snapshots(id);

-- 添加索引
CREATE INDEX idx_positions_snapshot ON positions(snapshot_id);
```

#### 3.1.3 账户表变更
```sql
-- 添加冻结金额字段
ALTER TABLE accounts ADD COLUMN frozen_amount DECIMAL(20,8) DEFAULT 0;

-- 添加版本号(乐观锁)
ALTER TABLE accounts ADD COLUMN version INTEGER DEFAULT 1;

-- 添加索引
CREATE INDEX idx_accounts_frozen ON accounts(user_id, frozen_amount);
```

### 3.2 新增表

#### 3.2.1 价格快照表
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

CREATE INDEX idx_price_snapshots_product_time
  ON price_snapshots(product_id, snapshot_time DESC);
```

#### 3.2.2 审计日志表
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

CREATE INDEX idx_audit_logs_user_time
  ON audit_logs(user_id, created_at DESC);

CREATE INDEX idx_audit_logs_type_time
  ON audit_logs(operation_type, created_at DESC);
```

#### 3.2.3 订单处理日志表
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

CREATE INDEX idx_order_processing_logs_order
  ON order_processing_logs(order_id, created_at DESC);

CREATE INDEX idx_order_processing_logs_job
  ON order_processing_logs(job_id, created_at DESC);
```

## 4. API 接口设计

### 4.1 保持兼容性

所有现有 API 接口保持不变,内部实现切换到队列处理:

```typescript
// 现有接口(保持不变)
router.post('/order/create', authenticateUser, async (req, res) => {
  // 原同步撮合逻辑
  // ↓ 改为
  // 提交到队列,立即返回订单ID
});

// 新增查询接口(可选)
router.get('/order/status/:orderId', authenticateUser, async (req, res) => {
  // 查询订单处理状态
});
```

### 4.2 新增内部接口

```typescript
// 内部使用的状态查询接口
router.get('/internal/order/queue-status', async (req, res) => {
  // 返回队列统计信息
});
```

## 5. 实施顺序

1. **阶段一**: 基础设施准备
   - 安装 BullMQ 依赖
   - 配置 Redis 连接
   - 创建数据库表

2. **阶段二**: 订单系统重构
   - 实现订单队列
   - 实现状态机
   - 实现幂等性

3. **阶段三**: 持仓系统重构
   - 实现平仓分布式锁
   - 实现平仓事务
   - 实现价格快照

4. **阶段四**: 资金系统重构
   - 实现资金操作事务
   - 实现审计日志
   - 实现冻结机制

5. **阶段五**: 测试和文档
   - 集成测试
   - 性能测试
   - 编写架构文档
   - 编写风险修复报告
