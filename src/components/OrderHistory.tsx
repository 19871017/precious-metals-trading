import { useState, useEffect, useMemo } from 'react';
import { Card, Tabs, Tag, Table, DatePicker, Space, Input, Select, Button } from 'tdesign-react';
import { SearchIcon, FilterIcon, DownloadIcon } from 'tdesign-icons-react';
import { formatPrice, formatCurrency } from '../utils/format';
import { Order } from '../types';

interface OrderHistoryProps {
  orders: Order[];
}

type HistoryPeriod = 'today' | 'week' | 'month' | 'all';

export default function OrderHistory({ orders }: OrderHistoryProps) {
  const [period, setPeriod] = useState<HistoryPeriod>('all');
  const [activeTab, setActiveTab] = useState<'all' | 'filled' | 'cancelled'>('all');
  const [searchText, setSearchText] = useState('');
  const [symbolFilter, setSymbolFilter] = useState<string>('all');

  const periodOptions = [
    { value: 'today', label: '今日' },
    { value: 'week', label: '近7天' },
    { value: 'month', label: '近30天' },
    { value: 'all', label: '全部' },
  ];

  const symbols = useMemo(() => {
    return Array.from(new Set(orders.map(o => o.symbol))).sort();
  }, [orders]);

  const filteredOrders = useMemo(() => {
    let result = [...orders];

    if (period !== 'all') {
      const now = new Date();
      const startTime = new Date();

      switch (period) {
        case 'today':
          startTime.setHours(0, 0, 0, 0);
          break;
        case 'week':
          startTime.setDate(now.getDate() - 7);
          break;
        case 'month':
          startTime.setDate(now.getDate() - 30);
          break;
      }

      result = result.filter(order => {
        const orderDate = new Date(order.createTime);
        return orderDate >= startTime && orderDate <= now;
      });
    }

    if (activeTab !== 'all') {
      result = result.filter(order => order.status === activeTab);
    }

    if (searchText) {
      const searchLower = searchText.toLowerCase();
      result = result.filter(order =>
        order.symbol.toLowerCase().includes(searchLower) ||
        order.id.toString().includes(searchLower)
      );
    }

    if (symbolFilter !== 'all') {
      result = result.filter(order => order.symbol === symbolFilter);
    }

    return result.sort((a, b) =>
      new Date(b.createTime).getTime() - new Date(a.createTime).getTime()
    );
  }, [orders, period, activeTab, searchText, symbolFilter]);

  const statistics = useMemo(() => {
    const filledOrders = orders.filter(o => o.status === 'filled');
    const cancelledOrders = orders.filter(o => o.status === 'cancelled');

    return {
      total: orders.length,
      filled: filledOrders.length,
      cancelled: cancelledOrders.length,
      fillRate: orders.length > 0 ? ((filledOrders.length / orders.length) * 100).toFixed(1) : '0.0',
      totalVolume: filledOrders.reduce((sum, o) => sum + o.quantity, 0),
      totalMargin: filledOrders.reduce((sum, o) => sum + (o.margin || 0), 0),
    };
  }, [orders]);

  const getStatusTag = (status: string) => {
    const config: Record<string, { text: string; theme: any }> = {
      filled: { text: '已成交', theme: 'success' },
      cancelled: { text: '已取消', theme: 'default' },
      rejected: { text: '已拒绝', theme: 'danger' },
    };
    const { text, theme } = config[status] || { text: status, theme: 'default' };
    return <Tag theme={theme} variant="light">{text}</Tag>;
  };

  const columns = [
    {
      colKey: 'id',
      title: '订单号',
      width: 100,
      cell: ({ row }: { row: Order }) => (
        <span className="font-mono text-xs">{row.id}</span>
      ),
    },
    {
      colKey: 'symbol',
      title: '品种',
      width: 70,
      cell: ({ row }: { row: Order }) => (
        <span className="font-semibold text-sm">{row.symbol}</span>
      ),
    },
    {
      colKey: 'type',
      title: '方向',
      width: 50,
      cell: ({ row }: { row: Order }) => (
        <Tag theme={row.type === 'buy' ? 'danger' : 'success'} variant="light" size="small">
          {row.type === 'buy' ? '买' : '卖'}
        </Tag>
      ),
    },
    {
      colKey: 'price',
      title: '价格',
      width: 90,
      cell: ({ row }: { row: Order }) => (
        <span className="font-mono text-sm">{formatPrice(row.price)}</span>
      ),
    },
    {
      colKey: 'quantity',
      title: '数量',
      width: 60,
      cell: ({ row }: { row: Order }) => (
        <span className="font-mono text-xs">{row.quantity}手</span>
      ),
    },
    {
      colKey: 'margin',
      title: '保证金',
      width: 90,
      cell: ({ row }: { row: Order }) => (
        <span className="font-mono text-xs text-amber-500">
          {row.margin ? formatCurrency(row.margin) : '--'}
        </span>
      ),
    },
    {
      colKey: 'status',
      title: '状态',
      width: 70,
      cell: ({ row }: { row: Order }) => getStatusTag(row.status),
    },
    {
      colKey: 'createTime',
      title: '时间',
      width: 120,
      cell: ({ row }: { row: Order }) => {
        const date = new Date(row.createTime);
        return (
          <span className="text-[10px] text-neutral-500 font-mono">
            {date.toLocaleString('zh-CN', {
              month: '2-digit',
              day: '2-digit',
              hour: '2-digit',
              minute: '2-digit',
            })}
          </span>
        );
      },
    },
  ];

  const handleExport = () => {
    const dataToExport = filteredOrders.map(order => ({
      订单号: order.id,
      品种: order.symbol,
      方向: order.type === 'buy' ? '买入' : '卖出',
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
    link.download = `订单历史_${period}_${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
  };

  return (
    <div className="space-y-4">
      <Card>
        <Space direction="vertical" style={{ width: '100%' }} size="medium">
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-base font-semibold text-neutral-200">订单历史</h3>
            <Space>
              <Select
                value={period}
                onChange={setPeriod}
                options={periodOptions}
                size="small"
              />
              <Button
                icon={<DownloadIcon />}
                variant="outline"
                size="small"
                onClick={handleExport}
                disabled={filteredOrders.length === 0}
              >
                导出
              </Button>
            </Space>
          </div>

          <div className="grid grid-cols-3 md:grid-cols-6 gap-3">
            <div className="bg-neutral-950 rounded p-2 border border-neutral-800">
              <p className="text-[10px] text-neutral-500 mb-1">总订单</p>
              <p className="text-lg font-bold text-white font-mono">{statistics.total}</p>
            </div>
            <div className="bg-neutral-950 rounded p-2 border border-neutral-800">
              <p className="text-[10px] text-neutral-500 mb-1">已成交</p>
              <p className="text-lg font-bold text-green-500 font-mono">{statistics.filled}</p>
            </div>
            <div className="bg-neutral-950 rounded p-2 border border-neutral-800">
              <p className="text-[10px] text-neutral-500 mb-1">已取消</p>
              <p className="text-lg font-bold text-neutral-500 font-mono">{statistics.cancelled}</p>
            </div>
            <div className="bg-neutral-950 rounded p-2 border border-neutral-800">
              <p className="text-[10px] text-neutral-500 mb-1">成交率</p>
              <p className="text-lg font-bold text-amber-500 font-mono">{statistics.fillRate}%</p>
            </div>
            <div className="bg-neutral-950 rounded p-2 border border-neutral-800">
              <p className="text-[10px] text-neutral-500 mb-1">总手数</p>
              <p className="text-lg font-bold text-white font-mono">{statistics.totalVolume}</p>
            </div>
            <div className="bg-neutral-950 rounded p-2 border border-neutral-800">
              <p className="text-[10px] text-neutral-500 mb-1">总保证金</p>
              <p className="text-sm font-bold text-amber-400 font-mono">
                {formatCurrency(statistics.totalMargin)}
              </p>
            </div>
          </div>
        </Space>
      </Card>

      <Card>
        <Tabs
          activeValue={activeTab}
          onChange={setActiveTab}
          size="medium"
          className="order-history-tabs"
        >
          <Tabs.TabPanel value="all" label={`全部 (${filteredOrders.length})`}>
            {renderOrderList(filteredOrders)}
          </Tabs.TabPanel>
          <Tabs.TabPanel
            value="filled"
            label={`已成交 (${orders.filter(o => o.status === 'filled').length})`}
          >
            {renderOrderList(filteredOrders.filter(o => o.status === 'filled'))}
          </Tabs.TabPanel>
          <Tabs.TabPanel
            value="cancelled"
            label={`已取消 (${orders.filter(o => o.status === 'cancelled').length})`}
          >
            {renderOrderList(filteredOrders.filter(o => o.status === 'cancelled'))}
          </Tabs.TabPanel>
        </Tabs>
      </Card>
    </div>
  );

  function renderOrderList(orderList: Order[]) {
    return (
      <div className="space-y-3">
        <div className="flex gap-3 mb-3">
          <Input
            prefixIcon={<SearchIcon />}
            placeholder="搜索订单号、品种..."
            value={searchText}
            onChange={setSearchText}
            clearable
            size="small"
            className="flex-1"
          />
          <Select
            value={symbolFilter}
            onChange={setSymbolFilter}
            options={[
              { label: '全部品种', value: 'all' },
              ...symbols.map(s => ({ label: s, value: s })),
            ]}
            placeholder="品种"
            size="small"
            style={{ width: 120 }}
          />
        </div>

        {orderList.length === 0 ? (
          <div className="text-center py-8">
            <p className="text-sm text-neutral-500">暂无订单记录</p>
          </div>
        ) : (
          <Table
            data={orderList}
            columns={columns}
            rowKey="id"
            pagination={{
              pageSize: 10,
              total: orderList.length,
              showJumper: false,
              showPageSize: false,
            }}
            bordered
            size="small"
          />
        )}
      </div>
    );
  }
}
