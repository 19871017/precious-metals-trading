import { useState, useEffect } from 'react';
import { Card, Row, Col, Statistic, DatePicker, Button, Space, Select } from 'tdesign-react';
import { DownloadIcon, RefreshIcon } from 'tdesign-icons-react';
import ReactECharts from 'echarts-for-react';
import { formatCurrency, formatNumber } from '../../utils/format';

interface CustomerStatisticsProps {
  period?: 'today' | 'week' | 'month' | 'all';
}

interface StatisticsData {
  totalCustomers: number;
  activeCustomers: number;
  newCustomers: number;
  totalBalance: number;
  totalDeposit: number;
  totalWithdraw: number;
  totalVolume: number;
  totalCommission: number;
  depositTrend: { date: string; amount: number }[];
  customerTrend: { date: string; count: number }[];
  volumeByProduct: { name: string; value: number }[];
}

export default function CustomerStatistics({ period = 'all' }: CustomerStatisticsProps) {
  const [loading, setLoading] = useState(false);
  const [statistics, setStatistics] = useState<StatisticsData | null>(null);
  const [selectedPeriod, setSelectedPeriod] = useState<'today' | 'week' | 'month' | 'all'>(period);

  const loadStatistics = async () => {
    setLoading(true);
    try {
      const response = await fetch(`/api/agent/statistics?period=${selectedPeriod}`);
      if (response.ok) {
        const data = await response.json();
        if (data.code === 0) {
          setStatistics(data.data);
        }
      }
    } catch (error) {
      console.error('加载统计数据失败:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadStatistics();
  }, [selectedPeriod]);

  const depositTrendOption = {
    backgroundColor: 'transparent',
    tooltip: {
      trigger: 'axis',
      backgroundColor: 'rgba(23, 23, 23, 0.95)',
      borderColor: '#444',
      borderWidth: 1,
      textStyle: { color: '#e5e5e5', fontSize: 11 },
      formatter: (params: any) => {
        const data = params[0];
        return `
          <div style="padding: 4px 8px;">
            <div style="font-size: 10px; color: #888; margin-bottom: 4px;">${data.axisValue}</div>
            <div style="display: flex; align-items: center; gap: 8px;">
              <span style="font-size: 10px; color: #888;">充值金额:</span>
              <span style="font-size: 12px; font-weight: bold; color: #22c55e; font-family: monospace;">
                ¥${formatNumber(data.value)}
              </span>
            </div>
          </div>
        `;
      },
    },
    grid: {
      left: '3%',
      right: '4%',
      bottom: '3%',
      top: '10%',
      containLabel: true,
    },
    xAxis: {
      type: 'category',
      boundaryGap: false,
      data: statistics?.depositTrend?.map(d => d.date) || [],
      axisLine: { lineStyle: { color: '#2a2a2a' } },
      axisLabel: { color: '#888', fontSize: 10 },
      axisTick: { show: false },
    },
    yAxis: {
      type: 'value',
      axisLine: { show: false },
      axisLabel: { color: '#888', fontSize: 10, formatter: (v: number) => formatNumber(v) },
      splitLine: { lineStyle: { color: '#1a1a1a', type: 'dashed' } },
    },
    series: [
      {
        name: '充值金额',
        type: 'line',
        smooth: true,
        data: statistics?.depositTrend?.map(d => d.amount) || [],
        areaStyle: {
          color: {
            type: 'linear',
            x: 0,
            y: 0,
            x2: 0,
            y2: 1,
            colorStops: [
              { offset: 0, color: 'rgba(34, 197, 94, 0.3)' },
              { offset: 1, color: 'rgba(34, 197, 94, 0.05)' },
            ],
          },
        },
        lineStyle: { color: '#22c55e', width: 2 },
        itemStyle: { color: '#22c55e' },
      },
    ],
  };

  const customerTrendOption = {
    backgroundColor: 'transparent',
    tooltip: {
      trigger: 'axis',
      backgroundColor: 'rgba(23, 23, 23, 0.95)',
      borderColor: '#444',
      borderWidth: 1,
      textStyle: { color: '#e5e5e5', fontSize: 11 },
    },
    grid: {
      left: '3%',
      right: '4%',
      bottom: '3%',
      top: '10%',
      containLabel: true,
    },
    xAxis: {
      type: 'category',
      boundaryGap: true,
      data: statistics?.customerTrend?.map(d => d.date) || [],
      axisLine: { lineStyle: { color: '#2a2a2a' } },
      axisLabel: { color: '#888', fontSize: 10 },
      axisTick: { show: false },
    },
    yAxis: {
      type: 'value',
      axisLine: { show: false },
      axisLabel: { color: '#888', fontSize: 10 },
      splitLine: { lineStyle: { color: '#1a1a1a', type: 'dashed' } },
    },
    series: [
      {
        name: '新增客户',
        type: 'bar',
        data: statistics?.customerTrend?.map(d => d.count) || [],
        itemStyle: {
          color: {
            type: 'linear',
            x: 0,
            y: 0,
            x2: 0,
            y2: 1,
            colorStops: [
              { offset: 0, color: '#f59e0b' },
              { offset: 1, color: '#d97706' },
            ],
          },
          borderRadius: [4, 4, 0, 0],
        },
        barMaxWidth: 30,
      },
    ],
  };

  const volumeByProductOption = {
    backgroundColor: 'transparent',
    tooltip: {
      trigger: 'item',
      backgroundColor: 'rgba(23, 23, 23, 0.95)',
      borderColor: '#444',
      borderWidth: 1,
      textStyle: { color: '#e5e5e5', fontSize: 11 },
      formatter: '{b}: {c}手 ({d}%)',
    },
    legend: {
      orient: 'vertical',
      right: '5%',
      top: 'center',
      textStyle: { color: '#888', fontSize: 10 },
    },
    series: [
      {
        name: '交易量',
        type: 'pie',
        radius: ['40%', '70%'],
        center: ['40%', '50%'],
        data: statistics?.volumeByProduct || [],
        itemStyle: {
          borderRadius: 5,
          borderColor: '#171717',
          borderWidth: 2,
        },
        label: {
          show: false,
        },
        emphasis: {
          label: {
            show: true,
            fontSize: 12,
            fontWeight: 'bold',
            color: '#fff',
          },
        },
      },
    ],
  };

  const handleExport = () => {
    if (!statistics) return;

    const dataToExport = {
      统计周期: selectedPeriod,
      导出时间: new Date().toLocaleString('zh-CN'),
      总客户数: statistics.totalCustomers,
      活跃客户数: statistics.activeCustomers,
      新增客户数: statistics.newCustomers,
      总余额: statistics.totalBalance,
      总充值: statistics.totalDeposit,
      总提现: statistics.totalWithdraw,
      总交易量: statistics.totalVolume,
      总佣金: statistics.totalCommission,
    };

    const csvContent = [
      Object.keys(dataToExport).join(','),
      Object.values(dataToExport).join(','),
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `客户统计_${selectedPeriod}_${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
  };

  return (
    <div className="space-y-4">
      <Card>
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-base font-semibold text-neutral-200">客户统计报表</h3>
          <Space>
            <Select
              value={selectedPeriod}
              onChange={setSelectedPeriod}
              size="small"
              options={[
                { label: '今日', value: 'today' },
                { label: '近7天', value: 'week' },
                { label: '近30天', value: 'month' },
                { label: '全部', value: 'all' },
              ]}
            />
            <Button
              icon={<RefreshIcon />}
              variant="outline"
              size="small"
              onClick={loadStatistics}
              loading={loading}
            >
              刷新
            </Button>
            <Button
              icon={<DownloadIcon />}
              theme="primary"
              size="small"
              onClick={handleExport}
              disabled={!statistics}
            >
              导出
            </Button>
          </Space>
        </div>

        <Row gutter={[16, 16]}>
          <Col span={6}>
            <Statistic
              title="总客户数"
              value={statistics?.totalCustomers || 0}
              theme="default"
              suffix="人"
            />
          </Col>
          <Col span={6}>
            <Statistic
              title="活跃客户"
              value={statistics?.activeCustomers || 0}
              theme="success"
              suffix="人"
            />
          </Col>
          <Col span={6}>
            <Statistic
              title="新增客户"
              value={statistics?.newCustomers || 0}
              theme="warning"
              suffix="人"
            />
          </Col>
          <Col span={6}>
            <Statistic
              title="总余额"
              value={statistics?.totalBalance || 0}
              theme="primary"
              formatter={(value) => `¥${formatNumber(value)}`}
            />
          </Col>
        </Row>

        <Row gutter={[16, 16]} className="mt-4">
          <Col span={6}>
            <Statistic
              title="总充值"
              value={statistics?.totalDeposit || 0}
              theme="success"
              formatter={(value) => `¥${formatNumber(value)}`}
            />
          </Col>
          <Col span={6}>
            <Statistic
              title="总提现"
              value={statistics?.totalWithdraw || 0}
              theme="danger"
              formatter={(value) => `¥${formatNumber(value)}`}
            />
          </Col>
          <Col span={6}>
            <Statistic
              title="总交易量"
              value={statistics?.totalVolume || 0}
              theme="default"
              suffix="手"
            />
          </Col>
          <Col span={6}>
            <Statistic
              title="总佣金"
              value={statistics?.totalCommission || 0}
              theme="primary"
              formatter={(value) => `¥${formatNumber(value)}`}
            />
          </Col>
        </Row>
      </Card>

      <Row gutter={[16, 16]}>
        <Col span={12}>
          <Card title="充值趋势" headerBordered>
            <ReactECharts
              option={depositTrendOption}
              style={{ height: '300px' }}
              lazyUpdate
            />
          </Card>
        </Col>
        <Col span={12}>
          <Card title="客户增长" headerBordered>
            <ReactECharts
              option={customerTrendOption}
              style={{ height: '300px' }}
              lazyUpdate
            />
          </Card>
        </Col>
      </Row>

      <Card title="交易量分布" headerBordered>
        <ReactECharts
          option={volumeByProductOption}
          style={{ height: '400px' }}
          lazyUpdate
        />
      </Card>
    </div>
  );
}
