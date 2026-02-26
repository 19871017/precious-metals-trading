import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Loading } from 'tdesign-react';

/**
 * 后台管理系统专用保护路由
 * 使用独立的 adminToken 进行认证
 */
interface AdminProtectedRouteProps {
  children: React.ReactNode;
}

export default function AdminProtectedRoute({ children }: AdminProtectedRouteProps) {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [authorized, setAuthorized] = useState(false);

  useEffect(() => {
    const checkAdminAuth = () => {
      try {
        // 检查管理员令牌
        const adminToken = localStorage.getItem('adminToken');
        const adminUser = localStorage.getItem('adminUser');

      if (!adminToken || !adminUser) {
        // 未登录，跳转到后台登录页
        navigate('/', { replace: true });
        return;
      }

      // 验证管理员信息
      const user = JSON.parse(adminUser);
      if (!user || user.role !== 'ADMIN') {
        // 非管理员，清除认证信息并跳转
        localStorage.removeItem('adminToken');
        localStorage.removeItem('adminUser');
        navigate('/', { replace: true });
        return;
      }

        // 认证通过
        setAuthorized(true);
      } catch (error) {
        // 解析失败，清除认证信息并跳转
        localStorage.removeItem('adminToken');
        localStorage.removeItem('adminUser');
        navigate('/', { replace: true });
      } finally {
        setLoading(false);
      }
    };

    checkAdminAuth();
  }, [navigate]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-900">
        <Loading loading={true} size="large" />
      </div>
    );
  }

  return authorized ? <>{children}</> : null;
}
