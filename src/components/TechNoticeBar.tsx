import { useState, useEffect, useRef } from 'react';

interface Announcement {
  id: number;
  content: string;
  time: string;
}

interface TechNoticeBarProps {
  announcements: Announcement[];
  icon?: React.ReactNode;
}

export default function TechNoticeBar({ announcements, icon }: TechNoticeBarProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const scrollContentRef = useRef<HTMLDivElement>(null);
  const [isPaused, setIsPaused] = useState(false);
  const animationRef = useRef<number>();
  const positionRef = useRef(0);
  const speedRef = useRef(0.5);

  // 自动滚动动画
  useEffect(() => {
    const animate = () => {
      if (!isPaused && containerRef.current && scrollContentRef.current) {
        const containerWidth = containerRef.current.offsetWidth;
        const contentWidth = scrollContentRef.current.offsetWidth;

        positionRef.current -= speedRef.current;

        // 当滚动内容全部移出容器时，重置到起始位置
        if (Math.abs(positionRef.current) >= contentWidth / 2) {
          positionRef.current = 0;
        }

        if (scrollContentRef.current) {
          scrollContentRef.current.style.transform = `translateX(${positionRef.current}px)`;
        }
      }
      animationRef.current = requestAnimationFrame(animate);
    };

    animationRef.current = requestAnimationFrame(animate);

    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [isPaused, announcements.length]);

  if (announcements.length === 0) {
    return null;
  }

  // 复制一份数据用于无缝循环
  const doubledAnnouncements = [...announcements, ...announcements];

  return (
    <div className="mb-3 h-9 bg-neutral-900 border border-neutral-800 rounded overflow-hidden relative flex">
      {/* 科技流光效果 */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-0 left-0 h-full w-24 bg-gradient-to-r from-transparent via-amber-500/10 to-transparent animate-slide"></div>
      </div>

      {/* 左侧图标区 */}
      <div className="flex-shrink-0 px-3 border-r border-neutral-800 flex items-center z-10 relative">
        <div className="relative">
          {icon}
          {/* 金色脉冲光点 */}
          <div className="absolute -top-1 -right-1 w-2 h-2 bg-amber-500 rounded-full animate-ping opacity-50"></div>
          <div className="absolute -top-1 -right-1 w-2 h-2 bg-amber-500 rounded-full animate-pulse"></div>
        </div>
      </div>

      {/* 滑动内容区 */}
      <div
        className="flex-1 overflow-hidden relative px-3 flex items-center"
        ref={containerRef}
        onMouseEnter={() => setIsPaused(true)}
        onMouseLeave={() => setIsPaused(false)}
      >
        <div
          ref={scrollContentRef}
          className="flex whitespace-nowrap"
          style={{ transform: 'translateX(0)' }}
        >
          {doubledAnnouncements.map((announce, index) => (
            <div
              key={`${announce.id}-${index}`}
              className="flex items-center gap-2 text-xs px-4 flex-shrink-0"
            >
              {/* 时间标签 - 暗金色 */}
              <span className="text-amber-400 font-mono text-[11px] bg-amber-950/50 px-1.5 py-0.5 rounded border border-amber-800/30 whitespace-nowrap">
                {announce.time}
              </span>
              {/* 公告内容 - 高对比度暗金色 */}
              <span className="text-amber-300 font-medium">{announce.content}</span>
              {/* 流光装饰点 */}
              <span className="flex gap-0.5 flex-shrink-0 ml-2">
                <span className="w-1 h-1 bg-amber-500 rounded-full animate-pulse"></span>
                <span className="w-1 h-1 bg-amber-500/70 rounded-full animate-pulse" style={{ animationDelay: '0.2s' }}></span>
                <span className="w-1 h-1 bg-amber-500/50 rounded-full animate-pulse" style={{ animationDelay: '0.4s' }}></span>
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
