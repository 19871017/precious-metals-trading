import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button, Input, Radio, Divider } from 'tdesign-react';
import { UserIcon, LockOnIcon, MailIcon } from 'tdesign-icons-react';

export default function Login() {
  const navigate = useNavigate();
  const [loginType, setLoginType] = useState<'password' | 'code'>('password');
  const [loading, setLoading] = useState(false);

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setTimeout(() => {
      setLoading(false);
      navigate('/home');
    }, 1000);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-black via-neutral-950 to-black flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="bg-neutral-900/80 backdrop-blur-lg rounded-2xl p-8 shadow-2xl border border-neutral-800">
          <div className="text-center mb-8">
            <div className="w-16 h-16 mx-auto mb-4 gold-gradient rounded-full flex items-center justify-center">
              <span className="text-2xl font-bold text-neutral-900">Au</span>
            </div>
            <h1 className="text-3xl font-bold text-white mb-2">贵金属交易平台</h1>
            <p className="text-neutral-500">安全 · 专业 · 高效</p>
          </div>

          <div className="mb-6">
            <Radio.Group
              variant="default-filled"
              value={loginType}
              onChange={(value) => setLoginType(value as 'password' | 'code')}
            >
              <Radio value="password">密码登录</Radio>
              <Radio value="code">验证码登录</Radio>
            </Radio.Group>
          </div>

          <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-lg p-4 mb-6">
            <p className="text-yellow-400 text-sm text-center">
              📝 测试账号：任意输入即可登录
            </p>
          </div>

          <form onSubmit={handleLogin}>
            <div className="mb-4">
              <label className="block text-neutral-200 text-sm mb-2">账号</label>
              <Input
                size="large"
                placeholder={loginType === 'password' ? '请输入手机号或邮箱' : '请输入手机号'}
                prefixIcon={<UserIcon />}
              />
            </div>

              {loginType === 'password' ? (
              <>
                <div className="mb-4">
                  <label className="block text-neutral-200 text-sm mb-2">密码</label>
                  <Input
                    size="large"
                    type="password"
                    placeholder="请输入密码"
                    prefixIcon={<LockOnIcon />}
                  />
                </div>
                <div className="flex justify-end mb-6">
                  <Button variant="text" theme="primary" size="small">
                    忘记密码？
                  </Button>
                </div>
              </>
            ) : (
              <div className="mb-4">
                <label className="block text-neutral-200 text-sm mb-2">验证码</label>
                <div className="flex gap-2">
                  <Input
                    size="large"
                    placeholder="请输入验证码"
                    prefixIcon={<MailIcon />}
                  />
                  <Button size="large" variant="outline" theme="primary">
                    获取验证码
                  </Button>
                </div>
              </div>
            )}

            <Button
              size="large"
              theme="primary"
              type="submit"
              loading={loading}
              block
              className="gold-gradient !bg-yellow-500 !text-gray-900 !font-semibold !border-0"
            >
              登录
            </Button>
          </form>

          <Divider className="!border-neutral-800">或使用以下方式登录</Divider>

          <div className="flex justify-center gap-6 mt-6">
            <Button
              variant="text"
              size="large"
              icon={<span className="text-green-500 text-2xl">💬</span>}
            />
            <Button
              variant="text"
              size="large"
              icon={<span className="text-blue-500 text-2xl">🌐</span>}
            />
            <Button
              variant="text"
              size="large"
              icon={<span className="text-white text-2xl">🍎</span>}
            />
          </div>

          <p className="text-center text-neutral-500 text-sm mt-6">
            还没有账号？
            <Button variant="text" theme="primary" size="small">
              立即注册
            </Button>
          </p>
        </div>

        <p className="text-center text-neutral-600 text-xs mt-6">
          登录即表示同意《用户协议》和《隐私政策》
        </p>
      </div>
    </div>
  );
}
