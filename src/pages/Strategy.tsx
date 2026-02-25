import React, { useState, useEffect, useRef } from 'react';
import {
  Card,
  Button,
  Select,
  DatePicker,
  InputNumber,
  Space,
  Table,
  Row,
  Col,
  Statistic,
  Tabs,
  Divider,
  MessagePlugin,
} from 'tdesign-react';
import { PlayCircleIcon } from 'tdesign-icons-react';
import * as echarts from 'echarts';
import {
  BacktestConfig,
  BacktestResult,
  KLineData,
  STRATEGY_PARAMS,
  runBacktest,
  optimizeStrategy,
} from '../services/strategy.service';
import { fetchKLineData } from '../services/shuhai.service';

const { Option } = Select;
const { DatePickerRangePicker } = DatePicker;

const Strategy: React.FC = () => {
  // 策略选择
  const [selectedStrategy, setSelectedStrategy] = useState<string>('maCross');
  const [selectedSymbol, setSelectedSymbol] = useState<string>('AG2406');

  // 回测配置
  const [backtestConfig, setBacktestConfig] = useState<Partial<BacktestConfig>>({
    initialCapital: 100000,
    commission: 0.001,
    slippage: 0,
    leverage: 1,
  });

  // 日期范围
  const [dateRange, setDateRange] = useState<[Date, Date]>([
    new Date(Date.now() - 90 * 24 * 60 * 60 * 1000),
    new Date(),
  ]);

  // 回测结果
  const [backtestResult, setBacktestResult] = useState<BacktestResult | null>(null);
  const [isBacktesting, setIsBacktesting] = useState(false);

  // 优化结果
  const [optimizationResults, setOptimizationResults] = useState<any[]>([]);
  const [isOptimizing, setIsOptimizing] = useState(false);

  // 图表引用
  const equityChartRef = useRef<HTMLDivElement>(null);
  const drawdownChartRef = useRef<HTMLDivElement>(null);
  const monthlyChartRef = useRef<HTMLDivElement>(null);
  const equityChartInstance = useRef<echarts.ECharts | null>(null);
  const drawdownChartInstance = useRef<echarts.ECharts | null>(null);
  const monthlyChartInstance = useRef<echarts.ECharts | null>(null);

  // 初始化图表
  useEffect(() => {
    if (equityChartRef.current) {
      equityChartInstance.current = echarts.init(equityChartRef.current);
    }
    if (drawdownChartRef.current) {
      drawdownChartInstance.current = echarts.init(drawdownChartRef.current);
    }
    if (monthlyChartRef.current) {
      monthlyChartInstance.current = echarts.init(monthlyChartRef.current);
    }

    const handleResize = () => {
      equityChartInstance.current?.resize();
      drawdownChartInstance.current?.resize();
      monthlyChartInstance.current?.resize();
    };

    window.addEventListener('resize', handleResize);

    return () => {
      equityChartInstance.current?.dispose();
      drawdownChartInstance.current?.dispose();
      monthlyChartInstance.current?.dispose();
      window.removeEventListener('resize', handleResize);
    };
  }, []);

  // 更新权益曲线图表
  useEffect(() => {
    if (backtestResult && equityChartInstance.current) {
      const dates = backtestResult.equityCurve.map(c => c.date);
      const equity = backtestResult.equityCurve.map(c => c.equity);

      equityChartInstance.current.setOption({
        title: {
          text: '权益曲线',
          left: 'center',
        },
        tooltip: {
          trigger: 'axis',
        },
        xAxis: {
          type: 'category',
          data: dates,
          axisLabel: {
            rotate: 45,
          },
        },
        yAxis: {
          type: 'value',
          name: '权益(元)',
        },
        series: [
          {
            name: '权益',
            type: 'line',
            data: equity,
            smooth: true,
            lineStyle: {
              color: '#00f29a',
              width: 2,
            },
            areaStyle: {
              color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
                { offset: 0, color: 'rgba(0, 242, 154, 0.3)' },
                { offset: 1, color: 'rgba(0, 242, 154, 0.1)' },
              ]),
            },
          },
        ],
      });
    }
  }, [backtestResult]);

  // 更新回撤图表
  useEffect(() => {
    if (backtestResult && drawdownChartInstance.current) {
      const dates = backtestResult.equityCurve.map(c => c.date);
      const drawdown = backtestResult.equityCurve.map(c => c.drawdown);

      drawdownChartInstance.current.setOption({
        title: {
          text: '回撤曲线',
          left: 'center',
        },
        tooltip: {
          trigger: 'axis',
          formatter: (params: any) => {
            return `${params[0].axisValue}<br/>回撤: ${params[0].value.toFixed(2)}%`;
          },
        },
        xAxis: {
          type: 'category',
          data: dates,
          axisLabel: {
            rotate: 45,
          },
        },
        yAxis: {
          type: 'value',
          name: '回撤(%)',
          max: 100,
        },
        series: [
          {
            name: '回撤',
            type: 'line',
            data: drawdown,
            smooth: true,
            lineStyle: {
              color: '#f5222d',
              width: 2,
            },
            areaStyle: {
              color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
                { offset: 0, color: 'rgba(245, 34, 45, 0.3)' },
                { offset: 1, color: 'rgba(245, 34, 45, 0.1)' },
              ]),
            },
          },
        ],
      });
    }
  }, [backtestResult]);

  // 更新月度收益图表
  useEffect(() => {
    if (backtestResult && monthlyChartInstance.current) {
      const months = backtestResult.monthlyReturns.map(m => m.month);
      const returns = backtestResult.monthlyReturns.map(m => m.return);

      monthlyChartInstance.current.setOption({
        title: {
          text: '月度收益',
          left: 'center',
        },
        tooltip: {
          trigger: 'axis',
          formatter: (params: any) => {
            const value = params[0].value;
            const color = value >= 0 ? '#00f29a' : '#f5222d';
            return `${params[0].axisValue}<br/>收益: <span style="color:${color}">${value.toFixed(2)}%</span>`;
          },
        },
        xAxis: {
          type: 'category',
          data: months,
        },
        yAxis: {
          type: 'value',
          name: '收益率(%)',
        },
        series: [
          {
            name: '收益',
            type: 'bar',
            data: returns.map(v => ({
              value: v,
              itemStyle: {
                color: v >= 0 ? '#00f29a' : '#f5222d',
              },
            })),
          },
        ],
      });
    }
  }, [backtestResult]);

  // 运行回测
  const handleRunBacktest = async () => {
    if (!dateRange || dateRange.length !== 2) {
      MessagePlugin.warning('请选择日期范围');
      return;
    }

    setIsBacktesting(true);

    try {
      // 获取K线数据
      const endDate = Math.floor(dateRange[1].getTime() / 1000);
      const startDate = Math.floor(dateRange[0].getTime() / 1000);

      const klineData = await fetchKLineData(selectedSymbol, startDate, endDate, '1h');

      if (!klineData || klineData.length === 0) {
        MessagePlugin.error('未获取到K线数据');
        setIsBacktesting(false);
        return;
      }

      // 转换数据格式
      const formattedData: KLineData[] = klineData.map(item => ({
        timestamp: item[0],
        open: item[1],
        high: item[2],
        low: item[3],
        close: item[4],
        volume: item[5],
      }));

      // 运行回测
      const config: BacktestConfig = {
        symbol: selectedSymbol,
        strategy: selectedStrategy,
        startDate: dateRange[0].toISOString().split('T')[0],
        endDate: dateRange[1].toISOString().split('T')[0],
        initialCapital: backtestConfig.initialCapital || 100000,
        commission: backtestConfig.commission || 0.001,
        slippage: backtestConfig.slippage || 0,
        leverage: backtestConfig.leverage || 1,
      };

      const result = runBacktest(config, formattedData);
      setBacktestResult(result);

      MessagePlugin.success('回测完成');
    } catch (error) {
      console.error('回测失败:', error);
      MessagePlugin.error('回测失败');
    } finally {
      setIsBacktesting(false);
    }
  };

  // 运行策略优化
  const handleOptimize = async () => {
    if (!dateRange || dateRange.length !== 2) {
      MessagePlugin.warning('请选择日期范围');
      return;
    }

    setIsOptimizing(true);

    try {
      // 获取K线数据
      const endDate = Math.floor(dateRange[1].getTime() / 1000);
      const startDate = Math.floor(dateRange[0].getTime() / 1000);

      const klineData = await fetchKLineData(selectedSymbol, startDate, endDate, '1h');

      if (!klineData || klineData.length === 0) {
        MessagePlugin.error('未获取到K线数据');
        setIsOptimizing(false);
        return;
      }

      // 转换数据格式
      const formattedData: KLineData[] = klineData.map(item => ({
        timestamp: item[0],
        open: item[1],
        high: item[2],
        low: item[3],
        close: item[4],
        volume: item[5],
      }));

      // 定义参数范围
      let paramRanges: Record<string, [number, number, number]> = {};

      switch (selectedStrategy) {
        case 'maCross':
          paramRanges = {
            shortPeriod: [3, 10, 1],
            longPeriod: [15, 30, 5],
          };
          break;
        case 'macdStrategy':
          paramRanges = {
            fastPeriod: [8, 16, 2],
            slowPeriod: [20, 32, 4],
          };
          break;
        case 'rsiStrategy':
          paramRanges = {
            period: [10, 20, 2],
          };
          break;
        default:
          MessagePlugin.info('该策略暂不支持参数优化');
          setIsOptimizing(false);
          return;
      }

      const results = optimizeStrategy(formattedData, selectedStrategy, paramRanges);
      setOptimizationResults(results);

      MessagePlugin.success('优化完成');
    } catch (error) {
      console.error('优化失败:', error);
      MessagePlugin.error('优化失败');
    } finally {
      setIsOptimizing(false);
    }
  };

  // 应用优化参数
  const handleApplyParams = (params: Record<string, number>) => {
    setBacktestConfig(prev => ({
      ...prev,
      ...params,
    }));

    // 更新策略参数
    const strategyParams = STRATEGY_PARAMS[selectedStrategy];
    if (strategyParams) {
      strategyParams.parameters = { ...strategyParams.parameters, ...params };
    }

    MessagePlugin.success('参数已应用,请重新运行回测');
  };

  // 交易记录表格列
  const tradeColumns = [
    {
      colKey: 'id',
      title: '交易ID',
      width: 100,
    },
    {
      colKey: 'type',
      title: '类型',
      width: 80,
      cell: (context: any) => (
        <span style={{ color: context.row.type === 'buy' ? '#00f29a' : '#f5222d' }}>
          {context.row.type === 'buy' ? '买入' : '卖出'}
        </span>
      ),
    },
    {
      colKey: 'entryPrice',
      title: '开仓价',
      width: 100,
      cell: (context: any) => context.row.entryPrice?.toFixed(2),
    },
    {
      colKey: 'exitPrice',
      title: '平仓价',
      width: 100,
      cell: (context: any) => context.row.exitPrice?.toFixed(2) || '-',
    },
    {
      colKey: 'quantity',
      title: '数量',
      width: 80,
    },
    {
      colKey: 'profit',
      title: '盈亏',
      width: 100,
      cell: (context: any) => {
        const profit = context.row.profit;
        return (
          <span style={{ color: profit >= 0 ? '#00f29a' : '#f5222d' }}>
            {profit >= 0 ? '+' : ''}{profit.toFixed(2)}
          </span>
        );
      },
    },
    {
      colKey: 'profitPercent',
      title: '盈亏%',
      width: 100,
      cell: (context: any) => {
        const profitPercent = context.row.profitPercent;
        return (
          <span style={{ color: profitPercent >= 0 ? '#00f29a' : '#f5222d' }}>
            {profitPercent >= 0 ? '+' : ''}{profitPercent.toFixed(2)}%
          </span>
        );
      },
    },
    {
      colKey: 'entryTime',
      title: '开仓时间',
      cell: (context: any) => new Date(context.row.entryTime).toLocaleString(),
    },
  ];

  // 优化结果表格列
  const optimizationColumns = [
    {
      colKey: 'params',
      title: '参数',
      cell: (context: any) => JSON.stringify(context.row.params),
    },
    {
      colKey: 'totalReturn',
      title: '总收益率',
      width: 100,
      cell: (context: any) => `${context.row.result.summary.totalReturn.toFixed(2)}%`,
    },
    {
      colKey: 'sharpeRatio',
      title: '夏普比率',
      width: 100,
      cell: (context: any) => context.row.result.summary.sharpeRatio.toFixed(3),
    },
    {
      colKey: 'maxDrawdown',
      title: '最大回撤',
      width: 100,
      cell: (context: any) => `${context.row.result.summary.maxDrawdown.toFixed(2)}%`,
    },
    {
      colKey: 'winRate',
      title: '胜率',
      width: 80,
      cell: (context: any) => `${context.row.result.summary.winRate.toFixed(1)}%`,
    },
    {
      colKey: 'action',
      title: '操作',
      width: 100,
      cell: (context: any) => (
        <Button size="small" onClick={() => handleApplyParams(context.row.params)}>
          应用
        </Button>
      ),
    },
  ];

  return (
    <div style={{ padding: '20px', backgroundColor: '#121212', minHeight: '100vh' }}>
      <h1 style={{ color: '#fff', marginBottom: '24px' }}>智能交易策略</h1>

      <Row gutter={16}>
        <Col span={6}>
          <Card title="策略配置" theme="dark">
            <Space direction="vertical" style={{ width: '100%' }}>
              <div>
                <div style={{ color: '#fff', marginBottom: '8px' }}>选择策略</div>
                <Select
                  value={selectedStrategy}
                  onChange={setSelectedStrategy}
                  style={{ width: '100%' }}
                >
                  {Object.entries(STRATEGY_PARAMS).map(([key, value]) => (
                    <Option key={key} value={key}>
                      {value.name}
                    </Option>
                  ))}
                </Select>
              </div>

              <div>
                <div style={{ color: '#fff', marginBottom: '8px' }}>选择品种</div>
                <Select
                  value={selectedSymbol}
                  onChange={setSelectedSymbol}
                  style={{ width: '100%' }}
                >
                  <Option value="AG2406">白银2406</Option>
                  <Option value="AU2406">黄金2406</Option>
                  <Option value="CU2406">铜2406</Option>
                  <Option value="ZN2406">锌2406</Option>
                </Select>
              </div>

              <div>
                <div style={{ color: '#fff', marginBottom: '8px' }}>日期范围</div>
                <DatePickerRangePicker
                  value={dateRange}
                  onChange={setDateRange}
                  style={{ width: '100%' }}
                />
              </div>

              <div>
                <div style={{ color: '#fff', marginBottom: '8px' }}>初始资金</div>
                <InputNumber
                  value={backtestConfig.initialCapital}
                  onChange={(value: number) =>
                    setBacktestConfig({ ...backtestConfig, initialCapital: value })
                  }
                  style={{ width: '100%' }}
                />
              </div>

              <div>
                <div style={{ color: '#fff', marginBottom: '8px' }}>手续费率 (%)</div>
                <InputNumber
                  value={backtestConfig.commission}
                  onChange={(value: number) =>
                    setBacktestConfig({ ...backtestConfig, commission: value / 100 })
                  }
                  step={0.001}
                  min={0}
                  style={{ width: '100%' }}
                />
              </div>

              <div>
                <div style={{ color: '#fff', marginBottom: '8px' }}>杠杆倍数</div>
                <InputNumber
                  value={backtestConfig.leverage}
                  onChange={(value: number) =>
                    setBacktestConfig({ ...backtestConfig, leverage: value })
                  }
                  min={1}
                  max={100}
                  style={{ width: '100%' }}
                />
              </div>

              <Button
                theme="primary"
                icon={<PlayCircleIcon />}
                loading={isBacktesting}
                onClick={handleRunBacktest}
                style={{ width: '100%' }}
              >
                运行回测
              </Button>

              <Button
                variant="outline"
                loading={isOptimizing}
                onClick={handleOptimize}
                style={{ width: '100%' }}
              >
                参数优化
              </Button>
            </Space>
          </Card>

          {backtestResult && (
            <Card title="策略描述" theme="dark" style={{ marginTop: '16px' }}>
              <p style={{ color: '#999' }}>
                {STRATEGY_PARAMS[selectedStrategy]?.description}
              </p>
              <Divider />
              <div style={{ color: '#999', fontSize: '12px' }}>
                参数: {JSON.stringify(STRATEGY_PARAMS[selectedStrategy]?.parameters, null, 2)}
              </div>
            </Card>
          )}
        </Col>

        <Col span={18}>
          {backtestResult ? (
            <>
              {/* 核心指标 */}
              <Row gutter={16} style={{ marginBottom: '16px' }}>
                <Col span={4}>
                  <Card theme="dark" hoverShadow>
                    <Statistic
                      title="总收益率"
                      value={backtestResult.summary.totalReturn}
                      suffix="%"
                      trend={backtestResult.summary.totalReturn >= 0 ? 'up' : 'down'}
                      theme={backtestResult.summary.totalReturn >= 0 ? 'success' : 'error'}
                    />
                  </Card>
                </Col>
                <Col span={4}>
                  <Card theme="dark" hoverShadow>
                    <Statistic
                      title="最大回撤"
                      value={backtestResult.summary.maxDrawdown}
                      suffix="%"
                      theme="error"
                    />
                  </Card>
                </Col>
                <Col span={4}>
                  <Card theme="dark" hoverShadow>
                    <Statistic
                      title="夏普比率"
                      value={backtestResult.summary.sharpeRatio}
                      precision={3}
                    />
                  </Card>
                </Col>
                <Col span={4}>
                  <Card theme="dark" hoverShadow>
                    <Statistic
                      title="胜率"
                      value={backtestResult.summary.winRate}
                      suffix="%"
                    />
                  </Card>
                </Col>
                <Col span={4}>
                  <Card theme="dark" hoverShadow>
                    <Statistic
                      title="交易次数"
                      value={backtestResult.summary.totalTrades}
                    />
                  </Card>
                </Col>
                <Col span={4}>
                  <Card theme="dark" hoverShadow>
                    <Statistic
                      title="盈亏比"
                      value={backtestResult.summary.profitFactor}
                      precision={2}
                    />
                  </Card>
                </Col>
              </Row>

              {/* 图表区域 */}
              <Tabs defaultValue="equity" theme="dark" style={{ marginBottom: '16px' }}>
                <Tabs.TabPanel value="equity" label="权益曲线">
                  <Card theme="dark">
                    <div ref={equityChartRef} style={{ height: '400px' }} />
                  </Card>
                </Tabs.TabPanel>
                <Tabs.TabPanel value="drawdown" label="回撤曲线">
                  <Card theme="dark">
                    <div ref={drawdownChartRef} style={{ height: '400px' }} />
                  </Card>
                </Tabs.TabPanel>
                <Tabs.TabPanel value="monthly" label="月度收益">
                  <Card theme="dark">
                    <div ref={monthlyChartRef} style={{ height: '400px' }} />
                  </Card>
                </Tabs.TabPanel>
              </Tabs>

              {/* 详细指标 */}
              <Card title="详细指标" theme="dark" style={{ marginBottom: '16px' }}>
                <Row gutter={16}>
                  <Col span={8}>
                    <Statistic
                      title="年化收益率"
                      value={backtestResult.summary.annualizedReturn}
                      suffix="%"
                      trend={backtestResult.summary.annualizedReturn >= 0 ? 'up' : 'down'}
                    />
                  </Col>
                  <Col span={8}>
                    <Statistic
                      title="平均盈利"
                      value={backtestResult.summary.avgProfit}
                      precision={2}
                      theme="success"
                    />
                  </Col>
                  <Col span={8}>
                    <Statistic
                      title="平均亏损"
                      value={backtestResult.summary.avgLoss}
                      precision={2}
                      theme="error"
                    />
                  </Col>
                </Row>
                <Divider />
                <Row gutter={16}>
                  <Col span={8}>
                    <Statistic title="波动率" value={backtestResult.riskMetrics.volatility.toFixed(2)} suffix="%" />
                  </Col>
                  <Col span={8}>
                    <Statistic title="VaR(95%)" value={backtestResult.riskMetrics.var95.toFixed(2)} />
                  </Col>
                  <Col span={8}>
                    <Statistic title="VaR(99%)" value={backtestResult.riskMetrics.var99.toFixed(2)} />
                  </Col>
                </Row>
              </Card>

              {/* 交易记录 */}
              <Card title="交易记录" theme="dark" style={{ marginBottom: '16px' }}>
                <Table
                  data={backtestResult.trades}
                  columns={tradeColumns}
                  pagination={{
                    pageSize: 10,
                  }}
                  hover
                  theme="dark"
                />
              </Card>

              {/* 优化结果 */}
              {optimizationResults.length > 0 && (
                <Card title="参数优化结果" theme="dark">
                  <Table
                    data={optimizationResults}
                    columns={optimizationColumns}
                    pagination={{
                      pageSize: 5,
                    }}
                    hover
                    theme="dark"
                  />
                </Card>
              )}
            </>
          ) : (
            <Card theme="dark" style={{ height: '600px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <div style={{ textAlign: 'center', color: '#666' }}>
                <PlayCircleIcon size="64px" style={{ marginBottom: '16px' }} />
                <div>请选择策略并运行回测</div>
              </div>
            </Card>
          )}
        </Col>
      </Row>
    </div>
  );
};

export default Strategy;
