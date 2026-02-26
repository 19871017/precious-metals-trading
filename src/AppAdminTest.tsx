import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';

/**
 * 简化版测试 - 不依赖 TDesign
 */
function AppAdminTest() {
  return (
    <div style={{ padding: '40px', fontFamily: 'Arial, sans-serif' }}>
      <h1 style={{ color: '#333' }}>后台管理系统 - 测试版</h1>
      <p style={{ color: '#666', fontSize: '16px' }}>如果你看到这个页面,说明 React 和路由都正常工作</p>

      <Routes>
        <Route
          path="/"
          element={
            <div style={{ marginTop: '20px', padding: '20px', background: '#f5f5f5', borderRadius: '8px' }}>
              <h2>登录页 (简化版)</h2>
              <input
                type="text"
                placeholder="用户名"
                style={{
                  padding: '10px',
                  margin: '10px 0',
                  width: '300px',
                  border: '1px solid #ddd',
                  borderRadius: '4px'
                }}
              />
              <br />
              <input
                type="password"
                placeholder="密码"
                style={{
                  padding: '10px',
                  margin: '10px 0',
                  width: '300px',
                  border: '1px solid #ddd',
                  borderRadius: '4px'
                }}
              />
              <br />
              <button
                style={{
                  padding: '10px 30px',
                  background: '#007bff',
                  color: 'white',
                  border: 'none',
                  borderRadius: '4px',
                  cursor: 'pointer',
                  marginTop: '10px'
                }}
                onClick={() => {
                  localStorage.setItem('adminToken', 'test_token');
                  window.location.hash = '#/dashboard';
                }}
              >
                登录
              </button>
            </div>
          }
        />

        <Route
          path="/dashboard"
          element={
            localStorage.getItem('adminToken') ? (
              <div style={{ marginTop: '20px' }}>
                <h2>仪表盘页面</h2>
                <p>欢迎来到后台管理系统!</p>
                <button
                  style={{
                    padding: '10px 20px',
                    background: '#dc3545',
                    color: 'white',
                    border: 'none',
                    borderRadius: '4px',
                    cursor: 'pointer'
                  }}
                  onClick={() => {
                    localStorage.removeItem('adminToken');
                    window.location.hash = '#/';
                  }}
                >
                  退出登录
                </button>
              </div>
            ) : (
              <Navigate to="/" replace />
            )
          }
        />

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </div>
  );
}

export default AppAdminTest;
