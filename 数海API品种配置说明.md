# 数海API品种配置说明

## 当前可用的品种（共5个）

根据测试结果，当前账号 `wu123` 可以访问以下5个品种：

| 序号 | 品种代码 | 品种名称 | 数海代码 | 市场 | 状态 |
|-----|---------|---------|---------|------|------|
| 1 | DAX | 德指 | CEDAXA0 | CE | ✅ 可用 |
| 2 | HSI | 恒指 | HIHHI02 | HI | ✅ 可用 |
| 3 | NQ | 纳指 | CENQA0 | CE | ✅ 可用 |
| 4 | USOIL | 原油 | NECLA0 | NE | ✅ 可用 |
| 5 | MHSI | 小恒指 | HIHHI01 | HI | ✅ 可用 |

## 暂不可用的品种

| 品种代码 | 品种名称 | 数海代码 | 原因 |
|---------|---------|---------|------|
| GOLD | 黄金 | NEGCZ0 | 需要购买市场权限 |

## 品种管理接口

系统提供了完整的品种管理后台API，支持动态添加、编辑、删除品种。

### 1. 获取所有品种列表

```
GET /api/symbol/list
```

**查询参数：**
- `status` (可选): 筛选状态（active/inactive）
- `category` (可选): 筛选分类

**响应示例：**
```json
{
  "code": 0,
  "message": "success",
  "data": {
    "total": 5,
    "items": [
      {
        "id": 1,
        "code": "DAX",
        "name": "德指",
        "shuhaiCode": "CEDAXA0",
        "market": "CE",
        "category": "指数",
        "status": "active",
        "pricePrecision": 2,
        "sort": 1,
        "createdAt": "2026-02-25T11:00:00.000Z",
        "updatedAt": "2026-02-25T11:00:00.000Z"
      }
    ]
  },
  "timestamp": 1740480000000
}
```

### 2. 获取活跃品种列表（前端显示用）

```
GET /api/symbol/active
```

**响应示例：**
```json
{
  "code": 0,
  "message": "success",
  "data": [
    {
      "code": "DAX",
      "name": "德指",
      "shuhaiCode": "CEDAXA0",
      "market": "CE",
      "category": "指数",
      "pricePrecision": 2
    }
  ],
  "timestamp": 1740480000000
}
```

### 3. 获取单个品种详情

```
GET /api/symbol/detail/:id
```

### 4. 添加新品种（需要管理员权限）

```
POST /api/symbol/add
Authorization: Bearer <token>
```

**请求体：**
```json
{
  "code": "ES",
  "name": "小标普",
  "shuhaiCode": "CEESA0",
  "market": "CE",
  "category": "指数",
  "pricePrecision": 2,
  "sort": 6
}
```

### 5. 更新品种信息（需要管理员权限）

```
PUT /api/symbol/update/:id
Authorization: Bearer <token>
```

**请求体：**
```json
{
  "name": "德指期货",
  "status": "active"
}
```

### 6. 删除品种（需要管理员权限）

```
DELETE /api/symbol/delete/:id
Authorization: Bearer <token>
```

### 7. 启用/禁用品种（需要管理员权限）

```
PUT /api/symbol/toggle/:id
Authorization: Bearer <token>
```

### 8. 批量排序（需要管理员权限）

```
PUT /api/symbol/sort
Authorization: Bearer <token>
```

**请求体：**
```json
{
  "orders": [
    { "id": 1, "sort": 1 },
    { "id": 2, "sort": 2 },
    { "id": 3, "sort": 3 }
  ]
}
```

### 9. 获取分类列表

```
GET /api/symbol/categories
```

## 后台添加品种的步骤

### 第一步：测试数海API访问权限

使用测试脚本验证新品种是否可以访问：

```bash
node test-single-symbol.js <数海代码>
```

示例：
```bash
node test-single-symbol.js CEESA0
```

### 第二步：通过后台API添加品种

```bash
curl -X POST http://localhost:3001/api/symbol/add \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <token>" \
  -d '{
    "code": "ES",
    "name": "小标普",
    "shuhaiCode": "CEESA0",
    "market": "CE",
    "category": "指数",
    "pricePrecision": 2,
    "sort": 6
  }'
```

### 第三步：验证品种是否正常工作

检查系统日志，确认新品种数据正常更新：

```
[MarketData] Updated ES: 6912.75 (+0.18%)
```

## 品种代码规则

### 市场代码

| 市场代码 | 市场名称 | 说明 |
|---------|---------|------|
| CE | 欧洲期货 | 欧洲期货市场 |
| HI | 恒指期货 | 香港恒指期货 |
| NE | 美期货 | 美国期货市场 |
| CM | 商品期货 | 商品期货市场 |

### 品种代码命名规则

数海代码格式：`市场代码 + 品种代码`

示例：
- `CEDAXA0` - CE(欧洲) + DAX(德指) + A0(连续合约)
- `HIHHI02` - HI(恒指) + HHI(恒指) + 02(合约月份)
- `NEGCZ0` - NE(美期) + GC(黄金) + Z0(合约月份)

## 注意事项

1. **市场权限**: 账号必须购买相应市场的数据权限才能访问品种
2. **代码唯一性**: 内部代码(code)必须唯一，不能重复
3. **数海代码验证**: 添加新品种前必须测试数海代码是否可用
4. **分类管理**: 建议按分类管理品种（指数、贵金属、能源等）
5. **排序**: sort字段决定前端显示顺序

## 前端显示说明

前端应使用 `/api/symbol/active` 接口获取活跃品种列表，这样可以：

1. 自动同步后台的品种添加/删除操作
2. 只显示启用的品种
3. 按照排序字段正确显示

## 配置文件

### 后端配置

**文件**: `server/src/services/MarketDataService.ts`

```typescript
const ALL_PRODUCTS = [
  { code: 'DAX', name: '德指', shuhaiCode: SYMBOL_MAPPING['DAX'] },
  { code: 'HSI', name: '恒指', shuhaiCode: SYMBOL_MAPPING['HSI'] },
  { code: 'NQ', name: '纳指', shuhaiCode: SYMBOL_MAPPING['NQ'] },
  { code: 'USOIL', name: '原油', shuhaiCode: SYMBOL_MAPPING['USOIL'] },
  { code: 'MHSI', name: '小恒指', shuhaiCode: SYMBOL_MAPPING['MHSI'] },
  // { code: 'GOLD', name: '黄金', shuhaiCode: SYMBOL_MAPPING['GOLD'] }, // 需要购买权限
];
```

### 环境变量

**文件**: `server/.env`

```
USE_SHUHAI_API=true
SHUHAI_USERNAME=wu123
SHUHAI_PASSWORD=wu123
```

---

**更新时间**: 2026年2月25日
**维护人**: AI Assistant
