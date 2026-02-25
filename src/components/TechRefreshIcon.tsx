interface TechRefreshIconProps {
  size?: string | number;
  className?: string;
  refreshing?: boolean;
}

export default function TechRefreshIcon({ size = '18px', className = '', refreshing = false }: TechRefreshIconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      className={className}
    >
      <defs>
        <linearGradient id="techGradient" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#2563eb" />
          <stop offset="50%" stopColor="#3b82f6" />
          <stop offset="100%" stopColor="#06b6d4" />
        </linearGradient>
        <filter id="glow" x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur stdDeviation="1.5" result="coloredBlur"/>
          <feMerge>
            <feMergeNode in="coloredBlur"/>
            <feMergeNode in="SourceGraphic"/>
          </feMerge>
        </filter>
      </defs>

      {/* 外圈脉冲环 - 刷新时显示 */}
      {refreshing && (
        <>
          <circle
            cx="12"
            cy="12"
            r="11"
            stroke="url(#techGradient)"
            strokeWidth="0.5"
            className="animate-ping opacity-10"
            style={{ animationDuration: '1.5s' }}
          />
          <circle
            cx="12"
            cy="12"
            r="10"
            stroke="url(#techGradient)"
            strokeWidth="0.8"
            className="animate-pulse opacity-20"
            style={{ animationDuration: '1s' }}
          />
        </>
      )}

      {/* 主轨道圆 */}
      <circle
        cx="12"
        cy="12"
        r="9"
        stroke="url(#techGradient)"
        strokeWidth="1.2"
        className="opacity-30"
      />

      {/* 刷新箭头主路径 */}
      <path
        d="M21 12a9 9 0 01-9 9"
        stroke="url(#techGradient)"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
        filter="url(#glow)"
        className={refreshing ? 'animate-spin origin-center' : ''}
        style={{
          transformOrigin: '12px 12px',
        }}
      />

      {/* 箭头头部 */}
      <path
        d="M21 12a9 9 0 01-3-6.34"
        stroke="url(#techGradient)"
        strokeWidth="0"
        fill="url(#techGradient)"
        className={refreshing ? 'animate-spin origin-center' : ''}
        style={{
          transformOrigin: '12px 12px',
        }}
      />
      <path
        d="M18 6v6h6"
        stroke="url(#techGradient)"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
        filter="url(#glow)"
        className={refreshing ? 'animate-spin origin-center' : ''}
        style={{
          transformOrigin: '12px 12px',
        }}
      />

      {/* AI 扫描光线 - 刷新时显示 */}
      {refreshing && (
        <path
          d="M12 12 L12 3"
          stroke="url(#techGradient)"
          strokeWidth="1.5"
          strokeLinecap="round"
          className="animate-spin origin-center"
          style={{
            transformOrigin: '12px 12px',
            animationDuration: '2s',
            opacity: 0.6,
          }}
        />
      )}

      {/* 中心数据点 */}
      <circle
        cx="12"
        cy="12"
        r="2"
        fill="url(#techGradient)"
        filter="url(#glow)"
        className={refreshing ? 'animate-pulse' : ''}
      />

      {/* 装饰性数据点 - 四角 */}
      {[0, 90, 180, 270].map((angle, i) => {
        const x = 12 + Math.cos((angle * Math.PI) / 180) * 7.5;
        const y = 12 + Math.sin((angle * Math.PI) / 180) * 7.5;
        return (
          <circle
            key={i}
            cx={x}
            cy={y}
            r="0.8"
            fill="url(#techGradient)"
            className={refreshing ? 'animate-pulse' : 'opacity-50'}
            style={{
              animationDelay: `${i * 0.2}s`,
            }}
          />
        );
      })}
    </svg>
  );
}
