import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { ConfigProvider } from 'tdesign-react';
import Login from './pages/Login';
import Register from './pages/Register';
import ForgotPassword from './pages/ForgotPassword';
import AdminLogin from './pages/AdminLogin';
import AgentLogin from './pages/AgentLogin';
import TestPage from './pages/TestPage';
import BottomNav from './components/BottomNav';
import Home from './pages/Home';
import Market from './pages/Market';
import Position from './pages/Position';
import Analysis from './pages/Analysis';
import Profile from './pages/Profile';
import AdminPC from './pages/AdminPC';
import Deposit from './pages/Deposit';
import Withdraw from './pages/Withdraw';
import BankCardManagement from './pages/BankCardManagement';
import HelpCenter from './pages/HelpCenter';
import ProtectedRoute from './components/ProtectedRoute';
import AgentDashboard from './pages/agent/Dashboard';
import AgentCustomers from './pages/agent/Customers';

function App() {
  return (
    <ConfigProvider
      globalConfig={{
        classNamePrefix: 't',
      }}
      theme={{
        name: 'default',
      }}
    >
      <BrowserRouter>
        <Routes>
          {/* 公开路由 */}
          <Route path="/" element={<Login />} />
          <Route path="/login" element={<Login />} />
          <Route path="/test" element={<TestPage />} />
          <Route path="/register" element={<Register />} />
          <Route path="/forgot-password" element={<ForgotPassword />} />
          <Route path="/admin-login" element={<AdminLogin />} />
          <Route path="/agent-login" element={<AgentLogin />} />

          {/* 需要认证的路由 */}
          <Route
            path="/home"
            element={
              <ProtectedRoute>
                <><Home /><BottomNav /></>
              </ProtectedRoute>
            }
          />
          <Route
            path="/market"
            element={
              <ProtectedRoute>
                <><Market /><BottomNav /></>
              </ProtectedRoute>
            }
          />
          <Route
            path="/position"
            element={
              <ProtectedRoute>
                <><Position /><BottomNav /></>
              </ProtectedRoute>
            }
          />
          <Route
            path="/analysis"
            element={
              <ProtectedRoute>
                <><Analysis /><BottomNav /></>
              </ProtectedRoute>
            }
          />
          <Route
            path="/profile"
            element={
              <ProtectedRoute>
                <><Profile /><BottomNav /></>
              </ProtectedRoute>
            }
          />
          <Route
            path="/deposit"
            element={
              <ProtectedRoute>
                <><Deposit /><BottomNav /></>
              </ProtectedRoute>
            }
          />
          <Route
            path="/withdraw"
            element={
              <ProtectedRoute>
                <><Withdraw /><BottomNav /></>
              </ProtectedRoute>
            }
          />
          <Route
            path="/bank-cards"
            element={
              <ProtectedRoute>
                <><BankCardManagement /><BottomNav /></>
              </ProtectedRoute>
            }
          />
          <Route
            path="/help"
            element={
              <ProtectedRoute>
                <HelpCenter />
              </ProtectedRoute>
            }
          />

          {/* 管理员路由 */}
          <Route
            path="/admin"
            element={
              <ProtectedRoute requireAdmin={true}>
                <AdminPC />
              </ProtectedRoute>
            }
          />

          {/* 代理路由 */}
          <Route path="/agent" element={<AgentDashboard />}>
            <Route index element={<Navigate to="/agent/dashboard" replace />} />
            <Route path="dashboard" element={<AgentDashboard />} />
            <Route path="customers" element={<AgentCustomers />} />
          </Route>
          <Route path="/agent/dashboard" element={<AgentDashboard />} />

          {/* 默认重定向 */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </ConfigProvider>
  );
}

export default App;
