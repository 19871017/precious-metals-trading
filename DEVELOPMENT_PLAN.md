# AI量化交易系统 - 开发完善计划

## 已完成任务

### 1. 前端数据持久化优化
- **状态**: 已完成
- **内容**:
  - 创建 `user.service.ts` - 统一的用户服务API封装
  - 更新 `Home.tsx` - 使用 `accountApi.getInfo()` 获取真实账户数据
  - 更新 `Position.tsx` - 使用 `positionApi.getList()` 获取真实持仓数据
  - 替换 `localStorage` 为后端API调用
  - 更新 `types/index.ts` - 添加 `riskLevel`、`liquidationPrice`、`openedAt` 字段

### 2. UI主题风格统一
- **状态**: 已完成
- **内容**:
  - 重构 `Strategy.tsx` - 移除硬编码的 `backgroundColor: '#121212'` 等内联样式
  - 使用统一的Tailwind CSS类: `bg-gradient-to-b from-black to-neutral-950`
  - 统一卡片样式: `!bg-neutral-900 !border-neutral-800`
  - 统一按钮主题: `theme="warning"` (琥珀色)

### 3. 充值功能完善
- **状态**: 已完成
- **内容**:
  - 更新 `Deposit.tsx` - 对接 `financeApi.createDeposit()` 和 `financeApi.getRecords()`
  - 支持4种充值方式: 银行卡转账、USDT、支付宝、微信支付
  - 实现充值记录列表展示
  - 添加加载状态和错误处理

### 4. 提现功能完善
- **状态**: 已完成
- **内容**:
  - 更新 `Withdraw.tsx` - 对接 `financeApi.createWithdraw()` 和 `accountApi.getInfo()`
  - 支持银行卡和USDT两种提现方式
  - 实现提现手续费计算
  - 添加余额验证和加载状态

### 5. 订单历史完善
- **状态**: 已完成
- **内容**:
  - 更新 `OrderHistory.tsx` - 对接 `orderApi.getList()`
  - 添加状态过滤功能 (待成交/已成交/已取消/已拒绝)
  - 支持订单导出为CSV格式

### 6. 个人中心完善
- **状态**: 已完成
- **内容**:
  - 更新 `Profile.tsx` - 对接 `accountApi.getInfo()` 获取账户数据
  - 实现退出登录功能
  - 更新资产概览卡片显示真实数据

### 7. 银行卡管理完善
- **状态**: 已完成
- **内容**:
  - 更新 `BankCardManagement.tsx` - 对接 `bankCardApi` 全部API
  - 实现银行卡添加、删除、设置默认功能
  - 统一UI主题风格

### 8. API错误处理统一
- **状态**: 已完成
- **内容**:
  - 创建 `api-client.ts` - Axios配置和拦截器
  - 实现请求/响应拦截器
  - 统一错误码处理 (401/403/404/500/429等)
  - 401自动跳转到登录页
  - 开发环境打印请求耗时

---

## 待完成任务

### 1. 统一后台管理入口
- **状态**: 待完成
- **问题**: 存在多个管理员入口:
  - `AdminPC`
  - `AdminLite`
  - `AdminPCSimple`
  - `AdminSimpleAdmin`
  - `/admin-entry.html`
- **目标**: 整合为统一的后台管理入口

### 2. 添加API文档
- **状态**: 待完成
- **目标**: 使用Swagger/OpenAPI生成后端API文档

---

## 技术栈

### 前端
| 技术 | 版本/说明 |
|------|-----------|
| React | 18 |
| TypeScript | - |
| TDesign React | UI组件库 |
| Tailwind CSS | 样式框架 |
| React Router v6 | 路由 |
| ECharts | 图表 |
| Socket.IO Client | 实时通信 |

### 后端
| 技术 | 版本/说明 |
|------|-----------|
| Express | - |
| TypeScript | - |
| PostgreSQL | 数据库 |
| Redis | 缓存 |
| Socket.IO | 实时通信 |
| JWT | 认证 |
| bcryptjs | 加密 |

---

## API端点对照表

| 功能模块 | 前端API | 后端路由 | 状态 |
|---------|---------|-----------|------|
| 账户信息 | accountApi.getInfo() | /api/account/info | 已对接 |
| 账户余额 | accountApi.getBalance() | /api/account/balance | 已对接 |
| 风险等级 | accountApi.getRiskLevel() | /api/account/risk-level | 待对接 |
| 创建订单 | orderApi.create() | /api/order/create | 已存在 |
| 取消订单 | orderApi.cancel() | /api/order/cancel | 已存在 |
| 订单列表 | orderApi.getList() | /api/order/list | 已对接 |
| 持仓列表 | positionApi.getList() | /api/position/list | 已对接 |
| 平仓 | positionApi.close() | /api/position/close | 已存在 |
| 修改止盈止损 | positionApi.updateSlTp() | /api/position/update-sl-tp | 已存在 |
| 创建充值 | financeApi.createDeposit() | /finance/deposit | 已对接 |
| 创建提现 | financeApi.createWithdraw() | /finance/withdraw | 已对接 |
| 财务记录 | financeApi.getRecords() | /finance/records | 已对接 |
| 银行卡列表 | bankCardApi.getList() | /api/bank-cards | 待对接后端 |
| 添加银行卡 | bankCardApi.add() | /api/bank-cards | 待对接后端 |
| 删除银行卡 | bankCardApi.delete() | /api/bank-cards/:id | 待对接后端 |
| 设置默认卡 | bankCardApi.setDefault() | /api/bank-cards/:id/default | 待对接后端 |

---

## 前端页面清单

| 页面 | 路由 | API对接状态 | 备注 |
|------|------|-------------|------|
| 登录 | /login | - | 使用auth.service |
| 注册 | /register | - | 使用auth.service |
| 忘记密码 | /forgot-password | - | 使用auth.service |
| 首页 | /home | 已对接 | accountApi.getInfo() |
| 行情 | /market | - | 使用shuhai-backend.service |
| 持仓 | /position | 已对接 | positionApi.getList() |
| 分析 | /analysis | - | - |
| 个人中心 | /profile | 已对接 | accountApi.getInfo() |
| 充值 | /deposit | 已对接 | financeApi |
| 提现 | /withdraw | 已对接 | financeApi |
| 银行卡管理 | /bank-cards | 已对接 | bankCardApi |
| 帮助中心 | /help | - | 静态内容 |
| 订单历史 | /order-history | 已对接 | orderApi.getList() |
| 策略 | /strategy | - | 使用shuhai-backend.service |
| 管理员后台 | /admin-simple | - | 独立模块 |

---

## 下一步行动

1. **统一后台管理入口**
   - 确定使用哪个版本作为统一入口
   - 移除或重构其他版本
   - 确保导航和路由一致

2. **添加API文档**
   - 安装Swagger/OpenAPI工具
   - 为后端API添加注解
   - 生成交互式API文档

3. **后端银行卡API实现**
   - 实现银行卡列表API
   - 实现添加银行卡API
   - 实现删除银行卡API
   - 实现设置默认银行卡API
