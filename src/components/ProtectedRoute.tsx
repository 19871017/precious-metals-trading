import { useEffect, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Loading } from 'tdesign-react';
import { isLoggedIn, getToken, isAdmin } from '../services/auth';

interface ProtectedRouteProps {
  children: React.ReactNode;
  requireAdmin?: boolean;
}

export default function ProtectedRoute({ children, requireAdmin = false }: ProtectedRouteProps) {
  const navigate = useNavigate();
  const location = useLocation();
  const [loading, setLoading] = useState(true);
  const [authorized, setAuthorized] = useState(false);

  useEffect(() => {
    const checkAuth = () => {
      // 检查是否登录
      if (!isLoggedIn()) {
        // 如果是后台路由，跳转到管理员登录页
        if (location.pathname.startsWith('/admin')) {
          navigate('/admin-login', { replace: true });
        } else {
          navigate('/', { replace: true });
        }
        return;
      }

      // 检查是否需要管理员权限
      if (requireAdmin) {
        if (!isAdmin()) {
          // 如果不是管理员，跳转到首页
          navigate('/home', { replace: true });
          return;
        }
      }

      setAuthorized(true);
      setLoading(false);
    };

    checkAuth();
  }, [navigate, location.pathname, requireAdmin]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-900">
        <Loading loading={true} size="large" />
      </div>
    );
  }

  return authorized ? <>{children}</> : null;
}
