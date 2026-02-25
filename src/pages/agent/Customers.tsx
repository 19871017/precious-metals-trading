import { useState, useEffect } from 'react';
import {
  Card,
  Table,
  Input,
  Button,
  Space,
  Tag,
  Select,
  DatePicker,
  Dialog,
  Descriptions,
  Message
} from 'tdesign-react';
import {
  SearchIcon,
  RefreshIcon,
  UserIcon,
  MoneyCircleIcon,
  ShopIcon,
  ChartIcon
} from 'tdesign-icons-react';
import axios from 'axios';

interface Customer {
  id: number;
  userId: number;
  username: string;
  realName: string;
  phone: string;
  email?: string;
  balance: number;
  availableBalance: number;
  totalDeposit: number;
  totalWithdraw: number;
  totalVolume: number;
  orderCount: number;
  registerTime: string;
  lastTradeTime?: string;
  status: number;
}

interface Statistics {
  totalCustomers: number;
  totalBalance: number;
  totalVolume: number;
  todayNewCustomers: number;
}

export default function AgentCustomers() {
  const [loading, setLoading] = useState(false);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [statistics, setStatistics] = useState<Statistics | null>(null);

  // 搜索条件
  const [searchKeyword, setSearchKeyword] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [dateRange, setDateRange] = useState<any[]>([]);

  // 分页
  const [pagination, setPagination] = useState({
    current: 1,
    pageSize: 20,
    total: 0
  });

  // 客户详情弹窗
  const [detailVisible, setDetailVisible] = useState(false);
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);

  // 加载客户列表
  const loadCustomers = async () => {
    setLoading(true);
    try {
      const params: any = {
        page: pagination.current,
        pageSize: pagination.pageSize
      };

      if (searchKeyword) {
        params.keyword = searchKeyword;
      }
      if (filterStatus) {
        params.status = filterStatus;
      }
      if (dateRange && dateRange.length === 2) {
        params.startDate = dateRange[0];
        params.endDate = dateRange[1];
      }

      const response = await axios.get('/api/agent/customers', { params });

      if (response.data.code === 0) {
        setCustomers(response.data.data.list || []);
        setStatistics(response.data.data.statistics);
        setPagination({
          ...pagination,
          total: response.data.data.total || 0
        });
      }
    } catch (error) {
      console.error('加载客户列表失败:', error);
      Message.error('加载客户列表失败');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadCustomers();
  }, [pagination.current, pagination.pageSize]);

  // 搜索
  const handleSearch = () => {
    setPagination({ ...pagination, current: 1 });
    loadCustomers();
  };

  // 重置
  const handleReset = () => {
    setSearchKeyword('');
    setFilterStatus('');
    setDateRange([]);
    setPagination({ ...pagination, current: 1 });
  };

  // 查看详情
  const handleViewDetail = (customer: Customer) => {
    setSelectedCustomer(customer);
    setDetailVisible(true);
  };

  // 格式化货币
  const formatCurrency = (value: number) => {
    return `¥${value.toFixed(2)}`;
  };

  // 表格列定义
  const columns = [
    {
      colKey: 'userId',
      title: '用户ID',
      width: 80,
      fixed: 'left' as const
    },
    {
      colKey: 'username',
      title: '用户名',
      width: 120,
      fixed: 'left' as const
    },
    {
      colKey: 'realName',
      title: '真实姓名',
      width: 100
    },
    {
      colKey: 'phone',
      title: '手机号',
      width: 120,
      ellipsis: true
    },
    {
      colKey: 'balance',
      title: '账户余额',
      width: 120,
      cell: ({ row }: any) => formatCurrency(row.balance)
    },
    {
      colKey: 'availableBalance',
      title: '可用余额',
      width: 120,
      cell: ({ row }: any) => formatCurrency(row.availableBalance)
    },
    {
      colKey: 'totalVolume',
      title: '总交易量',
      width: 120,
      cell: ({ row }: any) => `¥${(row.totalVolume || 0).toLocaleString()}`
    },
    {
      colKey: 'orderCount',
      title: '订单数',
      width: 80,
      align: 'center' as const
    },
    {
      colKey: 'status',
      title: '状态',
      width: 80,
      cell: ({ row }: any) => (
        <Tag
          theme={row.status === 1 ? 'success' : 'default'}
        >
          {row.status === 1 ? '正常' : '禁用'}
        </Tag>
      )
    },
    {
      colKey: 'registerTime',
      title: '注册时间',
      width: 160,
      ellipsis: true
    },
    {
      colKey: 'action',
      title: '操作',
      width: 120,
      fixed: 'right' as const,
      cell: ({ row }: any) => (
        <Space>
          <Button
            variant="text"
            theme="primary"
            size="small"
            onClick={() => handleViewDetail(row)}
          >
            详情
          </Button>
        </Space>
      )
    }
  ];

  return (
    <div>
      {/* 统计卡片 */}
      {statistics && (
        <Card bordered={false} style={{ marginBottom: '16px' }}>
          <Space size="large">
            <div>
              <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#0052d9' }}>
                {statistics.totalCustomers}
              </div>
              <div style={{ fontSize: '12px', color: '#666' }}>总客户数</div>
            </div>
            <div>
              <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#22c55e' }}>
                {statistics.todayNewCustomers}
              </div>
              <div style={{ fontSize: '12px', color: '#666' }}>今日新增</div>
            </div>
            <div>
              <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#fbbf24' }}>
                ¥{statistics.totalBalance.toFixed(2)}
              </div>
              <div style={{ fontSize: '12px', color: '#666' }}>总余额</div>
            </div>
            <div>
              <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#f97316' }}>
                ¥{(statistics.totalVolume || 0).toLocaleString()}
              </div>
              <div style={{ fontSize: '12px', color: '#666' }}>总交易量</div>
            </div>
          </Space>
        </Card>
      )}

      {/* 客户列表 */}
      <Card title="客户列表" bordered={false}>
        {/* 搜索栏 */}
        <Space style={{ marginBottom: '16px', width: '100%' }}>
          <Input
            placeholder="搜索用户名/真实姓名/手机号"
            value={searchKeyword}
            onChange={setSearchKeyword}
            style={{ width: '250px' }}
            clearable
          />
          <Select
            placeholder="状态筛选"
            value={filterStatus}
            onChange={setFilterStatus}
            style={{ width: '120px' }}
            clearable
          >
            <Select.Option value="1">正常</Select.Option>
            <Select.Option value="0">禁用</Select.Option>
          </Select>
          <DatePicker
            range
            placeholder={['开始日期', '结束日期']}
            value={dateRange}
            onChange={setDateRange}
          />
          <Button icon={<SearchIcon />} onClick={handleSearch}>
            搜索
          </Button>
          <Button icon={<RefreshIcon />} onClick={loadCustomers}>
            刷新
          </Button>
          <Button variant="dashed" onClick={handleReset}>
            重置
          </Button>
        </Space>

        {/* 表格 */}
        <Table
          columns={columns}
          data={customers}
          loading={loading}
          pagination={{
            current: pagination.current,
            pageSize: pagination.pageSize,
            total: pagination.total,
            showSizeChanger: true,
            onPageSizeChange: (size) => {
              setPagination({ ...pagination, pageSize: size, current: 1 });
            },
            onChange: (page) => {
              setPagination({ ...pagination, current: page });
            }
          }}
          rowKey="id"
          scroll={{ x: 1200 }}
        />
      </Card>

      {/* 客户详情弹窗 */}
      <Dialog
        header="客户详情"
        visible={detailVisible}
        onClose={() => setDetailVisible(false)}
        width="95vw"
        style={{ maxWidth: '700px' }}
        footer={null}
      >
        {selectedCustomer && (
          <Descriptions column={2} bordered>
            <Descriptions.Item label="用户ID">{selectedCustomer.userId}</Descriptions.Item>
            <Descriptions.Item label="用户名">{selectedCustomer.username}</Descriptions.Item>
            <Descriptions.Item label="真实姓名">{selectedCustomer.realName}</Descriptions.Item>
            <Descriptions.Item label="手机号">{selectedCustomer.phone}</Descriptions.Item>
            <Descriptions.Item label="邮箱">{selectedCustomer.email || '-'}</Descriptions.Item>
            <Descriptions.Item label="状态">
              <Tag theme={selectedCustomer.status === 1 ? 'success' : 'default'}>
                {selectedCustomer.status === 1 ? '正常' : '禁用'}
              </Tag>
            </Descriptions.Item>
            <Descriptions.Item label="账户余额">
              <span style={{ color: '#0052d9', fontWeight: 'bold' }}>
                {formatCurrency(selectedCustomer.balance)}
              </span>
            </Descriptions.Item>
            <Descriptions.Item label="可用余额">
              <span style={{ color: '#22c55e', fontWeight: 'bold' }}>
                {formatCurrency(selectedCustomer.availableBalance)}
              </span>
            </Descriptions.Item>
            <Descriptions.Item label="总充值">
              {formatCurrency(selectedCustomer.totalDeposit || 0)}
            </Descriptions.Item>
            <Descriptions.Item label="总提现">
              {formatCurrency(selectedCustomer.totalWithdraw || 0)}
            </Descriptions.Item>
            <Descriptions.Item label="总交易量">
              ¥{(selectedCustomer.totalVolume || 0).toLocaleString()}
            </Descriptions.Item>
            <Descriptions.Item label="订单数">{selectedCustomer.orderCount}</Descriptions.Item>
            <Descriptions.Item label="注册时间" span={2}>
              {selectedCustomer.registerTime}
            </Descriptions.Item>
            <Descriptions.Item label="最后交易时间" span={2}>
              {selectedCustomer.lastTradeTime || '暂无'}
            </Descriptions.Item>
          </Descriptions>
        )}
      </Dialog>
    </div>
  );
}
