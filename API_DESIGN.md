# 实时市场分析AI系统 - API接口设计文档

## 1. 系统架构概述

### 1.1 架构原则
- **高可用性**：多节点部署，支持故障自动切换
- **高性能**：支持高并发实时数据处理
- **可扩展性**：模块化设计，便于新增数据源
- **安全性**：数据加密传输，身份认证鉴权
- **缓存优先**：多级缓存策略，降低数据库压力

### 1.2 技术栈
- **后端框架**：Node.js + Express / Spring Boot
- **数据库**：Redis (缓存) + MongoDB (历史数据) + MySQL (结构化数据)
- **消息队列**：Kafka / RabbitMQ (实时数据流)
- **WebSocket**：实时推送
- **API网关**：Nginx / Kong (负载均衡、限流)

---

## 2. 核心接口设计

### 2.1 实时行情数据接口

#### 2.1.1 获取实时行情
```typescript
// GET /api/v1/market/realtime
interface RealTimeMarketRequest {
  symbols: string[];          // 证券代码列表 ['000001.SZ', 'AAPL']
  fields?: string[];          // 返回字段 ['price', 'volume', 'change']
  includePreMarket?: boolean; // 是否包含盘前数据
}

interface RealTimeMarketResponse {
  code: number;
  message: string;
  data: {
    symbol: string;
    price: number;
    volume: number;
    change: number;
    changePercent: number;
    high: number;
    low: number;
    open: number;
    prevClose: number;
    timestamp: number;
  }[];
}
```

#### 2.1.2 WebSocket实时行情推送
```typescript
// WS: wss://api.example.com/market/stream

interface MarketStreamRequest {
  action: 'subscribe' | 'unsubscribe';
  symbols: string[];
  interval?: 'tick' | '1m' | '5m' | '15m' | '1h';
}

interface MarketStreamData {
  type: 'quote' | 'trade' | 'depth';
  symbol: string;
  price: number;
  volume: number;
  timestamp: number;
}
```

#### 2.1.3 K线数据
```typescript
// GET /api/v1/market/kline
interface KlineRequest {
  symbol: string;
  interval: '1m' | '5m' | '15m' | '30m' | '1h' | '4h' | '1d';
  startTime?: number;
  endTime?: number;
  limit?: number; // 默认1000条
}

interface KlineResponse {
  code: number;
  data: {
    timestamp: number;
    open: number;
    high: number;
    low: number;
    close: number;
    volume: number;
  }[];
}
```

---

### 2.2 基本面数据接口

#### 2.2.1 公司财务数据
```typescript
// GET /api/v1/fundamental/financials
interface FinancialRequest {
  symbol: string;
  period: 'quarterly' | 'annual';
  statement: 'income' | 'balance' | 'cashflow' | 'all';
  years?: number; // 默认5年
}

interface FinancialResponse {
  code: number;
  data: {
    symbol: string;
    reports: {
      period: string; // '2024Q3'
      revenue: number;
      netIncome: number;
      totalAssets: number;
      totalDebt: number;
      peRatio: number;
      pbRatio: number;
      eps: number;
    }[];
  };
}
```

#### 2.2.2 行业分析数据
```typescript
// GET /api/v1/fundamental/industry
interface IndustryRequest {
  industryCode?: string;
  sector?: string;
  metrics?: string[]; // ['pe_avg', 'pb_avg', 'growth_rate']
}

interface IndustryResponse {
  code: number;
  data: {
    industryName: string;
    industryCode: string;
    peAverage: number;
    pbAverage: number;
    marketCap: number;
    growthRate: number;
    stocks: string[];
  };
}
```

#### 2.2.3 宏观经济数据
```typescript
// GET /api/v1/fundamental/macro
interface MacroRequest {
  country?: string;
  indicators?: string[]; // ['GDP', 'CPI', 'PPI', '利率']
  startDate?: string;
  endDate?: string;
}

interface MacroResponse {
  code: number;
  data: {
    indicator: string;
    date: string;
    value: number;
    change: number;
    unit: string;
  }[];
}
```

---

