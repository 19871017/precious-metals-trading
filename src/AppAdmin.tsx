import { useState } from 'react';
import { Routes, Route, Navigate, useNavigate } from 'react-router-dom';
import AdminLoginSimple from './AdminLoginSimple';
import AdminPCSimple from './pages/AdminPCSimple';

/**
 * 后台管理系统入口 - 完全独立于前端系统
 * 使用独立的路由和认证系统
 */
function AppAdmin() {
  const [isAdminLoggedIn, setIsAdminLoggedIn] = useState(() => {
    return !!(localStorage.getItem('adminToken') && localStorage.getItem('adminUser'));
  });

  // 登录成功回调
  const handleLoginSuccess = () => {
    setIsAdminLoggedIn(true);
  };

  // 退出登录回调
  const handleLogout = () => {
    localStorage.removeItem('adminToken');
    localStorage.removeItem('adminUser');
    setIsAdminLoggedIn(false);
  };

  return (
      <div>
        <Routes>
          {/* 后台管理登录页 */}
          <Route
            path="/"
            element={
              isAdminLoggedIn ? (
                <Navigate to="/dashboard" replace />
              ) : (
                <AdminLoginSimple onLoginSuccess={handleLoginSuccess} />
              )
            }
          />

          {/* 后台管理主页面 - 需要管理员认证 */}
          <Route
            path="/dashboard"
            element={
              isAdminLoggedIn ? (
                <AdminPCWrapper onLogout={handleLogout} />
              ) : (
                <Navigate to="/" replace />
              )
            }
          />

          {/* 默认重定向到登录页 */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </div>
  );
}

// AdminPC 包装组件，传递退出登录方法
function AdminPCWrapper({ onLogout }: { onLogout: () => void }) {
  return <AdminPCSimple onLogout={onLogout} />;
}

export default AppAdmin;
