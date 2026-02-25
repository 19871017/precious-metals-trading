import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronLeftIcon } from 'tdesign-icons-react';

export default function HelpCenter() {
  const navigate = useNavigate();
  const [expandedFaq, setExpandedFaq] = useState<string | null>(null);

  const handleFaqToggle = (key: string) => {
    setExpandedFaq(expandedFaq === key ? null : key);
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-black to-neutral-950 pb-24">
      <div className="max-w-2xl mx-auto px-4">
        {/* 顶部导航栏 */}
        <header className="flex items-center gap-3 py-5 mb-4">
          <button
            onClick={() => navigate('/profile')}
            className="text-amber-400 hover:text-amber-300 transition-colors"
          >
            <ChevronLeftIcon size="24px" />
          </button>
          <div>
            <h1 className="text-xl font-bold text-white tracking-wide">帮助中心</h1>
            <p className="text-xs text-neutral-500 mt-1">为您提供全方位的帮助支持</p>
          </div>
        </header>

        {/* 帮助内容 */}
        <div className="space-y-4">
          {/* 新手入门 */}
          <div className="bg-neutral-900/80 border border-neutral-800/80 rounded-xl p-5">
            <div className="flex items-center gap-2 mb-4">
              <div className="w-1 h-4 bg-amber-700 rounded-full" />
              <h3 className="text-sm font-bold text-white">新手入门</h3>
            </div>
            <div className="space-y-3">
              {[
                { question: '如何注册账号？', answer: '在登录页面点击"注册"按钮，输入手机号、设置密码并完成验证即可创建账户。' },
                { question: '忘记密码怎么办？', answer: '在登录页面点击"忘记密码"，通过手机验证码验证后可重置密码。' },
                { question: '如何完成实名认证？', answer: '进入个人中心-安全设置，点击"实名认证"，上传身份证正反面照片，审核通过即可完成认证。' },
              ].map((faq, index) => (
                <div
                  key={`beginner-${index}`}
                  className="bg-neutral-950/60 border border-neutral-800/80 rounded-lg overflow-hidden"
                >
                  <button
                    onClick={() => handleFaqToggle(`beginner-${index}`)}
                    className="w-full p-3 text-left hover:bg-neutral-800/60 transition-colors"
                  >
                    <p className="text-sm text-neutral-300 flex items-center justify-between">
                      {faq.question}
                      <span className={`transform transition-transform ${expandedFaq === `beginner-${index}` ? 'rotate-180' : ''}`}>
                        ▼
                      </span>
                    </p>
                  </button>
                  {expandedFaq === `beginner-${index}` && (
                    <div className="px-3 pb-3 pt-0 border-t border-neutral-800/50">
                      <p className="text-sm text-neutral-400 leading-relaxed">
                        {faq.answer}
                      </p>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* 首页功能 */}
          <div className="bg-neutral-900/80 border border-neutral-800/80 rounded-xl p-5">
            <div className="flex items-center gap-2 mb-4">
              <div className="w-1 h-4 bg-amber-700 rounded-full" />
              <h3 className="text-sm font-bold text-white">首页功能</h3>
            </div>
            <div className="space-y-3">
              {[
                { question: '首页显示什么信息？', answer: '首页显示六大主流品种（德指、纳指、恒指、小恒指、美黄金、美原油）的实时行情、涨跌幅、最高价、最低价、成交量等信息。' },
                { question: '如何查看AI智能分析？', answer: '首页顶部提供AI智能分析摘要，展示市场整体趋势、关键点位、风险评估和操作建议，帮助您快速把握市场动向。' },
                { question: '行情数据多久更新？', answer: '行情数据通过WebSocket实时推送，价格变化即时更新，确保您获得最新的市场信息。' },
              ].map((faq, index) => (
                <div
                  key={`home-${index}`}
                  className="bg-neutral-950/60 border border-neutral-800/80 rounded-lg overflow-hidden"
                >
                  <button
                    onClick={() => handleFaqToggle(`home-${index}`)}
                    className="w-full p-3 text-left hover:bg-neutral-800/60 transition-colors"
                  >
                    <p className="text-sm text-neutral-300 flex items-center justify-between">
                      {faq.question}
                      <span className={`transform transition-transform ${expandedFaq === `home-${index}` ? 'rotate-180' : ''}`}>
                        ▼
                      </span>
                    </p>
                  </button>
                  {expandedFaq === `home-${index}` && (
                    <div className="px-3 pb-3 pt-0 border-t border-neutral-800/50">
                      <p className="text-sm text-neutral-400 leading-relaxed">
                        {faq.answer}
                      </p>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* 交易功能 */}
          <div className="bg-neutral-900/80 border border-neutral-800/80 rounded-xl p-5">
            <div className="flex items-center gap-2 mb-4">
              <div className="w-1 h-4 bg-amber-700 rounded-full" />
              <h3 className="text-sm font-bold text-white">交易功能</h3>
            </div>
            <div className="space-y-3">
              {[
                { question: '支持哪些交易品种？', answer: '目前支持6个品种：德指(DAX)、纳指(NQ)、恒指(HSI)、小恒指(MHSI)、美黄金(GOLD)、美原油(USOIL)。' },
                { question: '如何下单交易？', answer: '在交易页面选择品种，设置方向（做多/做空）、手数、价格，确认后即可下单。也可以使用市价单快速成交。' },
                { question: 'K线图如何查看？', answer: '交易页面提供专业的K线图表，支持不同时间周期切换(1分钟、5分钟、15分钟、1小时、4小时、日线)，点击上方时间按钮切换。' },
                { question: '止盈止损如何设置？', answer: '下单时可以在右侧面板设置止盈止损价格，也可以在持仓页面点击"修改止盈止损"进行调整。' },
                { question: '最低交易手数是多少？', answer: '各品种最低交易手数为0.01手，具体根据合约价值和保证金要求而定。' },
              ].map((faq, index) => (
                <div
                  key={`trade-${index}`}
                  className="bg-neutral-950/60 border border-neutral-800/80 rounded-lg overflow-hidden"
                >
                  <button
                    onClick={() => handleFaqToggle(`trade-${index}`)}
                    className="w-full p-3 text-left hover:bg-neutral-800/60 transition-colors"
                  >
                    <p className="text-sm text-neutral-300 flex items-center justify-between">
                      {faq.question}
                      <span className={`transform transition-transform ${expandedFaq === `trade-${index}` ? 'rotate-180' : ''}`}>
                        ▼
                      </span>
                    </p>
                  </button>
                  {expandedFaq === `trade-${index}` && (
                    <div className="px-3 pb-3 pt-0 border-t border-neutral-800/50">
                      <p className="text-sm text-neutral-400 leading-relaxed">
                        {faq.answer}
                      </p>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* 持仓管理 */}
          <div className="bg-neutral-900/80 border border-neutral-800/80 rounded-xl p-5">
            <div className="flex items-center gap-2 mb-4">
              <div className="w-1 h-4 bg-amber-700 rounded-full" />
              <h3 className="text-sm font-bold text-white">持仓管理</h3>
            </div>
            <div className="space-y-3">
              {[
                { question: '如何查看持仓？', answer: '点击底部导航"持仓"按钮，查看所有未平仓的订单，包括品种、方向、手数、开仓价、当前价、浮动盈亏等信息。' },
                { question: '如何平仓？', answer: '在持仓列表中找到要平仓的订单，点击"平仓"按钮，确认后即可平仓。平仓后盈亏将计入账户余额。' },
                { question: '如何修改止盈止损？', answer: '在持仓页面点击"修改止盈止损"，输入新的止盈止损价格，确认后生效。支持同时修改或单独修改。' },
                { question: '什么是保证金？', answer: '保证金是交易时必须冻结的资金，不同品种的保证金比例不同。持仓期间保证金会被冻结，平仓后释放。' },
                { question: '什么是浮动盈亏？', answer: '浮动盈亏是根据当前价格计算的未实现盈亏，只有平仓后才会变成实际盈亏。' },
              ].map((faq, index) => (
                <div
                  key={`position-${index}`}
                  className="bg-neutral-950/60 border border-neutral-800/80 rounded-lg overflow-hidden"
                >
                  <button
                    onClick={() => handleFaqToggle(`position-${index}`)}
                    className="w-full p-3 text-left hover:bg-neutral-800/60 transition-colors"
                  >
                    <p className="text-sm text-neutral-300 flex items-center justify-between">
                      {faq.question}
                      <span className={`transform transition-transform ${expandedFaq === `position-${index}` ? 'rotate-180' : ''}`}>
                        ▼
                      </span>
                    </p>
                  </button>
                  {expandedFaq === `position-${index}` && (
                    <div className="px-3 pb-3 pt-0 border-t border-neutral-800/50">
                      <p className="text-sm text-neutral-400 leading-relaxed">
                        {faq.answer}
                      </p>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* 智能分析 */}
          <div className="bg-neutral-900/80 border border-neutral-800/80 rounded-xl p-5">
            <div className="flex items-center gap-2 mb-4">
              <div className="w-1 h-4 bg-amber-700 rounded-full" />
              <h3 className="text-sm font-bold text-white">智能分析</h3>
            </div>
            <div className="space-y-3">
              {[
                { question: '什么是智能分析？', answer: '智能分析功能通过AI技术分析K线数据，提供技术指标解读、趋势判断、支撑阻力位识别、风险评估等智能分析结果。' },
                { question: '如何使用智能分析？', answer: '点击底部导航"分析"按钮，选择品种后可查看技术指标、AI分析、策略推荐和回测结果。点击"生成分析"可获取最新分析。' },
                { question: '技术指标有哪些？', answer: '包括MA移动平均线、MACD、RSI、KDJ、布林带等常用指标，每个指标都有详细的数值和解读。' },
                { question: '策略推荐是什么？', answer: '系统根据当前市场状况自动生成3种策略：保守型、稳健型、激进型，每种策略包含操作方向、进场位、止盈位、止损位和预期收益。' },
                { question: '回测结果说明什么？', answer: '回测功能基于历史数据模拟策略表现，显示胜率、盈利交易数、最大回撤、总收益等指标，帮助评估策略效果。' },
              ].map((faq, index) => (
                <div
                  key={`analysis-${index}`}
                  className="bg-neutral-950/60 border border-neutral-800/80 rounded-lg overflow-hidden"
                >
                  <button
                    onClick={() => handleFaqToggle(`analysis-${index}`)}
                    className="w-full p-3 text-left hover:bg-neutral-800/60 transition-colors"
                  >
                    <p className="text-sm text-neutral-300 flex items-center justify-between">
                      {faq.question}
                      <span className={`transform transition-transform ${expandedFaq === `analysis-${index}` ? 'rotate-180' : ''}`}>
                        ▼
                      </span>
                    </p>
                  </button>
                  {expandedFaq === `analysis-${index}` && (
                    <div className="px-3 pb-3 pt-0 border-t border-neutral-800/50">
                      <p className="text-sm text-neutral-400 leading-relaxed">
                        {faq.answer}
                      </p>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* 资金管理 */}
          <div className="bg-neutral-900/80 border border-neutral-800/80 rounded-xl p-5">
            <div className="flex items-center gap-2 mb-4">
              <div className="w-1 h-4 bg-amber-700 rounded-full" />
              <h3 className="text-sm font-bold text-white">资金管理</h3>
            </div>
            <div className="space-y-3">
              {[
                { question: '如何充值？', answer: '进入个人中心-账户充值，选择充值方式（银行卡/USDT），输入金额，按提示完成支付即可。充值后即时到账。' },
                { question: '如何提现？', answer: '进入个人中心-账户提现，选择提现银行卡，输入提现金额，确认后提交。银行卡提现T+1到账。' },
                { question: '如何管理银行卡？', answer: '进入个人中心-银行卡管理，可以添加新的提现银行卡或解绑已绑定银行卡。' },
                { question: '提现需要多长时间？', answer: '银行卡提现通常1-2个工作日到账，节假日可能延长。建议提前规划资金。' },
                { question: '有提现手续费吗？', answer: '根据平台规定收取相应手续费，具体费率以页面显示为准。' },
              ].map((faq, index) => (
                <div
                  key={`fund-${index}`}
                  className="bg-neutral-950/60 border border-neutral-800/80 rounded-lg overflow-hidden"
                >
                  <button
                    onClick={() => handleFaqToggle(`fund-${index}`)}
                    className="w-full p-3 text-left hover:bg-neutral-800/60 transition-colors"
                  >
                    <p className="text-sm text-neutral-300 flex items-center justify-between">
                      {faq.question}
                      <span className={`transform transition-transform ${expandedFaq === `fund-${index}` ? 'rotate-180' : ''}`}>
                        ▼
                      </span>
                    </p>
                  </button>
                  {expandedFaq === `fund-${index}` && (
                    <div className="px-3 pb-3 pt-0 border-t border-neutral-800/50">
                      <p className="text-sm text-neutral-400 leading-relaxed">
                        {faq.answer}
                      </p>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* 账户安全 */}
          <div className="bg-neutral-900/80 border border-neutral-800/80 rounded-xl p-5">
            <div className="flex items-center gap-2 mb-4">
              <div className="w-1 h-4 bg-amber-700 rounded-full" />
              <h3 className="text-sm font-bold text-white">账户安全</h3>
            </div>
            <div className="space-y-3">
              {[
                { question: '如何修改密码？', answer: '进入个人中心-安全设置，点击"登录密码"，输入原密码和新密码即可修改。修改密码后需要重新登录。' },
                { question: '如何绑定手机号？', answer: '进入个人中心-安全设置，点击"手机验证"，输入新手机号和验证码即可绑定或更换。' },
                { question: '如何绑定邮箱？', answer: '进入个人中心-安全设置，点击"邮箱验证"，输入邮箱地址和验证码即可绑定邮箱。' },
                { question: '忘记密码怎么办？', answer: '在登录页面点击"忘记密码"，通过已绑定的手机号接收验证码验证后可重置密码。' },
                { question: '账户安全提示？', answer: '请妥善保管账户密码，不要分享给他人。定期修改密码，启用手机验证，保障账户安全。' },
              ].map((faq, index) => (
                <div
                  key={`security-${index}`}
                  className="bg-neutral-950/60 border border-neutral-800/80 rounded-lg overflow-hidden"
                >
                  <button
                    onClick={() => handleFaqToggle(`security-${index}`)}
                    className="w-full p-3 text-left hover:bg-neutral-800/60 transition-colors"
                  >
                    <p className="text-sm text-neutral-300 flex items-center justify-between">
                      {faq.question}
                      <span className={`transform transition-transform ${expandedFaq === `security-${index}` ? 'rotate-180' : ''}`}>
                        ▼
                      </span>
                    </p>
                  </button>
                  {expandedFaq === `security-${index}` && (
                    <div className="px-3 pb-3 pt-0 border-t border-neutral-800/50">
                      <p className="text-sm text-neutral-400 leading-relaxed">
                        {faq.answer}
                      </p>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* 常见问题 */}
          <div className="bg-neutral-900/80 border border-neutral-800/80 rounded-xl p-5">
            <div className="flex items-center gap-2 mb-4">
              <div className="w-1 h-4 bg-amber-700 rounded-full" />
              <h3 className="text-sm font-bold text-white">常见问题</h3>
            </div>
            <div className="space-y-3">
              {[
                { question: '交易时间是什么？', answer: '不同品种交易时间不同：德指、纳指为北京时间晚20:00-次日04:00；恒指、小恒指为北京时间09:00-12:00、13:00-16:00；美黄金、美原油为北京时间06:00-次日05:00（冬令时）。' },
                { question: '遇到网络异常怎么办？', answer: '请检查网络连接，切换网络环境。如持续异常，请联系技术支持。持仓和订单会保存在服务器，重新登录后可正常查看。' },
                { question: '数据更新延迟怎么办？', answer: '行情数据实时推送，如遇延迟可尝试刷新页面或重新连接WebSocket。如有持续问题请检查网络状况。' },
                { question: '如何退出登录？', answer: '在个人中心页面底部点击"退出登录"按钮，确认后即可退出。建议每次使用后退出登录，保障账户安全。' },
              ].map((faq, index) => (
                <div
                  key={`common-${index}`}
                  className="bg-neutral-950/60 border border-neutral-800/80 rounded-lg overflow-hidden"
                >
                  <button
                    onClick={() => handleFaqToggle(`common-${index}`)}
                    className="w-full p-3 text-left hover:bg-neutral-800/60 transition-colors"
                  >
                    <p className="text-sm text-neutral-300 flex items-center justify-between">
                      {faq.question}
                      <span className={`transform transition-transform ${expandedFaq === `common-${index}` ? 'rotate-180' : ''}`}>
                        ▼
                      </span>
                    </p>
                  </button>
                  {expandedFaq === `common-${index}` && (
                    <div className="px-3 pb-3 pt-0 border-t border-neutral-800/50">
                      <p className="text-sm text-neutral-400 leading-relaxed">
                        {faq.answer}
                      </p>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
