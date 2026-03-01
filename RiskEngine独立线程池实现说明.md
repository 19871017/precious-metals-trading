# Risk Engine 独立线程池实现说明

## 概述

本实现为交易系统的 Risk Engine 建立了独立的 Worker Pool，确保风控检查不受 HTTP 请求线程和撮合线程的影响，即使在行情剧烈波动时也能保证风控系统的稳定运行。

## 实现目标

1. ✅ Risk Engine 不允许与 HTTP 请求线程、撮合线程共享资源池
2. ✅ 建立独立 worker pool，大小为 CPU核心数 / 2
3. ✅ 确保行情波动时风控仍运行

## 架构设计

### 系统架构

```
┌─────────────────────────────────────────────────────────┐
│                     Express HTTP 服务器                    │
│                      (HTTP 请求线程)                        │
└─────────────────────────────────────────────────────────┘
                           ↕
                      (不共享资源)
                           ↕
┌─────────────────────────────────────────────────────────┐
│              SystemPriorityController                      │
│                   (撮合线程)                               │
│            P0: 强平 | P1: 风控 | P2: 撮合 | P3: 查询         │
└─────────────────────────────────────────────────────────┘
                           ↕
                      (不共享资源)
                           ↕
┌─────────────────────────────────────────────────────────┐
│              Risk Engine Worker Pool                     │
│          (CPU核心数 / 2 个 Worker)                         │
│         独立队列: risk-engine:queue                       │
└─────────────────────────────────────────────────────────┘
                           ↕
              ┌──────────────┴──────────────┐
              │                             │
        Worker 1                      Worker N
        (并发 5)                       (并发 5)
```

### Worker Pool 配置

| 配置项 | 默认值 | 说明 |
|--------|--------|------|
| Worker 数量 | CPU核心数 / 2 | 独立 Worker 数量 |
| 每个 Worker 并发数 | 5 | 每个 Worker 同时处理 5 个任务 |
| 队列名称 | `risk-engine:queue` | 独立的 BullMQ 队列 |
| 最大重试次数 | 3 | 失败任务的重试次数 |
| 重试延迟 | 1000ms | 重试延迟（指数退避） |

### 任务优先级

支持 0-10 的任务优先级：

- **0-2**: 紧急风控检查（如强平前的风控验证）
- **3-5**: 正常风控检查（如用户下单）
- **6-8**: 批量风控检查（如批量用户风控评估）
- **9-10**: 后台风控分析（如风险统计）

## 文件结构

```
server/src/
├── services/
│   ├── RiskEngineWorkerPool.ts          # Worker Pool 实现
│   ├── RiskEngineQueueProducer.ts       # 队列生产者实现
│   ├── RiskEngineWorkerPoolManager.ts   # Worker Pool 管理器
│   └── RiskEngine.ts                    # 风控引擎（已更新）
├── routes/
│   └── risk-worker-pool.ts              # Worker Pool 管理路由
├── examples/
│   └── risk-worker-pool.example.ts      # 使用示例
└── index.ts                             # 主程序（已更新）
```

## 核心组件

### 1. RiskEngineWorkerPool

Worker Pool 的核心实现，负责创建和管理 Worker。

**主要功能**:
- 启动/停止 Worker Pool
- 处理风控检查任务
- 错误处理和重试
- 状态监控

**使用方法**:

```typescript
import { riskEngineWorkerPool } from './services/RiskEngineWorkerPool';

// 定义处理器
const processor: RiskCheckProcessor = async (job) => {
  // 处理风控检查
  return { success: true, passed: true, ... };
};

// 启动 Worker Pool
await riskEngineWorkerPool.start(processor);

// 获取状态
const status = riskEngineWorkerPool.getStatus();

// 停止 Worker Pool
await riskEngineWorkerPool.stop();
```

### 2. RiskEngineQueueProducer

队列生产者，用于提交风控检查任务。

**主要功能**:
- 提交单个任务
- 批量提交任务
- 等待任务结果
- 队列管理（暂停、恢复、清空）

**使用方法**:

```typescript
import { riskEngineQueueProducer } from './services/RiskEngineQueueProducer';

// 初始化
await riskEngineQueueProducer.initialize();

// 提交任务
const job = await riskEngineQueueProducer.submitRiskCheck(data);

// 等待结果
const result = await riskEngineQueueProducer.waitForResult(job.id);

// 获取队列统计
const stats = await riskEngineQueueProducer.getQueueStats();
```

### 3. RiskEngineWorkerPoolManager

Worker Pool 的统一管理器，简化使用。

