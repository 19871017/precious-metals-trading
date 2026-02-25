// ============================================
// 订单系统类型定义
// ============================================

export enum OrderType {
  MARKET = 'MARKET',    // 市价单
  LIMIT = 'LIMIT'       // 限价单
}

export enum OrderDirection {
  BUY = 'BUY',          // 做多
  SELL = 'SELL'         // 做空
}

export enum OrderStatus {
  CREATED = 'CREATED',              // 已创建
  PENDING = 'PENDING',              // 待成交
  PARTIALLY_FILLED = 'PARTIALLY_FILLED',  // 部分成交
  FILLED = 'FILLED',                // 已成交
  CANCELED = 'CANCELED',            // 已取消
  REJECTED = 'REJECTED',            // 被拒绝
  LIQUIDATED = 'LIQUIDATED'         // 强平
}

export interface Order {
  id: string;
  userId: string;
  productCode: string;        // 产品代码，如 XAUUSD
  type: OrderType;
  direction: OrderDirection;
  quantity: number;           // 数量
  price?: number;             // 价格（限价单必填）
  leverage: number;           // 杠杆倍数
  margin: number;             // 保证金
  stopLoss?: number;          // 止损价
  takeProfit?: number;        // 止盈价
  status: OrderStatus;
  filledQuantity: number;     // 已成交数量
  filledPrice?: number;       // 成交均价
  createdAt: Date;
  updatedAt: Date;
  canceledAt?: Date;
  rejectReason?: string;      // 拒绝原因
}

// ============================================
// 仓位系统类型定义
// ============================================

export enum PositionDirection {
  LONG = 'LONG',      // 多头
  SHORT = 'SHORT'     // 空头
}

export enum PositionStatus {
  OPEN = 'OPEN',          // 持仓中
  CLOSED = 'CLOSED',      // 已平仓
  LIQUIDATED = 'LIQUIDATED'  // 已强平
}

export interface Position {
  id: string;
  userId: string;
  productCode: string;
  direction: PositionDirection;
  openPrice: number;          // 开仓均价
  quantity: number;           // 持仓数量
  leverage: number;           // 杠杆倍数
  marginUsed: number;         // 占用保证金
  liquidationPrice: number;   // 强平价
  stopLoss?: number;          // 止损价
  takeProfit?: number;        // 止盈价
  unrealizedPnl: number;      // 未实现盈亏
  realizedPnl: number;        // 已实现盈亏
  status: PositionStatus;
  openedAt: Date;
  closedAt?: Date;
  orders: string[];           // 关联订单ID列表
}

// ============================================
// 账户系统类型定义
// ============================================

export interface Account {
  userId: string;
  totalBalance: number;       // 总余额
  availableBalance: number;   // 可用余额
  frozenMargin: number;       // 冻结保证金
  unrealizedPnl: number;      // 未实现盈亏
  realizedPnl: number;        // 已实现盈亏
  positions: Map<string, Position>;  // 持仓列表
  riskLevel: RiskLevel;       // 风险等级
}

export enum RiskLevel {
  SAFE = 'SAFE',        // 安全
  WARNING = 'WARNING',  // 关注
  DANGER = 'DANGER'     // 高风险
}

// ============================================
// 成交记录类型定义
// ============================================

export interface Trade {
  id: string;
  orderId: string;
  userId: string;
  productCode: string;
  direction: OrderDirection;
  price: number;
  quantity: number;
  leverage: number;
  margin: number;
  fee: number;
  timestamp: Date;
}

// ============================================
// 强平记录类型定义
// ============================================

export interface LiquidationRecord {
  id: string;
  userId: string;
  positionId: string;
  productCode: string;
  liquidationPrice: number;
  quantity: number;
  marginLost: number;
  timestamp: Date;
  reason: string;
}

// ============================================
// 行情数据类型定义
// ============================================

export interface MarketData {
  productCode: string;
  productName?: string;    // 产品名称
  bid: number;            // 买入价
  ask: number;            // 卖出价
  lastPrice: number;      // 最新成交价
  high24h: number;        // 24小时最高
  low24h: number;         // 24小时最低
  volume24h: number;      // 24小时成交量
  openPrice?: number;     // 开盘价
  change?: number;        // 涨跌额
  changePercent?: number; // 涨跌幅
  timestamp: Date;
}

// ============================================
// API 响应类型定义
// ============================================

export interface ApiResponse<T = any> {
  code: number;
  message: string;
  data: T;
  timestamp: number;
}

export interface CreateOrderRequest {
  productCode: string;
  type: OrderType;
  direction: OrderDirection;
  quantity: number;
  price?: number;
  leverage: number;
  stopLoss?: number;
  takeProfit?: number;
}

export interface UpdateSlTpRequest {
  positionId: string;
  stopLoss?: number;
  takeProfit?: number;
}

export interface RiskPreview {
  marginRequired: number;
  liquidationPrice: number;
  maxLoss: number;
  riskLevel: RiskLevel;
}
