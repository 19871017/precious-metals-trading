import React from 'react';

interface LoadingSkeletonProps {
  /**
   * 骨架屏类型
   * @default 'text'
   */
  variant?: 'text' | 'circular' | 'rectangular' | 'rounded';

  /**
   * 宽度
   * @default '100%'
   */
  width?: string | number;

  /**
   * 高度
   * @default 16
   */
  height?: string | number;

  /**
   * 骨架屏数量（仅text类型）
   * @default 1
   */
  count?: number;

  /**
   * 是否显示动画
   * @default true
   */
  animated?: boolean;

  /**
   * 自定义样式类名
   */
  className?: string;

  /**
   * 圆角
   * @default 4
   */
  borderRadius?: number;
}

/**
 * 骨架屏加载组件
 * 用于数据加载时显示占位动画
 */
const LoadingSkeleton: React.FC<LoadingSkeletonProps> = ({
  variant = 'text',
  width = '100%',
  height = 16,
  count = 1,
  animated = true,
  className = '',
  borderRadius = 4
}) => {
  const baseClasses = 'bg-neutral-800/50';

  const getVariantClasses = () => {
    switch (variant) {
      case 'circular':
        return 'rounded-full';
      case 'rectangular':
        return 'rounded-none';
      case 'rounded':
        return `rounded-lg`;
      default:
        return `rounded`;
    }
  };

  const animationClass = animated ? 'animate-pulse' : '';

  const style: React.CSSProperties = {
    width: typeof width === 'number' ? `${width}px` : width,
    height: typeof height === 'number' ? `${height}px` : height,
    borderRadius: variant !== 'text' ? undefined : borderRadius
  };

  if (variant === 'text' && count > 1) {
    return (
      <div className={`space-y-2 ${className}`}>
        {Array.from({ length: count }).map((_, index) => (
          <div
            key={index}
            className={`${baseClasses} ${getVariantClasses()} ${animationClass}`}
            style={{
              width: index === count - 1 ? '60%' : width,
              height: typeof height === 'number' ? `${height}px` : height
            }}
          />
        ))}
      </div>
    );
  }

  return (
    <div
      className={`${baseClasses} ${getVariantClasses()} ${animationClass} ${className}`}
      style={style}
    />
  );
};

// ============================================
// 预定义骨架屏组件
// ============================================

/**
 * 加载卡片骨架
 */
export const CardSkeleton = () => (
  <div className="bg-neutral-900/80 border border-neutral-800 rounded-xl p-4">
    <div className="flex items-center gap-3 mb-3">
      <LoadingSkeleton variant="circular" width={40} height={40} />
      <div className="flex-1">
        <LoadingSkeleton height={16} className="mb-2" />
        <LoadingSkeleton height={12} width="60%" />
      </div>
    </div>
    <LoadingSkeleton height={40} />
  </div>
);

/**
 * 列表项骨架
 */
export const ListItemSkeleton = () => (
  <div className="flex items-center gap-3 p-3 border-b border-neutral-800">
    <LoadingSkeleton variant="circular" width={32} height={32} />
    <div className="flex-1">
      <LoadingSkeleton height={14} className="mb-2" />
      <LoadingSkeleton height={12} width="40%" />
    </div>
    <LoadingSkeleton width={60} height={20} />
  </div>
);

/**
 * 表格骨架
 */
interface TableSkeletonProps {
  rows?: number;
  columns?: number;
}

export const TableSkeleton: React.FC<TableSkeletonProps> = ({ rows = 5, columns = 4 }) => (
  <div className="space-y-2">
    {/* 表头 */}
    <div className="flex gap-4 p-3 bg-neutral-900/50 rounded-t-lg">
      {Array.from({ length: columns }).map((_, index) => (
        <LoadingSkeleton key={`header-${index}`} height={16} className="flex-1" />
      ))}
    </div>
    {/* 表格行 */}
    {Array.from({ length: rows }).map((_, rowIndex) => (
      <div key={`row-${rowIndex}`} className="flex gap-4 p-3 border-t border-neutral-800">
        {Array.from({ length: columns }).map((_, colIndex) => (
          <LoadingSkeleton key={`cell-${rowIndex}-${colIndex}`} height={14} className="flex-1" />
        ))}
      </div>
    ))}
  </div>
);

/**
 * 页面加载骨架
 */
export const PageSkeleton = () => (
  <div className="space-y-4">
    <LoadingSkeleton height={32} width={200} className="mb-6" />
    <LoadingSkeleton height={150} className="mb-4" />
    <div className="grid grid-cols-2 gap-4">
      <CardSkeleton />
      <CardSkeleton />
    </div>
    <LoadingSkeleton height={400} />
  </div>
);

export default LoadingSkeleton;
