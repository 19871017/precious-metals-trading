import { useState, useEffect, useMemo } from 'react';
import { Modal, Input, Select, Button, Tag, Space, Table, DatePicker, Card, Statistic } from 'tdesign-react';
import { SearchIcon, FilterIcon, DownloadIcon, RefreshIcon } from 'tdesign-icons-react';
import { formatPrice, formatCurrency } from '../utils/format';
import { Order } from '../types';

interface OrderManagementProps {
  visible: boolean;
  onClose: () => void;
  orders: Order[];
  onCancelOrder: (order: Order) => void;
}

type OrderStatus = 'all' | 'pending' | 'filled' | 'cancelled' | 'rejected';
type OrderType = 'all' | 'market' | 'limit' | 'stop';
type OrderDirection = 'all' | 'buy' | 'sell';

export default function OrderManagement({ visible, onClose, orders, onCancelOrder }: OrderManagementProps) {
  const [searchText, setSearchText] = useState('');
  const [statusFilter, setStatusFilter] = useState<OrderStatus>('all');
  const [typeFilter, setTypeFilter] = useState<OrderType>('all');
  const [directionFilter, setDirectionFilter] = useState<OrderDirection>('all');
  const [dateRange, setDateRange] = useState<[Date, Date] | null>(null);
  const [sortBy, setSortBy] = useState<'createTime' | 'price' | 'quantity'>('createTime');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [selectedRowKeys, setSelectedRowKeys] = useState<(string | number)[]>([]);

  const statusMap: Record<OrderStatus, string> = {
    all: '全部',
    pending: '待成交',
    filled: '已成交',
    cancelled: '已取消',
    rejected: '已拒绝',
  };

  const typeMap: Record<OrderType, string> = {
    all: '全部',
    market: '市价单',
    limit: '限价单',
    stop: '止损单',
  };

  const directionMap: Record<OrderDirection, string> = {
    all: '全部',
    buy: '买入',
    sell: '卖出',
  };

  const getStatusTag = (status: string) => {
    const statusConfig: Record<string, { text: string; theme: any }> = {
      pending: { text: '待成交', theme: 'warning' },
      filled: { text: '已成交', theme: 'success' },
      cancelled: { text: '已取消', theme: 'default' },
      rejected: { text: '已拒绝', theme: 'danger' },
    };
    const config = statusConfig[status] || { text: '未知', theme: 'default' };
    return <Tag theme={config.theme} variant="light">{config.text}</Tag>;
  };

  const getTypeTag = (type: string) => {
    const typeConfig: Record<string, { text: string; theme: any }> = {
      market: { text: '市价', theme: 'primary' },
      limit: { text: '限价', theme: 'cyan' },
      stop: { text: '止损', theme: 'danger' },
    };
    const config = typeConfig[type] || { text: type, theme: 'default' };
    return <Tag theme={config.theme} variant="light">{config.text}</Tag>;
  };

  const filteredOrders = useMemo(() => {
    let result = [...orders];

    if (statusFilter !== 'all') {
      result = result.filter(order => order.status === statusFilter);
    }

    if (typeFilter !== 'all') {
      result = result.filter(order => order.orderType === typeFilter);
    }

    if (directionFilter !== 'all') {
      result = result.filter(order => order.type === directionFilter);
    }

    if (searchText) {
      const searchLower = searchText.toLowerCase();
      result = result.filter(order =>
        order.symbol.toLowerCase().includes(searchLower) ||
        order.id.toString().includes(searchLower) ||
        (order.orderId && order.orderId.toString().includes(searchLower))
      );
    }

    if (dateRange && dateRange[0] && dateRange[1]) {
      const [start, end] = dateRange;
      result = result.filter(order => {
        const orderDate = new Date(order.createTime);
        return orderDate >= start && orderDate <= end;
      });
    }

    result.sort((a, b) => {
      let comparison = 0;
      switch (sortBy) {
        case 'createTime':
          comparison = new Date(a.createTime).getTime() - new Date(b.createTime).getTime();
          break;
        case 'price':
          comparison = a.price - b.price;
          break;
        case 'quantity':
          comparison = a.quantity - b.quantity;
          break;
      }
      return sortOrder === 'asc' ? comparison : -comparison;
    });

    return result;
  }, [orders, statusFilter, typeFilter, directionFilter, searchText, dateRange, sortBy, sortOrder]);

  const statistics = useMemo(() => {
    return {
      total: orders.length,
      pending: orders.filter(o => o.status === 'pending').length,
      filled: orders.filter(o => o.status === 'filled').length,
      cancelled: orders.filter(o => o.status === 'cancelled').length,
      rejected: orders.filter(o => o.status === 'rejected').length,
    };
  }, [orders]);

  const columns = [
    {
      colKey: 'id',
      title: '订单号',
      width: 120,
      cell: ({ row }: { row: Order }) => (
        <span className="font-mono text-xs">{row.id}</span>
      ),
    },
    {
      colKey: 'symbol',
      title: '品种',
      width: 80,
      cell: ({ row }: { row: Order }) => (
        <span className="font-semibold text-sm">{row.symbol}</span>
      ),
    },
    {
      colKey: 'type',
      title: '方向',
      width: 60,
      cell: ({ row }: { row: Order }) => (
        <Tag theme={row.type === 'buy' ? 'danger' : 'success'} variant="light">
          {row.type === 'buy' ? '买' : '卖'}
        </Tag>
      ),
    },
    {
      colKey: 'orderType',
      title: '类型',
      width: 70,
      cell: ({ row }: { row: Order }) => getTypeTag(row.orderType),
    },
    {
      colKey: 'price',
      title: '价格',
      width: 100,
      cell: ({ row }: { row: Order }) => (
        <span className="font-mono text-sm">{formatPrice(row.price)}</span>
      ),
    },
    {
      colKey: 'quantity',
      title: '数量',
      width: 70,
      cell: ({ row }: { row: Order }) => (
        <span className="font-mono text-sm">{row.quantity}手</span>
      ),
    },
    {
      colKey: 'margin',
      title: '保证金',
      width: 100,
      cell: ({ row }: { row: Order }) => (
        <span className="font-mono text-sm text-amber-500">
          {row.margin ? formatCurrency(row.margin) : '--'}
        </span>
      ),
    },
    {
      colKey: 'status',
      title: '状态',
      width: 80,
      cell: ({ row }: { row: Order }) => getStatusTag(row.status),
    },
    {
      colKey: 'createTime',
      title: '时间',
      width: 150,
      cell: ({ row }: { row: Order }) => {
        const date = new Date(row.createTime);
        return (
          <span className="text-xs text-neutral-500">
            {date.toLocaleString('zh-CN', {
              month: '2-digit',
              day: '2-digit',
              hour: '2-digit',
              minute: '2-digit',
              second: '2-digit',
            })}
          </span>
        );
      },
    },
    {
      colKey: 'action',
      title: '操作',
      width: 80,
      fixed: 'right' as const,
      cell: ({ row }: { row: Order }) => (
        row.status === 'pending' && (
          <Button
            size="small"
            theme="danger"
            variant="light"
            onClick={() => onCancelOrder(row)}
          >
            取消
          </Button>
        )
      ),
    },
  ];

  const handleReset = () => {
    setSearchText('');
    setStatusFilter('all');
    setTypeFilter('all');
    setDirectionFilter('all');
    setDateRange(null);
    setSortBy('createTime');
    setSortOrder('desc');
    setSelectedRowKeys([]);
  };

  const handleExport = () => {
    const dataToExport = filteredOrders.map(order => ({
      订单号: order.id,
      品种: order.symbol,
      方向: order.type === 'buy' ? '买入' : '卖出',
      类型: typeMap[order.orderType as OrderType] || order.orderType,
      价格: order.price,
      数量: order.quantity,
      保证金: order.margin || 0,
      状态: statusMap[order.status as OrderStatus] || order.status,
      创建时间: order.createTime,
    }));

    const csvContent = [
      Object.keys(dataToExport[0] || {}).join(','),
      ...dataToExport.map(row => Object.values(row).join(',')),
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `订单记录_${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
  };

  return (
    <Modal
      visible={visible}
      onClose={onClose}
      header="订单管理"
      width="95vw"
      style={{ maxWidth: '1200px' }}
      footer={null}
      className="order-management-modal"
    >
      <div className="p-4 space-y-4">
        <Card>
          <Space direction="vertical" style={{ width: '100%' }} size="large">
            <div className="flex gap-4 items-end">
              <div className="flex-1">
                <Input
                  prefixIcon={<SearchIcon />}
                  placeholder="搜索订单号、品种..."
                  value={searchText}
                  onChange={setSearchText}
                  clearable
                />
              </div>
              <Select
                value={statusFilter}
                onChange={setStatusFilter}
                style={{ width: 120 }}
                options={Object.entries(statusMap).map(([key, label]) => ({ label, value: key }))}
                placeholder="订单状态"
              />
              <Select
                value={typeFilter}
                onChange={setTypeFilter}
                style={{ width: 120 }}
                options={Object.entries(typeMap).map(([key, label]) => ({ label, value: key }))}
                placeholder="订单类型"
              />
              <Select
                value={directionFilter}
                onChange={setDirectionFilter}
                style={{ width: 100 }}
                options={Object.entries(directionMap).map(([key, label]) => ({ label, value: key }))}
                placeholder="买卖方向"
              />
            </div>

            <div className="grid grid-cols-6 gap-4">
              <div className="col-span-2">
                <DatePicker
                  mode="date"
                  range
                  placeholder={['开始日期', '结束日期']}
                  value={dateRange}
                  onChange={setDateRange}
                  enableTimePicker={false}
                />
              </div>
              <div className="col-span-4 flex gap-2 justify-end">
                <Select
                  value={sortBy}
                  onChange={setSortBy}
                  style={{ width: 120 }}
                  options={[
                    { label: '创建时间', value: 'createTime' },
                    { label: '价格', value: 'price' },
                    { label: '数量', value: 'quantity' },
                  ]}
                  placeholder="排序方式"
                />
                <Button
                  icon={sortOrder === 'asc' ? '⬆️' : '⬇️'}
                  variant="outline"
                  onClick={() => setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')}
                >
                  {sortOrder === 'asc' ? '升序' : '降序'}
                </Button>
                <Button
                  icon={<RefreshIcon />}
                  variant="outline"
                  onClick={handleReset}
                >
                  重置
                </Button>
                <Button
                  icon={<DownloadIcon />}
                  theme="primary"
                  onClick={handleExport}
                  disabled={filteredOrders.length === 0}
                >
                  导出
                </Button>
              </div>
            </div>
          </Space>
        </Card>

        <Card>
          <div className="grid grid-cols-5 gap-4 mb-4">
            <Statistic title="总订单数" value={statistics.total} />
            <Statistic title="待成交" value={statistics.pending} theme="warning" />
            <Statistic title="已成交" value={statistics.filled} theme="success" />
            <Statistic title="已取消" value={statistics.cancelled} theme="default" />
            <Statistic title="已拒绝" value={statistics.rejected} theme="danger" />
          </div>
        </Card>

        <Card>
          <Table
            data={filteredOrders}
            columns={columns}
            rowKey="id"
            pagination={{
              pageSize: 10,
              total: filteredOrders.length,
              showJumper: true,
              showPageSize: true,
              pageSizeOptions: [10, 20, 50, 100],
            }}
            selectedRowKeys={selectedRowKeys}
            onSelectChange={setSelectedRowKeys}
            bordered
            stripe
            hover
            size="small"
          />
        </Card>
      </div>
    </Modal>
  );
}
