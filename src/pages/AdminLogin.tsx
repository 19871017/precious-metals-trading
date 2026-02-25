import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Input, Button, MessagePlugin } from 'tdesign-react';
import { UserIcon, LockOnIcon, DesktopIcon } from 'tdesign-icons-react';
import { login } from '../services/auth';

export default function AdminLogin() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    username: '',
    password: ''
  });

  const handleLogin = async () => {
    // 验证输入
    if (!formData.username.trim()) {
      MessagePlugin.warning('请输入管理员用户名');
      return;
    }

    if (!formData.password) {
      MessagePlugin.warning('请输入密码');
      return;
    }

    setLoading(true);

    try {
      // 调用登录API
      const result = await login(formData.username.trim(), formData.password);

      // 验证是否是管理员
      if (result.user.role !== 'ADMIN') {
        MessagePlugin.error('该账号不是管理员账号，无法访问后台管理系统');
        // 清除token
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        setLoading(false);
        return;
      }

      MessagePlugin.success('登录成功，欢迎回来');
      // 跳转到后台主页
      navigate('/admin');
    } catch (error: any) {
      // 根据错误类型显示不同的提示
      if (error.message.includes('用户名或密码错误')) {
        MessagePlugin.error('用户名或密码错误，请重试');
      } else if (error.message.includes('服务器内部错误')) {
        MessagePlugin.error('服务器错误，请稍后重试');
      } else if (error.message.includes('未授权')) {
        MessagePlugin.error('登录失败，请检查账号状态');
      } else {
        MessagePlugin.error(error.message || '登录失败，请稍后重试');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleLogin();
    }
  };

  const handleBackToHome = () => {
    navigate('/');
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center p-4">
      {/* 背景装饰 */}
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute -top-40 -right-40 w-80 h-80 bg-blue-500/10 rounded-full blur-3xl" />
        <div className="absolute -bottom-40 -left-40 w-80 h-80 bg-purple-500/10 rounded-full blur-3xl" />
      </div>

      {/* 登录卡片 */}
      <div className="relative w-full max-w-md">
        <div className="bg-white/95 backdrop-blur-sm rounded-2xl shadow-2xl p-8 space-y-6">
          {/* Logo和标题 */}
          <div className="text-center">
            <div className="inline-flex items-center justify-center w-16 h-16 bg-gradient-to-br from-blue-600 to-purple-600 rounded-2xl mb-4 shadow-lg shadow-blue-600/20">
              <DesktopIcon size="32px" className="text-white" />
            </div>
            <h1 className="text-2xl font-bold text-gray-900 mb-2">后台管理系统</h1>
            <p className="text-sm text-gray-500">管理员登录 · 请使用管理员账号</p>
          </div>

          {/* 登录表单 */}
          <div className="space-y-4">
            {/* 用户名输入 */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                管理员用户名
              </label>
              <Input
                size="large"
                placeholder="请输入管理员用户名"
                value={formData.username}
                onChange={(val) => setFormData({ ...formData, username: val as string })}
                prefixIcon={<UserIcon size="20px" />}
                onKeyDown={handleKeyDown}
                className="!py-3"
                disabled={loading}
                clearable
              />
            </div>

            {/* 密码输入 */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                登录密码
              </label>
              <Input
                size="large"
                type="password"
                placeholder="请输入密码"
                value={formData.password}
                onChange={(val) => setFormData({ ...formData, password: val as string })}
                prefixIcon={<LockOnIcon size="20px" />}
                onKeyDown={handleKeyDown}
                className="!py-3"
                disabled={loading}
                clearable
              />
            </div>

            {/* 登录按钮 */}
            <Button
              size="large"
              theme="primary"
              block
              loading={loading}
              onClick={handleLogin}
              className="!h-12 !font-semibold !text-base !shadow-lg !shadow-blue-600/30 hover:!shadow-blue-600/40 transition-all"
            >
              {loading ? '登录中...' : '登录后台管理'}
            </Button>
          </div>

          {/* 安全提示 */}
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <div className="flex items-start gap-3">
              <div className="flex-shrink-0 w-5 h-5 bg-blue-100 rounded-full flex items-center justify-center mt-0.5">
                <span className="text-blue-600 text-xs font-bold">!</span>
              </div>
              <div className="flex-1">
                <p className="text-sm text-blue-800 font-medium mb-1">安全提示</p>
                <ul className="text-xs text-blue-700 space-y-1">
                  <li>• 仅授权管理员可以访问</li>
                  <li>• 请勿在公共设备上保存密码</li>
                  <li>• 登录失败3次将锁定15分钟</li>
                </ul>
              </div>
            </div>
          </div>

          {/* 返回首页 */}
          <div className="text-center">
            <button
              onClick={handleBackToHome}
              className="text-sm text-gray-500 hover:text-gray-700 transition-colors"
            >
              ← 返回前端系统
            </button>
          </div>
        </div>

        {/* 页脚信息 */}
        <div className="mt-6 text-center">
          <p className="text-xs text-gray-500">
            Precious Metals Trading System · 管理员专用入口
          </p>
        </div>
      </div>
    </div>
  );
}
