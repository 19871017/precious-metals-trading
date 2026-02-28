# 需求实施计划

- [ ] 1. 安装和配置基础设施依赖
  - [ ] 1.1 安装 BullMQ 和相关依赖包
    - 在 server/package.json 中添加 bullmq 和 @types/bullmq 依赖
    - 安装 ioredis 作为 Redis 客户端(如果需要)
    - 运行 npm install 安装依赖

  - [ ] 1.2 创建队列配置模块
    - 创建 server/src/config/queue.config.ts 文件
    - 配置 BullMQ 队列连接参数
    - 定义队列名称常量(orders:queue, orders:delayed, orders:failed)
    - 配置队列默认选项(重试次数、超时时间等)

  - [ ] 1.3 创建 Redis 分布式锁工具类
    - 创建 server/src/utils/distributed-lock.ts 文件
    - 实现基于 Redlock 算法的分布式锁获取方法
    - 实现锁释放方法(使用 Lua 脚本保证原子性)
    - 添加锁超时和重试机制

- [ ] 2. 数据库表结构变更
  - [ ] 2.1 创建价格快照表
    - 编写 CREATE TABLE price_snapshots SQL 语句
    - 定义字段: id, product_id, price, snapshot_time, source, metadata
    - 创建唯一索引 (product_id, snapshot_time)
    - 执行迁移脚本创建表

  - [ ] 2.2 创建审计日志表
    - 编写 CREATE TABLE audit_logs SQL 语句
    - 定义字段: id, user_id, operation_type, amount, before_balance, after_balance, related_order_id, related_position_id, description, metadata, created_at, created_by
    - 创建索引: idx_audit_logs_user_time, idx_audit_logs_type_time
    - 执行迁移脚本创建表

  - [ ] 2.3 创建订单处理日志表
    - 编写 CREATE TABLE order_processing_logs SQL 语句
    - 定义字段: id, order_id, job_id, state_from, state_to, processing_time, error_message, metadata, created_at
    - 创建索引: idx_order_processing_logs_order, idx_order_processing_logs_job
    - 执行迁移脚本创建表

  - [ ] 2.4 更新订单表结构
    - 添加 state VARCHAR(20) 字段,默认值为 'created'
    - 添加 state_history JSONB 字段,默认值为 '[]'
    - 添加 idempotency_key VARCHAR(64) 唯一字段
    - 创建索引: idx_orders_state, idx_orders_idempotency
    - 执行 ALTER TABLE 语句更新表结构

  - [ ] 2.5 更新持仓表结构
    - 添加 snapshot_id BIGINT 字段,引用 price_snapshots(id)
    - 创建索引: idx_positions_snapshot
    - 执行 ALTER TABLE 语句更新表结构

  - [ ] 2.6 更新账户表结构
    - 添加 frozen_amount DECIMAL(20,8) 字段,默认值为 0
    - 添加 version INTEGER 字段,默认值为 1(用于乐观锁)
    - 创建索引: idx_accounts_frozen
    - 执行 ALTER TABLE 语句更新表结构

- [ ] 3. 实现订单状态机和队列系统
  - [ ] 3.1 定义订单状态枚举和类型
    - 在 server/src/types/index.ts 中定义 OrderState 枚举(CREATED, PROCESSING, FILLED, CLOSED, FAILED)
    - 定义状态转换规则类型 VALID_TRANSITIONS
    - 定义订单状态历史记录类型 StateHistory
    - 定义幂等性检查返回类型 IdempotencyResult

  - [ ] 3.2 创建订单状态机管理器
    - 创建 server/src/services/OrderStateMachine.ts 文件
    - 实现状态转换验证方法 canTransition()
    - 实现状态变更方法 transition()并记录历史
    - 实现状态历史记录的存储和查询
    - 添加状态转换的错误处理

  - [ ] 3.3 创建订单队列生产者
    - 创建 server/src/services/OrderQueueProducer.ts 文件
    - 实现 BullMQ Queue 实例初始化
    - 实现提交订单到队列的方法 addOrder()
    - 实现获取订单状态的方法 getOrderStatus()
    - 实现取消订单的方法 cancelOrder()
    - 添加队列错误处理和重试逻辑

  - [ ] 3.4 创建订单队列消费者处理器
    - 创建 server/src/workers/OrderWorker.ts 文件
    - 实现 BullMQ Worker 实例初始化
    - 实现订单处理主逻辑 processOrder()
    - 实现订单状态流转(CREATED → PROCESSING → FILLED/FAILED)
    - 实现处理失败的重试和错误记录
    - 添加处理日志记录到 order_processing_logs 表

  - [ ] 3.5 实现订单幂等性检查
    - 在 OrderQueueProducer 中实现幂等性检查方法
    - 使用 Redis 存储已处理订单ID集合(processed_orders)
    - 实现幂等性结果的缓存(result:{order_number})
    - 在处理订单前检查幂等性,重复请求返回缓存结果

  - [ ] 3.6 修改订单创建接口使用队列
    - 修改 server/src/routes/api.ts 中的 POST /api/order/create 接口
    - 将同步撮合逻辑改为提交到队列
    - 立即返回订单ID和处理状态
    - 保持原有请求参数和响应格式不变
    - 添加订单号生成逻辑(用于幂等性检查)