### 2.3 新闻舆情分析接口

#### 2.3.1 获取相关新闻
```typescript
// GET /api/v1/news/list
interface NewsRequest {
  symbols?: string[];      // 关联证券代码
  keywords?: string[];     // 关键词
  category?: string;       // 'market' | 'company' | 'policy'
  sentiment?: 'positive' | 'negative' | 'neutral';
  startTime?: string;
  endTime?: string;
  page?: number;
  pageSize?: number;
}

interface NewsResponse {
  code: number;
  data: {
    id: string;
    title: string;
    summary: string;
    source: string;
    publishTime: string;
    url: string;
    sentiment: 'positive' | 'negative' | 'neutral';
    sentimentScore: number; // -1 到 1
    relatedSymbols: string[];
  }[];
  pagination: {
    page: number;
    pageSize: number;
    total: number;
  };
}
```

#### 2.3.2 舆情情感分析
```typescript
// POST /api/v1/news/sentiment/analyze
interface SentimentAnalysisRequest {
  content: string;       // 文本内容
  language?: 'zh' | 'en';
  context?: string;       // 上下文信息
}

interface SentimentAnalysisResponse {
  code: number;
  data: {
    sentiment: 'positive' | 'negative' | 'neutral';
    score: number;
    confidence: number;
    keywords: {
      word: string;
      sentiment: string;
      weight: number;
    }[];
    categories: string[]; // ['经济', '政策', '公司']
  };
}
```

#### 2.3.3 实时舆情监控
```typescript
// WS: wss://api.example.com/news/stream
interface NewsStreamData {
  type: 'news' | 'alert';
  id: string;
  title: string;
  sentiment: 'positive' | 'negative' | 'neutral';
  relatedSymbols: string[];
  importance: 'low' | 'medium' | 'high';
  timestamp: number;
}
```

---

### 2.4 用户投资组合接口

#### 2.4.1 获取用户持仓
```typescript
// GET /api/v1/portfolio/positions
interface PositionsRequest {
  userId: string;
  includeDetails?: boolean;
  includePnL?: boolean;
}

interface PositionsResponse {
  code: number;
  data: {
    positions: {
      symbol: string;
      name: string;
      quantity: number;
      avgCost: number;
      currentPrice: number;
      marketValue: number;
      pnl: number;
      pnlPercent: number;
      todayPnL: number;
      weight: number;
    }[];
    summary: {
      totalMarketValue: number;
      totalPnL: number;
      totalPnLPercent: number;
      todayPnL: number;
      cash: number;
    };
  };
}
```

#### 2.4.2 获取交易历史
```typescript
// GET /api/v1/portfolio/trades
interface TradesRequest {
  userId: string;
  symbol?: string;
  side?: 'buy' | 'sell';
  startDate?: string;
  endDate?: string;
  page?: number;
  pageSize?: number;
}

interface TradesResponse {
  code: number;
  data: {
    trades: {
      id: string;
      symbol: string;
      side: 'buy' | 'sell';
      quantity: number;
      price: number;
      amount: number;
      fee: number;
      timestamp: string;
    }[];
    pagination: {
      page: number;
      pageSize: number;
      total: number;
    };
  };
}
```

#### 2.4.3 风险敞口分析
```typescript
// GET /api/v1/portfolio/exposure
interface ExposureResponse {
  code: number;
  data: {
    sectorExposure: {
      sector: string;
      value: number;
      weight: number;
    }[];
    countryExposure: {
      country: string;
      value: number;
      weight: number;
    }[];
    currencyExposure: {
      currency: string;
      value: number;
      weight: number;
    }[];
  };
}
```

---

### 2.5 风险控制API

#### 2.5.1 风险评估
```typescript
// POST /api/v1/risk/assess
interface RiskAssessRequest {
  portfolioPositions: {
    symbol: string;
    quantity: number;
  }[];
  timeframe?: string; // '1d' | '1w' | '1m'
}

interface RiskAssessResponse {
  code: number;
  data: {
    overallRisk: 'low' | 'medium' | 'high';
    riskScore: number; // 0-100
    metrics: {
      volatility: number;
      maxDrawdown: number;
      var95: number;      // 95%置信度VaR
      var99: number;      // 99%置信度VaR
      beta: number;
      sharpeRatio: number;
    };
    riskFactors: {
      factor: string;
      impact: number;
      level: 'low' | 'medium' | 'high';
    }[];
  };
}
```

