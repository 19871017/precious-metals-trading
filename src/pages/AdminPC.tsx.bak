import { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import {
  Table,
  Input,
  Button,
  Select,
  Switch,
  Dialog,
  Badge,
  Tooltip,
  Tag,
  DatePicker,
  InputNumber,
  Divider,
  MessagePlugin
} from 'tdesign-react';
import {
  DashboardIcon,
  UserIcon,
  ShopIcon,
  ChartIcon,
  WalletIcon,
  SettingIcon,
  LogoutIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  CheckCircleIcon,
  RefreshIcon,
  AddIcon,
  EditIcon,
  DeleteIcon,
  DownloadIcon
} from 'tdesign-icons-react';
import { formatCurrency } from '../utils/format';
import { adminApi } from '../services/admin';

// 菜单项配置
const menuItems = [
  { key: 'dashboard', icon: <DashboardIcon size="20px" />, label: '仪表盘' },
  { key: 'users', icon: <UserIcon size="20px" />, label: '用户管理' },
  { key: 'agents', icon: <UserIcon size="20px" />, label: '代理管理' },
  { key: 'products', icon: <ShopIcon size="20px" />, label: '产品管理' },
  { key: 'orders', icon: <ChartIcon size="20px" />, label: '订单管理' },
  { key: 'positions', icon: <ChartIcon size="20px" />, label: '持仓管理' },
  { key: 'finance', icon: <WalletIcon size="20px" />, label: '财务管理' },
  { key: 'commission', icon: <WalletIcon size="20px" />, label: '分佣管理' },
  { key: 'risk', icon: <SettingIcon size="20px" />, label: '风控管理' },
  { key: 'settings', icon: <SettingIcon size="20px" />, label: '系统设置' }
];

// 模拟数据
const mockDashboardData = {
  stats: [
    { title: '总用户数', value: '12,568', change: '+12.5%', icon: UserIcon, color: '#667eea' },
    { title: '活跃用户', value: '8,902', change: '+8.3%', icon: UserIcon, color: '#764ba2' },
    { title: '今日订单', value: '3,428', change: '+15.7%', icon: ShopIcon, color: '#f093fb' },
    { title: '持仓订单', value: '1,256', change: '-3.2%', icon: ChartIcon, color: '#f5576c' },
    { title: '总交易量', value: '¥5,680万', change: '+22.1%', icon: WalletIcon, color: '#4facfe' },
    { title: '平台资金', value: '¥1.58亿', change: '+18.9%', icon: WalletIcon, color: '#00f2fe' }
  ],
  recentOrders: [
    { id: 'ORD001', user: 'user001', symbol: 'XAUUSD', type: 'buy', volume: 0.5, profit: 1250, time: '10:30:25' },
    { id: 'ORD002', user: 'user002', symbol: 'XAGUSD', type: 'sell', volume: 1.0, profit: -280, time: '10:28:15' },
    { id: 'ORD003', user: 'user003', symbol: 'AU2406', type: 'buy', volume: 2.0, profit: 8400, time: '10:25:40' },
    { id: 'ORD004', user: 'user001', symbol: 'XPTUSD', type: 'sell', volume: 0.3, profit: -520, time: '10:22:18' }
  ],
  pendingDeposits: 3,
  pendingWithdrawals: 5
};

const mockUsers = [
  { id: 1, username: 'user001', realName: '张三', phone: '138****1234', balance: 125000, profit: 15000, level: 0, status: 'active', registerTime: '2024-01-15' },
  { id: 2, username: 'user002', realName: '李四', phone: '139****5678', balance: 88000, profit: -5200, level: 1, status: 'active', registerTime: '2024-01-18' },
  { id: 3, username: 'user003', realName: '王五', phone: '137****9012', balance: 250000, profit: 45000, level: 2, status: 'active', registerTime: '2024-01-20' }
];

const mockOrders = [
  { id: 'ORD202402230001', user: 'user001', symbol: 'XAUUSD', symbolName: '国际黄金', type: 'buy', volume: 0.5, price: 2035.5, leverage: 10, margin: 10177.5, profit: 1250, status: 'open', time: '2024-02-23 10:15:30' },
  { id: 'ORD202402230002', user: 'user002', symbol: 'XAGUSD', symbolName: '国际白银', type: 'sell', volume: 1.0, price: 22.85, leverage: 20, margin: 1142.5, profit: -280, status: 'open', time: '2024-02-23 09:45:00' },
  { id: 'ORD202402230003', user: 'user003', symbol: 'AU2406', symbolName: '沪金主力', type: 'buy', volume: 2.0, price: 505.8, leverage: 10, margin: 10116, profit: 8400, status: 'closed', time: '2024-02-22 15:30:00' }
];

const mockFinance = [
  { id: 'TXN001', user: 'user001', type: 'deposit', amount: 50000, method: 'bank', status: 'completed', time: '2024-02-23 08:00:00' },
  { id: 'TXN002', user: 'user002', type: 'withdraw', amount: 30000, method: 'bank', status: 'pending', time: '2024-02-23 09:00:00' },
  { id: 'TXN003', user: 'user003', type: 'deposit', amount: 100000, method: 'usdt', status: 'completed', time: '2024-02-22 14:30:00' }
];

interface AdminPCProps {
  onLogout?: () => void;
}

export default function AdminPC({ onLogout }: AdminPCProps) {
  const navigate = useNavigate();
  const location = useLocation();
  const [collapsed, setCollapsed] = useState(false);
  const [activeMenu, setActiveMenu] = useState('dashboard');
  const [userData, setUserData] = useState(() => {
    // 从独立的adminUser获取管理员信息
    try {
      const adminUser = localStorage.getItem('adminUser');
      if (adminUser) {
        const user = JSON.parse(adminUser);
        return {
          name: user.name || '管理员',
          avatar: '',
          role: '超级管理员'
        };
      }
    } catch (error) {
      console.error('解析管理员信息失败:', error);
    }
    return {
      name: '管理员',
      avatar: '',
      role: '超级管理员'
    };
  });

  // 各模块状态
  const [products, setProducts] = useState<any[]>([]);
  const [agents, setAgents] = useState<any[]>([]);
  const [positions, setPositions] = useState<any[]>([]);
  const [commissionRecords, setCommissionRecords] = useState<any[]>([]);
  const [commissionStats, setCommissionStats] = useState<any>({});
  const [loading, setLoading] = useState(false);

  // 手续费设置状态 - 从 localStorage 加载
  const [feeSettings, setFeeSettings] = useState(() => {
    try {
      const saved = localStorage.getItem('admin_fee_settings');
      if (saved) {
        return JSON.parse(saved);
      }
    } catch (error) {
      console.error('加载手续费设置失败:', error);
    }
    return {
      open_rate: 0.002,
      close_rate: 0.002,
      min_amount: 5,
      swap_long: 0.5,
      swap_short: -0.3
    };
  });

  // 根据路由设置激活菜单
  useEffect(() => {
    const path = location.pathname.replace('/admin', '').slice(1);
    if (path) {
      setActiveMenu(path);
    }
  }, [location]);

  // 数据加载函数 - 暂时使用模拟数据
  const loadProductsData = async () => {
    try {
      setLoading(true);
      // const data = await adminApi.product.getList();
      // 暂时使用模拟数据
      const data = [
        { id: 1, code: 'XAUUSD', name: '国际黄金', type: 'FOREX', category: '贵金属', pricePrecision: 2, volumePrecision: 2, minVolume: 0.01, maxLeverage: 100, commissionRate: 0.0005, status: 'active' },
        { id: 2, code: 'XAGUSD', name: '国际白银', type: 'FOREX', category: '贵金属', pricePrecision: 3, volumePrecision: 2, minVolume: 0.01, maxLeverage: 100, commissionRate: 0.0003, status: 'active' },
        { id: 3, code: 'AU2406', name: '沪金主力', type: 'FUTURES', category: '贵金属期货', pricePrecision: 1, volumePrecision: 1, minVolume: 1, maxLeverage: 10, commissionRate: 0.0001, status: 'active' }
      ];
      setProducts(data || []);
    } catch (error) {
      console.error('加载产品列表失败:', error);
      // MessagePlugin.error('加载产品列表失败');
    } finally {
      setLoading(false);
    }
  };

  const loadAgentsData = async () => {
    try {
      setLoading(true);
      // const data = await adminApi.agent.getList();
      // 暂时使用模拟数据
      const data = {
        list: [
          { id: 1, agentCode: 'AG001', name: '张代理', phone: '138****1111', level: 1, referralCount: 25, totalCommission: 15000, balance: 8000, status: 'active', createdAt: '2024-01-10 10:00:00' },
          { id: 2, agentCode: 'AG002', name: '李代理', phone: '139****2222', level: 2, referralCount: 12, totalCommission: 8500, balance: 5000, status: 'active', createdAt: '2024-01-15 14:30:00' },
          { id: 3, agentCode: 'AG003', name: '王代理', phone: '137****3333', level: 1, referralCount: 18, totalCommission: 12000, balance: 6500, status: 'inactive', createdAt: '2024-01-20 09:15:00' }
        ]
      };
      setAgents(data?.list || []);
    } catch (error) {
      console.error('加载代理列表失败:', error);
      // MessagePlugin.error('加载代理列表失败');
    } finally {
      setLoading(false);
    }
  };

  const loadPositionsData = async () => {
    try {
      setLoading(true);
      // const data = await adminApi.position.getList();
      // 暂时使用模拟数据
      const data = {
        list: [
          { id: 'POS001', userId: 'user001', orderId: 'ORD001', symbol: 'XAUUSD', direction: 'LONG', openPrice: 2035.50, currentPrice: 2038.20, quantity: 0.5, leverage: 10, marginUsed: 10177.50, unrealizedPnl: 1350, liquidationPrice: 2020.00, status: 'OPEN' },
          { id: 'POS002', userId: 'user002', orderId: 'ORD002', symbol: 'XAGUSD', direction: 'SHORT', openPrice: 22.85, currentPrice: 22.90, quantity: 1.0, leverage: 20, marginUsed: 1142.50, unrealizedPnl: -50, liquidationPrice: 23.50, status: 'OPEN' },
          { id: 'POS003', userId: 'user003', orderId: 'ORD003', symbol: 'AU2406', direction: 'LONG', openPrice: 505.80, currentPrice: 508.50, quantity: 2.0, leverage: 10, marginUsed: 10116.00, unrealizedPnl: 5400, liquidationPrice: 490.00, status: 'OPEN' }
        ]
      };
      setPositions(data?.list || []);
    } catch (error) {
      console.error('加载持仓列表失败:', error);
      // MessagePlugin.error('加载持仓列表失败');
    } finally {
      setLoading(false);
    }
  };

  const loadCommissionData = async () => {
    try {
      setLoading(true);
      // const [recordsData, statsData] = await Promise.all([
      //   adminApi.commission.getRecords(),
      //   adminApi.commission.getStats()
      // ]);
      // 暂时使用模拟数据
      const recordsData = {
        records: [
          { id: 1, agentId: 'AG001', userId: 'user001', commission: 150, volume: 50, rate: 0.003, status: 'settled', createdAt: '2024-02-20 10:00:00' },
          { id: 2, agentId: 'AG002', userId: 'user002', commission: 80, volume: 40, rate: 0.002, status: 'settled', createdAt: '2024-02-21 14:30:00' },
          { id: 3, agentId: 'AG001', userId: 'user003', commission: 200, volume: 100, rate: 0.002, status: 'pending', createdAt: '2024-02-22 09:00:00' }
        ]
      };
      const statsData = {
        totalCommission: 158000,
        totalVolume: 15800,
        agentCount: 25
      };
      setCommissionRecords(recordsData?.records || []);
      setCommissionStats(statsData || {});
    } catch (error) {
      console.error('加载分佣数据失败:', error);
      // MessagePlugin.error('加载分佣数据失败');
    } finally {
      setLoading(false);
    }
  };

  // 加载各模块数据
  useEffect(() => {
    if (activeMenu === 'products') {
      loadProductsData();
    } else if (activeMenu === 'agents') {
      loadAgentsData();
    } else if (activeMenu === 'positions') {
      loadPositionsData();
    } else if (activeMenu === 'commission') {
      loadCommissionData();
    }
  }, [activeMenu]);

  // 保存手续费设置
  const saveFeeSettings = async () => {
    try {
      // 保存到 localStorage
      localStorage.setItem('admin_fee_settings', JSON.stringify(feeSettings));
      MessagePlugin.success('手续费设置已保存');
    } catch (error) {
      MessagePlugin.error('保存失败，请重试');
    }
  };

  const handleLogout = () => {
    Dialog.confirm({
      header: '确认退出',
      body: '您确定要退出后台管理系统吗？',
      onConfirm: () => {
        // 如果传入了 onLogout 回调，使用它
        if (onLogout) {
          onLogout();
        } else {
          // 否则自己处理退出逻辑
          localStorage.removeItem('adminToken');
          localStorage.removeItem('adminUser');
        }
        // 跳转到后台登录页
        navigate('/');
      }
    });
  };

  // 渲染仪表盘
  const renderDashboard = () => (
    <div className="space-y-6">
      {/* 统计卡片 */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-3 gap-5">
        {mockDashboardData.stats.map((stat, index) => (
          <div
            key={index}
            style={{
              background: '#ffffff',
              borderRadius: '16px',
              padding: '24px',
              boxShadow: '0 4px 20px rgba(0, 0, 0, 0.08)',
              border: '1px solid #e5e7eb',
              transition: 'all 0.3s ease',
              cursor: 'pointer'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.transform = 'translateY(-4px)';
              e.currentTarget.style.boxShadow = '0 12px 40px rgba(0, 0, 0, 0.12)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.transform = 'translateY(0)';
              e.currentTarget.style.boxShadow = '0 4px 20px rgba(0, 0, 0, 0.08)';
            }}
          >
            <div className="flex items-start justify-between mb-4">
              <div style={{
                width: '56px',
                height: '56px',
                borderRadius: '14px',
                background: 'linear-gradient(135deg, #f3f4f6 0%, #e5e7eb 100%)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}>
                <stat.icon size="28px" style={{ color: stat.color }} />
              </div>
              <Tag
                theme={stat.change.includes('+') ? 'success' : 'danger'}
                shape="round"
                size="small"
                style={{ fontWeight: 500 }}
              >
                {stat.change}
              </Tag>
            </div>
            <div className="text-3xl font-bold text-gray-900 mb-2" style={{ letterSpacing: '-0.5px' }}>
              {stat.value}
            </div>
            <div className="text-sm text-gray-500" style={{ fontWeight: 500 }}>{stat.title}</div>
          </div>
        ))}
      </div>

      {/* 快捷操作 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* 待处理事项 */}
        <div
          style={{
            background: '#ffffff',
            borderRadius: '16px',
            padding: '24px',
            boxShadow: '0 4px 20px rgba(0, 0, 0, 0.08)',
            border: '1px solid #e5e7eb'
          }}
        >
          <div className="flex items-center gap-3 mb-5">
            <div style={{
              width: '40px',
              height: '40px',
              borderRadius: '10px',
              background: 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}>
              <WalletIcon size="20px" style={{ color: '#ffffff' }} />
            </div>
            <h3 className="text-lg font-semibold text-gray-900">待处理事项</h3>
          </div>
          <div className="space-y-3">
            <div className="flex items-center justify-between p-4 rounded-xl" style={{ background: 'linear-gradient(135deg, #fef3c7 0%, #fde68a 100%)' }}>
              <div className="flex items-center gap-3">
                <div style={{
                  width: '36px',
                  height: '36px',
                  borderRadius: '8px',
                  background: 'rgba(245, 158, 11, 0.2)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}>
                  <WalletIcon size="18px" style={{ color: '#d97706' }} />
                </div>
                <span className="text-gray-700 font-medium">待审核充值</span>
              </div>
              <Badge count={mockDashboardData.pendingDeposits} theme="warning" />
            </div>
            <div className="flex items-center justify-between p-4 rounded-xl" style={{ background: 'linear-gradient(135deg, #fecaca 0%, #fca5a5 100%)' }}>
              <div className="flex items-center gap-3">
                <div style={{
                  width: '36px',
                  height: '36px',
                  borderRadius: '8px',
                  background: 'rgba(239, 68, 68, 0.2)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}>
                  <WalletIcon size="18px" style={{ color: '#dc2626' }} />
                </div>
                <span className="text-gray-700 font-medium">待审核提现</span>
              </div>
              <Badge count={mockDashboardData.pendingWithdrawals} theme="danger" />
            </div>
          </div>
        </div>

        {/* 系统状态 */}
        <div
          style={{
            background: '#ffffff',
            borderRadius: '16px',
            padding: '24px',
            boxShadow: '0 4px 20px rgba(0, 0, 0, 0.08)',
            border: '1px solid #e5e7eb'
          }}
        >
          <div className="flex items-center gap-3 mb-5">
            <div style={{
              width: '40px',
              height: '40px',
              borderRadius: '10px',
              background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}>
              <CheckCircleIcon size="20px" style={{ color: '#ffffff' }} />
            </div>
            <h3 className="text-lg font-semibold text-gray-900">系统状态</h3>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="p-4 rounded-xl text-center" style={{ background: 'linear-gradient(135deg, #d1fae5 0%, #a7f3d0 100%)' }}>
              <div className="text-xs text-gray-600 mb-2 font-medium">服务器</div>
              <div className="flex items-center justify-center gap-2 text-green-600">
                <CheckCircleIcon size="16px" />
                <span className="text-sm font-bold">正常</span>
              </div>
            </div>
            <div className="p-4 rounded-xl text-center" style={{ background: 'linear-gradient(135deg, #d1fae5 0%, #a7f3d0 100%)' }}>
              <div className="text-xs text-gray-600 mb-2 font-medium">数据库</div>
              <div className="flex items-center justify-center gap-2 text-green-600">
                <CheckCircleIcon size="16px" />
                <span className="text-sm font-bold">正常</span>
              </div>
            </div>
            <div className="p-4 rounded-xl text-center" style={{ background: 'linear-gradient(135deg, #d1fae5 0%, #a7f3d0 100%)' }}>
              <div className="text-xs text-gray-600 mb-2 font-medium">Redis</div>
              <div className="flex items-center justify-center gap-2 text-green-600">
                <CheckCircleIcon size="16px" />
                <span className="text-sm font-bold">正常</span>
              </div>
            </div>
            <div className="p-4 rounded-xl text-center" style={{ background: 'linear-gradient(135deg, #d1fae5 0%, #a7f3d0 100%)' }}>
              <div className="text-xs text-gray-600 mb-2 font-medium">API</div>
              <div className="flex items-center justify-center gap-2 text-green-600">
                <CheckCircleIcon size="16px" />
                <span className="text-sm font-bold">正常</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* 最近订单 */}
      <div
        style={{
          background: '#ffffff',
          borderRadius: '16px',
          padding: '24px',
          boxShadow: '0 4px 20px rgba(0, 0, 0, 0.08)',
          border: '1px solid #e5e7eb'
        }}
      >
        <div className="flex items-center gap-3 mb-5">
          <div style={{
            width: '40px',
            height: '40px',
            borderRadius: '10px',
            background: 'linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
          }}>
            <ChartIcon size="20px" style={{ color: '#ffffff' }} />
          </div>
          <h3 className="text-lg font-semibold text-gray-900">最近订单</h3>
        </div>
        <Table
          columns={[
            { colKey: 'id', title: '订单号', width: 150 },
            { colKey: 'user', title: '用户', width: 100 },
            { colKey: 'symbol', title: '品种', width: 100 },
            {
              colKey: 'type',
              title: '方向',
              cell: (row: any) => (
                <Tag theme={row.type === 'buy' ? 'danger' : 'success'}>
                  {row.type === 'buy' ? '买入' : '卖出'}
                </Tag>
              ),
              width: 80
            },
            { colKey: 'volume', title: '手数', width: 80 },
            {
              colKey: 'profit',
              title: '盈亏',
              cell: (row: any) => (
                <span className={row.profit >= 0 ? 'text-green-600 font-medium' : 'text-red-600 font-medium'}>
                  {formatCurrency(row.profit)}
                </span>
              ),
              width: 100
            },
            { colKey: 'time', title: '时间', width: 120 }
          ]}
          data={mockDashboardData.recentOrders}
          stripe
          hover
          size="small"
          pagination={false}
        />
      </div>
    </div>
  );

  // 渲染用户管理
  const renderUsers = () => (
    <div
      style={{
        background: '#ffffff',
        borderRadius: '16px',
        padding: '24px',
        boxShadow: '0 4px 20px rgba(0, 0, 0, 0.08)',
        border: '1px solid #e5e7eb'
      }}
    >
      <div className="flex items-center gap-3 mb-5">
        <div style={{
          width: '40px',
          height: '40px',
          borderRadius: '10px',
          background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center'
        }}>
          <UserIcon size="20px" style={{ color: '#ffffff' }} />
        </div>
        <h3 className="text-lg font-semibold text-gray-900">用户列表</h3>
      </div>
      <div className="mb-4 flex gap-4">
        <Input placeholder="搜索用户名/手机号" style={{ width: 250 }} clearable />
        <Select placeholder="用户状态" clearable style={{ width: 150 }}>
          <Select.Option value="active">正常</Select.Option>
          <Select.Option value="disabled">禁用</Select.Option>
        </Select>
        <Button theme="primary" icon={<UserIcon size="16px" />} style={{ borderRadius: '10px' }}>
          新增用户
        </Button>
      </div>
      <Table
        columns={[
          { colKey: 'id', title: 'ID', width: 80 },
          { colKey: 'username', title: '用户名', width: 120 },
          { colKey: 'realName', title: '姓名', width: 100 },
          { colKey: 'phone', title: '手机号', width: 120 },
          {
            colKey: 'balance',
            title: '余额',
            cell: (row: any) => formatCurrency(row.balance),
            width: 120
          },
          {
            colKey: 'profit',
            title: '累计盈亏',
            cell: (row: any) => (
              <span className={row.profit >= 0 ? 'text-green-600' : 'text-red-600'}>
                {formatCurrency(row.profit)}
              </span>
            ),
            width: 120
          },
          {
            colKey: 'level',
            title: '等级',
            cell: (row: any) => ['普通用户', '一级代理', '二级代理'][row.level],
            width: 100
          },
          {
            colKey: 'status',
            title: '状态',
            cell: (row: any) => (
              row.status === 'active' ? <Tag theme="success">正常</Tag> : <Tag theme="danger">禁用</Tag>
            ),
            width: 80
          },
          { colKey: 'registerTime', title: '注册时间', width: 120 },
          {
            colKey: 'action',
            title: '操作',
            width: 150,
            cell: () => (
              <div className="space-x-2">
                <Button size="small" variant="text">查看</Button>
                <Button size="small" variant="text">编辑</Button>
              </div>
            )
          }
        ]}
        data={mockUsers}
        stripe
        hover
        size="small"
        pagination={{ defaultPageSize: 10, total: 100 }}
      />
    </div>
  );

  // 渲染订单管理
  const renderOrders = () => (
    <div
      style={{
        background: '#ffffff',
        borderRadius: '16px',
        padding: '24px',
        boxShadow: '0 4px 20px rgba(0, 0, 0, 0.08)',
        border: '1px solid #e5e7eb'
      }}
    >
      <div className="flex items-center gap-3 mb-5">
        <div style={{
          width: '40px',
          height: '40px',
          borderRadius: '10px',
          background: 'linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center'
        }}>
          <ChartIcon size="20px" style={{ color: '#ffffff' }} />
        </div>
        <h3 className="text-lg font-semibold text-gray-900">订单管理</h3>
      </div>
      <div className="mb-4 flex gap-4 items-center">
        <Input placeholder="搜索订单号/用户" style={{ width: 250 }} clearable />
        <Select placeholder="订单状态" clearable style={{ width: 150 }}>
          <Select.Option value="open">持仓中</Select.Option>
          <Select.Option value="closed">已平仓</Select.Option>
        </Select>
        <DatePicker placeholder="选择日期范围" style={{ width: 250 }} />
        <Button theme="primary" icon={<RefreshIcon size="16px" />} style={{ borderRadius: '10px' }}>
          刷新
        </Button>
      </div>
      <Table
        columns={[
          { colKey: 'id', title: '订单号', width: 150 },
          { colKey: 'user', title: '用户', width: 100 },
          { colKey: 'symbolName', title: '品种', width: 100 },
          {
            colKey: 'type',
            title: '方向',
            cell: (row: any) => (
              <Tag theme={row.type === 'buy' ? 'danger' : 'success'}>
                {row.type === 'buy' ? '买入' : '卖出'}
              </Tag>
            ),
            width: 80
          },
          { colKey: 'volume', title: '手数', width: 80 },
          { colKey: 'price', title: '价格', width: 100 },
          {
            colKey: 'leverage',
            title: '杠杆',
            cell: (row: any) => `${row.leverage}x`,
            width: 80
          },
          {
            colKey: 'margin',
            title: '保证金',
            cell: (row: any) => formatCurrency(row.margin),
            width: 120
          },
          {
            colKey: 'profit',
            title: '盈亏',
            cell: (row: any) => (
              <span className={row.profit >= 0 ? 'text-green-600 font-medium' : 'text-red-600 font-medium'}>
                {formatCurrency(row.profit)}
              </span>
            ),
            width: 100
          },
          {
            colKey: 'status',
            title: '状态',
            cell: (row: any) => (
              row.status === 'open' ? <Tag theme="primary">持仓中</Tag> : <Tag>已平仓</Tag>
            ),
            width: 100
          },
          { colKey: 'time', title: '时间', width: 160 },
          {
            colKey: 'action',
            title: '操作',
            width: 150,
            cell: () => (
              <div className="space-x-2">
                <Button size="small" variant="text">查看</Button>
                <Button size="small" variant="text">平仓</Button>
              </div>
            )
          }
        ]}
        data={mockOrders}
        stripe
        hover
        size="small"
        pagination={{ defaultPageSize: 10, total: 156 }}
      />
    </div>
  );

  // 渲染财务管理
  const renderFinance = () => (
    <div
      style={{
        background: '#ffffff',
        borderRadius: '16px',
        padding: '24px',
        boxShadow: '0 4px 20px rgba(0, 0, 0, 0.08)',
        border: '1px solid #e5e7eb'
      }}
    >
      <div className="flex items-center gap-3 mb-5">
        <div style={{
          width: '40px',
          height: '40px',
          borderRadius: '10px',
          background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center'
        }}>
          <WalletIcon size="20px" style={{ color: '#ffffff' }} />
        </div>
        <h3 className="text-lg font-semibold text-gray-900">财务管理</h3>
      </div>
      <div className="mb-4 flex gap-4 items-center">
        <Input placeholder="搜索流水号/用户" style={{ width: 250 }} clearable />
        <Select placeholder="交易类型" clearable style={{ width: 150 }}>
          <Select.Option value="deposit">充值</Select.Option>
          <Select.Option value="withdraw">提现</Select.Option>
        </Select>
        <Select placeholder="状态筛选" clearable style={{ width: 150 }}>
          <Select.Option value="pending">待审核</Select.Option>
          <Select.Option value="completed">已完成</Select.Option>
          <Select.Option value="rejected">已拒绝</Select.Option>
        </Select>
      </div>
      <Table
        columns={[
          { colKey: 'id', title: '流水号', width: 150 },
          { colKey: 'user', title: '用户', width: 100 },
          {
            colKey: 'type',
            title: '类型',
            cell: (row: any) => (
              <Tag theme={row.type === 'deposit' ? 'success' : 'warning'}>
                {row.type === 'deposit' ? '充值' : '提现'}
              </Tag>
            ),
            width: 80
          },
          {
            colKey: 'amount',
            title: '金额',
            cell: (row: any) => formatCurrency(row.amount),
            width: 120
          },
          {
            colKey: 'method',
            title: '方式',
            cell: (row: any) => {
              const methods: any = { bank: '银行卡', usdt: 'USDT', alipay: '支付宝' };
              return methods[row.method] || row.method;
            },
            width: 100
          },
          {
            colKey: 'status',
            title: '状态',
            cell: (row: any) => {
              const statusMap: any = {
                pending: { label: '待审核', theme: 'warning' },
                completed: { label: '已完成', theme: 'success' },
                rejected: { label: '已拒绝', theme: 'danger' }
              };
              const status = statusMap[row.status] || { label: row.status || '未知', theme: 'default' };
              return <Tag theme={status.theme}>{status.label}</Tag>;
            },
            width: 100
          },
          { colKey: 'time', title: '时间', width: 160 },
          {
            colKey: 'action',
            title: '操作',
            width: 180,
            cell: (row: any) => (
              row.status === 'pending' ? (
                <div className="space-x-2">
                  <Button size="small" theme="success" variant="outline">通过</Button>
                  <Button size="small" theme="danger" variant="outline">拒绝</Button>
                </div>
              ) : (
                <Button size="small" variant="text" disabled>已处理</Button>
              )
            )
          }
        ]}
        data={mockFinance}
        stripe
        hover
        size="small"
        pagination={{ defaultPageSize: 10, total: 50 }}
      />
    </div>
  );

  // 渲染系统设置
  const renderSettings = () => (
    <div className="space-y-6">
      {/* 基本设置 */}
      <div
        style={{
          background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
          borderRadius: '16px',
          padding: '24px',
          boxShadow: '0 10px 40px rgba(102, 126, 234, 0.15)'
        }}
      >
        <div className="flex items-center gap-3 mb-4">
          <SettingIcon size="24px" style={{ color: '#ffffff' }} />
          <h3 className="text-xl font-semibold text-white">基本设置</h3>
        </div>
        <div className="space-y-3" style={{ backgroundColor: '#ffffff', borderRadius: '12px', padding: '20px' }}>
          <div className="flex items-center justify-between py-2">
            <div className="flex-1">
              <div className="text-sm font-semibold text-gray-900 mb-1">维护模式</div>
              <div className="text-xs text-gray-500">开启后普通用户无法访问系统</div>
            </div>
            <Switch defaultValue={false} size="large" className="!ml-4" />
          </div>
          <div className="flex items-center justify-between py-2" style={{ borderTop: '1px solid #f0f0f0', paddingTop: '16px' }}>
            <div className="flex-1">
              <div className="text-sm font-semibold text-gray-900 mb-1">允许注册</div>
              <div className="text-xs text-gray-500">是否开放用户注册功能</div>
            </div>
            <Switch defaultValue={true} size="large" className="!ml-4" />
          </div>
          <div className="flex items-center justify-between py-2" style={{ borderTop: '1px solid #f0f0f0', paddingTop: '16px' }}>
            <div className="flex-1">
              <div className="text-sm font-semibold text-gray-900 mb-1">允许交易</div>
              <div className="text-xs text-gray-500">是否允许用户进行交易操作</div>
            </div>
            <Switch defaultValue={true} size="large" className="!ml-4" />
          </div>
        </div>
      </div>

      {/* 交易设置 */}
      <div
        style={{
          background: 'linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)',
          borderRadius: '16px',
          padding: '24px',
          boxShadow: '0 10px 40px rgba(79, 172, 254, 0.15)'
        }}
      >
        <div className="flex items-center gap-3 mb-4">
          <ChartIcon size="24px" style={{ color: '#ffffff' }} />
          <h3 className="text-xl font-semibold text-white">交易设置</h3>
        </div>
        <div className="grid grid-cols-3 gap-4" style={{ backgroundColor: '#ffffff', borderRadius: '12px', padding: '20px' }}>
          <div className="text-center p-4 rounded-xl" style={{ background: 'linear-gradient(135deg, #f5f7fa 0%, #e8ecf1 100%)' }}>
            <div className="text-xs text-gray-500 mb-2">最大杠杆</div>
            <div className="text-2xl font-bold" style={{ background: 'linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>100x</div>
          </div>
          <div className="text-center p-4 rounded-xl" style={{ background: 'linear-gradient(135deg, #f5f7fa 0%, #e8ecf1 100%)' }}>
            <div className="text-xs text-gray-500 mb-2">最小充值</div>
            <div className="text-2xl font-bold text-gray-900">$100</div>
          </div>
          <div className="text-center p-4 rounded-xl" style={{ background: 'linear-gradient(135deg, #f5f7fa 0%, #e8ecf1 100%)' }}>
            <div className="text-xs text-gray-500 mb-2">最小提现</div>
            <div className="text-2xl font-bold text-gray-900">$100</div>
          </div>
        </div>
      </div>

      {/* 手续费设置 */}
      <div
        style={{
          background: 'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)',
          borderRadius: '16px',
          padding: '24px',
          boxShadow: '0 10px 40px rgba(240, 147, 251, 0.15)'
        }}
      >
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <WalletIcon size="24px" style={{ color: '#ffffff' }} />
            <div>
              <h3 className="text-xl font-semibold text-white">手续费设置</h3>
              <p className="text-xs text-white/80 mt-1">设置平台交易手续费，这是平台的主要收入来源</p>
            </div>
          </div>
        </div>
        <div className="space-y-5" style={{ backgroundColor: '#ffffff', borderRadius: '12px', padding: '24px' }}>
          <div className="flex items-center gap-6">
            <div className="flex-1">
              <label className="block text-sm font-semibold text-gray-900 mb-2">
                开仓手续费率
                <span className="block text-xs text-gray-500 mt-1 font-normal">开仓时收取的手续费比例（小数形式）</span>
              </label>
              <InputNumber
                placeholder="0.002"
                min={0}
                max={0.1}
                step={0.001}
                decimalPlaces={4}
                value={feeSettings.open_rate}
                onChange={(value) => setFeeSettings({ ...feeSettings, open_rate: value })}
                style={{ width: 200 }}
              />
            </div>
            <div className="px-6 py-3 rounded-xl" style={{ background: 'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)' }}>
              <div className="text-xs text-white/80 mb-1">当前值</div>
              <div className="text-2xl font-bold text-white">{(feeSettings.open_rate * 100).toFixed(2)}%</div>
            </div>
          </div>

          <div className="flex items-center gap-6">
            <div className="flex-1">
              <label className="block text-sm font-semibold text-gray-900 mb-2">
                平仓手续费率
                <span className="block text-xs text-gray-500 mt-1 font-normal">平仓时收取的手续费比例（小数形式）</span>
              </label>
              <InputNumber
                placeholder="0.002"
                min={0}
                max={0.1}
                step={0.001}
                decimalPlaces={4}
                value={feeSettings.close_rate}
                onChange={(value) => setFeeSettings({ ...feeSettings, close_rate: value })}
                style={{ width: 200 }}
              />
            </div>
            <div className="px-6 py-3 rounded-xl" style={{ background: 'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)' }}>
              <div className="text-xs text-white/80 mb-1">当前值</div>
              <div className="text-2xl font-bold text-white">{(feeSettings.close_rate * 100).toFixed(2)}%</div>
            </div>
          </div>

          <div className="flex items-center gap-6">
            <div className="flex-1">
              <label className="block text-sm font-semibold text-gray-900 mb-2">
                最小手续费金额
                <span className="block text-xs text-gray-500 mt-1 font-normal">每笔交易的最低手续费，单位：美元</span>
              </label>
              <InputNumber
                placeholder="5"
                min={0}
                max={100}
                step={1}
                value={feeSettings.min_amount}
                onChange={(value) => setFeeSettings({ ...feeSettings, min_amount: value })}
                style={{ width: 200 }}
              />
            </div>
            <div className="px-6 py-3 rounded-xl" style={{ background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)' }}>
              <div className="text-xs text-white/80 mb-1">当前值</div>
              <div className="text-2xl font-bold text-white">${feeSettings.min_amount}</div>
            </div>
          </div>

          <div className="flex items-center gap-6">
            <div className="flex-1">
              <label className="block text-sm font-semibold text-gray-900 mb-2">
                多头隔夜费
                <span className="block text-xs text-gray-500 mt-1 font-normal">持有做多头寸过夜时收取的费用（美元/手/天）</span>
              </label>
              <InputNumber
                placeholder="0.5"
                min={-10}
                max={10}
                step={0.1}
                decimalPlaces={2}
                value={feeSettings.swap_long}
                onChange={(value) => setFeeSettings({ ...feeSettings, swap_long: value })}
                style={{ width: 200 }}
              />
            </div>
            <div className={`px-6 py-3 rounded-xl ${feeSettings.swap_long >= 0 ? 'bg-red-50' : 'bg-green-50'}`}>
              <div className="text-xs text-gray-500 mb-1">当前值</div>
              <div className={`text-2xl font-bold ${feeSettings.swap_long >= 0 ? 'text-red-600' : 'text-green-600'}`}>
                {feeSettings.swap_long >= 0 ? '+' : ''}${feeSettings.swap_long}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-6">
            <div className="flex-1">
              <label className="block text-sm font-semibold text-gray-900 mb-2">
                空头隔夜费
                <span className="block text-xs text-gray-500 mt-1 font-normal">持有做空头寸过夜时收取的费用（美元/手/天）</span>
              </label>
              <InputNumber
                placeholder="-0.3"
                min={-10}
                max={10}
                step={0.1}
                decimalPlaces={2}
                value={feeSettings.swap_short}
                onChange={(value) => setFeeSettings({ ...feeSettings, swap_short: value })}
                style={{ width: 200 }}
              />
            </div>
            <div className={`px-6 py-3 rounded-xl ${feeSettings.swap_short >= 0 ? 'bg-red-50' : 'bg-green-50'}`}>
              <div className="text-xs text-gray-500 mb-1">当前值</div>
              <div className={`text-2xl font-bold ${feeSettings.swap_short >= 0 ? 'text-red-600' : 'text-green-600'}`}>
                {feeSettings.swap_short >= 0 ? '+' : ''}${feeSettings.swap_short}
              </div>
            </div>
          </div>

          <Divider style={{ margin: '24px 0' }} />

          <div style={{
            background: 'linear-gradient(135deg, #f0f9ff 0%, #e0f2fe 100%)',
            border: '1px solid #bae6fd',
            borderRadius: '12px',
            padding: '16px'
          }}>
            <div className="flex items-start gap-3">
              <div style={{
                width: '32px',
                height: '32px',
                background: 'linear-gradient(135deg, #0ea5e9 0%, #0284c7 100%)',
                borderRadius: '8px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0
              }}>
                <CheckCircleIcon size="18px" style={{ color: '#ffffff' }} />
              </div>
              <div>
                <div className="text-sm font-semibold text-gray-900 mb-2">手续费计算说明</div>
                <ul className="space-y-1.5 text-xs text-gray-600">
                  <li>• 开仓手续费 = 交易金额 × 开仓手续费率</li>
                  <li>• 平仓手续费 = 交易金额 × 平仓手续费率</li>
                  <li>• 实际手续费 = 计算手续费和最小手续费中的较大值</li>
                  <li>• 隔夜费每天结算一次，过夜持仓会产生</li>
                </ul>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="flex justify-end gap-3 mt-6">
        <Button
          size="large"
          variant="outline"
          onClick={() => {
            setFeeSettings({
              open_rate: 0.002,
              close_rate: 0.002,
              min_amount: 5,
              swap_long: 0.5,
              swap_short: -0.3
            });
            MessagePlugin.info('已重置为默认值');
          }}
          style={{ borderRadius: '10px' }}
        >
          重置
        </Button>
        <Button
          theme="primary"
          size="large"
          onClick={saveFeeSettings}
          style={{
            borderRadius: '10px',
            background: 'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)',
            border: 'none',
            boxShadow: '0 4px 15px rgba(240, 147, 251, 0.3)'
          }}
        >
          保存手续费设置
        </Button>
      </div>
    </div>
  );

  // 渲染产品管理
  const renderProducts = () => (
      <div
        style={{
          background: '#ffffff',
          borderRadius: '16px',
          padding: '24px',
          boxShadow: '0 4px 20px rgba(0, 0, 0, 0.08)',
          border: '1px solid #e5e7eb'
        }}
      >
        <div className="flex items-center gap-3 mb-5">
          <div style={{
            width: '40px',
            height: '40px',
            borderRadius: '10px',
            background: 'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
          }}>
            <ShopIcon size="20px" style={{ color: '#ffffff' }} />
          </div>
          <h3 className="text-lg font-semibold text-gray-900">产品管理</h3>
        </div>
        <div className="mb-4 flex gap-4">
          <Input placeholder="搜索产品代码/名称" style={{ width: 250 }} clearable />
          <Select placeholder="产品分类" clearable style={{ width: 150 }}>
            <Select.Option value="贵金属">贵金属</Select.Option>
            <Select.Option value="贵金属期货">贵金属期货</Select.Option>
          </Select>
          <Select placeholder="状态" clearable style={{ width: 120 }}>
            <Select.Option value="active">启用</Select.Option>
            <Select.Option value="inactive">停用</Select.Option>
          </Select>
          <Button theme="primary" icon={<AddIcon size="16px" />} style={{ borderRadius: '10px' }} onClick={() => MessagePlugin.info('添加产品功能开发中')}>
            新增产品
          </Button>
        </div>
        <Table
          columns={[
            { colKey: 'id', title: 'ID', width: 60 },
            { colKey: 'code', title: '产品代码', width: 100 },
            { colKey: 'name', title: '产品名称', width: 120 },
            {
              colKey: 'type',
              title: '类型',
              cell: (row: any) => (
                <Tag theme={row.type === 'FOREX' ? 'primary' : 'warning'}>
                  {row.type === 'FOREX' ? '现货' : '期货'}
                </Tag>
              ),
              width: 80
            },
            { colKey: 'category', title: '分类', width: 120 },
            {
              colKey: 'pricePrecision',
              title: '价格精度',
              cell: (row: any) => row.pricePrecision + '位',
              width: 100
            },
            {
              colKey: 'volumePrecision',
              title: '数量精度',
              cell: (row: any) => row.volumePrecision + '位',
              width: 100
            },
            {
              colKey: 'minVolume',
              title: '最小手数',
              cell: (row: any) => row.minVolume,
              width: 100
            },
            {
              colKey: 'maxLeverage',
              title: '最大杠杆',
              cell: (row: any) => row.maxLeverage + 'x',
              width: 100
            },
            {
              colKey: 'commissionRate',
              title: '手续费率',
              cell: (row: any) => (row.commissionRate * 100).toFixed(3) + '%',
              width: 100
            },
            {
              colKey: 'status',
              title: '状态',
              cell: (row: any) => (
                row.status === 'active' ? <Tag theme="success">启用</Tag> : <Tag theme="danger">停用</Tag>
              ),
              width: 80
            },
            {
              colKey: 'action',
              title: '操作',
              width: 150,
              cell: (row: any) => (
                <div className="space-x-2">
                  <Button size="small" variant="text" icon={<EditIcon size="14px" />}>编辑</Button>
                  <Button size="small" variant="text" theme="danger" icon={<DeleteIcon size="14px" />}>删除</Button>
                </div>
              )
            }
          ]}
          data={products}
          stripe
          hover
          size="small"
          loading={loading}
          pagination={{ defaultPageSize: 10 }}
        />
      </div>
  );

  // 渲染代理管理
  const renderAgents = () => (
      <div
        style={{
          background: '#ffffff',
          borderRadius: '16px',
          padding: '24px',
          boxShadow: '0 4px 20px rgba(0, 0, 0, 0.08)',
          border: '1px solid #e5e7eb'
        }}
      >
        <div className="flex items-center gap-3 mb-5">
          <div style={{
            width: '40px',
            height: '40px',
            borderRadius: '10px',
            background: 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
          }}>
            <UserIcon size="20px" style={{ color: '#ffffff' }} />
          </div>
          <h3 className="text-lg font-semibold text-gray-900">代理管理</h3>
        </div>
        <div className="mb-4 flex gap-4">
          <Input placeholder="搜索代理姓名/手机号" style={{ width: 250 }} clearable />
          <Select placeholder="代理等级" clearable style={{ width: 150 }}>
            <Select.Option value="1">一级代理</Select.Option>
            <Select.Option value="2">二级代理</Select.Option>
            <Select.Option value="3">三级代理</Select.Option>
          </Select>
          <Select placeholder="状态" clearable style={{ width: 120 }}>
            <Select.Option value="active">正常</Select.Option>
            <Select.Option value="inactive">停用</Select.Option>
          </Select>
          <Button theme="primary" icon={<AddIcon size="16px" />} style={{ borderRadius: '10px' }} onClick={() => MessagePlugin.info('添加代理功能开发中')}>
            新增代理
          </Button>
        </div>
        <Table
          columns={[
            { colKey: 'id', title: 'ID', width: 60 },
            { colKey: 'agentCode', title: '代理代码', width: 120 },
            { colKey: 'name', title: '代理姓名', width: 100 },
            { colKey: 'phone', title: '手机号', width: 130 },
            {
              colKey: 'level',
              title: '等级',
              cell: (row: any) => (
                <Tag theme={row.level === 1 ? 'primary' : row.level === 2 ? 'warning' : 'default'}>
                  {row.level}级代理
                </Tag>
              ),
              width: 100
            },
            { colKey: 'referralCount', title: '下级用户', width: 100 },
            {
              colKey: 'totalCommission',
              title: '累计分佣',
              cell: (row: any) => formatCurrency(row.totalCommission || 0),
              width: 120
            },
            {
              colKey: 'balance',
              title: '可提现',
              cell: (row: any) => formatCurrency(row.balance || 0),
              width: 120
            },
            {
              colKey: 'status',
              title: '状态',
              cell: (row: any) => (
                row.status === 'active' ? <Tag theme="success">正常</Tag> : <Tag theme="danger">停用</Tag>
              ),
              width: 80
            },
            { colKey: 'createdAt', title: '注册时间', width: 160 },
            {
              colKey: 'action',
              title: '操作',
              width: 180,
              cell: (row: any) => (
                <div className="space-x-2">
                  <Button size="small" variant="text" icon={<EditIcon size="14px" />}>编辑</Button>
                  <Button size="small" variant="text" icon={<WalletIcon size="14px" />}>佣金</Button>
                  <Button size="small" variant="text" theme="danger" icon={<DeleteIcon size="14px" />}>删除</Button>
                </div>
              )
            }
          ]}
          data={agents}
          stripe
          hover
          size="small"
          loading={loading}
          pagination={{ defaultPageSize: 10 }}
        />
      </div>
  );

  // 渲染持仓管理
  const renderPositions = () => (
      <div
        style={{
          background: '#ffffff',
          borderRadius: '16px',
          padding: '24px',
          boxShadow: '0 4px 20px rgba(0, 0, 0, 0.08)',
          border: '1px solid #e5e7eb'
        }}
      >
        <div className="flex items-center gap-3 mb-5">
          <div style={{
            width: '40px',
            height: '40px',
            borderRadius: '10px',
            background: 'linear-gradient(135deg, #ef4444 0%, #dc2626 100%)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
          }}>
            <ChartIcon size="20px" style={{ color: '#ffffff' }} />
          </div>
          <h3 className="text-lg font-semibold text-gray-900">持仓管理</h3>
        </div>
        <div className="mb-4 flex gap-4">
          <Input placeholder="搜索用户ID/订单号" style={{ width: 250 }} clearable />
          <Select placeholder="品种" clearable style={{ width: 150 }}>
            <Select.Option value="XAUUSD">国际黄金</Select.Option>
            <Select.Option value="XAGUSD">国际白银</Select.Option>
            <Select.Option value="AU2406">沪金主力</Select.Option>
          </Select>
          <Select placeholder="方向" clearable style={{ width: 120 }}>
            <Select.Option value="LONG">做多</Select.Option>
            <Select.Option value="SHORT">做空</Select.Option>
          </Select>
          <Button theme="default" icon={<RefreshIcon size="16px" />} style={{ borderRadius: '10px' }} onClick={loadPositionsData}>
            刷新
          </Button>
          <Button theme="warning" icon={<DownloadIcon size="16px" />} style={{ borderRadius: '10px' }}>
            导出数据
          </Button>
        </div>
        <Table
          columns={[
            { colKey: 'id', title: '持仓ID', width: 120 },
            { colKey: 'userId', title: '用户ID', width: 100 },
            { colKey: 'orderId', title: '订单号', width: 150 },
            { colKey: 'symbol', title: '品种', width: 100 },
            {
              colKey: 'direction',
              title: '方向',
              cell: (row: any) => (
                <Tag theme={row.direction === 'LONG' ? 'danger' : 'success'}>
                  {row.direction === 'LONG' ? '做多' : '做空'}
                </Tag>
              ),
              width: 80
            },
            {
              colKey: 'openPrice',
              title: '开仓价',
              cell: (row: any) => row.openPrice?.toFixed(2),
              width: 100
            },
            {
              colKey: 'currentPrice',
              title: '当前价',
              cell: (row: any) => row.currentPrice?.toFixed(2),
              width: 100
            },
            { colKey: 'quantity', title: '手数', width: 80 },
            {
              colKey: 'leverage',
              title: '杠杆',
              cell: (row: any) => row.leverage + 'x',
              width: 80
            },
            {
              colKey: 'marginUsed',
              title: '占用保证金',
              cell: (row: any) => formatCurrency(row.marginUsed || 0),
              width: 120
            },
            {
              colKey: 'unrealizedPnl',
              title: '浮动盈亏',
              cell: (row: any) => (
                <span className={row.unrealizedPnl >= 0 ? 'text-green-600 font-medium' : 'text-red-600 font-medium'}>
                  {formatCurrency(row.unrealizedPnl || 0)}
                </span>
              ),
              width: 120
            },
            {
              colKey: 'liquidationPrice',
              title: '强平价',
              cell: (row: any) => row.liquidationPrice?.toFixed(2),
              width: 100
            },
            {
              colKey: 'status',
              title: '状态',
              cell: (row: any) => {
                const statusMap: any = {
                  OPEN: { label: '持仓', theme: 'primary' },
                  CLOSED: { label: '已平仓', theme: 'success' },
                  LIQUIDATED: { label: '已强平', theme: 'danger' }
                };
                const status = statusMap[row.status] || { label: row.status || '未知', theme: 'default' };
                return <Tag theme={status.theme}>{status.label}</Tag>;
              },
              width: 100
            },
            {
              colKey: 'action',
              title: '操作',
              width: 120,
              cell: (row: any) => (
                <div className="space-x-2">
                  <Button size="small" variant="text">详情</Button>
                  <Button size="small" variant="text" theme="danger">强平</Button>
                </div>
              )
            }
          ]}
          data={positions}
          stripe
          hover
          size="small"
          loading={loading}
          pagination={{ defaultPageSize: 10 }}
        />
      </div>
  );

  // 渲染分佣管理
  const renderCommission = () => (
      <div className="space-y-6">
        {/* 统计卡片 */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-5">
          <div style={{
            background: '#ffffff',
            borderRadius: '16px',
            padding: '24px',
            boxShadow: '0 4px 20px rgba(0, 0, 0, 0.08)',
            border: '1px solid #e5e7eb'
          }}>
            <div className="p-4">
              <div className="text-sm text-gray-500 mb-2">总分佣金额</div>
              <div className="text-2xl font-bold text-gray-900">{formatCurrency(commissionStats.totalCommission || 0)}</div>
            </div>
          </div>
          <div style={{
            background: '#ffffff',
            borderRadius: '16px',
            padding: '24px',
            boxShadow: '0 4px 20px rgba(0, 0, 0, 0.08)',
            border: '1px solid #e5e7eb'
          }}>
            <div className="p-4">
              <div className="text-sm text-gray-500 mb-2">交易总量</div>
              <div className="text-2xl font-bold text-blue-600">{(commissionStats.totalVolume || 0).toFixed(2)} 手</div>
            </div>
          </div>
          <div style={{
            background: '#ffffff',
            borderRadius: '16px',
            padding: '24px',
            boxShadow: '0 4px 20px rgba(0, 0, 0, 0.08)',
            border: '1px solid #e5e7eb'
          }}>
            <div className="p-4">
              <div className="text-sm text-gray-500 mb-2">分佣记录数</div>
              <div className="text-2xl font-bold text-purple-600">{commissionRecords.length || 0}</div>
            </div>
          </div>
          <div style={{
            background: '#ffffff',
            borderRadius: '16px',
            padding: '24px',
            boxShadow: '0 4px 20px rgba(0, 0, 0, 0.08)',
            border: '1px solid #e5e7eb'
          }}>
            <div className="p-4">
              <div className="text-sm text-gray-500 mb-2">活跃代理</div>
              <div className="text-2xl font-bold text-green-600">{commissionStats.agentCount || 0}</div>
            </div>
          </div>
        </div>

        <div
          style={{
            background: '#ffffff',
            borderRadius: '16px',
            padding: '24px',
            boxShadow: '0 4px 20px rgba(0, 0, 0, 0.08)',
            border: '1px solid #e5e7eb'
          }}
        >
          <div className="flex items-center gap-3 mb-5">
            <div style={{
              width: '40px',
              height: '40px',
              borderRadius: '10px',
              background: 'linear-gradient(135deg, #8b5cf6 0%, #7c3aed 100%)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}>
              <WalletIcon size="20px" style={{ color: '#ffffff' }} />
            </div>
            <h3 className="text-lg font-semibold text-gray-900">分佣记录</h3>
          </div>
          <div className="mb-4 flex gap-4">
            <Input placeholder="搜索代理ID/用户ID" style={{ width: 250 }} clearable />
            <Select placeholder="状态" clearable style={{ width: 120 }}>
              <Select.Option value="pending">待结算</Select.Option>
              <Select.Option value="settled">已结算</Select.Option>
            </Select>
            <DatePicker placeholder="开始日期" clearable style={{ width: 150 }} />
            <DatePicker placeholder="结束日期" clearable style={{ width: 150 }} />
            <Button theme="primary" icon={<RefreshIcon size="16px" />} style={{ borderRadius: '10px' }} onClick={loadCommissionData}>
              刷新
            </Button>
            <Button theme="default" icon={<DownloadIcon size="16px" />} style={{ borderRadius: '10px' }}>
              导出
            </Button>
          </div>
          <Table
            columns={[
              { colKey: 'id', title: '记录ID', width: 100 },
              { colKey: 'agentId', title: '代理ID', width: 100 },
              { colKey: 'userId', title: '用户ID', width: 100 },
              {
                colKey: 'commission',
                title: '分佣金额',
                cell: (row: any) => formatCurrency(row.commission || 0),
                width: 120
              },
              {
                colKey: 'volume',
                title: '交易量',
                cell: (row: any) => row.volume?.toFixed(2) || '-',
                width: 100
              },
              {
                colKey: 'rate',
                title: '分佣比例',
                cell: (row: any) => (row.rate * 100).toFixed(2) + '%',
                width: 100
              },
              {
                colKey: 'status',
                title: '状态',
                cell: (row: any) => (
                  row.status === 'settled' ? <Tag theme="success">已结算</Tag> : <Tag theme="warning">待结算</Tag>
                ),
                width: 100
              },
              { colKey: 'createdAt', title: '创建时间', width: 160 },
              {
                colKey: 'action',
                title: '操作',
                width: 120,
                cell: (row: any) => (
                  <div className="space-x-2">
                    <Button size="small" variant="text">详情</Button>
                  </div>
                )
              }
            ]}
            data={commissionRecords}
            stripe
            hover
            size="small"
            loading={loading}
            pagination={{ defaultPageSize: 10 }}
          />
        </div>
      </div>
  );

  // 渲染风控管理
  const renderRisk = () => {
    return (
      <div className="space-y-6">
        <div
          style={{
            background: '#ffffff',
            borderRadius: '16px',
            padding: '24px',
            boxShadow: '0 4px 20px rgba(0, 0, 0, 0.08)',
            border: '1px solid #e5e7eb'
          }}
        >
          <div className="flex items-center gap-3 mb-5">
            <div style={{
              width: '40px',
              height: '40px',
              borderRadius: '10px',
              background: 'linear-gradient(135deg, #ef4444 0%, #dc2626 100%)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}>
              <SettingIcon size="20px" style={{ color: '#ffffff' }} />
            </div>
            <h3 className="text-lg font-semibold text-gray-900">风控概览</h3>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-5">
            <div className="p-4 rounded-xl text-center" style={{ background: 'linear-gradient(135deg, #fecaca 0%, #fca5a5 100%)' }}>
              <div className="text-sm text-gray-700 mb-2 font-medium">高风险用户</div>
              <div className="text-3xl font-bold text-red-600">12</div>
            </div>
            <div className="p-4 rounded-xl text-center" style={{ background: 'linear-gradient(135deg, #fed7aa 0%, #fdba74 100%)' }}>
              <div className="text-sm text-gray-700 mb-2 font-medium">预警用户</div>
              <div className="text-3xl font-bold text-orange-600">45</div>
            </div>
            <div className="p-4 rounded-xl text-center" style={{ background: 'linear-gradient(135deg, #fecaca 0%, #fca5a5 100%)' }}>
              <div className="text-sm text-gray-700 mb-2 font-medium">今日强平</div>
              <div className="text-3xl font-bold text-red-600">3</div>
            </div>
            <div className="p-4 rounded-xl text-center" style={{ background: 'linear-gradient(135deg, #d1fae5 0%, #a7f3d0 100%)' }}>
              <div className="text-sm text-gray-700 mb-2 font-medium">安全用户</div>
              <div className="text-3xl font-bold text-green-600">8,523</div>
            </div>
          </div>
        </div>

        <div
          style={{
            background: '#ffffff',
            borderRadius: '16px',
            padding: '24px',
            boxShadow: '0 4px 20px rgba(0, 0, 0, 0.08)',
            border: '1px solid #e5e7eb'
          }}
        >
          <div className="flex items-center gap-3 mb-5">
            <div style={{
              width: '40px',
              height: '40px',
              borderRadius: '10px',
              background: 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}>
              <ChartIcon size="20px" style={{ color: '#ffffff' }} />
            </div>
            <h3 className="text-lg font-semibold text-gray-900">高风险持仓</h3>
          </div>
          <div className="mb-4 flex gap-4">
            <Select placeholder="风险等级" clearable style={{ width: 150 }}>
              <Select.Option value="danger">高危</Select.Option>
              <Select.Option value="warning">预警</Select.Option>
            </Select>
            <Select placeholder="品种" clearable style={{ width: 150 }}>
              <Select.Option value="XAUUSD">国际黄金</Select.Option>
              <Select.Option value="XAGUSD">国际白银</Select.Option>
            </Select>
            <Button theme="primary" icon={<RefreshIcon size="16px" />} style={{ borderRadius: '10px' }}>
              刷新
            </Button>
            <Button theme="warning" icon={<DownloadIcon size="16px" />} style={{ borderRadius: '10px' }}>
              导出报告
            </Button>
          </div>
          <Table
            columns={[
              { colKey: 'userId', title: '用户ID', width: 100 },
              { colKey: 'positionId', title: '持仓ID', width: 120 },
              { colKey: 'symbol', title: '品种', width: 100 },
              {
                colKey: 'direction',
                title: '方向',
                cell: (row: any) => (
                  <Tag theme={row.direction === 'LONG' ? 'danger' : 'success'}>
                    {row.direction === 'LONG' ? '做多' : '做空'}
                  </Tag>
                ),
                width: 80
              },
              {
                colKey: 'marginRatio',
                title: '保证金使用率',
                cell: (row: any) => (
                  <Tag theme={row.marginRatio > 80 ? 'danger' : row.marginRatio > 50 ? 'warning' : 'success'}>
                    {row.marginRatio?.toFixed(1)}%
                  </Tag>
                ),
                width: 120
              },
              {
                colKey: 'unrealizedPnl',
                title: '浮动盈亏',
                cell: (row: any) => (
                  <span className={row.unrealizedPnl >= 0 ? 'text-green-600' : 'text-red-600'}>
                    {formatCurrency(row.unrealizedPnl || 0)}
                  </span>
                ),
                width: 120
              },
              {
                colKey: 'riskLevel',
                title: '风险等级',
                cell: (row: any) => {
                  const riskMap: any = {
                    danger: { label: '高危', theme: 'danger' },
                    warning: { label: '预警', theme: 'warning' },
                    safe: { label: '安全', theme: 'success' }
                  };
                  const risk = riskMap[row.riskLevel] || { label: row.riskLevel || '未知', theme: 'default' };
                  return <Tag theme={risk.theme}>{risk.label}</Tag>;
                },
                width: 100
              },
              {
                colKey: 'action',
                title: '操作',
                width: 150,
                cell: (row: any) => (
                  <div className="space-x-2">
                    <Button size="small" variant="text">详情</Button>
                    <Button size="small" variant="text" theme="danger">强平</Button>
                  </div>
                )
              }
            ]}
            data={[
              { userId: 'user001', positionId: 'POS001', symbol: 'XAUUSD', direction: 'LONG', marginRatio: 85.5, unrealizedPnl: -15200, riskLevel: 'danger' },
              { userId: 'user002', positionId: 'POS002', symbol: 'XAGUSD', direction: 'SHORT', marginRatio: 78.2, unrealizedPnl: -8900, riskLevel: 'warning' },
              { userId: 'user003', positionId: 'POS003', symbol: 'AU2406', direction: 'LONG', marginRatio: 92.1, unrealizedPnl: -25600, riskLevel: 'danger' }
            ]}
            stripe
            hover
            size="small"
            pagination={{ defaultPageSize: 10 }}
          />
        </div>

        <div
          style={{
            background: '#ffffff',
            borderRadius: '16px',
            padding: '24px',
            boxShadow: '0 4px 20px rgba(0, 0, 0, 0.08)',
            border: '1px solid #e5e7eb'
          }}
        >
          <div className="flex items-center gap-3 mb-5">
            <div style={{
              width: '40px',
              height: '40px',
              borderRadius: '10px',
              background: 'linear-gradient(135deg, #64748b 0%, #475569 100%)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}>
              <SettingIcon size="20px" style={{ color: '#ffffff' }} />
            </div>
            <h3 className="text-lg font-semibold text-gray-900">风控设置</h3>
          </div>
          <div className="space-y-4 max-w-3xl">
            <div className="flex items-center justify-between py-3 border-b">
              <div>
                <div className="text-sm font-medium text-gray-900">自动强平</div>
                <div className="text-xs text-gray-500 mt-1">当保证金使用率超过阈值时自动强平</div>
              </div>
              <Switch defaultValue={true} size="large" />
            </div>
            <div className="flex items-center justify-between py-3 border-b">
              <div>
                <div className="text-sm font-medium text-gray-900">强平阈值</div>
                <div className="text-xs text-gray-500 mt-1">触发自动强平的保证金使用率</div>
              </div>
              <div className="text-lg font-bold text-red-600 font-mono">90%</div>
            </div>
            <div className="flex items-center justify-between py-3 border-b">
              <div>
                <div className="text-sm font-medium text-gray-900">预警阈值</div>
                <div className="text-xs text-gray-500 mt-1">触发系统预警的保证金使用率</div>
              </div>
              <div className="text-lg font-bold text-orange-600 font-mono">70%</div>
            </div>
            <div className="flex items-center justify-between py-3">
              <div>
                <div className="text-sm font-medium text-gray-900">风控检查频率</div>
                <div className="text-xs text-gray-500 mt-1">系统检查用户风险状态的频率</div>
              </div>
              <div className="text-lg font-bold text-blue-600 font-mono">5秒/次</div>
            </div>
          </div>
          <div className="mt-6 flex justify-end">
            <Button theme="primary" size="large" style={{ borderRadius: '10px' }}>
              保存设置
            </Button>
          </div>
        </div>
      </div>
    );
  };

  // 渲染内容
  const renderContent = () => {
    switch (activeMenu) {
      case 'dashboard':
        return renderDashboard();
      case 'users':
        return renderUsers();
      case 'agents':
        return renderAgents();
      case 'products':
        return renderProducts();
      case 'orders':
        return renderOrders();
      case 'positions':
        return renderPositions();
      case 'finance':
        return renderFinance();
      case 'commission':
        return renderCommission();
      case 'risk':
        return renderRisk();
      case 'settings':
        return renderSettings();
      default:
        return renderDashboard();
    }
  };

  return (
    <div className="min-h-screen bg-white flex">
      {/* 左侧菜单栏 */}
      <div className={`${collapsed ? 'w-20' : 'w-64'} bg-white border-r border-gray-200 transition-all duration-300 flex flex-col`}>
        {/* Logo区域 */}
        <div className="h-16 flex items-center justify-center border-b border-gray-200">
          {!collapsed ? (
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 bg-gradient-to-br from-blue-600 to-purple-600 rounded-lg flex items-center justify-center">
                <span className="text-white font-bold text-lg">P</span>
              </div>
              <span className="text-lg font-bold text-gray-900">PreciousMetals</span>
            </div>
          ) : (
            <div className="w-8 h-8 bg-gradient-to-br from-blue-600 to-purple-600 rounded-lg flex items-center justify-center">
              <span className="text-white font-bold text-lg">P</span>
            </div>
          )}
        </div>

        {/* 菜单列表 */}
        <div className="flex-1 overflow-y-auto py-4">
          {menuItems.map((item) => (
            <button
              key={item.key}
              onClick={() => setActiveMenu(item.key)}
              className={`w-full flex items-center gap-3 px-5 py-3 transition-colors ${
                activeMenu === item.key
                  ? 'bg-blue-50 text-blue-600 border-r-4 border-blue-600'
                  : 'text-gray-600 hover:bg-gray-50'
              }`}
            >
              <span className="text-lg">{item.icon}</span>
              {!collapsed && <span className="text-sm font-medium">{item.label}</span>}
            </button>
          ))}
        </div>

        {/* 收缩按钮 */}
        <div className="p-4 border-t border-gray-200">
          <button
            onClick={() => setCollapsed(!collapsed)}
            className="w-full flex items-center justify-center gap-2 py-2 text-gray-500 hover:bg-gray-100 rounded transition-colors"
          >
            {collapsed ? <ChevronRightIcon size="20px" /> : <ChevronLeftIcon size="20px" />}
          </button>
        </div>
      </div>

      {/* 右侧内容区 */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* 顶部导航栏 */}
        <header className="h-16 bg-white border-b border-gray-200 flex items-center justify-between px-6 shadow-sm">
          {/* 面包屑 */}
          <div className="flex items-center gap-2 text-sm text-gray-600">
            <span className="hover:text-blue-600 cursor-pointer">首页</span>
            <span>/</span>
            <span className="font-medium text-gray-900">{menuItems.find(m => m.key === activeMenu)?.label}</span>
          </div>

          {/* 右侧操作区 */}
          <div className="flex items-center gap-4">
            <Tooltip content="刷新">
              <Button variant="text" icon={<RefreshIcon size="20px" />} />
            </Tooltip>
            <Tooltip content="设置">
              <Button variant="text" icon={<SettingIcon size="20px" />} />
            </Tooltip>
            <div className="w-px h-6 bg-gray-200" />
            <div className="flex items-center gap-3">
              <div className="text-right">
                <div className="text-sm font-medium text-gray-900">{userData.name}</div>
                <div className="text-xs text-gray-500">{userData.role}</div>
              </div>
              <div className="w-10 h-10 bg-gradient-to-br from-blue-600 to-purple-600 rounded-full flex items-center justify-center text-white font-medium">
                {userData.name.charAt(0)}
              </div>
              <Tooltip content="退出登录">
                <Button variant="text" icon={<LogoutIcon size="20px" />} onClick={handleLogout} />
              </Tooltip>
            </div>
          </div>
        </header>

        {/* 主内容区 */}
        <main className="flex-1 p-6 overflow-y-auto">
          {renderContent()}
        </main>
      </div>
    </div>
  );
}


