import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button, Badge, Dialog, MessagePlugin, Loading } from 'tdesign-react';
import {
  WalletIcon,
  UserIcon,
  LogoutIcon,
  ChevronRightIcon,
  SettingIcon,
  LockOnIcon,
  CheckIcon,
  CallIcon,
  MailIcon
} from 'tdesign-icons-react';
import UserCard from '../components/profile/UserCard';
import AssetCard from '../components/profile/AssetCard';
import FunctionGrid from '../components/profile/FunctionGrid';
import QuickNav, { defaultNavItems } from '../components/profile/QuickNav';
import EditProfileDialog from '../components/profile/EditProfileDialog';
import ChangePasswordDialog from '../components/profile/ChangePasswordDialog';
import ChangePhoneDialog from '../components/profile/ChangePhoneDialog';
import BindEmailDialog from '../components/profile/BindEmailDialog';
import RealNameAuthDialog from '../components/profile/RealNameAuthDialog';
import NoticeDetailDialog from '../components/profile/NoticeDetailDialog';
import logger from '../utils/logger';
import { accountApi } from '../services/user.service';

// 系统公告
const systemNotices = [
  {
    id: 1,
    title: '系统维护通知',
    content: '2024年2月25日 02:00-04:00 系统升级维护',
    date: '2024-02-25 10:30',
    type: 'urgent',
    read: false
  },
  {
    id: 2,
    title: '保证金比例调整',
    content: '黄金保证金比例调整为8%',
    date: '2024-02-22 15:20',
    type: 'important',
    read: true
  },
  {
    id: 3,
    title: '新功能上线',
    content: 'AI分析功能已上线，欢迎体验',
    date: '2024-02-21 09:15',
    type: 'normal',
    read: true
  }
];