#### 2.5.2 止损止盈设置
```typescript
// POST /api/v1/risk/stop-loss
interface StopLossRequest {
  userId: string;
  positions: {
    symbol: string;
    stopLossPrice?: number;
    takeProfitPrice?: number;
    trailingStop?: {
      percentage: number;
      activationPrice: number;
    };
  }[];
}

interface StopLossResponse {
  code: number;
  data: {
    orderId: string;
    status: 'active' | 'triggered' | 'cancelled';
    createdAt: string;
  };
}
```

#### 2.5.3 风险预警
```typescript
// WS: wss://api.example.com/risk/alerts
interface RiskAlertData {
  type: 'margin' | 'position_limit' | 'volatility' | 'drawdown';
  severity: 'warning' | 'critical';
  message: string;
  metrics: {
    current: number;
    threshold: number;
  };
  timestamp: number;
}
```

---

## 3. AI分析接口

### 3.1 智能问答接口
```typescript
// POST /api/v1/ai/chat
interface AIChatRequest {
  userId: string;
  question: string;
  context?: {
    symbols?: string[];
    portfolioId?: string;
    timeframe?: string;
  };
  stream?: boolean; // 是否流式返回
}

interface AIChatResponse {
  code: number;
  data: {
    answer: string;
    confidence: number;
    sources?: string[]; // 引用来源
    relatedQuestions?: string[];
    timestamp: number;
  };
}

// 流式返回格式 (SSE)
interface AIChatStreamResponse {
  type: 'delta' | 'done';
  content: string;
  finished: boolean;
}
```

### 3.2 技术分析接口
```typescript
// POST /api/v1/ai/technical
interface TechnicalAnalysisRequest {
  symbols: string[];
  indicators?: string[]; // ['MACD', 'RSI', 'KDJ', 'BOLL']
  timeframe?: string;
}

interface TechnicalAnalysisResponse {
  code: number;
  data: {
    symbol: string;
    trend: 'up' | 'down' | 'sideways';
    strength: number; // 0-100
    indicators: {
      name: string;
      value: number;
      signal: 'buy' | 'sell' | 'neutral';
    }[];
    supportLevels: number[];
    resistanceLevels: number[];
    recommendation: {
      action: 'buy' | 'sell' | 'hold';
      confidence: number;
      entryPrice?: number;
      stopLoss?: number;
      takeProfit?: number;
    };
  }[];
}
```

### 3.3 智能投顾接口
```typescript
// POST /api/v1/ai/advisor
interface AdvisorRequest {
  userId: string;
  riskProfile: 'conservative' | 'moderate' | 'aggressive';
  investmentGoal: string;
  investmentHorizon: 'short' | 'medium' | 'long';
  initialCapital?: number;
}

interface AdvisorResponse {
  code: number;
  data: {
    portfolioAllocation: {
      assetClass: string;
      recommendedWeight: number;
      currentWeight?: number;
      reason: string;
    }[];
    strategy: {
      name: string;
      description: string;
      expectedReturn: number;
      riskLevel: string;
    };
    recommendations: {
      action: 'buy' | 'sell' | 'rebalance';
      symbol: string;
      reason: string;
      confidence: number;
    }[];
  };
}
```

---

## 4. 扩展接口预留

### 4.1 数据源适配器接口
```typescript
// 数据源注册接口
interface DataSourceAdapter {
  sourceId: string;
  sourceName: string;
  type: 'market' | 'fundamental' | 'news' | 'alternative';
  capabilities: string[];
  rateLimit: number;
  authentication?: {
    type: 'apiKey' | 'oauth' | 'certificate';
    config: Record<string, string>;
  };
}

// POST /api/v1/admin/datasource/register
interface RegisterDataSourceRequest {
  adapter: DataSourceAdapter;
  endpoint: string;
  healthCheckPath: string;
}

// POST /api/v1/admin/datasource/test
interface TestDataSourceRequest {
  sourceId: string;
  testQuery?: any;
}
```

