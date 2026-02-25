import { useLocation, useNavigate } from 'react-router-dom';
import { HomeIcon, ChartIcon, ListIcon, AnalyticsIcon, UserIcon } from 'tdesign-icons-react';

export default function BottomNav() {
  const location = useLocation();
  const navigate = useNavigate();

  const navItems = [
    { path: '/home', icon: HomeIcon, label: '首页' },
    { path: '/market', icon: ChartIcon, label: '交易' },
    { path: '/position', icon: ListIcon, label: '持仓' },
    { path: '/analysis', icon: AnalyticsIcon, label: '分析' },
    { path: '/profile', icon: UserIcon, label: '我的' },
  ];

  return (
    <div className="fixed bottom-0 left-0 right-0 bg-neutral-950/95 backdrop-blur-sm border-t border-neutral-800 z-50">
      <div className="flex">
        {navItems.map((item) => {
          const isActive = location.pathname === item.path;
          const Icon = item.icon;
          return (
            <button
              key={item.path}
              onClick={() => navigate(item.path)}
              className={`flex-1 flex flex-col items-center justify-center py-2 transition-all ${
                isActive 
                  ? 'text-amber-600' 
                  : 'text-neutral-600 hover:text-neutral-400'
              }`}
            >
              <Icon size="20px" className="opacity-80" />
              <span className="text-xs mt-1 font-medium tracking-wide">{item.label}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
