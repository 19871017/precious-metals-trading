import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Input, Button, Checkbox, MessagePlugin } from 'tdesign-react';
import { UserIcon, LockOnIcon } from 'tdesign-icons-react';
import AuthLayout from '../components/auth/AuthLayout';
import { login } from '../services/auth';

// 双语字典
const i18n = {
  zh: {
    title: '欢迎回来',
    subtitle: '登录您的 AI 交易工作空间',
    emailLabel: '邮箱 / 用户名',
    emailPlaceholder: '请输入邮箱或用户名',
    passwordLabel: '密码',
    passwordPlaceholder: '请输入密码',
    rememberMe: '记住我',
    forgotPassword: '忘记密码？',
    loginButton: '登录',
    loggingIn: 'AI 分析中…',
    orContinue: '或继续使用',
    noAccount: '还没有账号？',
    createAccount: '创建账号',
    apiAccess: 'API 访问',
  },
  en: {
    title: 'Welcome Back',
    subtitle: 'Sign in to your AI trading workspace',
    emailLabel: 'Email / Username',
    emailPlaceholder: 'Enter your email or username',
    passwordLabel: 'Password',
    passwordPlaceholder: 'Enter your password',
    rememberMe: 'Remember me',
    forgotPassword: 'Forgot password?',
    loginButton: 'Sign In',
    loggingIn: 'AI Analyzing...',
    orContinue: 'or continue with',
    noAccount: "Don't have an account?",
    createAccount: 'Create Account',
    apiAccess: 'API Access',
  },
};

