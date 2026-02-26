import { useState } from 'react';
import { useNavigate } from 'react-router-dom';

interface AdminLoginSimpleProps {
  onLoginSuccess?: () => void;
}

export default function AdminLoginSimple({ onLoginSuccess }: AdminLoginSimpleProps) {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    username: '',
    password: ''
  });

  const handleLogin = async () => {
    if (!formData.username.trim()) {
      alert('请输入管理员用户名');
      return;
    }

    if (!formData.password) {
      alert('请输入密码');
      return;
    }

    setLoading(true);

    try {
      const mockAdminUsers = [
        { username: 'admin', password: 'admin123', role: 'ADMIN', name: '超级管理员' },
        { username: 'superadmin', password: 'super123', role: 'ADMIN', name: '超级管理员' }
      ];

      const adminUser = mockAdminUsers.find(
        u => u.username === formData.username.trim() && u.password === formData.password
      );

      if (!adminUser) {
        alert('用户名或密码错误');
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

      alert('登录成功，欢迎回来');

      // 调用登录成功回调并跳转
      if (onLoginSuccess) {
        onLoginSuccess();
      }
      navigate('/dashboard');
    } catch (error: any) {
      alert(error.message || '登录失败');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{
      minHeight: '100vh',
      background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '16px',
      position: 'relative',
      overflow: 'hidden'
    }}>
      {/* 背景装饰 */}
      <div style={{
        position: 'absolute',
        width: '400px',
        height: '400px',
        background: 'rgba(255, 255, 255, 0.1)',
        borderRadius: '50%',
        top: '-100px',
        right: '-100px'
      }}></div>
      <div style={{
        position: 'absolute',
        width: '300px',
        height: '300px',
        background: 'rgba(255, 255, 255, 0.08)',
        borderRadius: '50%',
        bottom: '-80px',
        left: '-80px'
      }}></div>

      <div style={{
        background: 'white',
        borderRadius: '20px',
        padding: '40px',
        width: '100%',
        maxWidth: '420px',
        boxShadow: '0 20px 60px rgba(0, 0, 0, 0.3)',
        position: 'relative',
        zIndex: 1
      }}>
        <div style={{ textAlign: 'center', marginBottom: '32px' }}>
          <div style={{
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: '72px',
            height: '72px',
            background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
            borderRadius: '20px',
            marginBottom: '20px',
            boxShadow: '0 8px 24px rgba(102, 126, 234, 0.4)'
          }}>
            <span style={{ fontSize: '36px' }}>🖥️</span>
          </div>
          <h1 style={{ fontSize: '28px', fontWeight: 'bold', margin: 0, marginBottom: '8px', color: '#1a1a2e' }}>
            后台管理系统
          </h1>
          <p style={{ fontSize: '15px', color: '#6b7280', margin: 0 }}>
            管理员登录 · 请使用管理员账号
          </p>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          <div>
            <label style={{ display: 'block', fontSize: '14px', fontWeight: '600', marginBottom: '8px', color: '#1a1a2e' }}>
              管理员用户名
            </label>
            <input
              type="text"
              placeholder="请输入管理员用户名"
              value={formData.username}
              onChange={(e) => setFormData({ ...formData, username: e.target.value })}
              disabled={loading}
              style={{
                width: '100%',
                padding: '14px 16px',
                border: '2px solid #e5e7eb',
                borderRadius: '10px',
                fontSize: '15px',
                boxSizing: 'border-box',
                background: '#fafafa',
                transition: 'all 0.3s',
                outline: 'none'
              }}
              onFocus={(e) => {
                e.target.style.borderColor = '#667eea';
                e.target.style.background = '#ffffff';
              }}
              onBlur={(e) => {
                e.target.style.borderColor = '#e5e7eb';
                e.target.style.background = '#fafafa';
              }}
            />
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '14px', fontWeight: '600', marginBottom: '8px', color: '#1a1a2e' }}>
              登录密码
            </label>
            <input
              type="password"
              placeholder="请输入密码"
              value={formData.password}
              onChange={(e) => setFormData({ ...formData, password: e.target.value })}
              disabled={loading}
              style={{
                width: '100%',
                padding: '14px 16px',
                border: '2px solid #e5e7eb',
                borderRadius: '10px',
                fontSize: '15px',
                boxSizing: 'border-box',
                background: '#fafafa',
                transition: 'all 0.3s',
                outline: 'none'
              }}
              onFocus={(e) => {
                e.target.style.borderColor = '#667eea';
                e.target.style.background = '#ffffff';
              }}
              onBlur={(e) => {
                e.target.style.borderColor = '#e5e7eb';
                e.target.style.background = '#fafafa';
              }}
            />
          </div>

          <button
            onClick={handleLogin}
            disabled={loading}
            style={{
              padding: '14px',
              background: loading ? '#9ca3af' : 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
              color: 'white',
              border: 'none',
              borderRadius: '10px',
              fontSize: '16px',
              fontWeight: '600',
              cursor: loading ? 'not-allowed' : 'pointer',
              transition: 'all 0.3s',
              boxShadow: loading ? 'none' : '0 4px 15px rgba(102, 126, 234, 0.4)',
              marginTop: '8px'
            }}
          >
            {loading ? '登录中...' : '登录后台管理'}
          </button>
        </div>

        <div style={{ marginTop: '24px', textAlign: 'center', paddingTop: '20px', borderTop: '1px solid #f0f0f0' }}>
          <p style={{ fontSize: '13px', color: '#9ca3af', margin: 0 }}>
            测试账号: <span style={{ color: '#667eea', fontWeight: '600' }}>admin</span> / <span style={{ color: '#667eea', fontWeight: '600' }}>admin123</span>
          </p>
        </div>
      </div>
    </div>
  );
}
