# 贵金属交易系统 - 完整上线部署指南

## 📋 目录

1. [系统概述](#1-系统概述)
2. [技术栈说明](#2-技术栈说明)
3. [数据库要求](#3-数据库要求)
4. [服务器环境要求](#4-服务器环境要求)
5. [本地部署](#5-本地部署)
6. [生产环境部署](#6-生产环境部署)
7. [安全配置](#7-安全配置)
8. [监控与维护](#8-监控与维护)
9. [故障排查](#9-故障排查)

---

## 1. 系统概述

### 1.1 系统架构

```
┌─────────────────────────────────────────────────────────────┐
│                        前端层 (React)                          │
│              React 18 + TypeScript + TDesign                  │
└─────────────────────────────────────────────────────────────┘
                              ↓ HTTP/HTTPS
┌─────────────────────────────────────────────────────────────┐
│                      后端API层 (Node.js)                       │
│              Express.js + TypeScript + Socket.IO               │
└─────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────┐
│                    数据存储层                                 │
│              PostgreSQL (主库) + Redis (缓存)                  │
└─────────────────────────────────────────────────────────────┘
```

### 1.2 核心功能模块

| 模块 | 功能描述 | 状态 |
|-----|---------|------|
| 用户认证 | JWT登录/注册/权限管理 | ✅ 已完成 |
| 账户管理 | 资金账户、余额、风险等级 | ✅ 已完成 |
| 行情数据 | 实时行情、K线、市场深度 | ✅ 已完成 |
| 交易功能 | 下单、撤单、持仓管理 | ✅ 已完成 |
| 风控系统 | 保证金、强平、止损止盈 | ✅ 已完成 |
| 财务管理 | 充值/提现申请、审核 | ✅ 已完成 |
| 代理系统 | 多级代理、佣金结算 | ✅ 已完成 |
| AI分析 | 智能交易建议 | ✅ 已完成 |

---

## 2. 技术栈说明

### 2.1 前端技术栈

| 技术/框架 | 版本 | 用途 |
|----------|------|------|
| **React** | 18.3.1 | 前端框架 |
| **TypeScript** | 5.6.2 | 类型安全的JavaScript |
| **TDesign** | 1.12.0 | UI组件库 |
| **React Router** | 6.22.0 | 路由管理 |
| **Tailwind CSS** | 3.4.17 | CSS框架 |
| **ECharts** | 5.5.0 | 图表库 |
| **Recharts** | 2.10.4 | 数据可视化 |
| **Day.js** | 1.11.10 | 日期处理 |
| **Lucide React** | 0.344.0 | 图标库 |
| **Vite** | 5.4.10 | 构建工具 |

### 2.2 后端技术栈

| 技术/框架 | 版本 | 用途 |
|----------|------|------|
| **Node.js** | 20.x+ | JavaScript运行时 |
| **Express.js** | 4.18.2 | Web应用框架 |
| **TypeScript** | 5.3.3 | 类型安全 |
| **PostgreSQL** | 14+ | 关系型数据库 |
| **Redis** | 7+ | 缓存/会话存储 |
| **Socket.IO** | 4.7.4 | WebSocket通信 |
| **JWT** | 9.0.2 | 用户认证 |
| **bcryptjs** | 2.4.3 | 密码加密 |
| **Winston** | 3.11.0 | 日志管理 |
| **Axios** | 1.6.2 | HTTP客户端 |

### 2.3 开发工具

| 工具 | 版本 | 用途 |
|------|------|------|
| ESLint | 9.13.0 | 代码检查 |
| PM2 | 5.3.0 | 进程管理 |
| TSX | 4.7.0 | TypeScript执行器 |

---

## 3. 数据库要求

### 3.1 MySQL 5.6 支持情况

**❌ 不支持 MySQL 5.6**

**原因：**
1. 本项目使用 **PostgreSQL** 作为主数据库，不是 MySQL
2. PostgreSQL 是更专业的开源数据库，具有以下优势：
   - 更强大的 JSONB 支持
   - 更好的事务处理能力
   - 更完善的数据类型
   - 更强的并发性能

### 3.2 PostgreSQL 版本要求

**✅ 推荐版本：PostgreSQL 14+**

**最低版本：PostgreSQL 12**

**特性支持对比：**

| 特性 | PG 12 | PG 13 | PG 14 | PG 15 | PG 16+ |
|-----|-------|-------|-------|-------|--------|
| JSONB 操作 | ✅ | ✅ | ✅ | ✅ | ✅ |
| 全文搜索 | ✅ | ✅ | ✅ | ✅ | ✅ |
| 窗口函数 | ✅ | ✅ | ✅ | ✅ | ✅ |
| 分区表 | ✅ | ✅ | ✅ | ✅ | ✅ |
| 性能优化 | ⭐⭐⭐ | ⭐⭐⭐⭐ | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐⭐ |

### 3.3 Redis 版本要求

**推荐版本：Redis 7.0+**

**最低版本：Redis 6.0**

**用途：**
- 会话存储
- 行情数据缓存
- API 请求限流
- 实时数据订阅

### 3.4 数据库容量规划

| 数据类型 | 预估容量 | 建议配置 |
|---------|---------|---------|
| 用户数据 | 100MB-1GB | 5GB |
| 订单数据 | 1GB-10GB | 20GB |
| 持仓数据 | 100MB-1GB | 2GB |
| 行情历史 | 10GB-50GB | 100GB |
| 日志数据 | 5GB-20GB | 50GB |

---

## 4. 服务器环境要求

### 4.1 硬件配置

#### 开发环境（最低配置）

| 资源 | 最低要求 | 推荐配置 |
|-----|---------|---------|
| CPU | 2核 | 4核 |
| 内存 | 4GB | 8GB |
| 硬盘 | 50GB SSD | 100GB SSD |

#### 生产环境（推荐配置）

| 资源 | 最低要求 | 推荐配置 |
|-----|---------|---------|
| CPU | 4核 | 8核+ |
| 内存 | 8GB | 16GB+ |
| 硬盘 | 200GB SSD | 500GB+ SSD |
| 带宽 | 10Mbps | 100Mbps+ |

### 4.2 操作系统

**支持的系统：**
- ✅ Ubuntu 20.04 / 22.04 LTS
- ✅ CentOS 7 / 8
- ✅ Debian 11 / 12
- ✅ Windows Server 2019+
- ✅ macOS 12+

### 4.3 软件依赖

#### 必须安装的软件

```bash
# Node.js 20.x+
node >= 20.0.0
npm >= 10.0.0

# PostgreSQL 14+
postgresql >= 14.0

# Redis 7.0+
redis >= 7.0

# Nginx (可选，用于反向代理)
nginx >= 1.20
```

---

## 5. 本地部署

### 5.1 克隆项目

```bash
# 进入项目目录
cd c:/Users/WY/Desktop/precious-metals-trading

# 查看项目结构
dir
```

### 5.2 数据库安装与配置

#### Windows 上安装 PostgreSQL

1. 下载 PostgreSQL 安装包：
   - 访问：https://www.postgresql.org/download/windows/
   - 选择 PostgreSQL 14 或 15 版本
   - 安装时记住设置的密码（默认端口 5432）

2. 创建数据库：
```bash
# 使用 pgAdmin 或命令行工具
createdb precious_metals_trading
```

3. 执行初始化脚本：
```bash
# 进入数据库目录
cd server/database

# 使用 psql 执行初始化脚本
psql -U postgres -d precious_metals_trading -f init_complete.sql
```

#### Windows 上安装 Redis

1. 下载 Redis for Windows：
   - 访问：https://github.com/microsoftarchive/redis/releases
   - 下载 Redis-x64-3.2.100.msi

2. 启动 Redis 服务：
```bash
# 启动 Redis
redis-server

# 或作为服务启动
redis-server --service-start
```

### 5.3 环境变量配置

#### 后端环境变量配置

创建 `server/.env` 文件：

```bash
# 服务器配置
PORT=3001
NODE_ENV=development

# 数据库配置 (PostgreSQL)
DB_HOST=localhost
DB_PORT=5432
DB_NAME=precious_metals_trading
DB_USER=postgres
DB_PASSWORD=your_password_here

# Redis 配置
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=

# JWT 配置
JWT_SECRET=precious-metals-trading-secret-key-2024-secure-32chars
JWT_EXPIRES_IN=7d

# 前端地址
CLIENT_URL=http://localhost:5173

# 行情数据源配置
MARKET_DATA_SOURCE=shuhai
SHUHAI_API_URL=https://api.lxd997.dpdns.org/stock.php

# 文件上传路径
UPLOAD_PATH=./uploads

# 日志配置
LOG_LEVEL=debug
LOG_DIR=./logs
```

#### 前端环境变量配置

创建 `src/.env` 或 `src/.env.local` 文件：

```bash
# API 地址
VITE_API_BASE_URL=http://localhost:3001/api

# WebSocket 地址
VITE_WS_URL=ws://localhost:3001

# 应用配置
VITE_APP_NAME=贵金属交易系统
```

### 5.4 安装依赖

```bash
# 安装后端依赖
cd server
npm install

# 安装前端依赖
cd ..
npm install
```

### 5.5 初始化数据库

```bash
# 使用提供的初始化脚本
cd server/database
psql -U postgres -d precious_metals_trading -f init_complete.sql
```

### 5.6 启动服务

#### 方式一：使用批处理脚本（Windows）

```bash
# 启动后端和前端
start.bat

# 或分别启动
start-backend.bat    # 启动后端服务
start-frontend.bat   # 启动前端服务
```

#### 方式二：手动启动

```bash
# 终端1：启动后端服务
cd server
npm run dev

# 终端2：启动前端服务
npm run dev
```

### 5.7 访问系统

- **前端地址：** http://localhost:5173
- **后端API：** http://localhost:3001
- **API健康检查：** http://localhost:3001/health

### 5.8 默认测试账号

```
演示账户：
- 用户名：demo-user
- 初始资金：¥1,000,000
```

---

## 6. 生产环境部署

### 6.1 服务器准备

#### 6.1.1 更新系统（以 Ubuntu 为例）

```bash
# 更新软件包
sudo apt update && sudo apt upgrade -y

# 安装必要工具
sudo apt install -y curl git vim wget build-essential
```

#### 6.1.2 安装 Node.js 20.x

```bash
# 使用 nvm 安装（推荐）
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.0/install.sh | bash
source ~/.bashrc
nvm install 20
nvm use 20
nvm alias default 20

# 验证安装
node -v  # 应显示 v20.x.x
npm -v   # 应显示 10.x.x
```

#### 6.1.3 安装 PostgreSQL 14

```bash
# 添加 PostgreSQL 仓库
sudo sh -c 'echo "deb http://apt.postgresql.org/pub/repos/apt $(lsb_release -cs)-pgdg main" > /etc/apt/sources.list.d/pgdg.list'

# 导入签名密钥
wget --quiet -O - https://www.postgresql.org/media/keys/ACCC4CF8.asc | sudo apt-key add -

# 安装 PostgreSQL
sudo apt update
sudo apt install -y postgresql-14 postgresql-contrib-14

# 启动服务
sudo systemctl start postgresql
sudo systemctl enable postgresql

# 创建数据库和用户
sudo -u postgres psql <<EOF
CREATE DATABASE precious_metals_trading;
CREATE USER trading_user WITH PASSWORD 'strong_password_here';
GRANT ALL PRIVILEGES ON DATABASE precious_metals_trading TO trading_user;
ALTER DATABASE precious_metals_trading OWNER TO trading_user;
\q
EOF
```

#### 6.1.4 安装 Redis

```bash
# 添加 Redis 仓库
sudo add-apt-repository ppa:redislabs/redis -y
sudo apt update

# 安装 Redis
sudo apt install -y redis-server

# 配置 Redis
sudo vim /etc/redis/redis.conf

# 修改以下配置：
# bind 0.0.0.0  # 允许外部访问
# requirepass your_redis_password  # 设置密码

# 启动服务
sudo systemctl start redis
sudo systemctl enable redis

# 验证
redis-cli ping  # 应返回 PONG
```

#### 6.1.5 安装 Nginx（可选）

```bash
# 安装 Nginx
sudo apt install -y nginx

# 启动服务
sudo systemctl start nginx
sudo systemctl enable nginx

# 验证
curl http://localhost
```

### 6.2 部署代码

#### 6.2.1 上传代码到服务器

```bash
# 方式一：使用 git
git clone <your-repo-url> /var/www/precious-metals-trading
cd /var/www/precious-metals-trading

# 方式二：使用 SCP 压缩上传
# 在本地执行：
tar -czf precious-metals-trading.tar.gz precious-metals-trading/
scp precious-metals-trading.tar.gz user@server:/var/www/

# 在服务器上解压
cd /var/www
tar -xzf precious-metals-trading.tar.gz
```

#### 6.2.2 安装依赖

```bash
cd /var/www/precious-metals-trading

# 安装后端依赖
cd server
npm install --production

# 安装前端依赖
cd ..
npm install --production
```

### 6.3 配置生产环境

#### 6.3.1 后端环境变量

创建 `server/.env.production`：

```bash
# 服务器配置
PORT=3001
NODE_ENV=production

# 数据库配置
DB_HOST=localhost
DB_PORT=5432
DB_NAME=precious_metals_trading
DB_USER=trading_user
DB_PASSWORD=strong_password_here

# Redis 配置
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=your_redis_password

# JWT 配置（生产环境必须使用强密钥）
JWT_SECRET=请生成一个32位以上的强密钥
JWT_EXPIRES_IN=7d

# 前端地址
CLIENT_URL=https://your-domain.com

# 行情数据源配置
MARKET_DATA_SOURCE=shuhai
SHUHAI_API_URL=https://api.lxd997.dpdns.org/stock.php

# 文件上传路径
UPLOAD_PATH=/var/www/uploads

# 日志配置
LOG_LEVEL=info
LOG_DIR=/var/log/precious-metals
```

#### 6.3.2 前端环境变量

创建 `.env.production`：

```bash
VITE_API_BASE_URL=https://api.your-domain.com
VITE_WS_URL=wss://api.your-domain.com
VITE_APP_NAME=贵金属交易系统
```

### 6.4 初始化数据库

```bash
cd /var/www/precious-metals-trading/server/database

# 执行初始化脚本
psql -U trading_user -d precious_metals_trading -f init_complete.sql
```

### 6.5 构建前端

```bash
cd /var/www/precious-metals-trading

# 构建生产版本
npm run build

# 构建产物在 dist/ 目录
```

### 6.6 配置 PM2（进程管理）

#### 6.6.1 安装 PM2

```bash
npm install -g pm2
```

#### 6.6.2 创建 PM2 配置文件

创建 `server/ecosystem.config.js`：

```javascript
module.exports = {
  apps: [{
    name: 'trading-backend',
    script: 'dist/index.js',
    instances: 2,
    exec_mode: 'cluster',
    autorestart: true,
    watch: false,
    max_memory_restart: '1G',
    env: {
      NODE_ENV: 'production',
      PORT: 3001
    },
    error_file: '/var/log/precious-metals/err.log',
    out_file: '/var/log/precious-metals/out.log',
    log_date_format: 'YYYY-MM-DD HH:mm:ss Z'
  }]
};
```

#### 6.6.3 启动服务

```bash
cd /var/www/precious-metals-trading/server

# 编译 TypeScript
npm run build

# 启动服务
pm2 start ecosystem.config.js

# 查看状态
pm2 status

# 查看日志
pm2 logs trading-backend

# 保存 PM2 配置
pm2 save
pm2 startup
```

### 6.7 配置 Nginx（反向代理）

创建 `/etc/nginx/sites-available/precious-metals`：

```nginx
# API 服务器配置
upstream api_backend {
    server localhost:3001;
    keepalive 64;
}

# 前端服务器配置
server {
    listen 80;
    listen [::]:80;
    server_name your-domain.com www.your-domain.com;

    # 前端静态文件
    root /var/www/precious-metals-trading/dist;
    index index.html;

    # 前端路由
    location / {
        try_files $uri $uri/ /index.html;
    }

    # API 反向代理
    location /api {
        proxy_pass http://api_backend;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
        proxy_read_timeout 86400;
    }

    # WebSocket 反向代理
    location /socket.io {
        proxy_pass http://api_backend;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    }

    # Gzip 压缩
    gzip on;
    gzip_types text/plain text/css application/json application/javascript text/xml application/xml application/xml+rss text/javascript;
    gzip_min_length 1000;

    # 缓存静态资源
    location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2|ttf|eot)$ {
        expires 1y;
        add_header Cache-Control "public, immutable";
    }
}

# 可选：单独的 API 子域名
# server {
#     listen 80;
#     server_name api.your-domain.com;
#
#     location / {
#         proxy_pass http://api_backend;
#         proxy_http_version 1.1;
#         proxy_set_header Upgrade $http_upgrade;
#         proxy_set_header Connection 'upgrade';
#         proxy_set_header Host $host;
#         proxy_cache_bypass $http_upgrade;
#     }
# }
```

#### 启用配置

```bash
# 创建软链接
sudo ln -s /etc/nginx/sites-available/precious-metals /etc/nginx/sites-enabled/

# 测试配置
sudo nginx -t

# 重新加载 Nginx
sudo systemctl reload nginx
```

### 6.8 配置 SSL 证书（HTTPS）

#### 使用 Let's Encrypt 免费证书

```bash
# 安装 Certbot
sudo apt install -y certbot python3-certbot-nginx

# 获取证书（自动配置 Nginx）
sudo certbot --nginx -d your-domain.com -d www.your-domain.com

# 自动续期
sudo certbot renew --dry-run
```

### 6.9 配置防火墙

```bash
# Ubuntu UFW
sudo ufw allow 22/tcp      # SSH
sudo ufw allow 80/tcp      # HTTP
sudo ufw allow 443/tcp     # HTTPS
sudo ufw enable
```

---

## 7. 安全配置

### 7.1 生产环境安全检查清单

- [ ] 使用强密码（数据库、Redis、JWT密钥）
- [ ] 启用 HTTPS（SSL/TLS）
- [ ] 配置 CORS（仅允许信任的域名）
- [ ] 启用请求限流（Rate Limiting）
- [ ] 禁用 Node.js 调试模式
- [ ] 设置安全响应头（Helmet）
- [ ] 定期更新依赖包
- [ ] 配置日志审计
- [ ] 数据库备份策略
- [ ] 禁用不必要的端口和服务

### 7.2 密钥安全

#### JWT 密钥生成

```bash
# 生成 32 位随机密钥
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

#### 数据库密码策略

```bash
# 要求：
# - 最少 12 位
# - 包含大小写字母、数字、特殊字符
# - 定期更换（建议每 90 天）
```

### 7.3 备份策略

#### 数据库备份脚本

创建 `/var/scripts/backup.sh`：

```bash
#!/bin/bash

# 配置
DB_NAME="precious_metals_trading"
DB_USER="trading_user"
DB_PASS="your_password"
BACKUP_DIR="/var/backups/postgresql"
DATE=$(date +%Y%m%d_%H%M%S)

# 创建备份目录
mkdir -p $BACKUP_DIR

# 备份数据库
pg_dump -U $DB_USER -d $DB_NAME | gzip > $BACKUP_DIR/db_$DATE.sql.gz

# 删除 30 天前的备份
find $BACKUP_DIR -name "db_*.sql.gz" -mtime +30 -delete

echo "Backup completed: db_$DATE.sql.gz"
```

#### 添加定时任务

```bash
# 编辑 crontab
crontab -e

# 每天凌晨 2 点备份
0 2 * * * /var/scripts/backup.sh
```

---

## 8. 监控与维护

### 8.1 PM2 监控

```bash
# 查看状态
pm2 status

# 查看实时日志
pm2 logs trading-backend

# 查看资源使用
pm2 monit

# 重启服务
pm2 restart trading-backend

# 停止服务
pm2 stop trading-backend
```

### 8.2 系统监控

#### 安装监控工具（可选）

```bash
# 安装 htop
sudo apt install -y htop

# 安装 iotop
sudo apt install -y iotop

# 安装 netstat
sudo apt install -y net-tools
```

### 8.3 日志管理

#### 后端日志位置

```
/var/log/precious-metals/
├── err.log          # 错误日志
├── out.log          # 输出日志
└── access.log       # 访问日志（如配置）
```

#### 日志轮转配置

创建 `/etc/logrotate.d/precious-metals`：

```
/var/log/precious-metals/*.log {
    daily
    rotate 30
    compress
    delaycompress
    notifempty
    create 0644 www-data www-data
    sharedscripts
    postrotate
        pm2 restart trading-backend
    endscript
}
```

### 8.4 性能优化

#### 数据库优化

```sql
-- 创建索引
CREATE INDEX idx_orders_user_id ON orders(user_id);
CREATE INDEX idx_positions_product_code ON positions(product_code);
CREATE INDEX idx_transactions_created_at ON transactions(created_at);

-- 定期清理历史数据
DELETE FROM orders WHERE created_at < NOW() - INTERVAL '1 year';
```

#### Redis 缓存优化

```bash
# 配置 Redis 内存限制
vim /etc/redis/redis.conf

# 设置最大内存
maxmemory 2gb

# 设置淘汰策略
maxmemory-policy allkeys-lru
```

---

## 9. 故障排查

### 9.1 常见问题

#### 问题1：后端服务无法启动

**检查步骤：**

```bash
# 1. 检查端口占用
netstat -tlnp | grep 3001

# 2. 查看日志
pm2 logs trading-backend

# 3. 检查环境变量
cat server/.env.production

# 4. 手动测试
cd server
npm run dev
```

**常见原因：**
- 端口被占用 → 修改 PORT 环境变量
- 数据库连接失败 → 检查 DB_HOST、DB_USER、DB_PASSWORD
- Redis 连接失败 → 检查 REDIS_HOST、REDIS_PORT
- 依赖缺失 → 重新执行 `npm install`

#### 问题2：数据库连接失败

**检查步骤：**

```bash
# 测试数据库连接
psql -U trading_user -d precious_metals_trading -h localhost

# 检查 PostgreSQL 服务状态
sudo systemctl status postgresql

# 查看 PostgreSQL 日志
sudo tail -f /var/log/postgresql/postgresql-14-main.log
```

**常见原因：**
- 密码错误 → 检查 DB_PASSWORD
- 用户权限不足 → 使用 `GRANT ALL PRIVILEGES` 授权
- 数据库不存在 → 执行初始化脚本

#### 问题3：前端无法连接后端

**检查步骤：**

```bash
# 1. 检查后端服务
curl http://localhost:3001/health

# 2. 检查 CORS 配置
# 在 server/index.ts 中检查 origin 配置

# 3. 检查 Nginx 配置
sudo nginx -t
sudo systemctl reload nginx
```

#### 问题4：行情数据不更新

**检查步骤：**

```bash
# 1. 检查行情数据源
curl https://api.lxd997.dpdns.org/stock.php?code=XAUUSD

# 2. 检查 Redis 缓存
redis-cli
> keys market:*

# 3. 查看日志
pm2 logs trading-backend | grep market
```

### 9.2 日志分析

#### 查看错误日志

```bash
# 最近 100 行错误日志
tail -n 100 /var/log/precious-metals/err.log

# 实时查看错误日志
tail -f /var/log/precious-metals/err.log

# 搜索特定错误
grep "ERROR" /var/log/precious-metals/err.log
```

### 9.3 性能问题

#### 查看资源使用

```bash
# CPU 和内存
top
htop

# 磁盘使用
df -h

# 网络连接
netstat -antp

# Node.js 进程
pm2 monit
```

---

## 10. 附录

### 10.1 快速启动命令

```bash
# 本地开发
start.bat

# 本地分别启动
start-backend.bat
start-frontend.bat

# 生产环境启动（PM2）
cd server
pm2 start ecosystem.config.js

# 生产环境停止
pm2 stop trading-backend

# 生产环境重启
pm2 restart trading-backend
```

### 10.2 端口说明

| 服务 | 默认端口 | 说明 |
|-----|---------|------|
| 前端 | 5173 | 开发环境 Vite Dev Server |
| 后端 API | 3001 | Express.js 服务 |
| PostgreSQL | 5432 | 数据库 |
| Redis | 6379 | 缓存服务 |
| Nginx HTTP | 80 | Web 服务器 |
| Nginx HTTPS | 443 | Web 服务器（SSL） |

### 10.3 重要文件路径

| 文件/目录 | 说明 |
|----------|------|
| `server/src/index.ts` | 后端入口文件 |
| `server/src/routes/` | API 路由 |
| `server/src/services/` | 业务逻辑 |
| `server/src/utils/` | 工具函数 |
| `server/database/` | 数据库脚本 |
| `src/` | 前端源代码 |
| `dist/` | 前端构建产物 |
| `server/dist/` | 后端构建产物 |
| `.env` / `.env.production` | 环境变量配置 |
| `vite.config.ts` | Vite 配置 |
| `package.json` | 前端依赖 |
| `server/package.json` | 后端依赖 |

### 10.4 联系与支持

- **GitHub Issues：** [项目 Issues 页面]
- **技术文档：** 见项目根目录下的 Markdown 文档

---

## 📌 总结

本系统采用 **PostgreSQL** 数据库（**不支持 MySQL**），前后端分离架构，技术栈成熟稳定。部署前请确保：

1. ✅ 数据库使用 PostgreSQL 14+
2. ✅ 安装 Node.js 20.x+
3. ✅ 配置正确的环境变量
4. ✅ 执行数据库初始化脚本
5. ✅ 生产环境启用 HTTPS
6. ✅ 配置定期备份策略
7. ✅ 设置防火墙规则

如有问题，请参考故障排查章节或查看日志文件。
