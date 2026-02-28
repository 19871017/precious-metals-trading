import { useEffect, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Loading } from 'tdesign-react';
import { ensureAuthSession, logout } from '../services/auth';

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
    let cancelled = false;

    const checkAuth = async () => {
      try {
        await ensureAuthSession({ requireAdmin });
        if (!cancelled) {
          setAuthorized(true);
        }
      } catch (error) {
        console.error('[ProtectedRoute] 鉴权失败:', error);
        await logout();
        if (!cancelled) {
          const fallback = location.pathname.startsWith('/admin') ? '/admin-login' : '/';
          navigate(fallback, { replace: true, state: { from: location.pathname } });
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    checkAuth();

    return () => {
      cancelled = true;
    };
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
