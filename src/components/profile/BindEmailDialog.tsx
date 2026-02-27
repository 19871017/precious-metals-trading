import { useState } from 'react';
import { Dialog, Form, Input, Button, MessagePlugin } from 'tdesign-react';
import { MailIcon, CheckIcon } from 'tdesign-icons-react';

interface BindEmailDialogProps {
  visible: boolean;
  onClose: () => void;
  currentEmail: string | null;
  onSuccess: (email: string) => void;
}

export default function BindEmailDialog({ visible, onClose, currentEmail, onSuccess }: BindEmailDialogProps) {
  const [form] = Form.useForm();
  const [step, setStep] = useState<'input-email' | 'verify-email'>('input-email');
  const [loading, setLoading] = useState(false);
  const [countdown, setCountdown] = useState(0);

  const handleSendCode = async (email: string) => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!email || !emailRegex.test(email)) {
      MessagePlugin.warning('请输入正确的邮箱地址');
      return false;
    }

    setLoading(true);
    try {
      const response = await fetch('/api/user/send-email-code', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });

      if (response.ok) {
        MessagePlugin.success('验证码已发送到您的邮箱');
        setCountdown(60);
        const timer = setInterval(() => {
          setCountdown(prev => {
            if (prev <= 1) {
              clearInterval(timer);
              return 0;
            }
            return prev - 1;
          });
        }, 1000);
        return true;
      } else {
        const error = await response.json();
        MessagePlugin.error(error.message || '发送失败');
        return false;
      }
    } catch (error) {
      MessagePlugin.error('网络错误,请重试');
      return false;
    } finally {
      setLoading(false);
    }
  };

  const handleBindEmail = async (values: any) => {
    setLoading(true);
    try {
      const response = await fetch('/api/user/bind-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: values.email,
          code: values.code,
        }),
      });

      if (response.ok) {
        MessagePlugin.success('邮箱绑定成功');
        onSuccess(values.email);
        handleClose();
      } else {
        const error = await response.json();
        MessagePlugin.error(error.message || '绑定失败');
      }
    } catch (error) {
      MessagePlugin.error('网络错误,请重试');
    } finally {
      setLoading(false);
    }
  };

  const handleUnbindEmail = async () => {
    if (!currentEmail) return;

    setLoading(true);
    try {
      const response = await fetch('/api/user/unbind-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });

      if (response.ok) {
        MessagePlugin.success('邮箱已解绑');
        onSuccess('');
        handleClose();
      } else {
        const error = await response.json();
        MessagePlugin.error(error.message || '解绑失败');
      }
    } catch (error) {
      MessagePlugin.error('网络错误,请重试');
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    setStep('input-email');
    form.reset();
    setCountdown(0);
    onClose();
  };

  if (currentEmail) {
    return (
      <Dialog
        header="解绑邮箱"
        visible={visible}
        onClose={handleClose}
        width="90vw"
        style={{ maxWidth: '400px' }}
        footer={
          <div className="flex gap-3">
            <Button theme="default" variant="outline" onClick={handleClose}>
              取消
            </Button>
            <Button theme="danger" onClick={handleUnbindEmail} loading={loading}>
              确认解绑
            </Button>
          </div>
        }
      >
        <div className="p-4">
          <div className="text-center mb-6">
            <MailIcon size="48px" className="text-amber-500 mx-auto mb-3" />
            <p className="text-sm text-neutral-400 mb-2">当前绑定邮箱</p>
            <p className="text-lg font-semibold text-white">{currentEmail}</p>
          </div>
          <div className="bg-red-950/20 border border-red-900/40 rounded p-3">
            <p className="text-xs text-red-400 leading-relaxed">
              解绑邮箱后,将无法使用邮箱找回密码,请确保已绑定手机号。
            </p>
          </div>
        </div>
      </Dialog>
    );
  }

  return (
    <Dialog
      header="绑定邮箱"
      visible={visible}
      onClose={handleClose}
      width="90vw"
      style={{ maxWidth: '450px' }}
      footer={null}
    >
      <div className="p-4">
        {step === 'input-email' && (
          <Form form={form} onSubmit={(values) => {
            setStep('verify-email');
          }}>
            <div className="mb-6 text-center">
              <MailIcon size="48px" className="text-amber-500 mx-auto mb-3" />
              <p className="text-sm text-neutral-400">绑定邮箱可以用于</p>
              <div className="text-left mt-3 space-y-2 text-xs text-neutral-500">
                <p>• 找回登录密码</p>
                <p>• 接收系统通知</p>
                <p>• 账户安全验证</p>
              </div>
            </div>

            <Form.FormItem
              name="email"
              label="邮箱地址"
              rules={[
                { required: true, message: '请输入邮箱地址' },
                {
                  pattern: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
                  message: '请输入正确的邮箱地址',
                },
              ]}
            >
              <Input placeholder="请输入您的邮箱" />
            </Form.FormItem>

            <Button
              theme="primary"
              type="submit"
              block
              size="large"
            >
              下一步
            </Button>
          </Form>
        )}

        {step === 'verify-email' && (
          <Form form={form} onSubmit={handleBindEmail}>
            <div className="mb-6 text-center">
              <CheckIcon size="48px" className="text-green-500 mx-auto mb-3" />
              <p className="text-sm text-neutral-400 mb-2">验证邮箱</p>
              <p className="text-xs text-neutral-600">
                验证码已发送到 {form.getFieldValue('email')}
              </p>
            </div>

            <Form.FormItem
              name="code"
              label="验证码"
              rules={[
                { required: true, message: '请输入验证码' },
                { len: 6, message: '验证码为6位数字' },
                { pattern: /^\d+$/, message: '请输入数字' },
              ]}
            >
              <div className="flex gap-2">
                <Input placeholder="请输入验证码" maxLength={6} />
                <Button
                  theme="primary"
                  variant="outline"
                  disabled={countdown > 0 || loading}
                  loading={loading}
                  onClick={() => handleSendCode(form.getFieldValue('email'))}
                >
                  {countdown > 0 ? `${countdown}秒` : '重新发送'}
                </Button>
              </div>
            </Form.FormItem>

            <Button
              theme="primary"
              type="submit"
              block
              size="large"
              loading={loading}
            >
              确认绑定
            </Button>
          </Form>
        )}
      </div>
    </Dialog>
  );
}
