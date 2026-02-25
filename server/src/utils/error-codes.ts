/**
 * 统一业务错误码规范
 * 格式: 5位数字
 * - 第一位: 模块 (1-通用, 2-用户, 3-交易, 4-财务, 5-行情, 6-风控, 7-管理, 9-系统)
 * - 第二位: 错误类型 (0-成功, 1-参数错误, 2-业务错误, 3-权限错误, 4-资源错误, 5-并发错误, 9-系统错误)
 * - 后三位: 具体错误序号
 */

export enum ErrorCode {
  // 成功
  SUCCESS = 0,

  // ========== 通用错误 (1xxxx) ==========
  // 参数错误 (10xxx)
  INVALID_PARAM = 10001,
  MISSING_PARAM = 10002,
  INVALID_FORMAT = 10003,
  OUT_OF_RANGE = 10004,

  // 业务错误 (12xxx)
  DUPLICATE_REQUEST = 12001,

  // 权限错误 (13xxx)
  UNAUTHORIZED = 13001,
  FORBIDDEN = 13002,
  TOKEN_INVALID = 13003,
  TOKEN_EXPIRED = 13004,
  TOKEN_MISSING = 13005,

  // 资源错误 (14xxx)
  RESOURCE_NOT_FOUND = 14001,

  // 并发错误 (15xxx)
  CONFLICT = 15001,
  LOCK_FAILED = 15002,

  // 系统错误 (19xxx)
  INTERNAL_ERROR = 19999,
  SERVICE_UNAVAILABLE = 19998,

  // ========== 用户模块 (2xxxx) ==========
  // 业务错误 (22xxx)
  USER_NOT_FOUND = 22001,
  USER_ALREADY_EXISTS = 22002,
  USER_DISABLED = 22003,
  PASSWORD_WRONG = 22004,
  PASSWORD_TOO_WEAK = 22005,
  VERIFICATION_CODE_WRONG = 22006,
  VERIFICATION_CODE_EXPIRED = 22007,

  // ========== 交易模块 (3xxxx) ==========
  // 业务错误 (32xxx)
  ORDER_NOT_FOUND = 32001,
  ORDER_ALREADY_FILLED = 32002,
  ORDER_ALREADY_CANCELLED = 32003,
  ORDER_CANNOT_CANCEL = 32004,
  MARKET_CLOSED = 32005,
  INSUFFICIENT_MARGIN = 32006,
  INSUFFICIENT_BALANCE = 32007,
  POSITION_NOT_FOUND = 32008,
  POSITION_ALREADY_CLOSED = 32009,

  // 并发错误 (35xxx)
  ORDER_LOCK_FAILED = 35001,
  MARGIN_LOCK_FAILED = 35002,

  // ========== 财务模块 (4xxxx) ==========
  // 业务错误 (42xxx)
  TRANSACTION_NOT_FOUND = 42001,
  DEPOSIT_TOO_LOW = 42002,
  WITHDRAW_TOO_HIGH = 42003,
  WITHDRAW_LIMIT_EXCEEDED = 42004,
  INSUFFICIENT_FUNDS = 42005,

  // ========== 风控模块 (6xxxx) ==========
  // 业务错误 (62xxx)
  RISK_LEVEL_HIGH = 62001,
  RISK_LEVEL_CRITICAL = 62002,
  POSITION_LIQUIDATED = 62003,
  POSITION_FORCE_CLOSE = 62004,

  // ========== 管理模块 (7xxxx) ==========
  // 权限错误 (73xxx)
  ADMIN_REQUIRED = 73001,
  PERMISSION_DENIED = 73002,

  // 业务错误 (72xxx)
  AGENT_NOT_FOUND = 72001,
  AGENT_ALREADY_EXISTS = 72002,
  AGENT_DISABLED = 72003,
}

/**
 * 错误码消息映射
 */