export default function Profile() {
  const navigate = useNavigate();
  const [activeNav, setActiveNav] = useState('account');
  const [logoutDialogVisible, setLogoutDialogVisible] = useState(false);
  const [editProfileVisible, setEditProfileVisible] = useState(false);
  const [changePasswordVisible, setChangePasswordVisible] = useState(false);
  const [changePhoneVisible, setChangePhoneVisible] = useState(false);
  const [bindEmailVisible, setBindEmailVisible] = useState(false);
  const [realNameAuthVisible, setRealNameAuthVisible] = useState(false);
  const [noticeDetailVisible, setNoticeDetailVisible] = useState(false);
  const [selectedNotice, setSelectedNotice] = useState<any>(null);

  // 用户数据
  const [userData, setUserData] = useState({
    name: '张三',
    phone: '138****8888',
    isVerified: true,
    avatar: ''
  });

  // 资产数据
  const [assetData, setAssetData] = useState({
    totalAssets: 0,
    availableFunds: 0,
    frozenMargin: 0,
    dailyPL: 0,
    dailyPLPercent: 0
  });

  // 加载状态
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    loadUserData();
  }, []);

  const loadUserData = async () => {
    setLoading(true);
    try {
      const accountInfo = await accountApi.getInfo();
      setAssetData({
        totalAssets: accountInfo.totalBalance,
        availableFunds: accountInfo.availableBalance,
        frozenMargin: accountInfo.frozenMargin,
        dailyPL: accountInfo.realizedPnl,
        dailyPLPercent: accountInfo.totalBalance > 0 ? (accountInfo.realizedPnl / accountInfo.totalBalance * 100) : 0,
      });
    } catch (error) {
      logger.error('加载用户数据失败:', error);
      // 使用模拟数据作为后备
      setAssetData({
        totalAssets: 850000,
        availableFunds: 263560,
        frozenMargin: 586440,
        dailyPL: 12500,
        dailyPLPercent: 1.5
      });
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = () => {
    setLogoutDialogVisible(true);
  };

  const confirmLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    window.location.href = '/login';
  };

  const handleEditProfile = () => {
    setEditProfileVisible(true);
  };

  const handleProfileSave = (data: any) => {
    logger.debug('保存个人信息:', data);
    // TODO: 调用后端API保存用户信息
    setUserData(prev => ({ ...prev, ...data }));
    MessagePlugin.success('个人信息保存成功');
  };

  const handleChangePassword = () => {
    setChangePasswordVisible(true);
  };

  const handlePasswordChange = () => {
    setChangePasswordVisible(false);
    MessagePlugin.success('密码修改成功，请重新登录');
    setTimeout(() => {
      window.location.href = '/login';
    }, 1500);
  };

  const handleNoticeClick = (notice: any) => {
    setSelectedNotice(notice);
    setNoticeDetailVisible(true);
  };

  // 账户管理功能
  const accountFunctions = [
    {
      icon: <WalletIcon size="24px" />,
      title: '账户充值',
      description: '快捷充值，即时到账',
      badge: 'NEW',
      onClick: (navigate: any) => navigate('/deposit')
    },
    {
      icon: <WalletIcon size="24px" />,
      title: '账户提现',
      description: '安全快捷，T+1到账',
      onClick: (navigate: any) => navigate('/withdraw')
    },
    {
      icon: <WalletIcon size="24px" />,
      title: '银行卡管理',
      description: '绑定/解绑银行卡',
      onClick: (navigate: any) => navigate('/bank-cards')
    },
    {
      icon: <UserIcon size="24px" />,
      title: '个人信息',
      description: '修改昵称、头像',
      onClick: handleEditProfile
    }
  ];

  // 安全设置项目
  const securityItems = [
    {
      icon: <LockOnIcon size="24px" />,
      title: '登录密码',
      description: '定期修改密码，保障账户安全',
      status: '已设置',
      onClick: handleChangePassword
    },
    {
      icon: <CallIcon size="24px" />,
      title: '手机验证',
      description: `已绑定 ${userData.phone}`,
      status: '已绑定',
      onClick: handleChangePassword
    },
    {
      icon: <MailIcon size="24px" />,
      title: '邮箱验证',
      description: '未绑定',
      status: '未绑定',
      onClick: handleChangePassword
    },
    {
      icon: <CheckIcon size="24px" />,
      title: '实名认证',
      description: '张三，已认证',
      status: '已认证',
      onClick: handleEditProfile
    }
  ];

  // 模拟趋势数据
  const trendData = [800000, 810000, 805000, 815000, 820000, 825000, 830000, 835000, 850000];

  return (
    <div className="min-h-screen bg-gradient-to-b from-black to-neutral-950 pb-24">
      {/* 顶部标题栏 */}
      <header className="flex justify-between items-center py-5 bg-neutral-900/80 backdrop-blur-sm border-b border-neutral-800">
        <div>
          <h1 className="text-xl font-bold text-white tracking-wide">我的账户</h1>
          <p className="text-xs text-neutral-500 mt-1">专业的金融账户管理中心</p>
        </div>
        <button className="w-10 h-10 rounded-full bg-neutral-900 border border-neutral-800 flex items-center justify-center text-neutral-500 hover:bg-neutral-800 hover:text-neutral-400 transition-all duration-200">
          <SettingIcon size="18px" />
        </button>
      </header>

      {/* 主内容区 */}
      <div className="max-w-2xl mx-auto px-4 py-6 space-y-6">
        {/* 用户卡片 */}
        <UserCard
          name={userData.name}
          phone={userData.phone}
          avatar={userData.avatar}
          isVerified={userData.isVerified}
          onEdit={handleEditProfile}
          loading={loading}
        />

        {/* 资产概览卡片 */}
        <AssetCard
          assets={assetData}
          showTrend={true}
          trendData={trendData}
        />

        {/* 后台管理入口（管理员可见） */}
        <button
          onClick={() => navigate('/admin-simple')}
          className="w-full bg-gradient-to-r from-amber-900/30 to-amber-800/30 border border-amber-700/50 rounded-xl p-4 flex items-center justify-between hover:from-amber-900/40 hover:to-amber-800/40 transition-all duration-200"
        >
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-amber-600/20 border border-amber-600/40 rounded-xl flex items-center justify-center">
              <SettingIcon size="24px" className="text-amber-500" />
            </div>
            <div className="text-left">
              <h4 className="text-sm font-semibold text-white mb-1">后台管理</h4>
              <p className="text-[11px] text-neutral-500">系统管理 · 数据统计 · 用户管理</p>
            </div>
          </div>
          <div className="w-8 h-8 rounded-full bg-amber-600/20 flex items-center justify-center group-hover:bg-amber-600/30 transition-colors">
            <ChevronRightIcon size="16px" className="text-amber-500 group-hover:translate-x-0.5 transition-transform" />
          </div>
        </button>

        {/* 快捷导航 */}
        <QuickNav
          activeKey={activeNav}
          items={defaultNavItems}
          onChange={setActiveNav}
        />

        {/* 功能区域 */}
        {activeNav === 'account' && (
          <FunctionGrid
            title="常用功能"
            items={accountFunctions.map(item => ({
              ...item,
              onClick: (item.onClick as any)(navigate)
            }))}
            columns={2}
          />
        )}

        {activeNav === 'security' && (
          <FunctionGrid
            title="安全设置"
            items={securityItems}
            columns={2}
          />
        )}
      </div>

      {/* 弹窗组件 */}
      <Dialog
        visible={logoutDialogVisible}
        header="退出登录"
        onClose={() => setLogoutDialogVisible(false)}
        onConfirm={confirmLogout}
        confirmBtnTheme="warning"
        confirmBtnContent="确定退出"
      >
        <p className="text-neutral-300">确定要退出登录吗？</p>
      </Dialog>

      <EditProfileDialog
        visible={editProfileVisible}
        onClose={() => setEditProfileVisible(false)}
        onSave={handleProfileSave}
        userData={userData}
      />

      <ChangePasswordDialog
        visible={changePasswordVisible}
        onClose={() => setChangePasswordVisible(false)}
        onConfirm={handlePasswordChange}
      />

      <NoticeDetailDialog
        visible={noticeDetailVisible}
        notice={selectedNotice}
        onClose={() => setNoticeDetailVisible(false)}
      />
    </div>
  );
}
