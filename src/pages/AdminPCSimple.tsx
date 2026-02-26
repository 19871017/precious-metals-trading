import { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';

interface AdminPCSimpleProps {
  onLogout?: () => void;
}

// 模拟数据
const mockDashboardData = {
  stats: [
    { title: '总用户数', value: '12,568', change: '+12.5%', color: '#667eea' },
    { title: '活跃用户', value: '8,902', change: '+8.3%', color: '#764ba2' },
    { title: '今日订单', value: '3,428', change: '+15.7%', color: '#f093fb' },
    { title: '持仓订单', value: '1,256', change: '-3.2%', color: '#f5576c' },
    { title: '总交易量', value: '¥5,680万', change: '+22.1%', color: '#4facfe' },
    { title: '平台资金', value: '¥1.58亿', change: '+18.9%', color: '#00f2fe' }
  ]
};

const menuItems = [
  { key: 'dashboard', label: '仪表盘' },
  { key: 'users', label: '用户管理' },
  { key: 'agents', label: '代理管理' },
  { key: 'products', label: '产品管理' },
  { key: 'orders', label: '订单管理' },
  { key: 'positions', label: '持仓管理' },
  { key: 'finance', label: '财务管理' },
  { key: 'commission', label: '分佣管理' },
  { key: 'risk', label: '风控管理' },
  { key: 'settings', label: '系统设置' }
];

export default function AdminPCSimple({ onLogout }: AdminPCSimpleProps) {
  const navigate = useNavigate();
  const location = useLocation();
  const [collapsed, setCollapsed] = useState(false);
  const [activeMenu, setActiveMenu] = useState('dashboard');
  const [userData] = useState(() => {
    try {
      const adminUser = localStorage.getItem('adminUser');
      if (adminUser) {
        const user = JSON.parse(adminUser);
        return {
          name: user.name || '管理员',
          role: '超级管理员'
        };
      }
    } catch (error) {
      console.error('解析管理员信息失败:', error);
    }
    return {
      name: '管理员',
      role: '超级管理员'
    };
  });

  useEffect(() => {
    const path = location.pathname.replace('/admin', '').slice(1);
    if (path) {
      setActiveMenu(path);
    }
  }, [location]);

  const handleLogout = () => {
    if (confirm('您确定要退出后台管理系统吗?')) {
      if (onLogout) {
        onLogout();
      } else {
        localStorage.removeItem('adminToken');
        localStorage.removeItem('adminUser');
      }
      navigate('/');
    }
  };

  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: '#f5f5f5' }}>
      {/* 左侧菜单栏 */}
      <div style={{
        width: collapsed ? '80px' : '256px',
        background: '#ffffff',
        borderRight: '1px solid #e5e7eb',
        display: 'flex',
        flexDirection: 'column',
        transition: 'width 0.3s',
        position: 'fixed',
        height: '100vh',
        zIndex: 100
      }}>
        {/* Logo区域 */}
        <div style={{ height: '64px', display: 'flex', alignItems: 'center', justifyContent: 'center', borderBottom: '1px solid #e5e7eb' }}>
          {!collapsed ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <div style={{
                width: '32px',
                height: '32px',
                background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                borderRadius: '8px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}>
                <span style={{ color: 'white', fontWeight: 'bold', fontSize: '16px' }}>P</span>
              </div>
              <span style={{ fontSize: '16px', fontWeight: 'bold', color: '#1a1a2e' }}>PreciousMetals</span>
            </div>
          ) : (
            <div style={{
              width: '32px',
              height: '32px',
              background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
              borderRadius: '8px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}>
              <span style={{ color: 'white', fontWeight: 'bold', fontSize: '16px' }}>P</span>
            </div>
          )}
        </div>

        {/* 菜单列表 */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '16px 0' }}>
          {menuItems.map((item) => (
            <button
              key={item.key}
              onClick={() => setActiveMenu(item.key)}
              style={{
                width: '100%',
                padding: collapsed ? '12px 0' : '12px 24px',
                display: 'flex',
                alignItems: 'center',
                gap: collapsed ? '0' : '12px',
                justifyContent: collapsed ? 'center' : 'flex-start',
                border: 'none',
                background: activeMenu === item.key ? '#667eea' : 'transparent',
                color: activeMenu === item.key ? '#ffffff' : '#6b7280',
                cursor: 'pointer',
                transition: 'all 0.2s',
                fontSize: '14px',
                fontWeight: activeMenu === item.key ? '600' : '400'
              }}
            >
              <span style={{ fontSize: collapsed ? '18px' : '16px' }}>{item.label.charAt(0)}</span>
              {!collapsed && <span>{item.label}</span>}
            </button>
          ))}
        </div>

        {/* 收缩按钮 */}
        <div style={{ padding: '16px', borderTop: '1px solid #e5e7eb' }}>
          <button
            onClick={() => setCollapsed(!collapsed)}
            style={{
              width: '100%',
              padding: '8px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '8px',
              border: 'none',
              background: '#f5f5f5',
              color: '#6b7280',
              borderRadius: '8px',
              cursor: 'pointer',
              fontSize: '14px'
            }}
          >
            {collapsed ? '→' : '←'}
          </button>
        </div>
      </div>

      {/* 右侧内容区 */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', marginLeft: collapsed ? '80px' : '256px', transition: 'margin-left 0.3s' }}>
        {/* 顶部导航栏 */}
        <header style={{
          height: '64px',
          background: '#ffffff',
          borderBottom: '1px solid #e5e7eb',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '0 24px'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '14px', color: '#6b7280' }}>
            <span style={{ cursor: 'pointer' }}>首页</span>
            <span>/</span>
            <span style={{ fontWeight: '600', color: '#1a1a2e' }}>
              {menuItems.find(m => m.key === activeMenu)?.label}
            </span>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontSize: '14px', fontWeight: '600', color: '#1a1a2e' }}>{userData.name}</div>
                <div style={{ fontSize: '12px', color: '#6b7280' }}>{userData.role}</div>
              </div>
              <div style={{
                width: '40px',
                height: '40px',
                background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                borderRadius: '50%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: 'white',
                fontWeight: '600',
                fontSize: '16px'
              }}>
                {userData.name.charAt(0)}
              </div>
              <button
                onClick={handleLogout}
                style={{
                  padding: '8px 16px',
                  background: '#f5f5f5',
                  color: '#6b7280',
                  border: 'none',
                  borderRadius: '6px',
                  cursor: 'pointer',
                  fontSize: '14px',
                  fontWeight: '500',
                  transition: 'all 0.2s'
                }}
              >
                退出
              </button>
            </div>
          </div>
        </header>

        {/* 主内容区 */}
        <main style={{ flex: 1, padding: '24px', overflowY: 'auto' }}>
          {activeMenu === 'dashboard' && (
            <>
              <div style={{ marginBottom: '24px' }}>
                <h1 style={{ fontSize: '24px', fontWeight: 'bold', color: '#1a1a2e', margin: 0 }}>
                  仪表盘
                </h1>
                <p style={{ fontSize: '14px', color: '#6b7280', marginTop: '4px' }}>欢迎使用后台管理系统</p>
              </div>

              {/* 统计卡片 */}
              <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
                gap: '20px',
                marginBottom: '32px'
              }}>
                {mockDashboardData.stats.map((stat, index) => (
                  <div
                    key={index}
                    style={{
                      background: '#ffffff',
                      borderRadius: '16px',
                      padding: '24px',
                      boxShadow: '0 4px 20px rgba(0, 0, 0, 0.08)',
                      border: '1px solid #e5e7eb',
                      transition: 'all 0.3s',
                      cursor: 'pointer'
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
                      <div style={{
                        width: '56px',
                        height: '56px',
                        borderRadius: '14px',
                        background: 'linear-gradient(135deg, #f3f4f6 0%, #e5e7eb 100%)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: '24px'
                      }}>
                        📊
                      </div>
                      <span style={{
                        padding: '4px 12px',
                        borderRadius: '20px',
                        fontSize: '12px',
                        fontWeight: '600',
                        background: stat.change.includes('+') ? '#d1fae5' : '#fee2e2',
                        color: stat.change.includes('+') ? '#059669' : '#dc2626'
                      }}>
                        {stat.change}
                      </span>
                    </div>
                    <div style={{ fontSize: '28px', fontWeight: 'bold', color: '#1a1a2e', marginBottom: '8px' }}>
                      {stat.value}
                    </div>
                    <div style={{ fontSize: '14px', color: '#6b7280', fontWeight: '500' }}>{stat.title}</div>
                  </div>
                ))}
              </div>
            </>
          )}

          {activeMenu !== 'dashboard' && (
            <div style={{ marginBottom: '24px' }}>
              <h1 style={{ fontSize: '24px', fontWeight: 'bold', color: '#1a1a2e', margin: 0 }}>
                {menuItems.find(m => m.key === activeMenu)?.label}
              </h1>
              <p style={{ fontSize: '14px', color: '#6b7280', marginTop: '4px' }}>欢迎使用后台管理系统</p>
            </div>
          )}

          {/* 其他页面的占位内容 */}
          {activeMenu !== 'dashboard' && (
            <div style={{
              background: '#ffffff',
              borderRadius: '16px',
              padding: '24px',
              boxShadow: '0 4px 20px rgba(0, 0, 0, 0.08)',
              border: '1px solid #e5e7eb',
              textAlign: 'center',
              paddingTop: '80px',
              paddingBottom: '80px'
            }}>
              <div style={{ fontSize: '64px', marginBottom: '24px' }}>🚧</div>
              <h2 style={{ fontSize: '20px', fontWeight: '600', color: '#1a1a2e', margin: '0 0 12px 0' }}>
                {menuItems.find(m => m.key === activeMenu)?.label}
              </h2>
              <p style={{ fontSize: '14px', color: '#6b7280', margin: 0 }}>
                此功能正在开发中,敬请期待...
              </p>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
