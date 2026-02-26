import { useState } from 'react';
import { ConfigProvider } from 'tdesign-react';
import { Input, Button, MessagePlugin } from 'tdesign-react';
import { UserIcon, LockOnIcon, DesktopIcon } from 'tdesign-icons-react';

export default function AppSimpleAdmin() {
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    username: '',
    password: ''
  });

  const handleLogin = async () => {
    if (!formData.username.trim()) {
      MessagePlugin.warning('请输入管理员用户名');
      return;
    }

    if (!formData.password) {
      MessagePlugin.warning('请输入密码');
      return;
    }

    setLoading(true);

    try {
      const mockAdminUsers = [
        { username: 'admin', password: 'admin123', role: 'ADMIN', name: '超级管理员' }
      ];

      const adminUser = mockAdminUsers.find(
        u => u.username === formData.username.trim() && u.password === formData.password
      );

      if (!adminUser) {
        MessagePlugin.error('用户名或密码错误');
        setLoading(false);
        return;
      }

      const adminToken = 'admin_token_' + Date.now();
      localStorage.setItem('adminToken', adminToken);
      localStorage.setItem('adminUser', JSON.stringify({
        username: adminUser.username,
        name: adminUser.name,
        role: adminUser.role
      }));

      MessagePlugin.success('登录成功！');
      setTimeout(() => {
        alert('登录成功！adminToken: ' + adminToken);
      }, 500);
    } catch (error: any) {
      MessagePlugin.error(error.message || '登录失败');
    } finally {
      setLoading(false);
    }
  };

  return (
    <ConfigProvider>
      <div style={{
        minHeight: '100vh',
        background: 'linear-gradient(135deg, #1e293b 0%, #0f172a 100%)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '16px'
      }}>
        <div style={{
          background: 'white',
          borderRadius: '16px',
          padding: '32px',
          width: '100%',
          maxWidth: '400px',
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)'
        }}>
          <div style={{ textAlign: 'center', marginBottom: '24px' }}>
            <div style={{
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: '64px',
              height: '64px',
              background: 'linear-gradient(135deg, #2563eb 0%, #7c3aed 100%)',
              borderRadius: '16px',
              marginBottom: '16px'
            }}>
              <DesktopIcon size="32px" style={{ color: 'white' }} />
            </div>
            <h1 style={{ fontSize: '24px', fontWeight: 'bold', margin: 0, marginBottom: '8px' }}>
              后台管理系统
            </h1>
            <p style={{ fontSize: '14px', color: '#6b7280', margin: 0 }}>
              简化版本 - 测试用
            </p>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div>
              <label style={{ display: 'block', fontSize: '14px', fontWeight: '500', marginBottom: '8px' }}>
                管理员用户名
              </label>
              <Input
                size="large"
                placeholder="请输入管理员用户名"
                value={formData.username}
                onChange={(val) => setFormData({ ...formData, username: val as string })}
                prefixIcon={<UserIcon size="20px" />}
                disabled={loading}
                clearable
              />
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '14px', fontWeight: '500', marginBottom: '8px' }}>
                登录密码
              </label>
              <Input
                size="large"
                type="password"
                placeholder="请输入密码"
                value={formData.password}
                onChange={(val) => setFormData({ ...formData, password: val as string })}
                prefixIcon={<LockOnIcon size="20px" />}
                disabled={loading}
                clearable
              />
            </div>

            <Button
              size="large"
              theme="primary"
              block
              loading={loading}
              onClick={handleLogin}
            >
              {loading ? '登录中...' : '登录后台管理'}
            </Button>
          </div>

          <div style={{ marginTop: '16px', textAlign: 'center' }}>
            <p style={{ fontSize: '12px', color: '#9ca3af', margin: 0 }}>
              测试账号: admin / admin123
            </p>
          </div>
        </div>
      </div>
    </ConfigProvider>
  );
}
