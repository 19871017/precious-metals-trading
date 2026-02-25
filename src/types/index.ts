export interface MarketData {
  symbol: string;
  name: string;
  price: number;
  change: number;
  changePercent: number;
  volume: number;
  high: number;
  low: number;
  isDomestic: boolean;
}

export interface Position {
  id: string;
  symbol: string;
  name: string;
  direction: 'long' | 'short';
  openPrice: number;
  currentPrice: number;
  quantity: number;
  margin: number;
  profitLoss: number;
  leverage?: number;
  stopLoss?: number;
  takeProfit?: number;
}

export interface Account {
  totalAssets: number;
  availableFunds: number;
  frozenMargin: number;
  dailyPL: number;
  cumulativePL: number;
}

export interface Order {
  id: string;
  symbol: string;
  type: 'buy' | 'sell';
  price: number;
  quantity: number;
  status: 'pending' | 'filled' | 'cancelled';
  createTime: string;
  margin?: number;
  orderType?: '市价单' | '限价单';
}

export interface ClosedPosition {
  id: string;
  symbol: string;
  name: string;
  direction: 'long' | 'short';
  openTime: string;
  openPrice: number;
  closePrice: number;
  closeTime: string;
  quantity: number;
  profitLoss: number;
  closeType: 'manual' | 'forced';
}

export interface NewsItem {
  id: string;
  title: string;
  content: string;
  time: string;
  category: 'news' | 'policy' | 'system';
}

export interface ChartData {
  timestamps: string[];
  prices: number[];
  volumes: number[];
}

export interface TechnicalIndicator {
  type: 'MACD' | 'RSI' | 'MA' | 'BOLL';
  data: number[];
  params?: any;
}
