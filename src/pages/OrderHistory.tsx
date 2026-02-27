import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, Button, Space, Loading, MessagePlugin } from 'tdesign-react';
import { ArrowLeftIcon, DownloadIcon, FilterIcon } from 'tdesign-icons-react';
import OrderHistory from '../components/OrderHistory';
import { Order } from '../types';
import { orderApi } from '../services/user.service';
import logger from '../utils/logger';

export default function OrderHistoryPage() {
  const navigate = useNavigate();
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(false);
  const [filterStatus, setFilterStatus] = useState<string | null>(null);

  useEffect(() => {
    loadOrders();
  }, []);

  const loadOrders = async () => {
    setLoading(true);
    try {
      const data = await orderApi.getList();
      setOrders(data);
    } catch (error) {
      logger.error('加载订单失败:', error);
      MessagePlugin.error('加载订单失败');
      setOrders([]);
    } finally {
      setLoading(false);
    }
  };

  const handleExportAll = () => {
    const dataToExport = orders.map(order => ({
      订单号: order.orderId || order.id || '',
      品种: order.productCode || order.symbol || '',
      方向: order.direction === 'BUY' || order.direction === 'buy' ? '买入' : '卖出',
      类型: order.type === 'MARKET' ? '市价单' : '限价单',
      价格: order.price || order.filledPrice || 0,
      数量: order.quantity,
      保证金: order.margin || 0,
      状态: getStatusText(order.status),
      创建时间: order.createdAt || order.createTime || '',
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

  const getStatusText = (status: string) => {
    const statusMap: Record<string, string> = {
      'pending': '待成交',
      'filled': '已成交',
      'cancelled': '已取消',
      'rejected': '已拒绝',
      'partial': '部分成交',
    };
    return statusMap[status] || status;
  };

  const filteredOrders = filterStatus
    ? orders.filter(order => order.status === filterStatus)
    : orders;

  return (
    <div className="min-h-screen bg-gradient-to-b from-black to-neutral-950 pb-20 pt-2">
      <div className="max-w-7xl mx-auto px-3">
        <header className="flex items-center justify-between mb-4 py-2">
          <div className="flex items-center gap-3">
            <Button
              variant="text"
              icon={<ArrowLeftIcon />}
              onClick={() => navigate(-1)}
              className="text-amber-400 hover:text-amber-300"
            >
              返回
            </Button>
            <div>
              <h1 className="text-lg font-bold text-white tracking-wide">订单历史</h1>
              <p className="text-xs text-neutral-500">查看和管理历史订单记录</p>
            </div>
          </div>
          <Space>
            <select
              value={filterStatus || ''}
              onChange={(e) => setFilterStatus(e.target.value || null)}
              className="bg-neutral-900 text-white text-sm px-3 py-2 border border-neutral-700 rounded-lg focus:outline-none focus:border-amber-500"
            >
              <option value="">全部状态</option>
              <option value="pending">待成交</option>
              <option value="filled">已成交</option>
              <option value="cancelled">已取消</option>
              <option value="rejected">已拒绝</option>
            </select>
            <Button
              icon={<DownloadIcon />}
              theme="warning"
              onClick={handleExportAll}
              disabled={orders.length === 0}
            >
              导出全部
            </Button>
          </Space>
        </header>

        {loading ? (
          <div className="flex justify-center py-20">
            <Loading loading text="加载中..." size="large" />
          </div>
        ) : (
          <OrderHistory orders={filteredOrders} />
        )}
      </div>
    </div>
  );
}
