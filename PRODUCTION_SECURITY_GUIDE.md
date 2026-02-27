# 生产环境部署安全指南

本文档描述了贵金属期货交易系统在生产环境部署时的安全配置要求。

## 1. 环境变量配置

### 前端环境变量

创建 `server/.env` 文件（确保已添加到 .gitignore）：

```bash
# GEMINI AI 配置
VITE_GEMINI_API_KEY=your_actual_gemini_api_key_here

# 数海行情数据配置
VITE_SHUHAI_USERNAME=your_actual_shuhai_username
VITE_SHUHAI_PASSWORD=your_actual_shuhai_password

# 后端服务配置（生产环境使用 HTTPS）
VITE_API_BASE_URL=https://your-domain.com

# Finnhub 金融新闻 API 配置
VITE_FINNHUB_API_KEY=your_finnhub_api_key_here
```

### 后端环境变量

创建 `server/.env` 文件（确保已添加到 .gitignore）：

```bash
# 服务器配置
PORT=3001
NODE_ENV=production

# CORS白名单 (生产环境必须设置)
# 多个域名用逗号分隔，如：https://example.com,https://app.example.com
CORS_ORIGINS=https://your-domain.com

# 客户端地址 (用于 WebSocket CORS)
CLIENT_URL=https://your-domain.com

# 数据库配置
DB_HOST=localhost
DB_PORT=5432
DB_NAME=precious_metals_trading
DB_USER=postgres
DB_PASSWORD=your_strong_password_here

# 日志数据库配置（可选）
DB_LOGS_NAME=precious_metals_trading_logs

# 数海API配置 (请替换为实际账号)
SHUHAI_USERNAME=your_actual_shuhai_username
SHUHAI_PASSWORD=your_actual_shuhai_password

# JWT密钥 (生产环境必须使用强密钥)
# 请使用以下命令生成新的密钥: openssl rand -base64 64
JWT_SECRET=your_jwt_secret_here_use_openssl_rand_base64_64

# Redis配置（可选，推荐生产环境使用）
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=your_redis_password_here
```

## 2. HTTPS 配置

生产环境必须使用 HTTPS。以下是使用 Nginx 的配置示例：

```nginx
# /etc/nginx/sites-available/your-domain.com

# HTTP to HTTPS redirect
server {
    listen 80;
    server_name your-domain.com www.your-domain.com;
    return 301 https://$server_name$request_uri;
}

# HTTPS server configuration
server {
    listen 443 ssl http2;
    server_name your-domain.com www.your-domain.com;

    # SSL 证书配置
    ssl_certificate /etc/letsencrypt/live/your-domain.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/your-domain.com/privkey.pem;

    # SSL 安全配置
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers ECDHE-RSA-AES256-GCM-SHA384:ECDHE-RSA-AES128-GCM-SHA256;
    ssl_prefer_server_ciphers off;
    ssl_session_cache shared:SSL:10m;
    ssl_session_timeout 10m;

    # 安全头
    add_header Strict-Transport-Security "max-age=31536000; includeSubDomains; preload" always;
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-XSS-Protection "1; mode=block" always;
    add_header Referrer-Policy "strict-origin-when-cross-origin" always;

    # 前端静态文件
    location / {
        root /path/to/frontend/dist;
        try_files $uri $uri/ /index.html;
        add_header Cache-Control "public, max-age=3600";
    }

    # API 代理
    location /api/ {
        proxy_pass http://localhost:3001/api/;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }

    # Socket.IO 代理
    location /socket.io/ {
        proxy_pass http://localhost:3001/socket.io/;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

## 3. 证书申请

使用 Let's Encrypt 免费证书：

```bash
# 安装 certbot
sudo apt-get install certbot python3-certbot-nginx

# 获取证书
sudo certbot --nginx -d your-domain.com -d www.your-domain.com

# 自动续期
sudo certbot renew --dry-run
```

## 4. 数据库安全

### PostgreSQL 安全配置

编辑 `/etc/postgresql/14/main/postgresql.conf`：

```ini
# 仅监听本地连接
listen_addresses = 'localhost'

# 启用 SSL 连接（可选但推荐）
ssl = on
ssl_cert_file = '/etc/ssl/certs/ssl-cert-snakeoil.pem'
ssl_key_file = '/etc/ssl/private/ssl-cert-snakeoil.key'

