# 贵金属期货交易系统

一个完整的贵金属期货交易平台，支持国际/国内贵金属期货交易，具备AI实时分析、风控管理、代理分佣等完整功能。

## 功能特性

### 核心功能
- ✅ 实时行情展示
- ✅ 市价单/限价单交易
- ✅ 多杠杆选择（10x-100x）
- ✅ 止盈止损设置
- ✅ 持仓管理与平仓
- ✅ 资金账户管理
- ✅ 充值提现系统
- ✅ 实时盈亏计算

### AI 分析
- ✅ AI 实时行情分析
- ✅ 技术指标分析
- ✅ 趋势判断
- ✅ 风险评估
- ✅ 语音输入交互
- ✅ 智能问答

### 风控系统
- ✅ 仓位限制
- ✅ 杠杆限制
- ✅ 强制平仓
- ✅ 风险预警
- ✅ 日亏损限制

### 代理分佣
- ✅ 二级代理体系
- ✅ 灵活分佣配置
- ✅ 自动分佣计算
- ✅ 代理账本记录
- ✅ 客户统计报表

### 管理后台
- ✅ 用户管理
- ✅ 代理管理
- ✅ 产品管理
- ✅ 订单管理
- ✅ 财务管理
- ✅ 风控管理
- ✅ 系统配置
- ✅ 操作日志

## 技术架构

### 前端
- React 18
- TypeScript
- TDesign UI
- Tailwind CSS
- ECharts
- Socket.io-client

### 后端
- Node.js
- Express.js
- TypeScript
- PostgreSQL
- Redis
- Socket.io
- JWT 认证

### AI服务
- Google Gemini API
- 语音识别

## 项目结构

```
precious-metals-trading/
├── src/                      # 前端源码
│   ├── components/           # 组件
│   ├── pages/               # 页面
│   ├── services/            # API服务
│   ├── types/               # 类型定义
│   └── utils/               # 工具函数
├── server/                  # 后端源码
│   ├── src/
│   │   ├── config/          # 配置
│   │   │   ├── database.ts  # 数据库配置
│   │   │   └── redis.ts     # Redis配置
│   │   ├── routes/          # 路由
│   │   │   ├── api/         # API路由
│   │   │   └── admin.ts     # 管理后台路由
│   │   ├── services/        # 服务
│   │   │   ├── auth.service.ts      # 认证服务
│   │   │   ├── trading.service.ts   # 交易服务
│   │   │   ├── finance.service.ts   # 财务服务
│   │   │   ├── commission.service.ts # 分佣服务
│   │   │   ├── market.service.ts    # 行情服务
│   │   │   ├── risk.service.ts       # 风控服务
│   │   │   └── ai.service.ts         # AI服务
│   │   ├── core/            # 核心模块
│   │   │   ├── OrderManager.ts      # 订单管理
│   │   │   ├── RiskManager.ts       # 风控管理
│   │   │   └── MarketDataService.ts  # 行情数据服务
│   │   ├── utils/           # 工具
│   │   │   ├── logger.ts    # 日志
│   │   │   ├── calculator.ts # 计算
│   │   │   └── redis.ts     # Redis
│   │   └── index.ts         # 入口文件
│   ├── database/
│   │   └── init.sql        # 数据库初始化脚本
│   ├── package.json
│   ├── tsconfig.json
│   └── .env
├── public/                  # 静态资源
├── docs/                    # 文档
│   ├── BACKEND_ARCHITECTURE.md  # 后端架构文档
│   └── DEPLOYMENT_GUIDE.md      # 部署指南
├── package.json
├── vite.config.ts
└── README.md
```

## 快速开始

### 环境要求
- Node.js >= 18.x
- PostgreSQL >= 14.x
- Redis >= 6.x

### 1. 克隆项目
```bash
git clone <repository-url>
cd precious-metals-trading
```

### 2. 安装前端依赖
```bash
npm install
```

### 3. 配置环境变量
```bash
cp .env.example .env
# 编辑 .env 文件配置 API 地址等
```

### 4. 启动前端开发服务器
```bash
npm run dev
```

### 5. 安装后端依赖
```bash
cd server
npm install
```

### 6. 配置后端环境变量
```bash
cp .env.example .env
# 编辑 .env 文件配置数据库、Redis等
```

### 7. 初始化数据库
```bash
# 创建数据库
createdb precious_metals_trading

# 导入表结构
psql -d precious_metals_trading -f database/init.sql
```

### 8. 启动后端服务
```bash
# 开发模式
npm run dev

# 生产模式
npm run build
pm2 start ecosystem.config.js
```

### 9. 访问应用
- 前端: http://localhost:5173
- 后端 API: http://localhost:3001
- 管理后台: http://localhost:5173/admin

## 部署指南

详细的部署指南请参考 [DEPLOYMENT_GUIDE.md](./DEPLOYMENT_GUIDE.md)

### 生产环境部署步骤

1. **服务器准备**
   - 安装 Node.js、PostgreSQL、Redis
   - 配置防火墙和安全组

