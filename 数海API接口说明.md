# 数海API接口说明

## 重要说明

数海API **仅支持 HTTP 协议**，不支持 HTTPS。

### HTTP vs HTTPS

| 协议 | 状态 | 说明 |
|-----|------|------|
| HTTP | ✅ 支持 | `http://ds.cnshuhai.com/stock.php` |
| HTTPS | ❌ 不支持 | 数海服务器不支持HTTPS访问 |

## API配置

### 认证信息
- 用户名: `wu123`
- 密码: `wu123`

### 请求方式

#### 获取单个品种行情
```
http://ds.cnshuhai.com/stock.php?type=stock&u=wu123&p=wu123&symbol=CEDAXA0
```

#### 获取多个品种行情（批量）
```
http://ds.cnshuhai.com/stock.php?type=stock&u=wu123&p=wu123&symbol=CEDAXA0,HIHHI02,CENQA0
```

### 请求参数

| 参数 | 说明 | 示例 |
|-----|------|------|
| type | 固定值，股票行情类型 | stock |
| u | 用户名 | wu123 |
| p | 密码 | wu123 |
| symbol | 数海品种代码（多个用逗号分隔） | CEDAXA0,HIHHI02,CENQA0 |

### 返回数据格式

```json
[
  {
    "Date": 1772019143,
    "Symbol": "CEDAXA0",
    "Name": "DAX主连",
    "NewPrice": 25130,           // 最新价
    "LastClose": 25084,           // 昨收价
    "Open": 25082,                // 开盘价
    "High": 25148,                // 最高价
    "Low": 25031,                 // 最低价
    "Volume": 8134,               // 成交量
    "BP1": 25128,                 // 买一价
    "SP1": 25131,                 // 卖一价
    "PriceChangeRatio": 0.18,     // 涨跌幅(%)
    "Open_Int": 40118,            // 持仓量
    "Amount": 0,                  // 成交额
    "Price2": 25095.004,          // 结算价
    "Price3": 25062,              // 其他价格字段
    "Vol2": 1,                    // 其他成交量字段
    "BV1": 4, "BV2": 0, ...,      // 买量
    "SV1": 7, "SV2": 0, ...       // 卖量
  }
]
```

### 主要字段说明

| 字段 | 说明 | 示例 |
|-----|------|------|
| Symbol | 数海品种代码 | CEDAXA0 |
| Name | 品种名称 | DAX主连 |
| NewPrice | 最新价 | 25130 |
| LastClose | 昨收价 | 25084 |
| Open | 开盘价 | 25082 |
| High | 最高价 | 25148 |
| Low | 最低价 | 25031 |
| Volume | 成交量 | 8134 |
| BP1 | 买一价 | 25128 |
| SP1 | 卖一价 | 25131 |
| PriceChangeRatio | 涨跌幅(%) | 0.18 |
| Open_Int | 持仓量 | 40118 |

## 品种代码映射

### 可用品种（经过测试验证）

| 品种代码 | 品种名称 | 数海代码 | 市场 | 状态 |
|---------|---------|---------|------|------|
| DAX | 德指 | CEDAXA0 | CE | ✅ 可用 |
| HSI | 恒指 | HIHHI02 | HI | ✅ 可用 |
| NQ | 纳指 | CENQA0 | CE | ✅ 可用 |
| USOIL | 原油 | NECLA0 | NE | ✅ 可用 |

### 市场代码说明

- **CE**: 欧洲期货市场
- **CM**: 商品期货市场
- **HI**: 恒指期货市场
- **NE**: 美期货市场

### 数海代码格式

格式: `[市场代码][品种代码]`

示例:
- `CEDAXA0` = CE市场 + DAXA0品种 (德指)
- `HIHHI02` = HI市场 + HHI02品种 (恒指)
- `NECLA0` = NE市场 + CLA0品种 (原油)

## 注意事项

1. **仅支持HTTP协议** - ⚠️ 不支持HTTPS，必须使用 `http://`
2. **批量请求** - 至少需要2个品种才能成功，单个品种返回407
3. **无需签名验证** - 直接使用用户名和密码即可
4. **缓存策略** - 建议实现5-10秒缓存，避免频繁请求
5. **请求频率** - 避免过于频繁的请求，可能触发频率限制
6. **字段映射** - 数海API返回的字段名采用驼峰命名，如 `NewPrice`、`LastClose`

## 后端配置文件

已修改的配置文件:
1. `server/src/services/MarketDataService.ts` - 主行情服务
2. `server/src/routes/shuhai.ts` - 数海API路由
3. `server/.env` - 环境变量配置

所有配置已统一使用HTTP协议。
