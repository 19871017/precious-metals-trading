import { MarketData, Position, Account, Order, NewsItem, ClosedPosition } from '../types';

export const mockMarketData: MarketData[] = [
  {
    symbol: 'XAUUSD',
    name: '国际黄金',
    price: 2345.80,
    change: 12.30,
    changePercent: 0.53,
    volume: 125680,
    high: 2348.20,
    low: 2330.50,
    isDomestic: false
  },
  {
    symbol: 'XAGUSD',
    name: '国际白银',
    price: 28.45,
    change: -0.35,
    changePercent: -1.21,
    volume: 89540,
    high: 28.90,
    low: 28.10,
    isDomestic: false
  },
  {
    symbol: 'XPTUSD',
    name: '国际铂金',
    price: 987.50,
    change: 5.20,
    changePercent: 0.53,
    volume: 32450,
    high: 990.00,
    low: 980.00,
    isDomestic: false
  },
  {
    symbol: 'XPDUSD',
    name: '国际钯金',
    price: 1024.80,
    change: -8.50,
    changePercent: -0.82,
    volume: 18230,
    high: 1035.00,
    low: 1018.00,
    isDomestic: false
  },
  {
    symbol: 'AU2406',
    name: '沪金主力',
    price: 518.65,
    change: 3.25,
    changePercent: 0.63,
    volume: 156780,
    high: 520.00,
    low: 515.00,
    isDomestic: true
  },
  {
    symbol: 'AG2406',
    name: '沪银主力',
    price: 6485.00,
    change: -45.00,
    changePercent: -0.69,
    volume: 89230,
    high: 6530.00,
    low: 6450.00,
    isDomestic: true
  },
  {
    symbol: 'PB2406',
    name: '沪铂主力',
    price: 286.50,
    change: 1.80,
    changePercent: 0.63,
    volume: 12340,
    high: 288.00,
    low: 284.50,
    isDomestic: true
  }
];

export const mockPositions: Position[] = [];

export const mockAccount: Account = {
  totalAssets: 850000.00,
  availableFunds: 263560.00,
  frozenMargin: 586440.00,
  dailyPL: 12500.00,
  cumulativePL: 45680.00
};

export const mockOrders: Order[] = [
  {
    id: 'ORD001',
    symbol: 'XAUUSD',
    type: 'buy',
    price: 2335.50,
    quantity: 2,
    status: 'filled',
    createTime: '2024-02-23 09:30:15'
  },
  {
    id: 'ORD002',
    symbol: 'AU2406',
    type: 'buy',
    price: 515.00,
    quantity: 5,
    status: 'filled',
    createTime: '2024-02-23 10:15:30'
  },
  {
    id: 'ORD003',
    symbol: 'XAGUSD',
    type: 'sell',
    price: 28.90,
    quantity: 10,
    status: 'filled',
    createTime: '2024-02-23 14:20:45'
  },
  {
    id: 'ORD004',
    symbol: 'XAUUSD',
    type: 'sell',
    price: 2348.00,
    quantity: 1,
    status: 'filled',
    createTime: '2024-02-22 16:45:20'
  },
  {
    id: 'ORD005',
    symbol: 'XPTUSD',
    type: 'buy',
    price: 995.00,
    quantity: 1,
    status: 'filled',
    createTime: '2024-02-22 11:20:10'
  },
  {
    id: 'ORD006',
    symbol: 'XPDUSD',
    type: 'buy',
    price: 1020.00,
    quantity: 2,
    status: 'filled',
    createTime: '2024-02-21 14:30:00'
  },
  {
    id: 'ORD007',
    symbol: 'AG2406',
    type: 'sell',
    price: 6520.00,
    quantity: 3,
    status: 'cancelled',
    createTime: '2024-02-21 10:15:30'
  },
  {
    id: 'ORD008',
    symbol: 'XAUUSD',
    type: 'buy',
    price: 2320.00,
    quantity: 1,
    status: 'filled',
    createTime: '2024-02-20 09:45:15'
  },
  {
    id: 'ORD009',
    symbol: 'AU2406',
    type: 'sell',
    price: 520.00,
    quantity: 2,
    status: 'pending',
    createTime: '2024-02-20 13:20:00'
  },
  {
    id: 'ORD010',
    symbol: 'XAGUSD',
    type: 'buy',
    price: 28.50,
    quantity: 5,
    status: 'filled',
    createTime: '2024-02-19 15:30:45'
  },
  {
    id: 'ORD011',
    symbol: 'XPTUSD',
    type: 'sell',
    price: 1000.00,
    quantity: 1,
    status: 'filled',
    createTime: '2024-02-19 11:10:20'
  },
  {
    id: 'ORD012',
    symbol: 'XAUUSD',
    type: 'buy',
    price: 2310.00,
    quantity: 3,
    status: 'filled',
    createTime: '2024-02-18 14:25:30'
  }
];

