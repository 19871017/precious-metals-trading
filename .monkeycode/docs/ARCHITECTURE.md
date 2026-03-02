# 系统架构概览

## 1. 整体拓扑
```
Web/Mobile 客户端 (React 18 + Vite)
        │ HTTPS + Socket.io
        ▼
Express API 网关 (`server/src/index.ts`)
        │            ├── auth / account / trade / finance / admin / ai 路由
        │            ├── systemLoadGuard + priorityRateLimit + orderRateLimit
        ▼
业务服务层 (OrderManager、RiskManager、TradingService、FinanceService 等)
        │            ├── BullMQ 队列 (订单 / 风控 / 强平 / Watchdog)
        │            ├── RiskEngineWorkerPool + LiquidationPriorityScheduler
        ▼
数据与外部源
        ├── PostgreSQL (核心业务库, `server/database/*.sql`)
        ├── Redis (缓存/锁/队列状态)
        ├── 数海 API、Yahoo Finance、Gemini AI
```

## 2. 前端架构
- **入口**：`src/main.tsx`、`src/App.tsx`。`ConfigProvider` 注入 TDesign 主题，React Router 定义 26 条业务路由与 `ProtectedRoute`/`AdminProtectedRoute` 守卫。
- **页面层**：`src/pages` 按业务拆分用户端、代理端、管理端，涵盖行情、策略回测、AI 分析、资金往来等移动优先界面。`Strategy.tsx`、`Market.tsx` 等页面内嵌 ECharts/TD 表格与状态管理。
- **服务层**：`src/services` 聚合 HTTP/API、WebSocket、AI、行情、策略、自动订单/风控等 19 个 service；对后端路由（如 `/ai/generate-summary`, `/market/kline`）提供统一封装，并内置缓存/降级逻辑。
- **组件层**：`src/components` 提供导航、订单列表、通知抽屉、风控配置面板等复用能力；大部分组件已类型化，匹配 TDesign 交互规范。

## 3. 后端架构
### 3.1 API 层
- **主入口**：`server/src/index.ts` 将 Helmet、CORS、多档限流、系统负载守卫、中间件挂载到 Express，并初始化 Socket.io。
- **路由划分**：`server/src/routes` 包含 25+ 路由文件，按 account/market/trading/finance/risk/ai/admin/watchdog/degradation/event-store/shuhai 等职责解耦；`routes/api/*` 提供对外 REST API。

### 3.2 核心服务
- **订单与持仓**：`server/src/core/OrderManager.ts`、`PositionManager.ts` 管理订单生命周期与仓位状态；`services/OrderStateMachine.ts` 将 CREATED→PROCESSING→FILLED→CLOSED→FAILED 状态机固化。
- **风险控制**：`RiskEngineWorkerPoolManager.ts` + `RiskEngineWorkerPool.ts` 将风险校验下沉到 BullMQ Worker；`SystemPriorityController.ts`、`priority-rate-limit.ts` 根据 P0~P3 优先级和实时队列深度调节限流。
- **强平机制**：`LiquidationSchedulerV2.ts` 负责批量扫描，`LiquidationPriorityScheduler.ts` 以 500ms 周期构建优先队列并结合分布式锁执行，`StopLossTakeProfitService.ts` 处理触发式止盈止损。
- **系统保障**：`WatchdogService.ts` 监控订单时延/数据库锁/Redis RTT 并写入 `AuditLogService`; `DegradationService.ts` 负责降级开关，`ChaosTestService.ts` 注入混沌测试，`event-store` 模块记录关键事件。

### 3.3 队列与并发
- BullMQ 实例集中在 `server/src/services/*Queue*.ts`，覆盖订单撮合、风险校验、强平快速通道等任务。所有队列共用 `config/queue.config.ts` 的 Redis 连接，默认指数退避与清理策略。
- `Middleware/order-rate-limit.ts` 与 `SystemPriorityController` 协同，对单用户/全局请求提供限流、队列状态查询与重置能力。

## 4. 数据与外部接口
- **数据库脚本**：`server/database/init.sql` 定义 19 张核心表，`database/migrate_refactor.sql` 补充价格快照、审计日志、订单处理日志及字段扩展。
- **Redis 应用**：保存行情缓存、队列元数据、分布式锁(`utils/distributed-lock.ts`)、风控状态、AI 缓存等。
- **外部数据源**：
  - 数海 API (`src/services/shuhai*.ts`, `server/src/routes/shuhai.ts`) 提供真实行情/交易接口。
  - Yahoo Finance (`src/services/yahoo-finance.service.ts`, `server/src/routes/yahoo-finance.ts`) 作为备用行情。
  - Google Gemini (`src/services/gemini.service.ts`, `server/src/routes/ai.ts`) 用于生成策略摘要、智能问答。

## 5. 安全与可靠性
- **认证授权**：`server/src/routes/auth.ts` + JWT/Refresh Token 机制；`middleware/auth.ts` (隐含) 控制用户/管理员访问。
- **安全中间件**：Helmet、CSURF（`package.json` 中依赖）、express-rate-limit、AES/Bcrypt 在 `server/src/services/auth.service.ts` 与 `utils/crypto` 中落地。
- **一致性**：分布式锁 (`utils/distributed-lock.ts`)、审计日志 (`services/AuditLogService.ts`)、事件存储 (`services/EventStoreService.ts`) 保障资金/订单幂等。
- **观测**：`Watchdog` + `SystemPriorityController` + `EventStore` 形成监控闭环，配套 `docs/risk-fix-report.md`、`docs/architecture-refactor.md` 记录整改策略。

## 6. 部署与运行
- **前端**：`npm install && npm run dev` / `npm run build`（`package.json`）。
- **后端**：`cd server && npm install && npm run dev`，生产使用 `npm run build` + `pm2 start ecosystem.config.js`（`README.md`, `DEPLOYMENT_GUIDE_COMPLETE.md`）。
- **数据初始化**：执行 `server/database/init.sql` + `migrate_refactor.sql`，Redis/队列配置在 `.env` 与 `config/queue.config.ts` 中设置。
- **辅助脚本**：`server/run-tests.js`, `run-all-tests.cjs`, 多个 `start-backend*.bat/ps1`、`create-test-agent.js` 等帮助部署与演示。
