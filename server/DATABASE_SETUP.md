# 数据库初始化指南

## 前置条件

1. 已安装 PostgreSQL 14+
2. 已创建数据库
3. 已配置环境变量

## 初始化步骤

### 1. 创建数据库

```bash
# 连接到PostgreSQL
psql -U postgres

# 创建数据库
CREATE DATABASE precious_metals_trading;
\q
```

### 2. 执行初始化脚本

```bash
# 进入项目目录
cd /workspace/server

# 执行初始化脚本
psql -U postgres -d precious_metals_trading -f database/init.sql

# 创建管理员账户
psql -U postgres -d precious_metals_trading -f database/init_admin.sql
```

### 3. 配置环境变量

复制 `.env.example` 为 `.env` 并配置:

```bash
cp .env.example .env
```

编辑 `.env` 文件,必须配置以下参数:

```env
# 数据库配置
DB_HOST=localhost
DB_PORT=5432
DB_NAME=precious_metals_trading
DB_USER=postgres
DB_PASSWORD=your_password

# JWT密钥 (必须设置,至少64字符)
JWT_SECRET=your_very_strong_random_secret_key_at_least_64_characters_long_please_change_this

# 数海API配置
SHUHAI_USERNAME=your_username
SHUHAI_PASSWORD=your_password
```

### 4. 生成JWT密钥

使用以下命令生成安全的JWT密钥:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

将输出的密钥复制到 `.env` 文件的 `JWT_SECRET` 参数。

### 5. 安装依赖并启动

```bash
# 安装依赖
npm install

# 启动服务
npm run dev
```

## 默认账户

初始化完成后,系统会创建以下默认账户:

### 管理员账户
- 用户名: `admin`
- 密码: `admin123`
- 角色: 超级管理员

**重要**: 生产环境部署后,请立即修改默认密码!

### 测试用户账户
- 用户名: `testuser`
- 密码: `admin123`
- 角色: 普通用户
- 初始资金: 100,000

## 修改默认密码

### 方法1: 通过API修改

```bash
# 使用curl修改密码
curl -X POST http://localhost:3001/auth/reset-password \
  -H "Content-Type: application/json" \
  -d '{
    "username": "admin",
    "new_password": "your_new_strong_password"
  }'
```

### 方法2: 直接修改数据库

```bash
# 生成新密码哈希
node -e "const bcrypt = require('bcryptjs'); console.log(bcrypt.hashSync('your_new_password', 10));"

# 更新数据库
psql -U postgres -d precious_metals_trading
UPDATE users SET password_hash = '$2a$10$...' WHERE username = 'admin';
\q
```

## 验证安装

访问健康检查接口:

```bash
curl http://localhost:3001/health
```

应该返回:

```json
{
  "code": 0,
  "message": "服务运行正常",
  "data": {
    "status": "ok",
    "timestamp": 1234567890,
    "uptime": 123.456
  }
}
```

## 故障排查

### 数据库连接失败
- 检查 `.env` 中的数据库配置
- 确认PostgreSQL服务正在运行
- 确认数据库已创建

### JWT密钥未配置
- 确认 `.env` 文件中已配置 `JWT_SECRET`
- 密钥长度必须至少32字符(建议64字符以上)

### 端口被占用
- 修改 `.env` 中的 `PORT` 参数
- 或停止占用3001端口的服务

## 安全建议

1. **立即修改默认密码**
2. **使用强JWT密钥** (至少64字符)
3. **配置数据库连接加密** (SSL)
4. **设置防火墙规则**
5. **定期备份数据库**
6. **监控系统日志**