export const mockClosedPositions: ClosedPosition[] = [
  {
    id: 'CLS001',
    symbol: 'XAUUSD',
    name: '国际黄金',
    direction: 'long',
    openTime: '2024-02-22 09:30:00',
    openPrice: 2320.00,
    closePrice: 2340.00,
    closeTime: '2024-02-22 15:30:00',
    quantity: 1,
    profitLoss: 2000.00,
    closeType: 'manual'
  },
  {
    id: 'CLS002',
    symbol: 'XAGUSD',
    name: '国际白银',
    direction: 'short',
    openTime: '2024-02-21 10:00:00',
    openPrice: 28.80,
    closePrice: 29.20,
    closeTime: '2024-02-21 16:00:00',
    quantity: 5,
    profitLoss: -2000.00,
    closeType: 'forced'
  },
  {
    id: 'CLS003',
    symbol: 'AU2406',
    name: '沪金主力',
    direction: 'long',
    openTime: '2024-02-20 11:00:00',
    openPrice: 510.00,
    closePrice: 518.00,
    closeTime: '2024-02-20 14:30:00',
    quantity: 3,
    profitLoss: 24000.00,
    closeType: 'manual'
  },
  {
    id: 'CLS004',
    symbol: 'XPTUSD',
    name: '国际铂金',
    direction: 'short',
    openTime: '2024-02-19 09:15:00',
    openPrice: 992.00,
    closePrice: 985.00,
    closeTime: '2024-02-19 16:45:00',
    quantity: 1,
    profitLoss: 700.00,
    closeType: 'manual'
  },
  {
    id: 'CLS005',
    symbol: 'XPDUSD',
    name: '国际钯金',
    direction: 'long',
    openTime: '2024-02-18 13:00:00',
    openPrice: 1015.00,
    closePrice: 1005.00,
    closeTime: '2024-02-18 17:00:00',
    quantity: 1,
    profitLoss: -980.00,
    closeType: 'forced'
  },
  {
    id: 'CLS006',
    symbol: 'AG2406',
    name: '沪银主力',
    direction: 'long',
    openTime: '2024-02-17 10:30:00',
    openPrice: 6420.00,
    closePrice: 6480.00,
    closeTime: '2024-02-17 15:00:00',
    quantity: 2,
    profitLoss: 12000.00,
    closeType: 'manual'
  },
  {
    id: 'CLS007',
    symbol: 'XAUUSD',
    name: '国际黄金',
    direction: 'short',
    openTime: '2024-02-16 09:00:00',
    openPrice: 2350.00,
    closePrice: 2355.00,
    closeTime: '2024-02-16 14:30:00',
    quantity: 2,
    profitLoss: -1000.00,
    closeType: 'forced'
  },
  {
    id: 'CLS008',
    symbol: 'XAGUSD',
    name: '国际白银',
    direction: 'long',
    openTime: '2024-02-15 11:00:00',
    openPrice: 28.30,
    closePrice: 28.70,
    closeTime: '2024-02-15 16:00:00',
    quantity: 8,
    profitLoss: 3200.00,
    closeType: 'manual'
  }
];

export const mockNews: NewsItem[] = [
  {
    id: 'NEWS001',
    title: '美联储暗示暂停加息步伐，黄金市场反应积极',
    content: '美联储最新会议纪要显示，多数委员支持暂停加息，受此影响，国际金价创近期新高。',
    time: '10分钟前',
    category: 'news'
  },
  {
    id: 'NEWS002',
    title: '系统维护通知：今晚22:00进行系统升级',
    content: '为提升服务质量，系统将于今晚22:00-22:30进行维护升级，期间交易功能暂停。',
    time: '30分钟前',
    category: 'system'
  },
  {
    id: 'NEWS003',
    title: '国内期货交易所调整保证金比例',
    content: '自下周一起，沪金、沪银合约保证金比例调整为10%和12%。',
    time: '1小时前',
    category: 'policy'
  }
];

// 首页公告数据 - 随机3条测试
export const mockAnnouncements = [
  {
    id: 1,
    content: '🎯 AI智能行情系统上线，为您提供实时市场分析与精准预测',
    time: '2024-02-23 14:30'
  },
  {
    id: 2,
    content: '📈 国际黄金价格突破2350美元，创下近三个月新高，市场看涨情绪浓厚',
    time: '2024-02-23 11:15'
  },
  {
    id: 3,
    content: '🔔 系统升级通知：今晚23:00-次日01:00进行服务器维护升级，期间暂停交易',
    time: '2024-02-23 09:00'
  },
];

// 强制刷新缓存标记: v1
