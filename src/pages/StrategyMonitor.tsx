import { useState, useEffect } from 'react';
import {
  Card,
  Button,
  Space,
  Tag,
  Switch,
  Table,
  Statistic,
  Row,
  Col,
  Timeline,
  MessagePlugin,
  Modal,
  Input,
  InputNumber,
  Select,
  Dialog,
} from 'tdesign-react';
import {
  PlayCircleIcon,
  StopCircleIcon,
  PauseCircleIcon,
  RefreshIcon,
  CheckCircleIcon,
  ErrorCircleIcon,
  InfoCircleIcon,
  WarningCircleIcon,
} from 'tdesign-icons-react';
import ReactECharts from 'echarts-for-react';
import {
  autoTradingEngine,
  AutoTradingConfig,
  TradingStatus,
  AutoPosition,
  TradingLog,
  TradingStats,
} from '../services/auto-trading-engine.service';
import {
  marketMonitor,
  SignalConfig,
} from '../services/market-monitor.service';
import { autoOrderService } from '../services/auto-order.service';
import {
  autoRiskService,
  RiskAlert,
  RiskConfig,
} from '../services/auto-risk.service';
import { STRATEGY_PARAMS } from '../services/strategy.service';
import logger from '../utils/logger';

const { Option } = Select;

export default function StrategyMonitor() {
  const [status, setStatus] = useState<TradingStatus>(TradingStatus.IDLE);
  const [config, setConfig] = useState<AutoTradingConfig | null>(null);
  const [positions, setPositions] = useState<AutoPosition[]>([]);
  const [logs, setLogs] = useState<TradingLog[]>([]);
  const [stats, setStats] = useState<TradingStats | null>(null);
  const [alerts, setAlerts] = useState<RiskAlert[]>([]);
  const [showConfigModal, setShowConfigModal] = useState(false);
  const [editingConfig, setEditingConfig] = useState<Partial<AutoTradingConfig>>({});
  const [selectedStrategy, setSelectedStrategy] = useState<string>('maCross');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    loadConfig();
    loadData();

    const handleStatusChange = (data: any) => {
      setStatus(data.status);
      if (data.config) {
        setConfig(data.config);
      }
    };

    const handlePositionOpened = (position: AutoPosition) => {
      setPositions(prev => [position, ...prev].slice(0, 20));
    };

    const handlePositionClosed = (data: any) => {
      setPositions(prev => prev.filter(p => p.symbol !== data.symbol));
    };

    const handlePositionUpdated = (data: any) => {
      setPositions(prev => prev.map(p => p.symbol === data.symbol ? data.position : p));
    };

    const handleLogAdded = (log: TradingLog) => {
      setLogs(prev => [log, ...prev].slice(0, 100));
    };

    const handleError = (data: any) => {
      MessagePlugin.error(data.error || '发生错误');
      setStatus(TradingStatus.ERROR);
    };

    autoTradingEngine.on('statusChanged', handleStatusChange);
    autoTradingEngine.on('positionOpened', handlePositionOpened);
    autoTradingEngine.on('positionClosed', handlePositionClosed);
    autoTradingEngine.on('positionUpdated', handlePositionUpdated);
    autoTradingEngine.on('logAdded', handleLogAdded);
    autoTradingEngine.on('error', handleError);

    const interval = setInterval(() => {
      loadData();
    }, 3000);

    return () => {
      autoTradingEngine.off('statusChanged', handleStatusChange);
      autoTradingEngine.off('positionOpened', handlePositionOpened);
      autoTradingEngine.off('positionClosed', handlePositionClosed);
      autoTradingEngine.off('positionUpdated', handlePositionUpdated);
      autoTradingEngine.off('logAdded', handleLogAdded);
      autoTradingEngine.off('error', handleError);
      clearInterval(interval);
    };
  }, []);

  const loadConfig = () => {
    const saved = localStorage.getItem('auto_trading_config');
    if (saved) {
      try {
        setConfig(JSON.parse(saved));
      } catch (error) {
        logger.error('Failed to load config:', error);
      }
    }
  };

  const loadData = () => {
    setPositions(autoTradingEngine.getPositions());
    setLogs(autoTradingEngine.getLogs(50));
    setStats(autoTradingEngine.getStats());
    setAlerts(autoRiskService.getLatestAlerts(10));
  };

  const handleStart = async () => {
    if (!editingConfig.strategyId) {
      MessagePlugin.warning('请选择策略');
      return;
    }

    const strategyInfo = STRATEGY_PARAMS[selectedStrategy];
    if (!strategyInfo) {
      MessagePlugin.error('策略信息未找到');
      return;
    }

    setLoading(true);
    try {
      const tradingConfig: AutoTradingConfig = {
        strategyId: selectedStrategy,
        strategyName: strategyInfo.name,
        symbols: ['GOLD', 'DAX', 'HSI', 'NQ', 'MHSI', 'USOIL'],
        initialCapital: editingConfig.initialCapital || 100000,
        maxPositionSize: editingConfig.maxPositionSize || 50000,
        maxDailyLoss: editingConfig.maxDailyLoss || 50000,
        maxDrawdown: editingConfig.maxDrawdown || 20,
        autoStopLoss: editingConfig.autoStopLoss !== false,
        autoTakeProfit: editingConfig.autoTakeProfit !== false,
        stopLossPercent: editingConfig.stopLossPercent || 2,
        takeProfitPercent: editingConfig.takeProfitPercent || 5,
        leverage: editingConfig.leverage || 10,
        enabled: true,
      };

      await autoTradingEngine.start(tradingConfig);

      const signalConfig: SignalConfig = {
        strategyId: selectedStrategy,
        symbols: tradingConfig.symbols,
        enabled: true,
        parameters: strategyInfo.parameters,
      };

      await marketMonitor.start(signalConfig);

      setConfig(tradingConfig);
      localStorage.setItem('auto_trading_config', JSON.stringify(tradingConfig));
      localStorage.setItem('auto_trading_enabled', 'true');

      MessagePlugin.success('自动交易已启动');
    } catch (error) {
      logger.error('Failed to start auto trading:', error);
      MessagePlugin.error('启动失败');
    } finally {
      setLoading(false);
    }
  };

  const handleStop = async () => {
    setLoading(true);
    try {
      await autoTradingEngine.stop();
      await marketMonitor.stop();
      localStorage.setItem('auto_trading_enabled', 'false');
      MessagePlugin.success('自动交易已停止');
    } catch (error) {
      logger.error('Failed to stop auto trading:', error);
      MessagePlugin.error('停止失败');
    } finally {
      setLoading(false);
    }
  };

  const handlePause = async () => {
    await autoTradingEngine.pause();
    MessagePlugin.info('自动交易已暂停');
  };

  const handleResume = async () => {
    await autoTradingEngine.resume();
    MessagePlugin.success('自动交易已恢复');
  };

  const handleSaveConfig = () => {
    setConfig(prev => ({ ...prev, ...editingConfig } as AutoTradingConfig));
    setShowConfigModal(false);
    MessagePlugin.success('配置已保存');
  };

  const getStatusTag = () => {
    const statusConfig: Record<TradingStatus, { text: string; theme: any; icon: any }> = {
      IDLE: { text: '未启动', theme: 'default', icon: InfoCircleIcon },
      RUNNING: { text: '运行中', theme: 'success', icon: PlayCircleIcon },
      PAUSED: { text: '已暂停', theme: 'warning', icon: PauseCircleIcon },
      STOPPED: { text: '已停止', theme: 'default', icon: StopCircleIcon },
      ERROR: { text: '错误', theme: 'danger', icon: ErrorCircleIcon },
    };

    const { text, theme, icon: Icon } = statusConfig[status] || statusConfig.IDLE;

    return (
      <Tag theme={theme} variant="light" icon={<Icon size="16px" />}>
        {text}
      </Tag>
    );
  };

  const getLogTypeIcon = (type: string) => {
    const iconConfig: Record<string, any> = {
      success: CheckCircleIcon,
      info: InfoCircleIcon,
      warning: WarningCircleIcon,
      error: ErrorCircleIcon,
      signal: PlayCircleIcon,
    };
    return iconConfig[type] || InfoCircleIcon;
  };

  const getLogTypeColor = (type: string) => {
    const colorConfig: Record<string, string> = {
      success: '#22c55e',
      info: '#3b82f6',
      warning: '#f59e0b',
      error: '#ef4444',
      signal: '#8b5cf6',
    };
    return colorConfig[type] || '#6b7280';
  };

  const columns = [
    {
      colKey: 'symbol',
      title: '品种',
      cell: ({ row }: { row: AutoPosition }) => (
        <span className="font-semibold text-sm">{row.symbol}</span>
      ),
    },
    {
      colKey: 'type',
      title: '方向',
      width: 80,
      cell: ({ row }: { row: AutoPosition }) => (
        <Tag theme={row.type === 'long' ? 'danger' : 'success'} variant="light" size="small">
          {row.type === 'long' ? '做多' : '做空'}
        </Tag>
      ),
    },
    {
      colKey: 'quantity',
      title: '数量',
      width: 100,
      cell: ({ row }: { row: AutoPosition }) => (
        <span className="font-mono text-sm">{row.quantity}手</span>
      ),
    },
    {
      colKey: 'entryPrice',
      title: '开仓价',
      width: 120,
      cell: ({ row }: { row: AutoPosition }) => (
        <span className="font-mono text-sm">{row.entryPrice.toFixed(2)}</span>
      ),
    },
    {
      colKey: 'currentPrice',
      title: '现价',
      width: 120,
      cell: ({ row }: { row: AutoPosition }) => (
        <span className="font-mono text-sm">{row.currentPrice.toFixed(2)}</span>
      ),
    },
    {
      colKey: 'profitLoss',
      title: '盈亏',
      width: 120,
      cell: ({ row }: { row: AutoPosition }) => (
        <span
          className={`font-mono text-sm font-semibold ${
            row.profitLoss >= 0 ? 'text-red-500' : 'text-green-500'
          }`}
        >
          {row.profitLoss >= 0 ? '+' : ''}
          {row.profitLoss.toFixed(2)}
        </span>
      ),
    },
    {
      colKey: 'profitLossPercent',
      title: '盈亏%',
      width: 100,
      cell: ({ row }: { row: AutoPosition }) => (
        <span
          className={`font-mono text-sm ${
            row.profitLossPercent >= 0 ? 'text-red-500' : 'text-green-500'
          }`}
        >
          {row.profitLossPercent >= 0 ? '+' : ''}
          {row.profitLossPercent.toFixed(2)}%
        </span>
      ),
    },
    {
      colKey: 'openedAt',
      title: '开仓时间',
      width: 150,
      cell: ({ row }: { row: AutoPosition }) => {
        const date = new Date(row.openedAt);
        return (
          <span className="text-xs text-neutral-500">
            {date.toLocaleString('zh-CN')}
          </span>
        );
      },
    },
  ];

  return (
    <div className="min-h-screen bg-gradient-to-b from-black to-neutral-950 pb-20 pt-4">
      <div className="max-w-7xl mx-auto px-4">
        <h1 className="text-2xl font-bold text-white mb-6">AI量化交易监控</h1>

        <Row gutter={16} className="mb-6">
          <Col span={16}>
            <Card>
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                  {getStatusTag()}
                  <span className="text-lg font-semibold text-white">
                    {config?.strategyName || '未选择策略'}
                  </span>
                </div>
                <Space>
                  {status === TradingStatus.RUNNING ? (
                    <Button
                      theme="warning"
                      variant="outline"
                      icon={<PauseCircleIcon />}
                      onClick={handlePause}
                      loading={loading}
                    >
                      暂停
                    </Button>
                  ) : status === TradingStatus.PAUSED ? (
                    <Button
                      theme="success"
                      icon={<PlayCircleIcon />}
                      onClick={handleResume}
                      loading={loading}
                    >
                      恢复
                    </Button>
                  ) : (
                    <Button
                      theme="primary"
                      icon={<PlayCircleIcon />}
                      onClick={handleStart}
                      loading={loading}
                    >
                      启动
                    </Button>
                  )}
                  {status !== TradingStatus.IDLE && status !== TradingStatus.STOPPED && (
                    <Button
                      theme="danger"
                      variant="outline"
                      icon={<StopCircleIcon />}
                      onClick={handleStop}
                      loading={loading}
                    >
                      停止
                    </Button>
                  )}
                  <Button
                    variant="outline"
                    icon={<RefreshIcon />}
                    onClick={loadData}
                  >
                    刷新
                  </Button>
                </Space>
              </div>

              <div className="grid grid-cols-4 gap-4">
                <div className="text-center">
                  <p className="text-xs text-neutral-500 mb-1">总交易</p>
                  <p className="text-2xl font-bold text-white">{stats?.totalTrades || 0}</p>
                </div>
                <div className="text-center">
                  <p className="text-xs text-neutral-500 mb-1">胜率</p>
                  <p className={`text-2xl font-bold ${stats?.winRate && stats.winRate >= 50 ? 'text-red-500' : 'text-green-500'}`}>
                    {stats?.winRate ? stats.winRate.toFixed(1) : '0'}%
                  </p>
                </div>
                <div className="text-center">
                  <p className="text-xs text-neutral-500 mb-1">总盈亏</p>
                  <p className={`text-2xl font-bold ${(stats?.totalProfit || 0) >= 0 ? 'text-red-500' : 'text-green-500'}`}>
                    ¥{((stats?.totalProfit || 0) + (stats?.totalLoss || 0)).toFixed(0)}
                  </p>
                </div>
                <div className="text-center">
                  <p className="text-xs text-neutral-500 mb-1">最大回撤</p>
                  <p className="text-2xl font-bold text-red-500">
                    {stats?.maxDrawdown ? stats.maxDrawdown.toFixed(1) : '0'}%
                  </p>
                </div>
              </div>
            </Card>
          </Col>

          <Col span={8}>
            <Card header="风险警报" className="h-full">
              {alerts.length === 0 ? (
                <div className="text-center py-8">
                  <CheckCircleIcon size="48px" className="text-green-500/50 mx-auto mb-2" />
                  <p className="text-sm text-neutral-500">暂无警报</p>
                </div>
              ) : (
                <div className="space-y-2 max-h-[250px] overflow-y-auto">
                  {alerts.map(alert => (
                    <div
                      key={alert.id}
                      className={`flex gap-3 p-3 rounded ${
                        alert.type === 'danger' ? 'bg-red-950/30 border border-red-900/40' :
                        alert.type === 'warning' ? 'bg-yellow-950/30 border border-yellow-900/40' :
                        'bg-blue-950/30 border border-blue-900/40'
                      }`}
                    >
                      <div className="flex-shrink-0">
                        <WarningCircleIcon size="20px" className={
                          alert.type === 'danger' ? 'text-red-500' :
                          alert.type === 'warning' ? 'text-yellow-500' : 'text-blue-500'
                        } />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm text-white mb-1 truncate">{alert.message}</p>
                        <p className="text-xs text-neutral-500">{new Date(alert.timestamp).toLocaleTimeString()}</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </Card>
          </Col>
        </Row>

        <Row gutter={16} className="mb-6">
          <Col span={12}>
            <Card header="持仓列表">
              {positions.length === 0 ? (
                <div className="text-center py-8">
                  <p className="text-sm text-neutral-500">暂无持仓</p>
                </div>
              ) : (
                <Table
                  data={positions}
                  columns={columns}
                  rowKey="id"
                  bordered
                  stripe
                  hover
                  size="small"
                  pagination={false}
                />
              )}
            </Card>
          </Col>

          <Col span={12}>
            <Card header="运行日志">
              <div className="max-h-[300px] overflow-y-auto">
                {logs.length === 0 ? (
                  <div className="text-center py-8">
                    <p className="text-sm text-neutral-500">暂无日志</p>
                  </div>
                ) : (
                  <Timeline>
                    {logs.map(log => (
                      <Timeline.Item
                        key={log.id}
                        label={new Date(log.timestamp).toLocaleTimeString()}
                        dotColor={getLogTypeColor(log.type)}
                      >
                        <div className="flex items-start gap-2">
                          <div className="flex-shrink-0 mt-0.5">
                            {React.createElement(getLogTypeIcon(log.type), {
                              size: '16px',
                              style: { color: getLogTypeColor(log.type) },
                            })}
                          </div>
                          <div className="flex-1">
                            <p className="text-sm text-neutral-200">{log.message}</p>
                            {log.data && (
                              <p className="text-xs text-neutral-500 mt-1">
                                {JSON.stringify(log.data)}
                              </p>
                            )}
                          </div>
                        </div>
                      </Timeline.Item>
                    ))}
                  </Timeline>
                )}
              </div>
            </Card>
          </Col>
        </Row>

        <Card header="配置" className="mb-4">
          <Row gutter={16}>
            <Col span={6}>
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-neutral-400">当前策略</span>
                  <Select
                    value={selectedStrategy}
                    onChange={setSelectedStrategy}
                    style={{ width: 200 }}
                  >
                    {Object.entries(STRATEGY_PARAMS).map(([key, value]) => (
                      <Option key={key} value={key}>{value.name}</Option>
                    ))}
                  </Select>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-neutral-400">初始资金</span>
                  <span className="text-sm font-semibold text-white">¥100,000</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-neutral-400">日亏损上限</span>
                  <span className="text-sm font-semibold text-white">¥50,000</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-neutral-400">最大回撤</span>
                  <span className="text-sm font-semibold text-white">20%</span>
                </div>
              </div>
            </Col>
            <Col span={6}>
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-neutral-400">自动止损</span>
                  <Switch value={editingConfig.autoStopLoss !== false} />
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-neutral-400">自动止盈</span>
                  <Switch value={editingConfig.autoTakeProfit !== false} />
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-neutral-400">止损百分比</span>
                  <span className="text-sm font-semibold text-white">{editingConfig.stopLossPercent || 2}%</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-neutral-400">止盈百分比</span>
                  <span className="text-sm font-semibold text-white">{editingConfig.takeProfitPercent || 5}%</span>
                </div>
                <Button
                  variant="outline"
                  block
                  icon={<RefreshIcon />}
                  onClick={() => setShowConfigModal(true)}
                >
                  修改配置
                </Button>
              </div>
            </Col>
          </Row>
        </Card>
      </div>

      <Dialog
        header="修改配置"
        visible={showConfigModal}
        onClose={() => setShowConfigModal(false)}
        width="600px"
        onConfirm={handleSaveConfig}
      >
        <div className="space-y-4">
          <div>
            <label className="block text-sm text-neutral-400 mb-2">策略</label>
            <Select
              value={editingConfig.strategyId}
              onChange={(value) => setEditingConfig(prev => ({ ...prev, strategyId: value as string }))}
              style={{ width: '100%' }}
            >
              {Object.entries(STRATEGY_PARAMS).map(([key, value]) => (
                <Option key={key} value={key}>{value.name}</Option>
              ))}
            </Select>
          </div>
          <div>
            <label className="block text-sm text-neutral-400 mb-2">初始资金</label>
            <InputNumber
              value={editingConfig.initialCapital}
              onChange={(value) => setEditingConfig(prev => ({ ...prev, initialCapital: value as number }))}
              min={10000}
              max={1000000}
              step={10000}
              style={{ width: '100%' }}
            />
          </div>
          <div>
            <label className="block text-sm text-neutral-400 mb-2">日亏损上限</label>
            <InputNumber
              value={editingConfig.maxDailyLoss}
              onChange={(value) => setEditingConfig(prev => ({ ...prev, maxDailyLoss: value as number }))}
              min={10000}
              max={100000}
              step={5000}
              style={{ width: '100%' }}
            />
          </div>
          <div>
            <label className="block text-sm text-neutral-400 mb-2">最大回撤(%)</label>
            <InputNumber
              value={editingConfig.maxDrawdown}
              onChange={(value) => setEditingConfig(prev => ({ ...prev, maxDrawdown: value as number }))}
              min={5}
              max={50}
              step={5}
              style={{ width: '100%' }}
            />
          </div>
          <div className="flex items-center justify-between">
            <label className="text-sm text-neutral-400">自动止损</label>
            <Switch
              value={editingConfig.autoStopLoss !== false}
              onChange={(value) => setEditingConfig(prev => ({ ...prev, autoStopLoss: value }))}
            />
          </div>
          <div className="flex items-center justify-between">
            <label className="text-sm text-neutral-400">自动止盈</label>
            <Switch
              value={editingConfig.autoTakeProfit !== false}
              onChange={(value) => setEditingConfig(prev => ({ ...prev, autoTakeProfit: value }))}
            />
          </div>
          <div>
            <label className="block text-sm text-neutral-400 mb-2">止损百分比(%)</label>
            <InputNumber
              value={editingConfig.stopLossPercent}
              onChange={(value) => setEditingConfig(prev => ({ ...prev, stopLossPercent: value as number }))}
              min={1}
              max={10}
              step={0.5}
              style={{ width: '100%' }}
            />
          </div>
          <div>
            <label className="block text-sm text-neutral-400 mb-2">止盈百分比(%)</label>
            <InputNumber
              value={editingConfig.takeProfitPercent}
              onChange={(value) => setEditingConfig(prev => ({ ...prev, takeProfitPercent: value as number }))}
              min={2}
              max={20}
              step={1}
              style={{ width: '100%' }}
            />
          </div>
        </div>
      </Dialog>
    </div>
  );
}
