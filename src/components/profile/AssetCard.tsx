import { useState } from 'react';
import { Eye, EyeOff } from 'lucide-react';
import { formatCurrency } from '../../utils/format';

interface AssetData {
  totalAssets: number;
  availableFunds: number;
  frozenMargin: number;
  dailyPL: number;
  dailyPLPercent: number;
}

interface AssetCardProps {
  assets: AssetData;
  showTrend?: boolean;
  trendData?: number[];
}

export default function AssetCard({ assets, showTrend = false, trendData = [] }: AssetCardProps) {
  const [showAmount, setShowAmount] = useState(true);
  const isProfit = assets.dailyPL >= 0;

  // 模拟趋势图（如果数据支持）
  const renderTrendChart = () => {
    if (!showTrend || trendData.length === 0) return null;

    const max = Math.max(...trendData);
    const min = Math.min(...trendData);
    const range = max - min || 1;

    const points = trendData.map((value, index) => {
      const x = (index / (trendData.length - 1)) * 100;
      const y = 100 - ((value - min) / range) * 80 - 10;
      return `${x},${y}`;
    }).join(' ');

    return (
      <div className="absolute top-4 right-4 w-20 h-12">
        <svg viewBox="0 0 100 100" className="w-full h-full opacity-30">
          <defs>
            <linearGradient id="trendGradient" x1="0%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" stopColor={isProfit ? '#ef4444' : '#22c55e'} stopOpacity="0.3" />
              <stop offset="100%" stopColor={isProfit ? '#ef4444' : '#22c55e'} stopOpacity="0" />
            </linearGradient>
          </defs>
          <polygon
            points={`0,100 ${points} 100,100`}
            fill="url(#trendGradient)"
          />
          <polyline
            points={points}
            fill="none"
            stroke={isProfit ? '#ef4444' : '#22c55e'}
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </div>
    );
  };

  return (
    <div className="bg-gradient-to-br from-neutral-900/90 to-neutral-950/90 border border-neutral-800 rounded-2xl p-6 shadow-lg relative overflow-hidden">
      {/* 背景装饰 */}
      <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-bl from-amber-700/5 to-transparent rounded-full -translate-y-1/2 translate-x-1/2" />

      {/* 总资产区域 */}
      <div className="flex items-center justify-between mb-6 relative z-10">
        <div>
          <p className="text-xs text-neutral-500 mb-2 tracking-wider font-medium">总资产 (¥)</p>
          <div className="flex items-baseline gap-2">
            <p className="text-3xl font-medium text-white font-mono tracking-tight">
              {showAmount ? formatCurrency(assets.totalAssets) : '****'}
            </p>
            {/* 切换显示按钮 */}
            <button
              onClick={() => setShowAmount(!showAmount)}
              className="text-neutral-600 hover:text-neutral-500 transition-colors"
            >
              {showAmount ? <EyeOff size={18} /> : <Eye size={18} />}
            </button>
          </div>
        </div>
        {renderTrendChart()}
      </div>

      {/* 子资产卡片 */}
      <div className="grid grid-cols-2 gap-3">
        {/* 可用余额 */}
        <div className="bg-neutral-950/60 border border-neutral-800/80 rounded-xl p-4 hover:bg-neutral-950/80 transition-colors duration-200">
          <p className="text-[11px] text-neutral-500 mb-2 tracking-wide font-medium">可用余额</p>
          <p className="text-base font-medium text-white font-mono">
            {showAmount ? formatCurrency(assets.availableFunds) : '****'}
          </p>
        </div>

        {/* 占用保证金 */}
        <div className="bg-neutral-950/60 border border-neutral-800/80 rounded-xl p-4 hover:bg-neutral-950/80 transition-colors duration-200">
          <p className="text-[11px] text-neutral-500 mb-2 tracking-wide font-medium">占用保证金</p>
          <p className="text-base font-medium text-amber-600 font-mono">
            {showAmount ? formatCurrency(assets.frozenMargin) : '****'}
          </p>
        </div>

        {/* 今日盈亏 */}
        <div className="bg-neutral-950/60 border border-neutral-800/80 rounded-xl p-4 hover:bg-neutral-950/80 transition-colors duration-200">
          <p className="text-[11px] text-neutral-500 mb-2 tracking-wide font-medium">今日盈亏</p>
          <p className="text-base font-medium font-mono flex items-center gap-2">
            <span className={isProfit ? 'text-red-500' : 'text-green-500'}>
              {showAmount ? (isProfit ? '+' : '') + formatCurrency(assets.dailyPL) : '****'}
            </span>
          </p>
        </div>

        {/* 今日涨跌幅 */}
        <div className="bg-neutral-950/60 border border-neutral-800/80 rounded-xl p-4 hover:bg-neutral-950/80 transition-colors duration-200">
          <p className="text-[11px] text-neutral-500 mb-2 tracking-wide font-medium">今日涨跌</p>
          <p className="text-base font-medium font-mono">
            {showAmount ? (
              <span className={isProfit ? 'text-red-500' : 'text-green-500'}>
                {isProfit ? '+' : ''}{assets.dailyPLPercent.toFixed(2)}%
              </span>
            ) : (
              '****'
            )}
          </p>
        </div>
      </div>

      {/* 底部提示 */}
      <div className="mt-4 pt-4 border-t border-neutral-800/50">
        <p className="text-[10px] text-neutral-600 text-center">
          数据仅供参考，实际交易以系统确认为准
        </p>
      </div>
    </div>
  );
}
