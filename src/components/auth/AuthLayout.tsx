import { ReactNode } from 'react';

interface AuthLayoutProps {
  children: ReactNode;
  type: 'login' | 'register' | 'forgot';
}

export default function AuthLayout({ children, type }: AuthLayoutProps) {
  // AI 状态文案轮播
  const aiStatusTexts = [
    'AI 引擎初始化中…',
    '市场数据加载完成',
    '风控系统已上线',
    '神经网络准备就绪',
  ];

  const aiFeatures = [
    {
      icon: (
        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
        </svg>
      ),
      title: 'AI 智能行情分析',
      description: '实时 AI 市场分析',
    },
    {
      icon: (
        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
        </svg>
      ),
      title: '多维风控系统',
      description: '全方位风险控制',
    },
    {
      icon: (
        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M13 10V3L4 14h7v7l9-11h-7z" />
        </svg>
      ),
      title: '专业级撮合引擎',
      description: '毫秒级订单匹配',
    },
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 flex">
      {/* 左侧：品牌 + AI 区 */}
      <div className="hidden lg:flex lg:w-1/2 bg-gradient-to-br from-blue-950/40 to-slate-950/60 relative overflow-hidden">
        {/* AI 背景动画效果 */}
        <div className="absolute inset-0">
          {/* 神经网络线条 */}
          <div className="absolute inset-0 opacity-20">
            <svg className="w-full h-full" viewBox="0 0 400 600" fill="none">
              {/* 垂直线条 */}
              {[50, 120, 200, 280, 350].map((x, i) => (
                <line
                  key={`v-${i}`}
                  x1={x}
                  y1={0}
                  x2={x}
                  y2={600}
                  stroke="currentColor"
                  strokeWidth="0.5"
                  className="text-blue-500/30"
                  style={{ animationDelay: `${i * 0.2}s` }}
                />
              ))}
              {/* 水平线条 */}
              {[100, 200, 300, 400, 500].map((y, i) => (
                <line
                  key={`h-${i}`}
                  x1={0}
                  y1={y}
                  x2={400}
                  y2={y}
                  stroke="currentColor"
                  strokeWidth="0.5"
                  className="text-blue-500/30"
                  style={{ animationDelay: `${i * 0.3}s` }}
                />
              ))}
              {/* 节点 */}
              {[...Array(15)].map((_, i) => {
                const x = 50 + (i % 5) * 75;
                const y = 100 + Math.floor(i / 5) * 150;
                return (
                  <circle
                    key={`node-${i}`}
                    cx={x}
                    cy={y}
                    r={3}
                    fill="currentColor"
                    className="text-blue-400 animate-pulse"
                    style={{ animationDelay: `${i * 0.1}s` }}
                  />
                );
              })}
            </svg>
          </div>

          {/* 数据粒子效果 */}
          <div className="absolute inset-0 overflow-hidden">
            {[...Array(20)].map((_, i) => (
              <div
                key={`particle-${i}`}
                className="absolute w-1 h-1 bg-blue-400/30 rounded-full animate-pulse"
                style={{
                  left: `${Math.random() * 100}%`,
                  top: `${Math.random() * 100}%`,
                  animationDuration: `${3 + Math.random() * 2}s`,
                  animationDelay: `${Math.random() * 2}s`,
                }}
              />
            ))}
          </div>
        </div>

        {/* 内容区 */}
        <div className="relative z-10 flex flex-col justify-center items-center h-full p-12">
          {/* LOGO */}
          <div className="mb-8">
            <div className="flex items-center gap-3 mb-2">
              <div className="w-12 h-12 bg-gradient-to-br from-blue-600 to-blue-800 rounded-lg flex items-center justify-center shadow-lg shadow-blue-900/30">
                <svg className="w-7 h-7 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
              </div>
              <span className="text-2xl font-bold text-white tracking-tight">AI Trading</span>
            </div>
            <p className="text-blue-300/70 text-sm ml-1">Intelligent Trading System</p>
          </div>

          {/* 核心能力展示 */}
          <div className="space-y-3 w-full max-w-md">
            {aiFeatures.map((feature, index) => (
              <div
                key={index}
                className="flex items-center gap-3 p-3 bg-white/5 backdrop-blur-sm rounded-lg border border-white/10 hover:bg-white/10 transition-colors"
              >
                <div className="flex-shrink-0 w-9 h-9 bg-blue-600/20 rounded-lg flex items-center justify-center border border-blue-500/30">
                  {feature.icon}
                </div>
                <div>
                  <h3 className="text-white font-semibold text-sm mb-0.5">{feature.title}</h3>
                  <p className="text-blue-300/60 text-xs">{feature.description}</p>
                </div>
              </div>
            ))}
          </div>

          {/* AI 状态指示器 */}
          <div className="mt-6 flex items-center gap-2 px-3 py-1.5 bg-blue-900/20 rounded-full border border-blue-500/30">
            <div className="w-1.5 h-1.5 bg-green-400 rounded-full animate-pulse" />
            <span className="text-blue-300/70 text-xs font-mono">{aiStatusTexts[0]}</span>
          </div>
        </div>
      </div>

      {/* 右侧：表单操作区 */}
      <div className="flex-1 flex items-center justify-center p-4 lg:p-12">
        <div className="w-full max-w-md">
          {/* 移动端 Logo（仅小屏幕显示） */}
          <div className="lg:hidden flex items-center gap-3 mb-8 justify-center">
            <div className="w-10 h-10 bg-gradient-to-br from-blue-600 to-blue-800 rounded-lg flex items-center justify-center">
              <svg className="w-6 h-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
            </div>
            <span className="text-xl font-bold text-white">AI Trading</span>
          </div>

          {children}
        </div>
      </div>
    </div>
  );
}
