import { useState, useEffect } from 'react';
import { Card, Form, Input, InputNumber, Switch, Button, Space, Message, Table, Dialog, Tag } from 'tdesign-react';
import { EditIcon, DeleteIcon, SaveIcon } from 'tdesign-icons-react';

interface RiskRule {
  id: string;
  name: string;
  type: 'position_limit' | 'leverage_limit' | 'loss_limit' | 'volume_limit';
  symbol: string;
  minQuantity: number;
  maxQuantity: number;
  maxLeverage: number;
  maxDailyLoss: number;
  maxPositionValue: number;
  enabled: boolean;
  createdAt: string;
  updatedAt: string;
}

export default function RiskControlConfig() {
  const [loading, setLoading] = useState(false);
  const [rules, setRules] = useState<RiskRule[]>([]);
  const [editForm] = Form.useForm();
  const [editingRule, setEditingRule] = useState<RiskRule | null>(null);
  const [editDialogVisible, setEditDialogVisible] = useState(false);

  const loadRules = async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/admin/risk-rules');
      if (response.ok) {
        const data = await response.json();
        if (data.code === 0) {
          setRules(data.data || []);
        }
      }
    } catch (error) {
      console.error('加载风控规则失败:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadRules();
  }, []);

  const handleEdit = (rule: RiskRule) => {
    setEditingRule(rule);
    editForm.setFieldsValue(rule);
    setEditDialogVisible(true);
  };

  const handleAdd = () => {
    const newRule: Partial<RiskRule> = {
      name: '',
      type: 'position_limit',
      symbol: 'ALL',
      minQuantity: 0.01,
      maxQuantity: 100,
      maxLeverage: 100,
      maxDailyLoss: 100000,
      maxPositionValue: 1000000,
      enabled: true,
    };
    setEditingRule(null);
    editForm.reset();
    editForm.setFieldsValue(newRule);
    setEditDialogVisible(true);
  };

  const handleSave = async (values: any) => {
    setLoading(true);
    try {
      const url = editingRule ? `/api/admin/risk-rules/${editingRule.id}` : '/api/admin/risk-rules';
      const method = editingRule ? 'PUT' : 'POST';

      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(values),
      });

      if (response.ok) {
        Message.success(editingRule ? '规则已更新' : '规则已创建');
        setEditDialogVisible(false);
        loadRules();
      } else {
        const error = await response.json();
        Message.error(error.message || '操作失败');
      }
    } catch (error) {
      Message.error('网络错误,请重试');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (rule: RiskRule) => {
    const confirmed = await Dialog.confirm({
      header: '确认删除',
      body: `确定要删除规则「${rule.name}」吗？`,
      theme: 'warning',
    });

    if (confirmed) {
      setLoading(true);
      try {
        const response = await fetch(`/api/admin/risk-rules/${rule.id}`, {
          method: 'DELETE',
        });

        if (response.ok) {
          Message.success('规则已删除');
          loadRules();
        } else {
          const error = await response.json();
          Message.error(error.message || '删除失败');
        }
      } catch (error) {
        Message.error('网络错误,请重试');
      } finally {
        setLoading(false);
      }
    }
  };

  const handleToggleEnabled = async (rule: RiskRule) => {
    setLoading(true);
    try {
      const response = await fetch(`/api/admin/risk-rules/${rule.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ enabled: !rule.enabled }),
      });

      if (response.ok) {
        Message.success(`规则已${!rule.enabled ? '启用' : '禁用'}`);
        loadRules();
      } else {
        const error = await response.json();
        Message.error(error.message || '操作失败');
      }
    } catch (error) {
      Message.error('网络错误,请重试');
    } finally {
      setLoading(false);
    }
  };

  const getTypeTag = (type: string) => {
    const config: Record<string, { text: string; theme: any }> = {
      position_limit: { text: '仓位限制', theme: 'danger' },
      leverage_limit: { text: '杠杆限制', theme: 'warning' },
      loss_limit: { text: '亏损限制', theme: 'primary' },
      volume_limit: { text: '交易量限制', theme: 'cyan' },
    };
    const { text, theme } = config[type] || { text: type, theme: 'default' };
    return <Tag theme={theme} variant="light">{text}</Tag>;
  };

  const columns = [
    {
      colKey: 'name',
      title: '规则名称',
      cell: ({ row }: { row: RiskRule }) => (
        <span className="font-semibold text-sm">{row.name}</span>
      ),
    },
    {
      colKey: 'type',
      title: '规则类型',
      width: 120,
      cell: ({ row }: { row: RiskRule }) => getTypeTag(row.type),
    },
    {
      colKey: 'symbol',
      title: '品种',
      width: 100,
      cell: ({ row }: { row: RiskRule }) => (
        <span className="font-mono text-sm">{row.symbol}</span>
      ),
    },
    {
      colKey: 'maxLeverage',
      title: '最大杠杆',
      width: 100,
      cell: ({ row }: { row: RiskRule }) => (
        <span className="font-mono text-sm">{row.maxLeverage}x</span>
      ),
    },
    {
      colKey: 'maxDailyLoss',
      title: '日亏损上限',
      width: 120,
      cell: ({ row }: { row: RiskRule }) => (
        <span className="font-mono text-sm text-red-500">¥{row.maxDailyLoss.toLocaleString()}</span>
      ),
    },
    {
      colKey: 'enabled',
      title: '状态',
      width: 80,
      cell: ({ row }: { row: RiskRule }) => (
        <Switch
          size="small"
          value={row.enabled}
          onChange={() => handleToggleEnabled(row)}
          loading={loading}
        />
      ),
    },
    {
      colKey: 'updatedAt',
      title: '更新时间',
      width: 150,
      cell: ({ row }: { row: RiskRule }) => {
        const date = new Date(row.updatedAt);
        return (
          <span className="text-xs text-neutral-500">
            {date.toLocaleString('zh-CN')}
          </span>
        );
      },
    },
    {
      colKey: 'action',
      title: '操作',
      width: 150,
      cell: ({ row }: { row: RiskRule }) => (
        <Space size="small">
          <Button
            size="small"
            variant="text"
            theme="primary"
            icon={<EditIcon />}
            onClick={() => handleEdit(row)}
          >
            编辑
          </Button>
          <Button
            size="small"
            variant="text"
            theme="danger"
            icon={<DeleteIcon />}
            onClick={() => handleDelete(row)}
          >
            删除
          </Button>
        </Space>
      ),
    },
  ];

  return (
    <div className="space-y-4">
      <Card>
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-base font-semibold text-neutral-200">风控规则配置</h3>
          <Button theme="primary" icon={<SaveIcon />} onClick={handleAdd}>
            添加规则
          </Button>
        </div>

        <Table
          data={rules}
          columns={columns}
          rowKey="id"
          loading={loading}
          pagination={{
            pageSize: 10,
            total: rules.length,
            showJumper: true,
            showPageSize: true,
          }}
          bordered
          stripe
          hover
          size="small"
        />
      </Card>

      <Dialog
        header={editingRule ? '编辑风控规则' : '添加风控规则'}
        visible={editDialogVisible}
        onClose={() => setEditDialogVisible(false)}
        width="90vw"
        style={{ maxWidth: '600px' }}
        footer={
          <div className="flex gap-3 justify-end">
            <Button theme="default" variant="outline" onClick={() => setEditDialogVisible(false)}>
              取消
            </Button>
            <Button theme="primary" onClick={() => editForm.submit()} loading={loading}>
              保存
            </Button>
          </div>
        }
      >
        <Form form={editForm} onSubmit={handleSave} layout="vertical">
          <Form.FormItem
            name="name"
            label="规则名称"
            rules={[{ required: true, message: '请输入规则名称' }]}
          >
            <Input placeholder="例如：黄金风控规则" />
          </Form.FormItem>

          <Form.FormItem
            name="type"
            label="规则类型"
            rules={[{ required: true, message: '请选择规则类型' }]}
          >
            <Select
              options={[
                { label: '仓位限制', value: 'position_limit' },
                { label: '杠杆限制', value: 'leverage_limit' },
                { label: '亏损限制', value: 'loss_limit' },
                { label: '交易量限制', value: 'volume_limit' },
              ]}
            />
          </Form.FormItem>

          <Form.FormItem
            name="symbol"
            label="品种代码"
            rules={[{ required: true, message: '请输入品种代码' }]}
            help="ALL表示所有品种"
          >
            <Input placeholder="GOLD 或 ALL" />
          </Form.FormItem>

          <Form.FormItem
            name="minQuantity"
            label="最小交易手数"
            rules={[{ required: true, message: '请输入最小交易手数' }]}
          >
            <InputNumber min={0.01} step={0.01} placeholder="0.01" />
          </Form.FormItem>

          <Form.FormItem
            name="maxQuantity"
            label="最大交易手数"
            rules={[{ required: true, message: '请输入最大交易手数' }]}
          >
            <InputNumber min={0.01} step={0.01} placeholder="100" />
          </Form.FormItem>

          <Form.FormItem
            name="maxLeverage"
            label="最大杠杆倍数"
            rules={[{ required: true, message: '请输入最大杠杆倍数' }]}
          >
            <InputNumber min={1} max={100} step={1} placeholder="100" />
          </Form.FormItem>

          <Form.FormItem
            name="maxDailyLoss"
            label="日亏损上限（元）"
            rules={[{ required: true, message: '请输入日亏损上限' }]}
          >
            <InputNumber min={0} step={1000} placeholder="100000" />
          </Form.FormItem>

          <Form.FormItem
            name="maxPositionValue"
            label="最大持仓价值（元）"
            rules={[{ required: true, message: '请输入最大持仓价值' }]}
          >
            <InputNumber min={0} step={10000} placeholder="1000000" />
          </Form.FormItem>

          <Form.FormItem
            name="enabled"
            label="启用状态"
            initialValue={true}
          >
            <Switch />
          </Form.FormItem>
        </Form>
      </Dialog>
    </div>
  );
}
