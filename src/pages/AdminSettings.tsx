import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Card,
  Button,
  Input,
  Select,
  Switch,
  Dialog,
  MessagePlugin,
  Table,
  Space,
  Tag,
  Badge,
  InputNumber,
  Toast
} from 'tdesign-react';
import {
  ApiIcon,
  KeyIcon,
  SaveIcon,
  TestConnectionIcon,
  CloseIcon,
  AddIcon,
  EditIcon,
  DeleteIcon,
  RefreshIcon,
  CheckCircleIcon,
  ErrorCircleIcon,
} from 'tdesign-icons-react';
import { apiConfigService, ApiConfig, AIProvider } from '../services/api-config.service';
import logger from '../utils/logger';

const { Option } = Select;

export default function AdminSettings() {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<'api-config' | 'system'>('api-config');
  const [configs, setConfigs] = useState<ApiConfig[]>([]);
  const [loading, setLoading] = useState(false);
  const [testingConfig, setTestingConfig] = useState<ApiConfig | null>(null);
  const [testResult, setTestResult] = useState<{ success: boolean; message: string; response?: any }>({ success: false, message: '' });

  // API配置表单
  const [form, setForm] = useState({
    name: '',
    provider: 'gemini' as AIProvider,
    apiKey: '',
    endpoint: '',
    model: '',
    enabled: false,
    priority: 10,
  });

  const providerOptions = [
    { label: 'Gemini (推荐)', value: 'gemini' },
    { label: 'OpenAI', value: 'openai' },
    { label: 'Anthropic', value: 'anthropic' },
    { label: '自定义', value: 'custom' },
  ];

  const modelOptions: Record<string, { label: string; value: string; description: string }> = {
    gemini: {
      label: 'Gemini 1.5 Pro',
      value: 'gemini-1.5-pro',
      description: '稳定的模型,速度快,性价比高',
    },
    'openai': {
      label: 'GPT-4',
      value: 'gpt-4',
      description: '强大的模型,支持多种任务',
    },
    'anthropic': {
      label: 'Claude 3.5 Sonnet',
      value: 'claude-3-sonnet',
      description: '强大的模型,长文本处理能力强',
    },
    'custom': {
      label: '自定义',
      value: 'custom',
      description: '自定义API端点',
    },
  };

  const loadConfigs = async () => {
    setLoading(true);
    try {
      const data = apiConfigService.getAllConfigs();
      setConfigs(data);
    } catch (error) {
      logger.error('加载API配置失败:', error);
      MessagePlugin.error('加载配置失败');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadConfigs();
  }, []);

  const handleTestConnection = async (config: ApiConfig) => {
    setTestingConfig(config);
    setTestResult({ success: false, message: '正在连接...' });

    try {
      const result = await apiConfigService.testConnection(config);
      setTestResult(result);
      if (result.success) {
        MessagePlugin.success(`连接成功! ${result.response?.provider || config.provider}`);
      } else {
        MessagePlugin.error(`连接失败: ${result.error}`);
      }
    } catch (error) {
      setTestResult({ success: false, message: (error as Error).message });
    }
  };

  const handleSave = async () => {
    if (!form.name.trim()) {
      MessagePlugin.warning('请输入配置名称');
      return;
    }

    if (!form.apiKey.trim()) {
      MessagePlugin.warning('请输入API Key');
      return;
    }

    try {
      if (form.id) {
        await apiConfigService.updateConfig(form.id, form);
        MessagePlugin.success('配置已更新');
      } else {
        const newConfig = await apiConfigService.createConfig(form);
        MessagePlugin.success('配置已保存');
      }

      await loadConfigs();
      resetForm();
    } catch (error) {
      logger.error('保存配置失败:', error);
      MessagePlugin.error('保存失败');
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await apiConfigService.deleteConfig(id);
      MessagePlugin.success('配置已删除');
      await loadConfigs();
    } catch (error) {
      logger.error('删除配置失败:', error);
      MessagePlugin.error('删除失败');
    }
  };

  const handleSetPriority = async (id: string, priority: number) => {
    try {
      await apiConfigService.updateConfig(id, { priority });
      await loadConfigs();
      MessagePlugin.success('优先级已更新');
    } catch (error) {
      logger.error('更新优先级失败:', error);
      MessagePlugin.error('更新优先级失败');
    }
  };

  const handleToggleEnabled = async (id: string) => {
    try {
      const config = configs.find(c => c.id === id);
      if (!config) return;

      await apiConfigService.updateConfig(id, { enabled: !config.enabled });
      await loadConfigs();

      const status = !config.enabled ? '启用' : '禁用';
      MessagePlugin.success(`已${status}API配置`);
    } catch (error) {
      logger.error('切换状态失败:', error);
      MessagePlugin.error('切换状态失败');
    }
  };

  const resetForm = () => {
    setForm({
      name: '',
      provider: 'gemini',
      apiKey: '',
      endpoint: '',
      model: 'gemini-1.5-flash',
      enabled: true,
      priority: 10,
    });
  };

  const handleApplyConfig = async () => {
    if (!form.enabled) {
      MessagePlugin.warning('请先启用API配置');
      return;
    }

    try {
      apiConfigService.setActiveConfig(form.id);
      MessagePlugin.success('已设为活跃API');
      await loadConfigs();
    } catch (error) {
      logger.error('应用配置失败:', error);
      MessagePlugin.error('应用配置失败');
    }
  };

  const columns = [
    {
      colKey: 'name',
      title: '配置名称',
      width: 200,
      cell: ({ row }: { row: ApiConfig }) => (
        <span className="font-semibold text-sm">{row.name}</span>
      ),
    },
    {
      colKey: 'provider',
      title: '提供商',
      width: 120,
      cell: ({ row }: { row: ApiConfig }) => (
        <span className="font-mono text-xs text-blue-400">{row.provider.toUpperCase()}</span>
      ),
    },
    {
      colKey: 'model',
      title: '模型',
      width: 150,
      cell: ({ row }: { row: ApiConfig }) => (
        <span className="font-mono text-xs text-purple-400">{row.model || '-'}</span>
      ),
    },
    {
      colKey: 'apiKey',
      title: 'API Key',
      width: 150,
      cell: ({ row }: { row: ApiConfig }) => (
        <div className="flex items-center gap-2">
          <span className="font-mono text-xs text-neutral-600">
            {row.apiKey.length > 8 ? `${row.apiKey.slice(0, 8)}...` : row.apiKey}
          </span>
          {row.enabled && (
            <Tag theme="success" variant="light" size="small">已启用</Tag>
          )}
        </div>
      ),
    },
    {
      colKey: 'priority',
      title: '优先级',
      width: 80,
      cell: ({ row }: { row: ApiConfig }) => (
        <Badge theme={row.priority <= 3 ? 'success' : 'warning'} variant="light">
          {row.priority}
        </Badge>
      ),
    },
    {
      colKey: 'enabled',
      title: '状态',
      width: 80,
      cell: ({ row }: { row: ApiConfig }) => (
        <Switch
          size="small"
          value={row.enabled}
          onChange={() => handleToggleEnabled(row.id)}
        />
      ),
    },
    {
      colKey: 'createdAt',
      title: '创建时间',
      width: 120,
      cell: ({ row }: { row: ApiConfig }) => (
        <span className="text-xs text-neutral-500">
          {new Date(row.createdAt).toLocaleDateString('zh-CN')}
        </span>
      ),
    },
    {
      colKey: 'action',
      title: '操作',
      width: 200,
      cell: ({ row }: { row: ApiConfig }) => (
        <Space size="small">
          {row.enabled && (
            <Button
              size="small"
              variant="text"
              theme="primary"
              onClick={() => handleApplyConfig(row.id)}
            >
              应用
            </Button>
          )}
          <Button
            size="small"
            variant="text"
            theme="default"
            icon={<EditIcon size="14px" />}
            onClick={() => setForm(row)}
          >
            编辑
          </Button>
          <Button
            size="small"
            variant="text"
            theme="default"
            icon={<TestConnectionIcon size="14px" />}
            onClick={() => handleTestConnection(row)}
          >
            测试
          </Button>
          <Button
            size="small"
            variant="text"
            theme="danger"
            icon={<DeleteIcon size="14px" />}
            onClick={() => {
              Dialog.confirm({
                header: '确认删除',
                body: `确定要删除配置「${row.name}」吗?此操作不可恢复。`,
                theme: 'warning',
                onConfirm: async () => {
                  await handleDelete(row.id);
                },
              });
            }}
          >
            删除
          </Button>
        </Space>
      ),
    },
  ];

  const getStatusBadge = (config: ApiConfig) => {
    if (!config.enabled) {
      return <Tag theme="default" variant="light">未启用</Tag>;
    }
    const priorityColor = config.priority <= 3 ? 'success' : config.priority <= 7 ? 'warning' : 'danger';
    return <Tag theme={priorityColor} variant="light">P{config.priority}</Tag>;
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-50 to-white pb-20 pt-4">
      <div className="max-w-7xl mx-auto px-4">
        <div className="mb-6">
          <h2 className="text-2xl font-bold text-gray-800 mb-2">系统设置</h2>
          <p className="text-sm text-gray-500">管理API密钥和第三方模型配置</p>
        </div>

        <Card>
          <div className="mb-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <ApiIcon size="24px" className="text-blue-500" />
                <h3 className="text-lg font-semibold text-gray-700">API配置管理</h3>
              </div>
              <Button
                icon={<AddIcon size="16px" />}
                onClick={() => {
                  resetForm();
                  setShowDialog(true);
                }}
              >
                添加API
              </Button>
              <Button
                icon={<RefreshIcon size="16px" />}
                onClick={() => loadConfigs()}
                loading={loading}
              >
                刷新
              </Button>
            </div>
          </div>

          {configs.length === 0 ? (
            <div className="text-center py-16">
              <KeyIcon size="48px" className="text-gray-400 mx-auto mb-4" />
              <p className="text-sm text-gray-500">暂无API配置</p>
            </div>
          ) : (
            <Table
              data={configs}
              columns={columns}
              rowKey="id"
              bordered
              stripe
              hover
              size="medium"
              pagination={{
                pageSize: 10,
                total: configs.length,
                showJumper: true,
                showSizeChanger: true,
              }}
              className="overflow-hidden"
            />
          )}
        </Card>

        {/* 添加/编辑API配置对话框 */}
        <Dialog
          header={form.id ? '编辑API配置' : '添加API配置'}
          visible={showDialog}
          onClose={() => setShowDialog(false)}
          width="700px"
          footer={
            <div className="flex gap-3 justify-end">
              <Button
                variant="outline"
                onClick={() => {
                  setShowDialog(false);
                  resetForm();
                }}
              >
                取消
              </Button>
              <Button
                theme="primary"
                onClick={handleSave}
                loading={loading}
              >
                保存
              </Button>
            </div>
          }
        >
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                配置名称 <span className="text-red-500">*</span>
              </label>
              <Input
                placeholder="请输入配置名称，如：Gemini Pro"
                value={form.name}
                onChange={(value) => setForm(prev => ({ ...prev, name: value as string }))}
                clearable
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                提供商 <span className="text-red-500">*</span>
              </label>
              <Select
                value={form.provider}
                onChange={(value) => {
                  const provider = value as AIProvider;
                  const modelConfig = modelOptions[provider];
                  setForm(prev => ({
                    ...prev,
                    provider,
                    endpoint: provider === 'custom' ? '' : undefined,
                    model: modelConfig.value,
                  }));
                }}
                options={providerOptions}
                placeholder="选择AI提供商"
              >
                {providerOptions.map(p => (
                  <Option key={p.value} value={p.value}>
                    {p.label}
                  </Option>
                ))}
              </Select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                API Key <span className="text-red-500">*</span>
              </label>
              <Input
                placeholder="粘贴您的API Key (以sk-或sk-开头)"
                value={form.apiKey}
                onChange={(value) => setForm(prev => ({ ...prev, apiKey: value as string }))}
                type="password"
                clearable
              />
            </div>

            {form.provider !== 'custom' && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">模型选择</label>
                <Select
                  value={form.model || ''}
                  onChange={(value) => setForm(prev => ({ ...prev, model: value as string }))}
                  options={
                    Object.values(modelOptions)
                      .filter(p => p.provider === form.provider)
                      .map(p => (
                        <Option key={p.value} value={p.value}>
                          {p.label} ({p.description})
                        </Option>
                      ))
                  }
                  placeholder="选择模型"
                />
              </div>
            )}

            {form.provider === 'custom' && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  自定义端点 <span className="text-red-500">*</span>
                </label>
                <Input
                  placeholder="输入完整的API端点URL"
                  value={form.endpoint || ''}
                  onChange={(value) => setForm(prev => ({ ...prev, endpoint: value as string }))}
                  placeholder="https://api.example.com/v1"
                  clearable
                />
              </div>
            )}

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  优先级 <span className="text-neutral-500">(1-10,数字越小优先级越高) <span className="text-red-500">*</span>
                </label>
                <InputNumber
                  min={1}
                  max={10}
                  defaultValue={10}
                  value={form.priority}
                  onChange={(value) => setForm(prev => ({ ...prev, priority: value || 10 }))}
                  number />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  <span className="text-neutral-500">启用状态</span>
                </label>
                <div className="flex items-center">
                  <Switch
                    size="large"
                    theme="primary"
                    value={form.enabled}
                    onChange={(value) => setForm(prev => ({ ...prev, enabled: value as boolean }))}
                  />
                  {form.enabled && (
                    <CheckCircleIcon className="text-green-500" size="20px" />
                  )}
                </div>
              </div>
            </div>
          </div>
        </Dialog>

        <div className="mt-6">
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
            <h3 className="text-lg font-semibold text-blue-900 mb-2">📝 API配置说明</h3>
            <div className="space-y-2 text-sm text-blue-800">
              <p>1. <span className="font-semibold">配置API Key后</span> 系统会优先使用该API进行AI分析</p>
              </p>
              <p>2. <span className="font-semibold">启用/禁用</span> 只有启用的API才会被自动调用</p>
              </p>
              <p>3. <span className="font-semibold">优先级</span> 多个API启用时,按优先级选择使用</p>
              </p>
              <p>4. <span className="font-semibold">测试连接</span> 点击"测试"验证API Key是否有效</p>
              </p>
            </div>
          </div>

          <div className="mt-6">
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 mb-6">
              <h3 className="text-lg font-semibold text-amber-900 mb-2">⚠️ 注意事项</h3>
              <div className="space-y-2 text-sm text-amber-800">
                <p>1. <span className="font-semibold">API Key安全</span> 请妥善保管API Key,不要泄露给他人</p>
                </p>
                <p>2. <span className="font-semibold">权限控制</span> 确保API Key具有适当的权限范围</p>
                </p>
                <p>3. <span className="font-semibold">费用控制</span> 注意API调用频率,避免产生高额费用</p>
                </p>
                <p>4. <span className="font-semibold">定期更新</span> 定期轮换API Key以提高安全性</p>
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
