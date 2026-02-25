import crypto from 'crypto';

/**
 * 生成唯一代理代码
 * 格式: AGENT + 6位随机数字
 */
export async function generateAgentCode(): Promise<string> {
  const prefix = 'AGENT';
  const randomNum = Math.floor(Math.random() * 1000000).toString().padStart(6, '0');
  return `${prefix}${randomNum}`;
}

/**
 * 验证代理代码格式
 * 格式: AGENT + 6位数字
 */
export function validateAgentCodeFormat(code: string): boolean {
  return /^AGENT\d{6}$/.test(code);
}

/**
 * 计算分佣金额
 * @param baseAmount 基础金额（交易手续费或盈亏）
 * @param commissionRate 分佣比例（0.0000 ~ 1.0000）
 * @returns 分佣金额
 */
export function calculateCommission(baseAmount: number, commissionRate: number): number {
  return parseFloat((baseAmount * commissionRate).toFixed(2));
}

/**
 * 生成订单号
 * 格式: ORD + 时间戳 + 3位随机数
 */
export function generateOrderNumber(): string {
  const timestamp = Date.now();
  const random = Math.floor(Math.random() * 1000).toString().padStart(3, '0');
  return `ORD${timestamp}${random}`;
}

/**
 * 生成交易流水号
 * 格式: TXN + 时间戳 + 4位随机数
 */
export function generateTransactionId(): string {
  const timestamp = Date.now();
  const random = Math.floor(Math.random() * 10000).toString().padStart(4, '0');
  return `TXN${timestamp}${random}`;
}

/**
 * 验证手机号格式（中国大陆）
 */
export function validatePhoneNumber(phone: string): boolean {
  return /^1[3-9]\d{9}$/.test(phone);
}

/**
 * 验证邮箱格式
 */
export function validateEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

/**
 * 验证身份证号格式（中国大陆）
 */
export function validateIdCard(idCard: string): boolean {
  // 简单验证：18位数字或最后一位X
  return /^\d{17}[\dXx]$/.test(idCard);
}

/**
 * 格式化金额（保留两位小数）
 */
export function formatAmount(amount: number): string {
  return parseFloat(amount.toFixed(2)).toLocaleString('zh-CN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  });
}

/**
 * 计算天数差
 */
export function getDaysBetween(startDate: Date, endDate: Date): number {
  const oneDay = 24 * 60 * 60 * 1000;
  const diffTime = Math.abs(endDate.getTime() - startDate.getTime());
  return Math.floor(diffTime / oneDay);
}

/**
 * 获取今天的开始时间（00:00:00）
 */
export function getTodayStart(): Date {
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  return now;
}

/**
 * 获取今天的结束时间（23:59:59）
 */
export function getTodayEnd(): Date {
  const now = new Date();
  now.setHours(23, 59, 59, 999);
  return now;
}

/**
 * 获取某月的开始日期
 */
export function getMonthStart(year: number, month: number): Date {
  return new Date(year, month - 1, 1);
}

/**
 * 获取某月的结束日期
 */
export function getMonthEnd(year: number, month: number): Date {
  return new Date(year, month, 0, 23, 59, 59, 999);
}

/**
 * 分页计算
 */
export function calculatePagination(
  total: number,
  page: number,
  pageSize: number
): {
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
  offset: number;
} {
  const totalPages = Math.ceil(total / pageSize);
  const offset = (page - 1) * pageSize;

  return {
    total,
    page,
    pageSize,
    totalPages,
    offset
  };
}

/**
 * 生成MD5哈希
 */
export function md5(text: string): string {
  return crypto.createHash('md5').update(text).digest('hex');
}

/**
 * 生成随机字符串
 */
export function randomString(length: number = 16): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let result = '';
  for (let i = 0; i < length; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

/**
 * 延迟函数
 */
export function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * 获取客户端IP
 */
export function getClientIp(req: any): string {
  return (
    req.headers['x-forwarded-for']?.split(',')[0] ||
    req.headers['x-real-ip'] ||
    req.connection?.remoteAddress ||
    req.socket?.remoteAddress ||
    req.ip ||
    '0.0.0.0'
  );
}

/**
 * 获取用户代理信息
 */
export async function getAgentInfo(
  pool: any,
  userId: number
): Promise<{
    agentId: number;
    agentCode: string;
    agentType: number;
    agentName: string;
    parentAgentId: number | null;
  } | null> {
  const result = await pool.query(
    `SELECT a.id as agent_id, a.agent_code, a.agent_type, a.real_name as agent_name, a.parent_agent_id
     FROM users u
     JOIN agents a ON u.agent_id = a.id
     WHERE u.id = $1`,
    [userId]
  );

  return result.rows.length > 0 ? result.rows[0] : null;
}

/**
 * 检查是否是总代理
 */
export function isTotalAgent(agentType: number): boolean {
  return agentType === 1;
}

/**
 * 检查是否是分代理
 */
export function isSubAgent(agentType: number): boolean {
  return agentType === 2;
}