2. **数据库配置**
   - 创建数据库和用户
   - 导入初始化脚本
   - 配置主从复制

3. **后端部署**
   - 安装依赖
   - 配置环境变量
   - 编译 TypeScript
   - 使用 PM2 启动

4. **前端部署**
   - 构建生产版本
   - 配置 Nginx
   - 配置 HTTPS

5. **监控配置**
   - 配置日志收集
   - 配置监控告警

## 数据库设计

完整的数据库设计请参考 [BACKEND_ARCHITECTURE.md](./BACKEND_ARCHITECTURE.md)

### 核心数据表

- `users` - 用户表
- `roles` - 角色表
- `agents` - 代理表
- `products` - 产品表
- `orders` - 订单表
- `positions` - 持仓表
- `trades` - 成交记录
- `accounts` - 账户表
- `transactions` - 资金流水
- `deposit_orders` - 充值订单
- `withdraw_orders` - 提现订单
- `commission_records` - 分佣记录
- `agent_ledger` - 代理账本
- `risk_rules` - 风控规则
- `risk_alerts` - 风控预警
- `ai_analyses` - AI分析记录
- `operation_logs` - 操作日志

## API 文档

### 基础信息
- Base URL: `/api/v1`
- 认证方式: Bearer Token
- 响应格式: JSON

### 认证接口
- `POST /auth/register` - 用户注册
- `POST /auth/login` - 用户登录
- `POST /auth/logout` - 用户登出
- `POST /auth/refresh-token` - 刷新令牌
- `GET /user/profile` - 获取个人信息

### 交易接口
- `POST /trading/orders` - 创建订单
- `GET /trading/orders` - 获取订单列表
- `GET /trading/positions` - 获取持仓列表
- `POST /trading/positions/:id/close` - 平仓
- `GET /trading/trades` - 获取成交记录

### 行情接口
- `GET /market/products` - 获取产品列表
- `GET /market/quotes` - 获取实时行情
- `GET /market/klines` - 获取K线数据

### 财务接口
- `GET /finance/account` - 获取账户信息
- `GET /finance/transactions` - 获取资金流水
- `POST /finance/deposit` - 创建充值订单
- `POST /finance/withdraw` - 创建提现申请

### AI 接口
- `POST /ai/analyze` - AI分析
- `POST /ai/chat` - AI对话
- `POST /ai/voice-input` - 语音输入

### 管理后台接口（需管理员权限）
- `GET /admin/users` - 用户管理
- `GET /admin/agents` - 代理管理
- `GET /admin/orders` - 订单管理
- `GET /admin/finance/deposit` - 充值审核
- `GET /admin/stats` - 系统统计

详细 API 文档请参考 [API_DOCUMENTATION.md](./docs/API_DOCUMENTATION.md)

## 开发指南

### 代码规范
- 使用 ESLint + Prettier
- 遵循 TypeScript 严格模式
- 提交前运行 `npm run lint`

### 测试
```bash
# 运行单元测试
npm test

# 运行集成测试
npm run test:integration
```

### 构建生产版本
```bash
# 前端
npm run build

# 后端
cd server
npm run build
```

## 系统架构

完整的架构文档请参考 [BACKEND_ARCHITECTURE.md](./BACKEND_ARCHITECTURE.md)

### 角色权限
- **超级管理员**: 所有权限
- **一级代理**: 管理下级代理和客户
- **二级代理**: 管理直属客户
- **普通用户**: 交易功能

### 分佣规则
- 可配置一级代理分佣比例
- 可配置二级代理分佣比例
- 平台自动计算分佣
- 分佣记录不可篡改

### 风控规则
- 单笔仓位限制
- 总持仓限制
- 杠杆限制
- 强平线/止损线配置
- 日亏损限制

## 安全性

- JWT Token 认证
- Refresh Token 机制
- 密码 bcrypt 加密
- 敏感数据 AES 加密
- 接口限流
- SQL 注入防护
- XSS 攻击防护
- CSRF 防护

## 监控与日志

- Winston 日志框架
- PM2 进程监控
- Nginx 访问日志
- PostgreSQL 慢查询日志
- Redis 监控
- 推荐使用 Prometheus + Grafana

## 常见问题

### 数据库连接失败
检查 `server/.env` 中的数据库配置是否正确，确保数据库服务已启动。

### Redis 连接失败
检查 Redis 服务状态，确认密码配置正确。

### WebSocket 连接失败
检查 Nginx 配置中的 WebSocket 代理设置。

更多问题请参考 [FAQ.md](./docs/FAQ.md)

## 更新日志

### v1.0.0 (2024-01-01)
- 初始版本发布
- 完整的交易系统功能
- AI 分析功能
- 管理后台

## 贡献指南

欢迎提交 Issue 和 Pull Request！

## 许可证

MIT License

## 联系方式

- Email: support@example.com
- 官网: https://example.com
- GitHub: https://github.com/your-repo

---

**免责声明**: 本系统仅用于学习和研究目的，不构成投资建议。实际交易请谨慎，风险自负。