# 设置最大连接数
max_connections = 100
```

### 创建强密码的用户

```sql
-- 创建具有强密码的用户
CREATE USER trading_user WITH PASSWORD 'your_strong_password_here';

-- 创建数据库
CREATE DATABASE precious_metals_trading OWNER trading_user;

-- 授予权限
GRANT ALL PRIVILEGES ON DATABASE precious_metals_trading TO trading_user;
```

## 5. 防火墙配置

使用 UFW 配置防火墙：

```bash
# 启用 UFW
sudo ufw enable

# 允许 SSH
sudo ufw allow 22/tcp

# 允许 HTTP/HTTPS
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp

# 拒绝其他端口（包括后端端口 3001）
sudo ufw deny 3001/tcp

# 查看状态
sudo ufw status
```

## 6. 服务器安全加固

### 更新系统

```bash
sudo apt update && sudo apt upgrade -y
```

### 禁用 root 登录

编辑 `/etc/ssh/sshd_config`：

```
PermitRootLogin no
PasswordAuthentication no
```

### 配置 fail2ban 防止暴力破解

```bash
# 安装 fail2ban
sudo apt install fail2ban -y

# 创建本地配置
sudo cp /etc/fail2ban/jail.conf /etc/fail2ban/jail.local

# 启动服务
sudo systemctl enable fail2ban
sudo systemctl start fail2ban
```

## 7. 应用层安全

### Rate Limiting 已配置

服务器已配置以下限流规则：

- 登录接口：5次/15分钟
- 认证接口：10次/分钟
- 交易接口：20次/分钟
- API通用：100次/分钟

### Security Headers 已配置

以下安全头在生产环境自动启用：

- Content Security Policy (CSP)
- HTTP Strict Transport Security (HSTS)
- X-Frame-Options
- X-Content-Type-Options
- Referrer-Policy

### 输入验证

所有 API 接口都应进行输入验证，防止 SQL 注入和 XSS 攻击。

## 8. 监控和日志

### 日志位置

- 应用日志：`server/logs/`
- Nginx 日志：`/var/log/nginx/`
- PostgreSQL 日志：`/var/log/postgresql/`

### 健康检查

健康检查端点：`https://your-domain.com/health`

## 9. 备份策略

### 数据库备份

```bash
# 创建每日备份脚本
#!/bin/bash
BACKUP_DIR="/backup/postgresql"
DATE=$(date +%Y%m%d)
PGPASSWORD="your_db_password" pg_dump -h localhost -U trading_user precious_metals_trading > $BACKUP_DIR/trading_$DATE.sql

# 保留最近30天的备份
find $BACKUP_DIR -name "trading_*.sql" -mtime +30 -delete
```

### 定时任务

```bash
# 编辑 crontab
crontab -e

# 添加每日凌晨2点执行备份
0 2 * * * /path/to/backup-script.sh
```

## 10. 部署检查清单

部署前请确认以下事项：

- [ ] 所有环境变量已正确配置
- [ ] 数据库密码足够复杂（至少16字符，包含大小写字母、数字、特殊字符）
- [ ] JWT 密钥已使用 `openssl rand -base64 64` 生成
- [ ] HTTPS 证书已配置且有效
- [ ] CORS 白名单已正确设置
- [ ] 防火墙已正确配置
- [ ] 数据库备份脚本已配置
- [ ] 日志系统已配置
- [ ] 监控告警已配置
- [ ] .env 文件已添加到 .gitignore
- [ ] API 密钥和密码未提交到代码仓库
- [ ] 健康检查端点可访问
- [ ] WebSocket 连接正常工作

## 11. 应急响应

### 紧急关闭服务

```bash
# 停止应用
pm2 stop all

# 停止数据库
sudo systemctl stop postgresql

# 停止 Nginx
sudo systemctl stop nginx
```

### 恢复数据库

```bash
PGPASSWORD="your_db_password" psql -h localhost -U trading_user -d precious_metals_trading < /backup/postgresql/trading_YYYYMMDD.sql
```

## 12. 联系信息

如发现安全问题或需要技术支持，请联系系统管理员。