export const ErrorMessages: Record<ErrorCode, string> = {
  [ErrorCode.SUCCESS]: '操作成功',

  // 通用错误
  [ErrorCode.INVALID_PARAM]: '参数无效',
  [ErrorCode.MISSING_PARAM]: '缺少必需参数',
  [ErrorCode.INVALID_FORMAT]: '格式错误',
  [ErrorCode.OUT_OF_RANGE]: '超出允许范围',
  [ErrorCode.DUPLICATE_REQUEST]: '重复请求',
  [ErrorCode.UNAUTHORIZED]: '未授权',
  [ErrorCode.FORBIDDEN]: '禁止访问',
  [ErrorCode.TOKEN_INVALID]: '令牌无效',
  [ErrorCode.TOKEN_EXPIRED]: '令牌已过期',
  [ErrorCode.TOKEN_MISSING]: '缺少令牌',
  [ErrorCode.RESOURCE_NOT_FOUND]: '资源不存在',
  [ErrorCode.CONFLICT]: '资源冲突',
  [ErrorCode.LOCK_FAILED]: '获取锁失败',
  [ErrorCode.INTERNAL_ERROR]: '系统内部错误',
  [ErrorCode.SERVICE_UNAVAILABLE]: '服务不可用',

  // 用户模块
  [ErrorCode.USER_NOT_FOUND]: '用户不存在',
  [ErrorCode.USER_ALREADY_EXISTS]: '用户已存在',
  [ErrorCode.USER_DISABLED]: '用户已禁用',
  [ErrorCode.PASSWORD_WRONG]: '密码错误',
  [ErrorCode.PASSWORD_TOO_WEAK]: '密码强度不足',
  [ErrorCode.VERIFICATION_CODE_WRONG]: '验证码错误',
  [ErrorCode.VERIFICATION_CODE_EXPIRED]: '验证码已过期',

  // 交易模块
  [ErrorCode.ORDER_NOT_FOUND]: '订单不存在',
  [ErrorCode.ORDER_ALREADY_FILLED]: '订单已成交',
  [ErrorCode.ORDER_ALREADY_CANCELLED]: '订单已取消',
  [ErrorCode.ORDER_CANNOT_CANCEL]: '订单不可取消',
  [ErrorCode.MARKET_CLOSED]: '市场已关闭',
  [ErrorCode.INSUFFICIENT_MARGIN]: '保证金不足',
  [ErrorCode.INSUFFICIENT_BALANCE]: '余额不足',
  [ErrorCode.POSITION_NOT_FOUND]: '持仓不存在',
  [ErrorCode.POSITION_ALREADY_CLOSED]: '持仓已关闭',
  [ErrorCode.ORDER_LOCK_FAILED]: '获取订单锁失败',
  [ErrorCode.MARGIN_LOCK_FAILED]: '获取保证金锁失败',

  // 财务模块
  [ErrorCode.TRANSACTION_NOT_FOUND]: '交易记录不存在',
  [ErrorCode.DEPOSIT_TOO_LOW]: '充值金额过低',
  [ErrorCode.WITHDRAW_TOO_HIGH]: '提现金额过高',
  [ErrorCode.WITHDRAW_LIMIT_EXCEEDED]: '超出每日提现限额',
  [ErrorCode.INSUFFICIENT_FUNDS]: '资金不足',

  // 风控模块
  [ErrorCode.RISK_LEVEL_HIGH]: '风险等级过高',
  [ErrorCode.RISK_LEVEL_CRITICAL]: '风险等级严重',
  [ErrorCode.POSITION_LIQUIDATED]: '仓位已强平',
  [ErrorCode.POSITION_FORCE_CLOSE]: '仓位已强制平仓',

  // 管理模块
  [ErrorCode.ADMIN_REQUIRED]: '需要管理员权限',
  [ErrorCode.PERMISSION_DENIED]: '权限不足',
  [ErrorCode.AGENT_NOT_FOUND]: '代理不存在',
  [ErrorCode.AGENT_ALREADY_EXISTS]: '代理已存在',
  [ErrorCode.AGENT_DISABLED]: '代理已禁用',
};

/**
 * 创建标准错误响应
 */
export function createErrorResponse(code: ErrorCode, message?: string, data?: any) {
  return {
    code,
    message: message || ErrorMessages[code] || '未知错误',
    data: data || null,
    timestamp: Date.now()
  };
}

/**
 * 创建成功响应
 */
export function createSuccessResponse(data: any, message: string = '操作成功') {
  return {
    code: ErrorCode.SUCCESS,
    message,
    data,
    timestamp: Date.now()
  };
}