export default function Login() {
  const navigate = useNavigate();
  const [lang, setLang] = useState<'zh' | 'en'>('zh');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [rememberMe, setRememberMe] = useState(false);
  const [loading, setLoading] = useState(false);

  const t = i18n[lang];

  const handleLogin = async () => {
    if (!email || !password) {
      MessagePlugin.warning('请输入用户名和密码');
      return;
    }

    setLoading(true);
    try {
      // 调用登录API
      await login(email, password);
      MessagePlugin.success('登录成功');
      navigate('/home');
    } catch (error: any) {
      MessagePlugin.error(error.message || '登录失败');
    } finally {
      setLoading(false);
    }
  };

  const handleForgotPassword = () => {
    navigate('/forgot-password');
  };

  const handleRegister = () => {
    navigate('/register');
  };

  return (
    <AuthLayout type="login">
      {/* 语言切换 */}
      <div className="absolute top-0 right-0">
        <button
          onClick={() => setLang(lang === 'zh' ? 'en' : 'zh')}
          className="px-3 py-1.5 text-xs font-medium text-slate-400 hover:text-white transition-colors border border-slate-700/50 rounded-lg hover:border-slate-600"
        >
          {lang === 'zh' ? 'EN' : '中文'}
        </button>
      </div>

      {/* 标题区 */}
      <div className="text-center mb-6">
        <h1 className="text-2xl font-bold text-white mb-1.5">{t.title}</h1>
        <p className="text-slate-400 text-sm">{t.subtitle}</p>
      </div>

      {/* 表单 */}
      <form onSubmit={(e) => { e.preventDefault(); handleLogin(); }} className="space-y-4">
        {/* 账号输入 */}
        <div>
          <label className="block text-slate-300 text-xs mb-1.5 font-medium">
            {t.emailLabel}
          </label>
          <Input
            size="medium"
            placeholder={t.emailPlaceholder}
            value={email}
            onChange={(val) => setEmail(val as string)}
            prefixIcon={<UserIcon />}
            className="!bg-slate-900/50 !border-slate-700 !text-white !py-2 focus:!border-blue-500 focus:!ring-1 focus:!ring-blue-500/20"
          />
        </div>

        {/* 密码输入 */}
        <div>
          <label className="block text-slate-300 text-xs mb-1.5 font-medium">
            {t.passwordLabel}
          </label>
          <Input
            size="medium"
            type="password"
            placeholder={t.passwordPlaceholder}
            value={password}
            onChange={(val) => setPassword(val as string)}
            prefixIcon={<LockOnIcon />}
            className="!bg-slate-900/50 !border-slate-700 !text-white !py-2 focus:!border-blue-500 focus:!ring-1 focus:!ring-blue-500/20"
          />
        </div>

        {/* 记住我 */}
        <div className="flex items-center justify-between">
          <Checkbox
            checked={rememberMe}
            onChange={(val) => setRememberMe(val as boolean)}
            className="!text-slate-400 text-xs"
          >
            {t.rememberMe}
          </Checkbox>
          <Button
            variant="text"
            theme="primary"
            size="small"
            onClick={handleForgotPassword}
            className="!text-blue-400 hover:!text-blue-300 text-xs"
          >
            {t.forgotPassword}
          </Button>
        </div>

        {/* 登录按钮 */}
        <Button
          size="medium"
          theme="primary"
          type="submit"
          loading={loading}
          block
          className="!bg-blue-600 hover:!bg-blue-500 !text-white !font-semibold !border-0 !shadow-lg !shadow-blue-900/30 hover:!shadow-blue-900/50 transition-all !py-2.5"
        >
          {loading ? (
            <div className="flex items-center justify-center gap-2">
              {[0, 1, 2].map((i) => (
                <div
                  key={i}
                  className="w-2 h-2 bg-white rounded-full ai-loading-dot"
                  style={{
                    animationDelay: `${i * 0.2}s`,
                  }}
                />
              ))}
            </div>
          ) : (
            t.loginButton
          )}
        </Button>
      </form>

      {/* 分割线 */}
      <div className="flex items-center gap-4 my-5">
        <div className="flex-1 h-px bg-slate-700/50" />
        <span className="text-slate-500 text-xs">{t.orContinue}</span>
        <div className="flex-1 h-px bg-slate-700/50" />
      </div>

      {/* 第三方登录 */}
      <div className="grid grid-cols-3 gap-2">
        <Button
          variant="outline"
          theme="default"
          className="!bg-slate-900/50 !border-slate-700 !text-slate-300 hover:!border-slate-600 hover:!bg-slate-800/50 !h-9"
        >
          <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
            <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09 0-6.81-5.54-12.34-12.34-12.34-4.21 0-7.88 2.15-10.02 5.34L6.9 7.92C8.75 5.07 12.13 3.75 16 3.75c4.33 0 8.24 1.88 10.96 4.83l-3.4 2.66z" />
          </svg>
        </Button>
        <Button
          variant="outline"
          theme="default"
          className="!bg-slate-900/50 !border-slate-700 !text-slate-300 hover:!border-slate-600 hover:!bg-slate-800/50 !h-9"
        >
          <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
            <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z" />
          </svg>
        </Button>
        <Button
          variant="outline"
          theme="default"
          className="!bg-slate-900/50 !border-slate-700 !text-slate-300 hover:!border-slate-600 hover:!bg-slate-800/50 !h-9"
        >
          <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
            <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z"/>
          </svg>
        </Button>
      </div>

      {/* 注册入口 */}
      <div className="text-center mt-5">
        <p className="text-slate-400 text-xs">
          {t.noAccount}{' '}
          <Button
            variant="text"
            theme="primary"
            size="small"
            onClick={handleRegister}
            className="!text-blue-400 hover:!text-blue-300 !font-medium text-xs"
          >
            {t.createAccount}
          </Button>
        </p>
      </div>

      {/* API 登录入口 */}
      <div className="text-center mt-3">
        <Button
          variant="text"
          size="small"
          onClick={() => navigate('/agent-login')}
          className="!text-slate-500 hover:!text-slate-400 text-[11px]"
        >
          代理登录入口
        </Button>
      </div>
    </AuthLayout>
  );
}
