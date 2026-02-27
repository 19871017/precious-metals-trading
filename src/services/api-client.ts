import axios, { AxiosError, InternalAxiosRequestConfig, AxiosRequestConfig, AxiosResponse } from 'axios';

// 创建 axios 实例
const apiClient = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL || 'http://localhost:3001',
  timeout: 30000,
  headers: {
    'Content-Type': 'application/json',
  },
});

// 请求拦截器
apiClient.interceptors.request.use(
  (config) => {
    // 从 localStorage 获取 token
    const token = localStorage.getItem('token');

    if (token) {
      config.headers = {
        ...config.headers,
        Authorization: `Bearer ${token}`,
      };
    }

    // 添加请求时间戳
    config.metadata = {
      ...config.metadata,
      startTime: Date.now(),
    };

    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// 响应拦截器
apiClient.interceptors.response.use(
  (response: AxiosResponse) => {
    const config = response.config as InternalAxiosRequestConfig & { metadata: { startTime: number } };
    const endTime = Date.now();
    const duration = endTime - config.metadata?.startTime;

    // 打印请求耗时（开发环境）
    if (import.meta.env.DEV) {
      console.log(`API Request: ${config.url?.split('?')[0]} (${duration}ms)`, {
        status: response.status,
        data: response.data,
      });
    }

    return response;
  },
  (error: AxiosError) => {
    const config = error.config as InternalAxiosRequestConfig & { metadata: { startTime: number } };
    const endTime = Date.now();
    const duration = endTime - config.metadata?.startTime;

    if (import.meta.env.DEV) {
      console.error(`API Error: ${config?.url?.split('?')[0]} (${duration}ms)`, {
        status: error.response?.status,
        message: error.message,
        response: error.response?.data,
      });
    }

    // 统一错误处理
    if (error.response) {
      const { status, data } = error.response;

      switch (status) {
        case 401:
          // 未授权，token过期
          localStorage.removeItem('token');
          localStorage.removeItem('user');
          window.location.href = '/login';
          break;

        case 403:
          // 权限不足
          console.error('权限不足');
          break;

        case 404:
          // 资源不存在
          console.error('资源不存在');
          break;

        case 429:
          // 请求过多
          console.error('请求过于频繁');
          break;

        case 500:
          // 服务器错误
          console.error('服务器内部错误');
          break;

        default:
          // 其他错误
          if (data && typeof data === 'object') {
            const apiError = data as { code?: number; message?: string };
            if (apiError.code && apiError.code !== 0) {
              console.error(`API Error [${apiError.code}]:`, apiError.message);
            }
          }
          break;
      }
    } else if (error.request) {
      // 请求已发出但没有收到响应
      console.error('网络错误，请检查网络连接');
    } else {
      // 在设置请求时触发了错误
      console.error('请求配置错误:', error.message);
    }

    return Promise.reject(error);
  }
);

// 统一的 API 错误类
export class ApiError extends Error {
  constructor(
    public code: number,
    public message: string,
    public data?: any
  ) {
    super(message);
    this.name = 'ApiError';
  }

  static isApiError(error: any): error is ApiError {
    return error instanceof ApiError;
  }
}

// 错误码枚举
export enum ApiErrorCode {
  SUCCESS = 0,
  UNAUTHORIZED = 401,
  FORBIDDEN = 403,
  NOT_FOUND = 404,
  VALIDATION_ERROR = 400,
  INTERNAL_ERROR = 500,
  RATE_LIMIT = 429,
}

// 错误信息映射
export const getErrorMessage = (code: number, defaultMessage: string = '操作失败'): string => {
  const errorMessages: Record<number, string> = {
    [ApiErrorCode.UNAUTHORIZED]: '登录已过期，请重新登录',
    [ApiErrorCode.FORBIDDEN]: '没有权限执行此操作',
    [ApiErrorCode.NOT_FOUND]: '请求的资源不存在',
    [ApiErrorCode.VALIDATION_ERROR]: '请求参数不正确',
    [ApiErrorCode.INTERNAL_ERROR]: '服务器内部错误，请稍后重试',
    [ApiErrorCode.RATE_LIMIT]: '请求过于频繁，请稍后再试',
  };

  return errorMessages[code] || defaultMessage;
};

export default apiClient;
