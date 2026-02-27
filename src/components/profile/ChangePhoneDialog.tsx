import { useState } from 'react';
import { Dialog, Form, Input, Button, MessagePlugin } from 'tdesign-react';
import { CallIcon, CheckIcon } from 'tdesign-icons-react';

interface ChangePhoneDialogProps {
  visible: boolean;
  onClose: () => void;
  currentPhone: string;
  onSuccess: (newPhone: string) => void;
}

export default function ChangePhoneDialog({ visible, onClose, currentPhone, onSuccess }: ChangePhoneDialogProps) {
  const [form] = Form.useForm();
  const [step, setStep] = useState<'verify-old' | 'input-new' | 'verify-new'>('verify-old');
  const [loading, setLoading] = useState(false);
  const [countdown, setCountdown] = useState(0);

  const handleSendCode = async (phone: string, isOld: boolean = true) => {
    if (!phone || phone.length !== 11) {
      MessagePlugin.warning('请输入正确的手机号码');
      return false;
    }

    setLoading(true);
    try {
      const url = isOld ? '/api/verification/send-code' : '/api/verification/send-code-new';
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone }),
      });

      if (response.ok) {
        MessagePlugin.success('验证码已发送');
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

  const handleVerifyOldPhone = async (values: any) => {
    setLoading(true);
    try {
      const response = await fetch('/api/user/verify-phone', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          phone: currentPhone.replace(/\*/g, '8'),
          code: values.oldCode,
        }),
      });

      if (response.ok) {
        MessagePlugin.success('验证成功');
        setStep('input-new');
      } else {
        const error = await response.json();
        MessagePlugin.error(error.message || '验证码错误');
      }
    } catch (error) {
      MessagePlugin.error('网络错误,请重试');
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyNewPhone = async (values: any) => {
    setLoading(true);
    try {
      const response = await fetch('/api/user/change-phone', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          oldPhone: currentPhone.replace(/\*/g, '8'),
          newPhone: values.newPhone,
          code: values.newCode,
        }),
      });

      if (response.ok) {
        MessagePlugin.success('手机号修改成功');
        onSuccess(values.newPhone);
        handleClose();
      } else {
        const error = await response.json();
        MessagePlugin.error(error.message || '修改失败');
      }
    } catch (error) {
      MessagePlugin.error('网络错误,请重试');
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    setStep('verify-old');
    form.reset();
    setCountdown(0);
    onClose();
  };

  return (
    <Dialog
      header="修改手机号"
      visible={visible}
      onClose={handleClose}
      width="90vw"
      style={{ maxWidth: '450px' }}
      footer={null}
    >
      <div className="p-4">
        {step === 'verify-old' && (
          <Form form={form} onSubmit={handleVerifyOldPhone}>
            <div className="mb-6 text-center">
              <CallIcon size="48px" className="text-amber-500 mx-auto mb-3" />
              <p className="text-sm text-neutral-400">验证原手机号</p>
              <p className="text-lg font-semibold text-white mt-1">{currentPhone}</p>
            </div>

            <Form.FormItem
              name="oldCode"
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
                  onClick={() => handleSendCode(currentPhone.replace(/\*/g, '8'))}
                >
                  {countdown > 0 ? `${countdown}秒` : '获取验证码'}
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
              验证手机号
            </Button>
          </Form>
        )}

        {step === 'input-new' && (
          <Form form={form} onSubmit={(values) => {
            setStep('verify-new');
          }}>
            <div className="mb-6 text-center">
              <CheckIcon size="48px" className="text-green-500 mx-auto mb-3" />
              <p className="text-sm text-neutral-400">原手机号验证通过</p>
              <p className="text-lg font-semibold text-white mt-1">请输入新手机号</p>
            </div>

            <Form.FormItem
              name="newPhone"
              label="新手机号"
              rules={[
                { required: true, message: '请输入新手机号' },
                { pattern: /^1[3-9]\d{9}$/, message: '请输入正确的手机号' },
              ]}
            >
              <Input placeholder="请输入11位手机号" maxLength={11} />
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

        {step === 'verify-new' && (
          <Form form={form} onSubmit={handleVerifyNewPhone}>
            <div className="mb-6 text-center">
              <CallIcon size="48px" className="text-amber-500 mx-auto mb-3" />
              <p className="text-sm text-neutral-400">验证新手机号</p>
            </div>

            <Form.FormItem
              name="newCode"
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
                  onClick={() => handleSendCode(form.getFieldValue('newPhone'), false)}
                >
                  {countdown > 0 ? `${countdown}秒` : '获取验证码'}
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
              确认修改
            </Button>
          </Form>
        )}
      </div>
    </Dialog>
  );
}
