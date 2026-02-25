import { ChevronRightIcon } from 'tdesign-icons-react';

interface FunctionItem {
  icon: React.ReactNode;
  title: string;
  description: string;
  badge?: string;
  onClick?: () => void;
}

interface FunctionGridProps {
  title?: string;
  items: FunctionItem[];
  columns?: 2 | 3 | 4;
}

export default function FunctionGrid({ title, items, columns = 2 }: FunctionGridProps) {
  const gridCols = columns === 2 ? 'grid-cols-2' : columns === 3 ? 'grid-cols-3' : 'grid-cols-4';

  return (
    <div className="space-y-4">
      {/* 标题 */}
      {title && (
        <div className="flex items-center gap-2">
          <div className="w-1 h-4 bg-amber-700 rounded-full" />
          <h3 className="text-sm font-bold text-white">{title}</h3>
        </div>
      )}

      {/* 功能网格 */}
      <div className={`grid ${gridCols} gap-3`}>
        {items.map((item, index) => (
          <button
            key={index}
            onClick={item.onClick}
            className="group bg-neutral-900/80 border border-neutral-800/80 rounded-xl p-4 text-left hover:bg-neutral-800/80 hover:border-neutral-700 hover:shadow-md hover:-translate-y-0.5 transition-all duration-200 relative"
          >
            {/* 徽章 */}
            {item.badge && (
              <div className="absolute -top-2 -right-2 bg-red-600 text-white text-[10px] font-medium px-1.5 py-0.5 rounded-full">
                {item.badge}
              </div>
            )}

            {/* 内容 */}
            <div className="flex items-start justify-between">
              <div className="flex-1">
                {/* 图标 */}
                <div className="w-10 h-10 bg-gradient-to-br from-amber-700/20 to-amber-900/20 border border-amber-700/30 rounded-xl flex items-center justify-center mb-3 group-hover:from-amber-700/30 group-hover:to-amber-900/30 transition-colors duration-200">
                  <span className="text-amber-600">{item.icon}</span>
                </div>

                {/* 文字 */}
                <h4 className="text-sm font-semibold text-white mb-1 group-hover:text-amber-200 transition-colors">
                  {item.title}
                </h4>
                <p className="text-[11px] text-neutral-500 leading-relaxed line-clamp-2">
                  {item.description}
                </p>
              </div>

              {/* 箭头 */}
              <ChevronRightIcon size="16px" className="text-neutral-600 group-hover:text-neutral-500 transition-colors mt-1" />
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}
