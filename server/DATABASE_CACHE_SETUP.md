# 数海API数据库缓存设置指南

## 概述

数海API数据现在使用三层缓存架构：
1. **PostgreSQL数据库缓存** - 持久化存储，重启后数据不丢失
2. **内存缓存** - 高速访问，提升响应速度
3. **数海API** - 数据源

## 数据库表结构

### 1. 实时行情缓存表 (`shuhai_quote_cache`)
- 存储品种的实时价格数据
- 缓存时间：5秒
- 包含字段：价格、涨跌幅、买卖价等

### 2. K线数据缓存表 (`shuhai_kline_cache`)
- 存储K线历史数据
- 支持多个时间周期：1分、5分、15分、30分、1小时、4小时、日、周
- 缓存时间：60秒
- 包含字段：OHLC价格、成交量等

## 初始化步骤

### 1. 确保PostgreSQL数据库运行

```bash
# 检查PostgreSQL是否运行
# Windows
sc query postgresql-x64-xx

# Linux/Mac
pg_isready
```

### 2. 设置环境变量

在 `server/.env` 文件中配置数据库连接信息：

```env
# 数据库配置
DB_HOST=localhost
DB_PORT=5432
DB_NAME=precious_metals_trading
DB_USER=postgres
DB_PASSWORD=your_password

# 数海API配置
SHUHAI_USERNAME=wu123
SHUHAI_PASSWORD=wu123
```

### 3. 创建数据库（如果不存在）

```bash
# 连接到PostgreSQL
psql -U postgres

# 创建数据库
CREATE DATABASE precious_metals_trading;
```

### 4. 初始化缓存表

```bash
cd server

# 使用tsxx运行初始化脚本
npm run db:init-shuhai
```

或者直接运行TypeScript脚本：

```bash
npx tsx src/scripts/init-shuhai-cache.ts
```

### 5. 验证表创建

```sql
-- 连接到数据库
\c precious_metals_trading

-- 查看创建的表
\dt shuhai_*

-- 应该看到两个表：
-- shuhai_quote_cache
-- shuhai_kline_cache
```

## 使用说明

### 数据缓存流程

1. **前端请求** → 后端API
2. **检查数据库缓存**（5秒内有效）
   - 命中 → 直接返回
   - 未命中 → 检查内存缓存
3. **检查内存缓存**
   - 命中 → 返回并存入数据库
   - 未命中 → 请求数海API
4. **API返回** → 存入内存缓存 + 存入数据库 → 返回前端

### 缓存管理API

#### 查看缓存统计
```
GET /shuhai/cache/stats
```

#### 清空缓存
```
DELETE /shuhai/cache
```

#### 健康检查
```
GET /shuhai/health
```

## 数据库维护

### 查看缓存数据

```sql
-- 查看实时行情缓存
SELECT * FROM shuhai_quote_cache ORDER BY cached_at DESC LIMIT 10;

-- 查看K线缓存
SELECT * FROM shuhai_kline_cache 
WHERE symbol = 'GOLD' AND period = 60 
ORDER BY kline_time DESC LIMIT 10;
```

### 清理过期数据

缓存会自动过期，但可以手动清理：

```sql
-- 删除30天前的K线数据
DELETE FROM shuhai_kline_cache 
WHERE cached_at < NOW() - INTERVAL '30 days';
```

### 数据库索引

已创建以下索引优化查询性能：
- `idx_shuhai_quote_symbol` - 品种代码索引
- `idx_shuhai_quote_cached_at` - 缓存时间索引
- `idx_shuhai_kline_symbol_period` - 品种+周期复合索引
- `idx_shuhai_kline_time` - K线时间索引

## 性能优化建议

1. **定期清理历史数据**
   - 保留最近30天的K线数据
   - 超过30天的数据可以归档

2. **监控缓存命中率**
   - 查看日志中的缓存命中情况
   - 根据实际情况调整缓存时间

3. **数据库连接池**
   - 当前配置最大连接数：20
   - 可根据并发量调整

## 故障排查

### 问题1：无法连接数据库

```
Error: connect ECONNREFUSED 127.0.0.1:5432
```

**解决方案：**
- 检查PostgreSQL服务是否运行
- 检查 `server/.env` 中的数据库配置
- 确认数据库端口是否正确（默认5432）

### 问题2：表不存在

```
relation "shuhai_quote_cache" does not exist
```

**解决方案：**
- 运行初始化脚本：`npx tsx src/scripts/init-shuhai-cache.ts`
- 检查是否连接到正确的数据库

### 问题3：K线图显示为空

**可能原因：**
1. 数海API返回数据格式错误
2. 数据库缓存为空

**解决方案：**
- 查看后端日志：`[数海代理] K线数据获取成功`
- 手动清除缓存：`DELETE /shuhai/cache`
- 检查数海API是否正常

## API接口文档

### 获取实时行情
```
GET /shuhai/quote?code=GOLD
```

### 获取K线数据
```
GET /shuhai/kline?code=GOLD&period=60&count=100
```

参数说明：
- `code`: 品种代码 (DAX, GOLD, HSI, MHSI, NQ, USOIL)
- `period`: 周期（分钟）: 1, 5, 15, 30, 60, 240, 1440, 10080
- `count`: 返回数量，默认100

## 技术栈

- **数据库**: PostgreSQL 14+
- **ORM**: 原生SQL (pg)
- **缓存**: 内存Map + PostgreSQL
- **API**: Express.js + Axios

## 联系支持

如有问题，请查看日志或联系技术支持。