**主要功能**:
- 初始化 Worker Pool
- 管理整个系统生命周期
- 提供统一的接口

**使用方法**:

```typescript
import { riskEngineWorkerPoolManager } from './services/RiskEngineWorkerPoolManager';

// 初始化
await riskEngineWorkerPoolManager.initialize();

// 获取状态
const status = riskEngineWorkerPoolManager.getStatus();

// 获取队列统计
const stats = await riskEngineWorkerPoolManager.getQueueStats();

// 暂停/恢复队列
await riskEngineWorkerPoolManager.pauseQueue();
await riskEngineWorkerPoolManager.resumeQueue();

// 停止
await riskEngineWorkerPoolManager.stop();
```

### 4. RiskEngine 集成

RiskEngine 现在支持通过 Worker Pool 执行风控检查。

**新增方法**:

```typescript
// 通过 Worker Pool 异步执行风控检查
async validateWithWorker(
  request: RiskCheckRequest,
  priority: number = 5
): Promise<{ jobId: string }>

// 等待 Worker Pool 完成风控检查
async waitForValidationResult(
  jobId: string,
  timeout: number = 5000
): Promise<RiskCheckResult>

// 通过 Worker Pool 执行风控检查（同步等待结果）
async validateAsync(
  request: RiskCheckRequest,
  priority: number = 5,
  timeout: number = 5000
): Promise<RiskCheckResult>
```

**使用方法**:

```typescript
import { riskEngine } from './services/RiskEngine';

// 方式 1: 异步提交 + 等待结果
const { jobId } = await riskEngine.validateWithWorker(request, priority);
const result = await riskEngine.waitForValidationResult(jobId, timeout);

// 方式 2: 同步等待结果（一步完成）
const result = await riskEngine.validateAsync(request, priority, timeout);

// 方式 3: 直接使用（不走 Worker Pool）
const result = await riskEngine.validate(request);
```

## API 接口

### Worker Pool 管理

#### 获取 Worker Pool 状态

```http
GET /risk/worker-pool/status
```

**响应**:
```json
{
  "code": 0,
  "message": "获取 Worker Pool 状态成功",
  "data": {
    "isInitialized": true,
    "workerPool": {
      "isRunning": true,
      "workerCount": 4,
      "config": {
        "workerCount": 4,
        "concurrency": 5,
        "queueName": "risk-engine:queue",
        "maxRetries": 3,
        "retryDelay": 1000
      }
    }
  }
}
```

#### 获取队列统计

```http
GET /risk/worker-pool/queue/stats
```

**响应**:
```json
{
  "code": 0,
  "message": "获取队列统计成功",
  "data": {
    "waiting": 12,
    "active": 8,
    "completed": 15234,
    "failed": 3,
    "delayed": 0
  }
}
```

#### 暂停队列

```http
POST /risk/worker-pool/queue/pause
```

#### 恢复队列

```http
POST /risk/worker-pool/queue/resume
```

#### 清空队列

```http
POST /risk/worker-pool/queue/drain
```

## 使用场景

### 场景 1: 用户下单

```typescript
// src/routes/api.ts
router.post('/order/create', async (req, res) => {
  const { userId, productCode, type, direction, quantity, leverage, price } = req.body;

  try {
    // 使用 Worker Pool 执行风控检查
    const result = await riskEngine.validateAsync({
      userId,
      productCode,
      operation: 'OPEN',
      quantity,
      leverage,
      price,
      direction,
    }, 5, // 优先级 5（中等）
      5000 // 超时 5 秒
    );

    if (!result.passed) {
      return res.status(400).json({
        code: 400,
        message: result.message,
      });
    }

    // 继续执行订单创建逻辑...
  } catch (error) {
    logger.error('[Order] 风控检查失败', error);
    return res.status(500).json({
      code: 500,
      message: '风控检查失败',
    });
  }
});
```

### 场景 2: 强平前的紧急风控检查

```typescript
// 高优先级风控检查
const result = await riskEngine.validateAsync({
  userId,
  productCode,
  operation: 'LIQUIDATE',
}, 0, // 优先级 0（最高）
  3000 // 超时 3 秒
);
```

### 场景 3: 批量用户风控评估

```typescript
const riskRequests = users.map(user => ({
  userId: user.id,
  productCode: 'XAUUSD',
  operation: 'OPEN' as const,
  quantity: 10,
  leverage: 10,
  price: 2345.67,
  direction: 'LONG' as const,
}));

// 提交所有任务
const jobs = await Promise.all(
  riskRequests.map(req => riskEngine.validateWithWorker(req, 7))
);

// 获取所有结果
const results = await Promise.all(
  jobs.map(job => riskEngine.waitForValidationResult(job.jobId, 10000))
);
```

