import { useState, useEffect } from 'react';
import {
  Layout,
  Menu,
  Card,
  Row,
  Col,
  Table,
  Button,
  Space,
  Tag,
  Avatar,
  Dropdown,
  Dialog,
  Form,
  Input,
  InputNumber,
  Message
} from 'tdesign-react';
import {
  UserIcon,
  HomeIcon,
  ChartIcon,
  ShopIcon,
  LogoutIcon,
  SettingIcon,
  UsergroupIcon
} from 'tdesign-icons-react';
import axios from 'axios';
import { useNavigate, Outlet, useLocation, Routes, Route, Navigate } from 'react-router-dom';

const { Header, Content, Aside, Footer } = Layout;

interface AgentInfo {
  agentId: number;
  agentCode: string;
  agentType: number;
  username: string;
  realName: string;
  phone: string;
  totalBalance: number;
  availableBalance: number;
}

interface Statistics {
  totalUsers: number;
  totalSubAgents: number;
  totalCommission: number;
  totalTradingVolume: number;
  todayCommission: number;
  monthCommission: number;
}

export default function AgentDashboard() {
  const navigate = useNavigate();
  const location = useLocation();
  const [collapsed, setCollapsed] = useState(false);
  const [activeMenu, setActiveMenu] = useState(['dashboard']);

  const [agentInfo, setAgentInfo] = useState<AgentInfo | null>(null);
  const [statistics, setStatistics] = useState<Statistics | null>(null);
  const [loading, setLoading] = useState(false);

  // 加载代理信息和统计数据
  useEffect(() => {
    loadAgentInfo();
    loadStatistics();
  }, []);

  // 根据路由设置当前菜单
  useEffect(() => {
    const path = location.pathname;
    if (path.includes('customers')) {
      setActiveMenu(['customers']);
    } else if (path.includes('commission')) {
      setActiveMenu(['commission']);
    } else if (path.includes('trading')) {
      setActiveMenu(['trading']);
    } else if (path.includes('withdraw')) {
      setActiveMenu(['withdraw']);
    } else {
      setActiveMenu(['dashboard']);
    }
  }, [location.pathname]);

  // 加载代理信息
  const loadAgentInfo = async () => {
    try {
      const savedInfo = localStorage.getItem('agentInfo');
      if (savedInfo) {
        setAgentInfo(JSON.parse(savedInfo));
      }

      const response = await axios.get('/api/agent/info');
      if (response.data.code === 0) {
        setAgentInfo(response.data.data);
        localStorage.setItem('agentInfo', JSON.stringify(response.data.data));
      }
    } catch (error) {
      console.error('加载代理信息失败:', error);
    }
  };

  // 加载统计数据
  const loadStatistics = async () => {
    setLoading(true);
    try {
      const response = await axios.get('/api/agent/statistics');
      if (response.data.code === 0) {
        setStatistics(response.data.data);
      }
    } catch (error) {
      console.error('加载统计数据失败:', error);
    } finally {
      setLoading(false);
    }
  };

  // 登出
  const handleLogout = () => {
    Dialog.confirm({
      header: '确认退出',
      body: '确定要退出代理管理系统吗？',
      onConfirm: () => {
        localStorage.removeItem('agentInfo');
        localStorage.removeItem('agentToken');
        Message.success('已退出登录');
        navigate('/agent-login');
      }
    });
  };

  // 菜单点击处理
  const handleMenuChange = (value: any) => {
    const menuPathMap: Record<string, string> = {
      'dashboard': '/agent/dashboard',
      'customers': '/agent/customers',
      'commission': '/agent/commission',
      'trading': '/agent/trading',
      'withdraw': '/agent/withdraw',
      'profile': '/agent/profile'
    };

    const path = menuPathMap[value as string];
    if (path) {
      navigate(path);
    }
  };

  return (
    <Layout style={{ minHeight: '100vh' }}>
      {/* 侧边栏 */}
      <Aside
        collapseArrow
        collapsed={collapsed}
        onCollapse={setCollapsed}
        style={{
          background: '#1f2937',
          color: '#fff',
          position: 'fixed',
          left: 0,
          top: 0,
          bottom: 0,
          zIndex: 100
        }}
      >
        <div style={{
          height: '64px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          borderBottom: '1px solid #374151'
        }}>
          {!collapsed ? (
            <div style={{ fontWeight: 'bold', fontSize: '18px', color: '#fbbf24' }}>
              代理管理
            </div>
          ) : (
            <div style={{ fontWeight: 'bold', fontSize: '18px', color: '#fbbf24' }}>
              代理
            </div>
          )}
        </div>

        <Menu
          value={activeMenu}
          onChange={handleMenuChange}
          style={{ background: 'transparent', color: '#fff' }}
          theme="dark"
        >
          <Menu.MenuItem value="dashboard" icon={<HomeIcon />}>
            数据概览
          </Menu.MenuItem>
          <Menu.MenuItem value="customers" icon={<UsergroupIcon />}>
            客户管理
          </Menu.MenuItem>
          <Menu.MenuItem value="commission" icon={<ShopIcon />}>
            佣金管理
          </Menu.MenuItem>
          <Menu.MenuItem value="trading" icon={<ChartIcon />}>
            交易记录
          </Menu.MenuItem>
          <Menu.MenuItem value="withdraw" icon={<ShopIcon />}>
            提现申请
          </Menu.MenuItem>
          <Menu.MenuItem value="profile" icon={<SettingIcon />}>
            个人设置
          </Menu.MenuItem>
        </Menu>
      </Aside>

      {/* 主体内容 */}
      <Layout style={{ marginLeft: collapsed ? 64 : 200 }}>
        {/* 顶部导航 */}
        <Header style={{
          background: '#fff',
          padding: '0 24px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          boxShadow: '0 1px 4px rgba(0,0,0,0.08)'
        }}>
          <div>
            <Button
              variant="text"
              onClick={() => setCollapsed(!collapsed)}
            >
              {collapsed ? '展开' : '收起'}
            </Button>
          </div>

          <Space>
            {agentInfo && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <Avatar size="32px">
                  {agentInfo.realName?.charAt(0) || 'A'}
                </Avatar>
                <div>
                  <div style={{ fontWeight: 500 }}>{agentInfo.realName}</div>
                  <div style={{ fontSize: '12px', color: '#999' }}>
                    {agentInfo.agentCode}
                    {' '}
                    <Tag
                      size="small"
                      theme={agentInfo.agentType === 1 ? 'warning' : 'success'}
                    >
                      {agentInfo.agentType === 1 ? '总代理' : '分代理'}
                    </Tag>
                  </div>
                </div>
              </div>
            )}

            <Dropdown
              options={[
                { content: '退出登录', value: 'logout', onClick: handleLogout }
              ]}
            >
              <Button variant="text" icon={<LogoutIcon />} />
            </Dropdown>
          </Space>
        </Header>

          {/* 内容区域 */}
          <Content style={{ padding: '24px', background: '#f3f4f6' }}>
            {/* 首页统计 */}
            {activeMenu[0] === 'dashboard' && (
              <div>
                <Card title="数据概览" bordered={false} style={{ marginBottom: '24px' }}>
                  <Row gutter={[16, 16]}>
                    <Col span={6}>
                      <div style={{ padding: '16px', background: '#f0f9ff', borderRadius: '8px', border: '1px solid #e0f2fe' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                          <UserIcon size="20px" style={{ color: '#0284c7' }} />
                          <span style={{ color: '#64748b', fontSize: '14px' }}>总客户数</span>
                        </div>
                        <div style={{ fontSize: '28px', fontWeight: 'bold', color: '#0284c7' }}>
                          {loading ? '-' : (statistics?.totalUsers || 0)}
                        </div>
                      </div>
                    </Col>
                    <Col span={6}>
                      <div style={{ padding: '16px', background: '#f0fdf4', borderRadius: '8px', border: '1px solid #dcfce7' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                          <UsergroupIcon size="20px" style={{ color: '#16a34a' }} />
                          <span style={{ color: '#64748b', fontSize: '14px' }}>总代理数</span>
                        </div>
                        <div style={{ fontSize: '28px', fontWeight: 'bold', color: '#16a34a' }}>
                          {loading ? '-' : (statistics?.totalSubAgents || 0)}
                        </div>
                      </div>
                    </Col>
                    <Col span={6}>
                      <div style={{ padding: '16px', background: '#fffbeb', borderRadius: '8px', border: '1px solid #fef3c7' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                          <span style={{ color: '#d97706', fontSize: '16px' }}>¥</span>
                          <span style={{ color: '#64748b', fontSize: '14px' }}>总佣金</span>
                        </div>
                        <div style={{ fontSize: '28px', fontWeight: 'bold', color: '#d97706' }}>
                          {loading ? '-' : (statistics?.totalCommission || 0).toLocaleString()}
                        </div>
                      </div>
                    </Col>
                    <Col span={6}>
                      <div style={{ padding: '16px', background: '#f8fafc', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                          <span style={{ color: '#475569', fontSize: '16px' }}>¥</span>
                          <span style={{ color: '#64748b', fontSize: '14px' }}>本月佣金</span>
                        </div>
                        <div style={{ fontSize: '28px', fontWeight: 'bold', color: '#475569' }}>
                          {loading ? '-' : (statistics?.monthCommission || 0).toLocaleString()}
                        </div>
                      </div>
                    </Col>
                  </Row>
                </Card>

                <Row gutter={[16, 16]}>
                  <Col span={12}>
                    <Card title="佣金账户" bordered={false}>
                      {agentInfo && (
                        <div>
                          <div style={{ fontSize: '24px', fontWeight: 'bold', marginBottom: '8px' }}>
                            ¥{agentInfo.availableBalance?.toFixed(2) || '0.00'}
                          </div>
                          <div style={{ color: '#666', fontSize: '14px' }}>
                            可提现佣金
                          </div>
                          <div style={{ marginTop: '16px', padding: '12px', background: '#f3f4f6', borderRadius: '8px' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                              <span style={{ color: '#666' }}>累计佣金：</span>
                              <span>¥{(agentInfo.totalBalance || 0).toFixed(2)}</span>
                            </div>
                          </div>
                        </div>
                      )}
                    </Card>
                  </Col>
                  <Col span={12}>
                    <Card title="交易统计" bordered={false}>
                      {statistics && (
                        <div>
                          <div style={{ fontSize: '20px', fontWeight: 'bold', marginBottom: '8px' }}>
                            ¥{(statistics.totalTradingVolume || 0).toLocaleString()}
                          </div>
                          <div style={{ color: '#666', fontSize: '14px' }}>
                            总交易量
                          </div>
                          <div style={{ marginTop: '16px', display: 'flex', gap: '16px' }}>
                            <div>
                              <div style={{ fontSize: '16px', fontWeight: 'bold', color: '#fbbf24' }}>
                                ¥{(statistics.todayCommission || 0).toFixed(2)}
                              </div>
                              <div style={{ fontSize: '12px', color: '#666' }}>今日佣金</div>
                            </div>
                            <div>
                              <div style={{ fontSize: '16px', fontWeight: 'bold', color: '#22c55e' }}>
                                ¥{(statistics.monthCommission || 0).toFixed(2)}
                              </div>
                              <div style={{ fontSize: '12px', color: '#666' }}>本月佣金</div>
                            </div>
                          </div>
                        </div>
                      )}
                    </Card>
                  </Col>
                </Row>
              </div>
            )}

            {/* 路由内容（其他页面） */}
            <Outlet />
          </Content>

        {/* 页脚 */}
        <Footer style={{ textAlign: 'center', color: '#999', fontSize: '12px' }}>
          贵金属交易系统 © 2024
        </Footer>
      </Layout>
    </Layout>
  );
}
