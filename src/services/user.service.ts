import apiClient, { ApiError, ApiErrorCode, getErrorMessage } from './api-client';
import { MessagePlugin } from 'tdesign-react';
import logger from '../utils/logger';

// 统一响应格式
export interface ApiResponse<T = any> {
  code: number;
  message: string;
  data: T;
  timestamp: number;
}

// 统一请求函数
async function request<T>(url: string, options?: RequestInit): Promise<T> {
  try {
    const response = await apiClient.request<ApiResponse<T>>({
      url,
      ...options,
    });

    if (response.data.code !== 0) {
      const errorMessage = getErrorMessage(response.data.code, response.data.message);
      MessagePlugin.error(errorMessage);
      throw new ApiError(response.data.code, errorMessage);
    }

    return response.data.data;
  } catch (error) {
    // 如果是 ApiError，已经被拦截器处理过了，不再重复显示
    if (ApiError.isApiError(error)) {
      throw error;
    }

      // 其他错误
      logger.error('Request failed:', error);
      MessagePlugin.error('网络错误，请检查连接');
      throw error;
    }
  }
}

// ============================================
// 账户信息
// ============================================

export interface AccountInfo {
  userId: string;
  totalBalance: number;
  availableBalance: number;
  frozenMargin: number;
  unrealizedPnl: number;
  realizedPnl: number;
  riskLevel: 'SAFE' | 'WARNING' | 'DANGER';
}

// ============================================
// 持仓信息
// ============================================

export interface Position {
  positionId: string;
  productCode: string;
  direction: 'LONG' | 'SHORT';
  openPrice: number;
  currentPrice: number;
  quantity: number;
  leverage: number;
  marginUsed: number;
  stopLoss: number | null;
  takeProfit: number | null;
  unrealizedPnl: number;
  realizedPnl: number;
  liquidationPrice: number | null;
  openedAt: string;
}

// ============================================
// 订单信息
// ============================================

export interface Order {
  orderId: string;
  productCode: string;
  type: 'MARKET' | 'LIMIT';
  direction: 'BUY' | 'SELL';
  quantity: number;
  price?: number;
  leverage: number;
  margin: number;
  status: string;
  filledPrice?: number;
  filledQuantity?: number;
  stopLoss: number | null;
  takeProfit: number | null;
  createdAt: string;
}

// ============================================
// 财务记录
// ============================================

export interface FinancialRecord {
  id: number;
  orderNumber: string;
  userId: string;
  type: 'deposit' | 'withdraw';
  amount: number;
  method: string;
  status: 'pending' | 'completed' | 'rejected';
  createdAt: string;
  approvedAt?: string;
  approvedBy?: string;
  remark?: string;
  fee?: number;
  rejectReason?: string;
}

// ============================================
// 银行卡信息
// ============================================

export interface BankCard {
  id: number;
  bankName: string;
  cardNumber: string;
  holderName: string;
  isDefault: boolean;
  createdAt: string;
}

// ============================================
// 账户API
// ============================================

export const accountApi = {
  // 获取账户信息
  getInfo: () => request<AccountInfo>('/api/account/info'),

  // 获取账户余额
  getBalance: () => request<{
    totalBalance: number;
    availableBalance: number;
    frozenMargin: number;
  }>('/api/account/balance'),

  // 获取风险等级
  getRiskLevel: () => request<{
    riskLevel: string;
    marginUsage: number;
    equity: number;
    unrealizedPnl: number;
  }>('/api/account/risk-level')
};

// ============================================
// 订单API
// ============================================