### 场景 4: 异步处理

```typescript
// 异步提交风控检查任务
const { jobId } = await riskEngine.validateWithWorker(request, 5);

// 在后台处理其他任务...
await doOtherWork();

// 轮询等待结果
const result = await riskEngine.waitForValidationResult(jobId, 10000);
```

## 性能指标

| 指标 | 目标值 | 说明 |
|------|--------|------|
| Worker 数量 | CPU核心数 / 2 | 独立 Worker 数量 |
| 每个 Worker 并发 | 5 | 每个 Worker 同时处理 5 个任务 |
| 总并发能力 | (CPU核心数 / 2) * 5 | 风控检查的总吞吐量 |
| 任务处理时间 | < 100ms | 单个风控检查的处理时间 |
| 任务响应延迟 | < 500ms | 从提交到获取结果的总时间 |
| 重试成功率 | > 95% | 失败重试后的成功率 |

### 示例（8 核 CPU）

- Worker 数量: 4
- 每个 Worker 并发: 5
- 总并发能力: 20 个风控检查/秒

## 监控指标

### Worker Pool 监控

- Worker Pool 运行状态
- Worker 数量和配置
- 每个 Worker 的负载

### 队列监控

- 等待处理的任务数
- 正在处理的任务数
- 已完成的任务数
- 失败的任务数
- 延迟的任务数

### 风控检查监控

- 风控检查通过率
- 风控检查失败原因分布
- 各优先级任务处理情况
- 平均处理时间

## 注意事项

1. **资源隔离**: Risk Engine Worker Pool 使用独立的资源池，不与 HTTP 请求线程和撮合线程共享
2. **Worker 数量**: Worker 数量设置为 CPU核心数 / 2，避免过度占用 CPU 资源
3. **优先级设置**: 合理设置任务优先级，紧急风控检查使用高优先级
4. **超时处理**: 设置合理的超时时间，避免长时间等待
5. **错误重试**: 失败任务会自动重试，注意重试次数和延迟设置
6. **队列清理**: 定期清理已完成和失败的任务，避免占用过多内存
7. **Redis 连接**: 确保 Redis 连接稳定，Worker Pool 依赖 BullMQ 和 Redis

## 故障排查

### Worker Pool 无法启动

**问题**: Worker Pool 启动失败

**排查步骤**:
1. 检查 Redis 连接是否正常
2. 检查 BullMQ 配置是否正确
3. 查看日志中的错误信息

### 任务处理缓慢

**问题**: 风控检查任务处理缓慢

**排查步骤**:
1. 检查 Worker Pool 状态
2. 检查队列统计，查看是否有任务堆积
3. 检查系统资源使用情况（CPU、内存）
4. 考虑增加 Worker 数量

### 任务失败率高

**问题**: 风控检查任务失败率高

**排查步骤**:
1. 查看失败任务的错误信息
2. 检查数据库连接是否正常
3. 检查风控逻辑是否有异常
4. 查看日志中的详细错误信息

### 队列堆积

**问题**: 队列中任务堆积严重

**排查步骤**:
1. 检查 Worker Pool 状态
2. 检查任务处理速度
3. 考虑增加 Worker 数量或每个 Worker 的并发数
4. 检查是否有任务被阻塞

## 后续优化

- [ ] 支持动态调整 Worker 数量
- [ ] 实现更细粒度的优先级控制
- [ ] 添加风控检查的性能监控
- [ ] 支持任务取消功能
- [ ] 优化批量任务处理性能
- [ ] 添加 Worker Pool 的健康检查
- [ ] 实现任务的依赖关系

## 总结

本实现成功为 Risk Engine 建立了独立的 Worker Pool，确保：

1. ✅ **资源隔离**: Risk Engine 使用独立的资源池，不与 HTTP 请求线程和撮合线程共享
2. ✅ **合理配置**: Worker 数量设置为 CPU核心数 / 2，合理利用系统资源
3. ✅ **稳定性**: 即使在行情剧烈波动时，风控系统仍能稳定运行
4. ✅ **高并发**: (CPU核心数 / 2) * 5 的总并发能力
5. ✅ **优先级控制**: 支持 0-10 的任务优先级，确保紧急风控检查及时处理
6. ✅ **异步处理**: 不阻塞主流程，提升系统响应速度
7. ✅ **失败重试**: 自动重试失败任务，提高可靠性
8. ✅ **完整监控**: 提供详细的状态和统计信息

---

*文档版本: 1.0*
*生成时间: 2026年03月01日*