### 4.2 自定义指标接口
```typescript
// 用户自定义指标
interface CustomIndicatorRequest {
  userId: string;
  name: string;
  formula: string;  // 公式表达式
  parameters?: Record<string, any>;
  description?: string;
}

// POST /api/v1/indicators/custom
// GET /api/v1/indicators/custom/:id
// PUT /api/v1/indicators/custom/:id
// DELETE /api/v1/indicators/custom/:id
```

### 4.3 回测引擎接口
```typescript
// POST /api/v1/backtest/run
interface BacktestRequest {
  strategy: {
    name: string;
    parameters: Record<string, any>;
    code?: string;  // 策略代码
  };
  data: {
    symbols: string[];
    startDate: string;
    endDate: string;
  };
  settings: {
    initialCapital: number;
    commission: number;
    slippage: number;
  };
}

interface BacktestResponse {
  code: number;
  data: {
    summary: {
      totalReturn: number;
      annualizedReturn: number;
      maxDrawdown: number;
      sharpeRatio: number;
      winRate: number;
      totalTrades: number;
    };
    equityCurve: {
      date: string;
      value: number;
    }[];
    trades: any[];
  };
}
```

---

## 5. 缓存策略

### 5.1 多级缓存架构
```
┌─────────────────────────────────────┐
│         API Gateway                 │
└──────────────┬────────────────────┘
               │
┌──────────────▼────────────────────┐
│         L1: CDN缓存               │  (静态资源、API响应)
│         TTL: 1-5分钟              │
└──────────────┬────────────────────┘
               │
┌──────────────▼────────────────────┐
│         L2: Redis缓存             │  (热点数据)
│         TTL: 5-60秒              │
│         实时行情: 1秒             │
│         K线数据: 5秒             │
│         基本面: 300秒            │
└──────────────┬────────────────────┘
               │
┌──────────────▼────────────────────┐
│         L3: 数据库缓存            │  (MySQL查询缓存)
│         TTL: 10-300秒            │
└───────────────────────────────────┘
```

### 5.2 缓存键设计
```
market:realtime:{symbol}          // 实时行情
market:kline:{symbol}:{interval}   // K线数据
fundamental:financials:{symbol}    // 财务数据
news:list:{date}:{category}       // 新闻列表
portfolio:positions:{userId}      // 用户持仓
risk:assess:{userId}:{timestamp}  // 风险评估
ai:chat:{userId}:{session}        // AI对话会话
```

### 5.3 缓存更新策略
- **主动刷新**：数据变更时主动更新缓存
- **定时刷新**：低频数据定时刷新
- **缓存穿透**：空值缓存，防止雪崩
- **缓存预热**：系统启动时预加载热点数据

---

## 6. 性能优化

### 6.1 并发处理
```typescript
// 限流配置
interface RateLimitConfig {
  endpoints: {
    path: string;
    limit: number;      // 每分钟请求数
    burst: number;      // 突发流量
  }[];
  // 示例
  // market/realtime: 1000/min
  // ai/chat: 60/min per user
  // portfolio: 300/min per user
}
```

### 6.2 数据压缩
- Gzip/Brotli 压缩响应数据
- Protocol Buffers 替代 JSON（性能提升40%）
- 二进制K线数据传输

### 6.3 分页与游标
```typescript
interface PaginationRequest {
  page?: number;        // 传统分页
  pageSize?: number;
  cursor?: string;      // 游标分页（性能更好）
}

interface PaginationResponse {
  data: any[];
  pagination: {
    page: number;
    pageSize: number;
    total: number;
    hasMore: boolean;
    nextCursor?: string;
  };
}
```

---

## 7. 安全设计

### 7.1 认证与授权
```typescript
// JWT Token
interface AuthToken {
  userId: string;
  role: 'user' | 'admin' | 'api';
  permissions: string[];
  exp: number;
}

// API Key认证
interface APIKey {
  key: string;
  secret: string;
  permissions: string[];
  rateLimit: number;
}
```

