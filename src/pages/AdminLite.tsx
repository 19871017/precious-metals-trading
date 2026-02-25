import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Card,
  Tabs,
  Table,
  Input,
  Button,
  Select,
  Modal,
  Message,
  Space,
  Tag
} from 'tdesign-react';
import {
  UserIcon,
  ShopIcon,
  ChartIcon,
  WalletIcon
} from 'tdesign-icons-react';

export default function AdminLite() {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('dashboard');

  const mockUsers = [
    {
      id: 1,
      username: 'user001',
      realName: '张三',
      phone: '138****1234',
      balance: 125000.00,
      profit: 15000.00,
      agentLevel: 0,
      status: 'active',
      registerTime: '2024-01-15 10:30:00'
    },
    {
      id: 2,
      username: 'user002',
      realName: '李四',
      phone: '139****5678',
      balance: 88000.00,
      profit: -5200.00,
      agentLevel: 1,
      status: 'active',
      registerTime: '2024-01-18 14:20:00'
    }
  ];

  const mockOrders = [
    {
      id: 'ORD202402230001',
      username: 'user001',
      symbolName: '国际黄金',
      type: 'buy',
      volume: 0.5,
      price: 2035.50,
      leverage: 10,
      margin: 10177.50,
      profit: 1250.00,
      status: 'open',
      createTime: '2024-02-23 10:15:30'
    }
  ];

  const dashboardStats = [
    { title: '总用户数', value: '1,256', icon: UserIcon, color: '#fbbf24' },
    { title: '今日订单', value: '342', icon: ShopIcon, color: '#3b82f6' },
    { title: '持仓数', value: '156', icon: ChartIcon, color: '#a855f7' },
    { title: '平台资金', value: '¥1.58亿', icon: WalletIcon, color: '#06b6d4' }
  ];

  const userColumns = [
    { colKey: 'id', title: 'ID', width: 80 },
    { colKey: 'username', title: '用户名', width: 120 },
    { colKey: 'realName', title: '姓名', width: 100 },
    { colKey: 'phone', title: '手机号', width: 120 },
    {
      colKey: 'balance',
      title: '余额',
      cell: (row: any) => `¥${row.balance.toLocaleString()}`,
      width: 120
    },
    { colKey: 'registerTime', title: '注册时间', width: 160 }
  ];

  const orderColumns = [
    { colKey: 'id', title: '订单号', width: 150 },
    { colKey: 'username', title: '用户', width: 100 },
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
    {
      colKey: 'volume',
      title: '手数',
      cell: (row: any) => row.volume,
      width: 80
    },
    {
      colKey: 'status',
      title: '状态',
      cell: (row: any) => (
        row.status === 'open' ? <Tag theme="primary">持仓中</Tag> : <Tag>已平仓</Tag>
      ),
      width: 100
    }
  ];

  return (
    <div className="min-h-screen bg-gradient-to-b from-black to-neutral-950 pb-20 pt-4">
      <div className="max-w-7xl mx-auto px-3">
        <header className="flex justify-between items-center mb-6 py-2">
          <div className="flex items-center gap-3">
            <h1 className="text-xl font-bold text-white">后台管理系统</h1>
            <Tag theme="warning" shape="round">管理员</Tag>
          </div>
          <Button variant="outline" size="small" onClick={() => navigate('/home')}>
            返回首页
          </Button>
        </header>

        <Tabs value={activeTab} onChange={setActiveTab} theme="card">
          <Tabs.TabPanel value="dashboard" label="仪表盘">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
              {dashboardStats.map((stat, index) => (
                <Card key={index} className="!bg-neutral-900 !border-neutral-800">
                  <div className="p-4">
                    <div className="flex items-center gap-3 mb-3">
                      <stat.icon size="32px" style={{ color: stat.color }} />
                    </div>
                    <div className="text-2xl font-bold text-white mb-1">{stat.value}</div>
                    <div className="text-xs text-neutral-500">{stat.title}</div>
                  </div>
                </Card>
              ))}
            </div>
            <Card className="!bg-neutral-900 !border-neutral-800">
              <h3 className="text-base font-semibold text-white mb-4">系统状态</h3>
              <div className="grid grid-cols-3 gap-4">
                <div className="bg-neutral-950 rounded-lg p-4 text-center">
                  <div className="text-sm text-neutral-500 mb-1">服务器状态</div>
                  <div className="text-lg font-bold text-green-500">运行中</div>
                </div>
                <div className="bg-neutral-950 rounded-lg p-4 text-center">
                  <div className="text-sm text-neutral-500 mb-1">数据库连接</div>
                  <div className="text-lg font-bold text-green-500">正常</div>
                </div>
                <div className="bg-neutral-950 rounded-lg p-4 text-center">
                  <div className="text-sm text-neutral-500 mb-1">API响应</div>
                  <div className="text-lg font-bold text-green-500">正常</div>
                </div>
              </div>
            </Card>
          </Tabs.TabPanel>

          <Tabs.TabPanel value="users" label="用户管理">
            <Card className="!bg-neutral-900 !border-neutral-800">
              <h3 className="text-base font-semibold text-white mb-4">用户列表</h3>
              <Table columns={userColumns} data={mockUsers} stripe hover size="small" />
            </Card>
          </Tabs.TabPanel>

          <Tabs.TabPanel value="orders" label="订单管理">
            <Card className="!bg-neutral-900 !border-neutral-800">
              <h3 className="text-base font-semibold text-white mb-4">订单列表</h3>
              <Table columns={orderColumns} data={mockOrders} stripe hover size="small" />
            </Card>
          </Tabs.TabPanel>

          <Tabs.TabPanel value="settings" label="系统设置">
            <Card className="!bg-neutral-900 !border-neutral-800">
              <h3 className="text-base font-semibold text-white mb-4">基本设置</h3>
              <div className="space-y-4">
                <div className="bg-neutral-950 rounded-lg p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="text-sm text-white mb-1">维护模式</div>
                      <div className="text-xs text-neutral-500">开启后普通用户无法访问系统</div>
                    </div>
                    <div className="text-sm font-medium text-amber-500">已关闭</div>
                  </div>
                </div>
                <div className="bg-neutral-950 rounded-lg p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="text-sm text-white mb-1">允许注册</div>
                      <div className="text-xs text-neutral-500">是否开放用户注册功能</div>
                    </div>
                    <div className="text-sm font-medium text-green-500">已开启</div>
                  </div>
                </div>
              </div>
            </Card>
          </Tabs.TabPanel>
        </Tabs>
      </div>
    </div>
  );
}