export const orderApi = {
  // 创建订单
  create: (params: {
    productCode: string;
    type: 'MARKET' | 'LIMIT';
    direction: 'BUY' | 'SELL';
    quantity: number;
    price?: number;
    leverage: number;
    stopLoss?: number;
    takeProfit?: number;
  }) => request<{
    orderId: string;
    status: string;
    filledPrice?: number;
    filledQuantity?: number;
    marginUsed: number;
    fee?: number;
    tradeId?: string;
  }>('/api/order/create', {
    method: 'POST',
    body: JSON.stringify(params),
  }),

  // 取消订单
  cancel: (orderId: string) => request<{ orderId: string }>('/api/order/cancel', {
    method: 'POST',
    body: JSON.stringify({ orderId }),
  }),

  // 获取订单列表
  getList: (status?: string) => request<Order[]>(
    status ? `/api/order/list?status=${status}` : '/api/order/list'
  ),

  // 获取订单详情
  getDetail: (orderId: string) => request<Order>(`/api/order/detail?orderId=${orderId}`)
};

// ============================================
// 持仓API
// ============================================

export const positionApi = {
  // 获取持仓列表
  getList: () => request<Position[]>('/api/position/list'),

  // 平仓
  close: (positionId: string) => request<{
    positionId: string;
    closePrice: number;
    realizedPnl: number;
    marginReleased: number;
  }>('/api/position/close', {
    method: 'POST',
    body: JSON.stringify({ positionId }),
  }),

  // 修改止盈止损
  updateSlTp: (positionId: string, stopLoss?: number, takeProfit?: number) => request<{
    positionId: string;
    stopLoss?: number;
    takeProfit?: number;
  }>('/api/position/update-sl-tp', {
    method: 'POST',
    body: JSON.stringify({ positionId, stopLoss, takeProfit }),
  })
};

// ============================================
// 财务API
// ============================================

export const financeApi = {
  // 创建充值申请
  createDeposit: (params: {
    amount: number;
    method: 'bank' | 'usdt' | 'alipay' | 'wechat';
    bankAccount?: string;
    bankName?: string;
    accountName?: string;
    usdtAddress?: string;
  }) => request<{
    id: string;
    orderNumber: string;
    amount: number;
    status: string;
    createdAt: string;
  }>('/finance/deposit', {
    method: 'POST',
    body: JSON.stringify(params),
  }),

  // 创建提现申请
  createWithdraw: (params: {
    amount: number;
    method: 'bank' | 'usdt';
    bankAccount?: string;
    bankName?: string;
    accountName?: string;
    usdtAddress?: string;
  }) => request<{
    id: string;
    orderNumber: string;
    amount: number;
    status: string;
    createdAt: string;
  }>('/finance/withdraw', {
    method: 'POST',
    body: JSON.stringify(params),
  }),

  // 获取财务记录列表
  getRecords: (params?: {
    type?: 'deposit' | 'withdraw';
    status?: 'pending' | 'completed' | 'rejected';
    page?: number;
    pageSize?: number;
  }) => request<{
    list: FinancialRecord[];
    total: number;
    page: number;
    pageSize: number;
    totalPages: number;
  }>(`/finance/records${params ? '?' + new URLSearchParams(params as any).toString() : ''}`),

  // 获取财务记录详情
  getRecordDetail: (id: string) => request<FinancialRecord>(`/finance/records/${id}`)
};

// ============================================
// 银行卡API
// ============================================

export const bankCardApi = {
  // 获取银行卡列表
  getList: () => request<BankCard[]>('/api/bank-cards'),

  // 添加银行卡
  add: (params: {
    bankName: string;
    cardNumber: string;
    holderName: string;
  }) => request<BankCard>('/api/bank-cards', {
    method: 'POST',
    body: JSON.stringify(params),
  }),

  // 删除银行卡
  delete: (cardId: number) => request<{ success: boolean }>(`/api/bank-cards/${cardId}`, {
    method: 'DELETE',
  }),

  // 设置默认银行卡
  setDefault: (cardId: number) => request<{ success: boolean }>(`/api/bank-cards/${cardId}/default`, {
    method: 'PUT',
  })
};

export default {
  accountApi,
  orderApi,
  positionApi,
  financeApi,
  bankCardApi,
};
