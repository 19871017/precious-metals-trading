import { useState } from 'react';
import { Dialog, Form, Input, Radio, Button, MessagePlugin, Upload } from 'tdesign-react';
import { CheckIcon, InfoCircleIcon } from 'tdesign-icons-react';

interface RealNameAuthDialogProps {
  visible: boolean;
  onClose: () => void;
  currentAuth: { name: string; idCard: string; verified: boolean } | null;
  onSuccess: (data: { name: string; idCard: string }) => void;
}

export default function RealNameAuthDialog({ visible, onClose, currentAuth, onSuccess }: RealNameAuthDialogProps) {
  const [form] = Form.useForm();
  const [step, setStep] = useState<'input-info' | 'upload-files' | 'submit-auth'>('input-info');
  const [loading, setLoading] = useState(false);

  if (currentAuth?.verified) {
    return (
      <Dialog
        header="实名认证"
        visible={visible}
        onClose={onClose}
        width="90vw"
        style={{ maxWidth: '500px' }}
        footer={null}
      >
        <div className="p-4">
          <div className="text-center mb-6">
            <CheckIcon size="64px" className="text-green-500 mx-auto mb-3" />
            <h3 className="text-xl font-bold text-white mb-2">认证成功</h3>
            <p className="text-sm text-neutral-400">您的实名信息已通过审核</p>
          </div>

          <div className="bg-neutral-950 rounded p-4 border border-neutral-800 space-y-3">
            <div className="flex justify-between items-center">
              <span className="text-sm text-neutral-500">真实姓名</span>
              <span className="text-sm font-semibold text-white">{currentAuth.name}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm text-neutral-500">身份证号</span>
              <span className="text-sm font-mono text-white">
                {currentAuth.idCard.slice(0, 6)}****{currentAuth.idCard.slice(-4)}
              </span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm text-neutral-500">认证状态</span>
              <span className="text-sm text-green-500">已认证</span>
            </div>
          </div>

          <div className="mt-4 bg-blue-950/20 border border-blue-900/40 rounded p-3">
            <div className="flex items-start gap-2">
              <InfoCircleIcon size="16px" className="text-blue-500 mt-0.5 flex-shrink-0" />
              <p className="text-xs text-blue-400 leading-relaxed">
                实名认证后可以享受更高额度的交易权限和更优质的客户服务。
              </p>
            </div>
          </div>

          <Button theme="primary" block size="large" className="mt-4" onClick={onClose}>
            关闭
          </Button>
        </div>
      </Dialog>
    );
  }

  const handleSubmitInfo = (values: any) => {
    setStep('upload-files');
  };

  const handleSubmitAuth = async (values: any) => {
    setLoading(true);
    try {
      const formData = new FormData();
      formData.append('name', values.name);
      formData.append('idCard', values.idCard);
      if (values.idCardFront?.[0]) {
        formData.append('idCardFront', values.idCardFront[0].raw);
      }
      if (values.idCardBack?.[0]) {
        formData.append('idCardBack', values.idCardBack[0].raw);
      }
      if (values.selfie?.[0]) {
        formData.append('selfie', values.selfie[0].raw);
      }

      const response = await fetch('/api/user/real-name-auth', {
        method: 'POST',
        body: formData,
      });

      if (response.ok) {
        MessagePlugin.success('认证申请已提交,审核结果将在1-3个工作日内通知您');
        onSuccess({ name: values.name, idCard: values.idCard });
        handleClose();
      } else {
        const error = await response.json();
        MessagePlugin.error(error.message || '提交失败');
      }
    } catch (error) {
      MessagePlugin.error('网络错误,请重试');
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    setStep('input-info');
    form.reset();
    onClose();
  };

  return (
    <Dialog
      header="实名认证"
      visible={visible}
      onClose={handleClose}
      width="90vw"
      style={{ maxWidth: '600px' }}
      footer={null}
    >
      <div className="p-4">
        {step === 'input-info' && (
          <Form form={form} onSubmit={handleSubmitInfo}>
            <div className="mb-6">
              <h3 className="text-base font-semibold text-white mb-2">实名认证说明</h3>
              <p className="text-xs text-neutral-400 leading-relaxed mb-3">
                为保障您的账户安全,根据相关法律法规要求,进行实名认证后方可进行资金操作。
              </p>
              <div className="bg-blue-950/20 border border-blue-900/40 rounded p-3">
                <div className="flex items-start gap-2">
                  <InfoCircleIcon size="16px" className="text-blue-500 mt-0.5 flex-shrink-0" />
                  <div className="text-xs text-blue-400">
                    <p>• 请填写真实的姓名和身份证号</p>
                    <p>• 认证信息仅用于身份验证,严格保密</p>
                    <p>• 审核通过后不可修改</p>
                  </div>
                </div>
              </div>
            </div>

            <Form.FormItem
              name="name"
              label="真实姓名"
              rules={[
                { required: true, message: '请输入真实姓名' },
                {
                  pattern: /^[\u4e00-\u9fa5]{2,10}$/,
                  message: '请输入2-10位中文姓名',
                },
              ]}
            >
              <Input placeholder="请输入您的真实姓名" />
            </Form.FormItem>

            <Form.FormItem
              name="idCard"
              label="身份证号"
              rules={[
                { required: true, message: '请输入身份证号' },
                {
                  pattern: /(^\d{15}$)|(^\d{18}$)|(^\d{17}(\d|X|x)$)/,
                  message: '请输入正确的身份证号',
                },
              ]}
            >
              <Input placeholder="请输入18位身份证号" maxLength={18} />
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

        {step === 'upload-files' && (
          <Form form={form} onSubmit={handleSubmitAuth}>
            <div className="mb-6 text-center">
              <CheckIcon size="48px" className="text-green-500 mx-auto mb-3" />
              <p className="text-sm text-neutral-400">上传身份证照片</p>
            </div>

            <Form.FormItem
              name="idCardFront"
              label="身份证正面"
              rules={[{ required: true, message: '请上传身份证正面照片' }]}
            >
              <Upload
                theme="image"
                accept="image/*"
                max={1}
                tips="请上传清晰身份证正面照片"
              />
            </Form.FormItem>

            <Form.FormItem
              name="idCardBack"
              label="身份证反面"
              rules={[{ required: true, message: '请上传身份证反面照片' }]}
            >
              <Upload
                theme="image"
                accept="image/*"
                max={1}
                tips="请上传清晰身份证反面照片"
              />
            </Form.FormItem>

            <Form.FormItem
              name="selfie"
              label="手持身份证照"
              rules={[{ required: true, message: '请上传手持身份证照片' }]}
            >
              <Upload
                theme="image"
                accept="image/*"
                max={1}
                tips="请上传本人手持身份证正面照片"
              />
            </Form.FormItem>

            <div className="bg-neutral-950 rounded p-3 border border-neutral-800 mb-4">
              <p className="text-xs text-neutral-400 leading-relaxed">
                • 请确保照片清晰、完整、无反光
                <br />
                • 身份证信息清晰可见,有效期在有效期内
                <br />
                • 照片格式支持JPG、PNG,大小不超过5MB
              </p>
            </div>

            <Button
              theme="primary"
              type="submit"
              block
              size="large"
              loading={loading}
            >
              提交认证
            </Button>
          </Form>
        )}
      </div>
    </Dialog>
  );
}