- [ ] 4. 实现持仓系统重构
  - [ ] 4.1 创建价格快照服务
    - 创建 server/src/services/PriceSnapshotService.ts 文件
    - 实现创建价格快照方法 createSnapshot()
    - 实现查询最新快照方法 getLatestSnapshot()
    - 实现按时间查询快照方法 getSnapshotByTime()
    - 添加定时任务定期创建价格快照

  - [ ] 4.2 实现平仓分布式锁
    - 在 server/src/utils/distributed-lock.ts 中添加持仓锁方法
    - 实现 acquirePositionLock() 方法,使用 Redlock 算法
    - 实现 releasePositionLock() 方法,使用 Lua 脚本
    - 配置锁超时时间为 30 秒
    - 添加锁获取失败的错误处理

  - [ ] 4.3 重构平仓逻辑使用事务和锁
    - 修改 server/src/services/trading.service.ts 中的平仓方法
    - 在事务外先获取分布式锁
    - 在事务内使用 FOR UPDATE 锁定持仓记录
    - 检查持仓状态,防止重复平仓
    - 使用价格快照计算盈亏
    - 更新持仓状态为 CLOSED
    - 调用资金服务更新余额和释放保证金
    - 释放分布式锁(在 finally 块中)
    - 平仓失败时回滚事务

  - [ ] 4.4 实现盈亏计算解耦
    - 创建 server/src/services/PnLCalculator.ts 文件
    - 实现使用价格快照计算盈亏的方法 calculatePnlWithSnapshot()
    - 确保盈亏计算的确定性(不依赖实时行情)
    - 添加盈亏计算验证逻辑
    - 在平仓和结算时使用此方法计算盈亏

  - [ ] 4.5 修改平仓接口
    - 修改 server/src/routes/api.ts 中的平仓相关接口
    - 集成分布式锁获取逻辑
    - 调用重构后的平仓方法
    - 保持原有请求参数和响应格式不变
    - 添加并发冲突的错误提示

- [ ] 5. 实现资金系统重构
  - [ ] 5.1 创建资金操作审计日志服务
    - 创建 server/src/services/AuditLogService.ts 文件
    - 实现创建审计日志方法 createAuditLog()
    - 实现查询审计日志方法 queryAuditLogs()
    - 实现按用户查询方法 getAuditLogsByUser()
    - 确保审计日志不可篡改

  - [ ] 5.2 创建账户余额分布式锁
    - 在 server/src/utils/distributed-lock.ts 中添加余额锁方法
    - 实现 acquireBalanceLock() 方法,使用 Redlock 算法
    - 实现 releaseBalanceLock() 方法,使用 Lua 脚本
    - 配置锁超时时间为 10 秒
    - 添加锁获取失败的错误处理

  - [ ] 5.3 重构资金操作使用事务
    - 修改 server/src/services/finance.service.ts 中的所有资金操作方法
    - 使用 transaction() 包装所有数据库操作
    - 在事务开始前获取分布式锁
    - 使用 FOR UPDATE 锁定账户记录
    - 使用乐观锁(version 字段)防止并发修改
    - 更新账户余额、冻结金额
    - 调用审计日志服务记录操作
    - 释放分布式锁(在 finally 块中)
    - 操作失败时回滚事务

  - [ ] 5.4 实现账户冻结和解冻功能
    - 在 server/src/services/finance.service.ts 中添加 freezeBalance() 方法
    - 在事务内验证可用余额是否充足
    - 更新 available_balance 和 frozen_amount
    - 调用审计日志服务记录冻结操作
    - 添加 unfreezeBalance() 方法
    - 在事务内验证冻结金额是否充足
    - 更新 available_balance 和 frozen_amount
    - 调用审计日志服务记录解冻操作

  - [ ] 5.5 修改资金相关接口
    - 修改 server/src/routes/finance.ts 中的充值、提现接口
    - 集成事务化资金操作
    - 添加分布式锁保护
    - 保持原有请求参数和响应格式不变
    - 添加并发冲突的错误提示

- [ ] 6. 初始化和启动配置
  - [ ] 6.1 创建队列初始化脚本
    - 创建 server/src/scripts/init-queue.ts 文件
    - 初始化 BullMQ Queue 实例
    - 初始化 BullMQ Worker 实例
    - 配置 Worker 监听队列
    - 添加 Worker 事件监听(completed, failed, progress)
    - 导出队列和 Worker 实例供主程序使用

  - [ ] 6.2 修改主程序入口
    - 修改 server/src/index.ts 文件
    - 导入队列初始化脚本并调用
    - 启动订单处理 Worker
    - 添加队列状态检查端点
    - 添加优雅关闭逻辑(关闭 Worker 和队列)

  - [ ] 6.3 创建定时任务
    - 创建 server/src/cron/price-snapshot-cron.ts 文件
    - 实现每分钟创建价格快照的定时任务
    - 使用 BullMQ 的 repeat 功能或 node-cron 库
    - 启动定时任务并在主程序中集成

