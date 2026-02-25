// ============================================
// WebSocket 服务 - 实时行情推送 (使用 Socket.IO)
// ============================================

import { io, Socket } from 'socket.io-client';

type WebSocketMessage = {
  type: 'quote' | 'trade' | 'position' | 'alert';
  symbols?: string[];
  data?: any[];
  timestamp: number;
};

type WebSocketCallback = (message: WebSocketMessage) => void;

class WebSocketService {
  private socket: Socket | null = null;
  private reconnectTimer: NodeJS.Timeout | null = null;
  private callbacks: WebSocketCallback[] = [];
  private isConnected: boolean = false;
  private reconnectAttempts: number = 0;
  private readonly maxReconnectAttempts = 5;
  private readonly reconnectDelay = 3000; // 3秒重连间隔

  constructor() {
    this.connect();
  }

  /**
   * 连接WebSocket服务器
   */
  connect(): void {
    const wsUrl = import.meta.env.VITE_WS_URL || 'http://localhost:3001';

    console.log(`[WebSocket] 正在连接到 ${wsUrl}...`);

    this.socket = io(wsUrl, {
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionDelay: 3000,
      reconnectionAttempts: 5
    });

    this.socket.on('connect', () => {
      console.log('[WebSocket] 连接成功');
      this.isConnected = true;
      this.reconnectAttempts = 0;

      // 订阅市场行情
      this.socket?.emit('subscribe:market', ['CENQA0', 'HIHHI01', 'CMGCA0', 'CEDAXA0', 'NECLA0', 'HIMCH01']);

      // 通知所有回调函数
      this.notifyCallbacks({
        type: 'quote',
        symbols: [],
        data: [],
        timestamp: Date.now()
      });
    });

    this.socket.on('disconnect', (reason) => {
      console.log(`[WebSocket] 连接关闭: ${reason}`);
      this.isConnected = false;
    });

    this.socket.on('connect_error', (error) => {
      console.error('[WebSocket] 连接错误:', error);
      this.isConnected = false;
    });

    this.socket.on('market:data', (data) => {
      console.log('[WebSocket] 收到行情数据:', data.length, '个产品');

      // 通知所有回调函数
      this.notifyCallbacks({
        type: 'quote',
        symbols: data.map((d: any) => d.productCode),
        data: data,
        timestamp: Date.now()
      });
    });

    // 监听行情更新推送
    this.socket.on('market:update', (data) => {
      console.log('[WebSocket] 收到行情更新:', data.symbols?.length || 0, '个产品');

      // 通知所有回调函数
      this.notifyCallbacks({
        type: 'quote',
        symbols: data.symbols || [],
        data: data.data || [],
        timestamp: Date.now()
      });
    });
  }

  /**
   * 订阅频道
   */
  subscribe(channel: string): void {
    if (!this.isConnected || !this.socket) {
      console.warn('[WebSocket] 未连接，无法订阅');
      return;
    }

    this.socket.emit(`subscribe:${channel}`);
    console.log(`[WebSocket] 已订阅频道: ${channel}`);
  }

  /**
   * 取消订阅频道
   */
  unsubscribe(channel: string): void {
    if (!this.isConnected || !this.socket) {
      return;
    }

    this.socket.emit(`unsubscribe:${channel}`);
    console.log(`[WebSocket] 已取消订阅频道: ${channel}`);
  }

  /**
   * 添加消息回调
   */
  onMessage(callback: WebSocketCallback): void {
    this.callbacks.push(callback);
  }

  /**
   * 移除消息回调
   */
  offMessage(callback: WebSocketCallback): void {
    const index = this.callbacks.indexOf(callback);
    if (index > -1) {
      this.callbacks.splice(index, 1);
    }
  }

  /**
   * 通知所有回调函数
   */
  private notifyCallbacks(message: WebSocketMessage): void {
    this.callbacks.forEach(callback => {
      try {
        callback(message);
      } catch (error) {
        console.error('[WebSocket] 回调函数执行失败:', error);
      }
    });
  }

  /**
   * 安排重连
   */
  private scheduleReconnect(): void {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      console.error('[WebSocket] 达到最大重连次数，停止重连');
      return;
    }

    if (this.reconnectTimer) {
      return;
    }

    this.reconnectAttempts++;
    const delay = this.reconnectDelay * this.reconnectAttempts; // 递增延迟

    console.log(`[WebSocket] ${delay}ms 后尝试重连 (第 ${this.reconnectAttempts} 次)`);

    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      this.connect();
    }, delay);
  }

  /**
   * 断开连接
   */
  disconnect(): void {
    console.log('[WebSocket] 断开连接');

    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }

    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
    }

    this.isConnected = false;
    this.reconnectAttempts = 0;
  }

  /**
   * 获取连接状态
   */
  getConnectionStatus(): boolean {
    return this.isConnected;
  }
}

// 创建单例
export const wsService = new WebSocketService();

export default wsService;