### 7.2 数据加密
- HTTPS 强制加密传输
- 敏感数据AES-256加密存储
- WebSocket 连接使用WSS

### 7.3 审计日志
```typescript
interface AuditLog {
  timestamp: number;
  userId: string;
  action: string;
  endpoint: string;
  ip: string;
  userAgent: string;
  status: number;
  responseTime: number;
}
```

---

## 8. 监控与告警

### 8.1 健康检查
```typescript
// GET /health
interface HealthResponse {
  status: 'healthy' | 'degraded' | 'unhealthy';
  services: {
    database: boolean;
    redis: boolean;
    kafka: boolean;
    externalApi: {
      [sourceId: string]: boolean;
    };
  };
  timestamp: number;
}
```

### 8.2 性能指标
```typescript
// GET /metrics
interface MetricsResponse {
  requests: {
    total: number;
    success: number;
    error: number;
    avgResponseTime: number;
  };
  cache: {
    hitRate: number;
    missRate: number;
  };
  database: {
    connections: number;
    queryTime: number;
  };
}
```

---

## 9. 部署架构

```
                    ┌─────────────┐
                    │   客户端     │
                    └──────┬──────┘
                           │
                    ┌──────▼──────┐
                    │   CDN       │
                    └──────┬──────┘
                           │
                    ┌──────▼──────┐
                    │  负载均衡     │
                    │   (Nginx)   │
                    └──────┬──────┘
                           │
        ┌──────────────────┼──────────────────┐
        │                  │                  │
   ┌────▼────┐      ┌────▼────┐      ┌────▼────┐
   │ API节点1 │      │ API节点2 │      │ API节点3 │
   └────┬────┘      └────┬────┘      └────┬────┘
        │                  │                  │
        └──────────────────┼──────────────────┘
                           │
        ┌──────────────────┼──────────────────┐
        │                  │                  │
   ┌────▼────┐      ┌────▼────┐      ┌────▼────┐
   │  Redis  │      │ MongoDB │      │  MySQL  │
   │  缓存   │      │  存储   │      │  存储   │
   └─────────┘      └─────────┘      └─────────┘
                           │
        ┌──────────────────┼──────────────────┐
        │                  │                  │
   ┌────▼────┐      ┌────▼────┐      ┌────▼────┐
   │  Kafka  │      │外部数据源│      │ AI引擎  │
   │ 消息队列 │      └─────────┘      └─────────┘
   └─────────┘
```

---

## 10. 实施建议

### 10.1 分阶段开发
**第一阶段**（MVP）
- 实时行情接口
- 基本数据查询
- 用户持仓查询
- 基础风险计算

**第二阶段**
- 新闻舆情分析
- AI问答接口
- 技术分析接口
- WebSocket推送

**第三阶段**
- 智能投顾
- 回测引擎
- 自定义指标
- 高级风控

### 10.2 技术选型建议
- **语言**：TypeScript (类型安全)
- **框架**：NestJS / Express (Node.js)
- **数据库**：PostgreSQL + Redis
- **消息队列**：RabbitMQ (易用) / Kafka (高性能)
- **API文档**：Swagger / OpenAPI
- **监控**：Prometheus + Grafana

### 10.3 成本估算
- **开发周期**：3-6个月
- **团队规模**：5-8人
- **服务器成本**：月度5000-20000元
- **数据源成本**：月度3000-10000元
- **AI服务成本**：按使用量计费

---

## 附录：错误码定义

```typescript
enum ErrorCode {
  SUCCESS = 0,
  INVALID_PARAM = 1001,
  UNAUTHORIZED = 1002,
  FORBIDDEN = 1003,
  NOT_FOUND = 1004,
  RATE_LIMIT = 1005,
  SERVER_ERROR = 5000,
  EXTERNAL_API_ERROR = 5001,
}
```

---

**文档版本**: v1.0
**更新日期**: 2026-02-23
**维护者**: 技术架构团队