- [ ] 7. 编写测试
  - [ ] 7.1 编写订单状态机单元测试
    - 创建 server/src/tests/OrderStateMachine.test.ts 文件
    - 测试所有合法的状态转换
    - 测试非法的状态转换应抛出异常
    - 测试状态历史记录的正确性

  - [ ] 7.2 编写队列生产者单元测试
    - 创建 server/src/tests/OrderQueueProducer.test.ts 文件
    - 测试订单提交到队列
    - 测试订单状态查询
    - 测试订单取消
    - 测试幂等性检查

  - [ ] 7.3 编写分布式锁单元测试
    - 创建 server/src/tests/distributed-lock.test.ts 文件
    - 测试锁的获取和释放
    - 测试锁的超时机制
    - 测试并发获取锁的场景
    - 测试 Lua 脚本的原子性

  - [ ] 7.4 编写平仓逻辑集成测试
    - 创建 server/src/tests/close-position.integration.test.ts 文件
    - 测试平仓的完整流程
    - 测试分布式锁的保护作用
    - 测试事务回滚机制
    - 测试重复平仓的防护

  - [ ] 7.5 编写资金操作集成测试
    - 创建 server/src/tests/financial-operation.integration.test.ts 文件
    - 测试充值、提现的资金流转
    - 测试账户冻结和解冻
    - 测试并发资金操作的安全性
    - 测试审计日志的完整性

- [ ] 8. 检查点 - 确保所有测试通过
  - 确保所有测试通过,如有疑问请询问用户

- [ ] 9. 性能优化和监控
  - [ ] 9.1 优化队列性能
    - 调整队列并发处理参数(concurrency)
    - 优化队列任务超时时间
    - 优化重试策略和退避算法
    - 添加队列性能监控指标

  - [ ] 9.2 优化数据库查询
    - 为新增的索引创建计划
    - 分析慢查询并优化
    - 添加查询性能监控
    - 优化事务隔离级别

  - [ ] 9.3 添加系统监控
    - 集成队列监控到日志系统
    - 添加分布式锁监控(锁等待时间、锁超时次数)
    - 添加资金操作监控(成功率、失败率)
    - 添加告警机制(队列堆积、锁超时)

- [ ] 10. 文档编写
  - [ ] 10.1 编写架构说明文档
    - 创建 docs/architecture-refactor.md 文件
    - 描述重构前的架构问题
    - 描述重构后的架构设计
    - 说明各个模块的职责和交互
    - 绘制架构图和时序图
    - 说明关键技术决策和权衡

  - [ ] 10.2 编写风险修复报告
    - 创建 docs/risk-fix-report.md 文件
    - 列出修复的风险点
    - 说明每个风险点的修复方案
    - 提供修复前后的对比
    - 列出未修复的风险和后续计划
    - 提供验证测试结果

  - [ ] 10.3 编写部署指南
    - 创建 docs/deployment-guide.md 文件
    - 说明新增依赖的安装步骤
    - 说明数据库迁移步骤
    - 说明 Redis 配置要求
    - 说明服务启动和停止步骤
    - 提供故障排查指南

  - [ ] 10.4 更新 API 文档
    - 更新现有 API 接口的文档
    - 说明接口内部实现的变更
    - 说明新增的状态查询接口
    - 说明可能的错误码和错误处理
    - 提供接口使用示例

- [ ] 11. 检查点 - 确保所有文档完整
  - 确保所有文档完整,如有疑问请询问用户

- [ ] 12. 最终验证和交付
  - [ ] 12.1 执行完整的功能测试
    - 测试订单创建和撮合流程
    - 测试持仓开仓和平仓流程
    - 测试资金充值、提现、冻结、解冻流程
    - 测试并发场景下的数据一致性
    - 测试异常情况下的回滚和恢复

  - [ ] 12.2 执行性能测试
    - 测试订单处理吞吐量
    - 测试数据库事务响应时间
    - 测试分布式锁的获取和释放性能
    - 测试系统在高负载下的稳定性

  - [ ] 12.3 执行安全审计
    - 检查分布式锁的安全性
    - 检查事务边界的完整性
    - 检查审计日志的不可篡改性
    - 检查幂等性机制的有效性

  - [ ] 12.4 生成最终交付报告
    - 汇总所有测试结果
    - 确认所有需求已满足
    - 确认所有验收标准已通过
    - 列出已知问题和后续优化方向
    - 准备交付文档和代码

- [ ] 13. 检查点 - 确认所有验收标准通过
  - 确认所有验收标准通过,如有疑问请询问用户
