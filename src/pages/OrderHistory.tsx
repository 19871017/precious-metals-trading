import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, Button, Space } from 'tdesign-react';
import { ArrowLeftIcon, DownloadIcon, FilterIcon } from 'tdesign-icons-react';
import OrderHistory from '../components/OrderHistory';
import { Order } from '../types';

export default function OrderHistoryPage() {
  const navigate = useNavigate();
  const [orders, setOrders] = useState<Order[]>(() => {
    try {
      const saved = localStorage.getItem('trading_orders');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  const handleExportAll = () => {
    const dataToExport = orders.map(order => ({
      订单号: order.id,
      品种: order.symbol,
      方向: order.type === 'buy' ? '买入' : '卖出',
      类型: order.orderType,
      价格: order.price,
      数量: order.quantity,
      保证金: order.margin || 0,
      状态: order.status,
      创建时间: order.createTime,
    }));

    const csvContent = [
      Object.keys(dataToExport[0] || {}).join(','),
      ...dataToExport.map(row => Object.values(row).join(',')),
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `全部订单记录_${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-black to-neutral-950 pb-20 pt-2">
      <div className="max-w-7xl mx-auto px-3">
        <header className="flex items-center justify-between mb-4 py-2">
          <div className="flex items-center gap-3">
            <Button
              variant="text"
              icon={<ArrowLeftIcon />}
              onClick={() => navigate(-1)}
              className="text-neutral-400 hover:text-white"
            >
              返回
            </Button>
            <div>
              <h1 className="text-lg font-bold text-white tracking-wide">订单历史</h1>
              <p className="text-xs text-neutral-600">查看和管理历史订单记录</p>
            </div>
          </div>
          <Button
            icon={<DownloadIcon />}
            theme="primary"
            onClick={handleExportAll}
            disabled={orders.length === 0}
          >
            导出全部
          </Button>
        </header>

        <OrderHistory orders={orders} />
      </div>
    </div>
  );
}
