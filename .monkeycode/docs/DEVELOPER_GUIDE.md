# 开发者速查

## 1. 环境准备
1. Node.js ≥ 18、PostgreSQL ≥ 14、Redis ≥ 6（参见 `README.md`、`DEPLOYMENT_GUIDE_COMPLETE.md`）。
2. 复制 `.env.example` 到 `.env`，配置 API/DB/Redis/Gemini/数海密钥。
3. 执行：
   ```bash
   npm install          # 前端
   npm run dev          # 启动 Vite 前端
   cd server && npm install
   npm run dev          # 启动 Express 后端
   ```
4. 初始化数据库：
   ```bash
   psql -d precious_metals_trading -f server/database/init.sql
   psql -d precious_metals_trading -f server/database/migrate_refactor.sql
   ```
5. 启动演示辅助脚本：`server/create-test-agent.js`, `start-backend*.bat`, `start-backend-ws.bat` 等提供快速体验。

## 2. 日常开发指引
- **前端目录**：`src/`。入口 `main.tsx`、路由 `App.tsx`，页面在 `src/pages/*`，服务在 `src/services/*`。Tailwind + TDesign 组合样式，`src/styles` 存放主题与工具类。
- **后端目录**：`server/src/`。`index.ts` 为启动点；`routes/` 负责接口，`services/` 存放业务逻辑，`core/` 管理订单/仓位，`middleware/` 实现认证与限流，`utils/` 封装日志、Redis、锁等。
- **AI/策略**：`src/services/ai-analysis.service.ts`、`strategy.service.ts` 与 `server/src/routes/ai.ts` 配套，开发新指标请复用 `technical-indicators.service.ts`。
- **风控/强平**：扩展时遵循 `docs/REFACTOR_SUMMARY.md` 的状态机与锁设计，确保订单、资金 API 使用 `utils/distributed-lock.ts` 与 `AuditLogService`。

## 3. 测试与验证
| 层级 | 现状 | 建议 |
| --- | --- | --- |
| 单元测试 | `server/tests/*` + 前端少量测试脚本，覆盖约 30%-40% | 重点补齐订单状态机、队列 Producer、风控 worker 与 AI 摘要逻辑；建议 Jest + React Testing Library。
| 集成/端到端 | 若干脚本（`server/test-*.js`, `test-frontend-api.js`, `test-react.html` 等）用于手动验证 | 引入 Playwright/Cypress 建立冒烟脚本，覆盖下单、平仓、充值提现、AI 分析、代理操作等主路径。
| 性能/压测 | `docs/真实压力模拟任务七总结.md`、`server/test-full-flow.js` 提供历史结果 | 整合到自动化流程，结合 Watchdog 指标，形成常态化压测。

## 4. 常见问题
- **WebSocket 无推送**：检查 `server/src/index.ts` 中 `CLIENT_URL` 环境变量与前端地址是否一致，确认 `marketService.setSocketIO` 已执行。
- **队列未消费**：确保 Redis 可用且 `RiskEngineWorkerPoolManager.initialize()` 未报错；必要时查看 `priority:*` 队列深度 (`server/src/services/SystemPriorityController.ts`)。
- **强平不触发**：确认 `LiquidationPriorityScheduler` 已 `start()`，并检查分布式锁 `lock:position:{id}:{user}` 是否卡死。
- **AI 摘要为空**：排查 `/ai/jinshinews`、`/ai/generate-summary` 的响应以及 `localStorage` 缓存 (`src/services/ai-analysis.service.ts`)。
- **数海 API 异常**：参考 `数海API问题说明.md`、`数海API权限问题分析.md`、`server/test-shuhai-*.js` 的排障步骤。

## 5. 现存缺口与优先级
1. **P0**：完成 BullMQ Worker、平仓锁、资金冻结链路（`docs/REFACTOR_SUMMARY.md` → “未完成的工作”）。
2. **P0**：将单元/集成测试覆盖率拉升至 80%，并在 CI 中执行 `npm run lint && npm run build && npm run test`。
3. **P1**：完善 AI（语音、多模型、交易信号）、自动交易与代理佣金结算。
4. **P1**：加强管理后台报表与数据可视化，整合 `docs/任务X总结` 中的指标需求。
5. **P2**：规划国际化、移动端优化、容器化部署及 CI/CD 管线。

## 6. 文档索引
- 系统级：`README.md`, `TECHNOLOGY_STACK.md`, `API_DESIGN.md`, `DEPLOYMENT_GUIDE_COMPLETE.md`。
- 重构/风险：`docs/architecture-refactor.md`, `docs/risk-fix-report.md`, `.monkeycode/specs/260228-trading-system-refactor/*.md`。
- 阶段报告：根目录下的 `任务一~七执行总结.md`, `AI量化交易系统完善总结.md`, `项目开发完整度评估报告.md` 等可复用为验收附件。
