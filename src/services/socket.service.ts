import { io, Socket } from 'socket.io-client';

// WebSocket 服务配置
const SOCKET_URL = import.meta.env.VITE_WS_URL || 'http://localhost:3001';

class SocketService {
  private socket: Socket | null = null;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;
  private reconnectDelay = 1000;

  /**
   * 连接 WebSocket
   */
  connect(): void {
    if (this.socket?.connected) {
      console.log('[WebSocket] Already connected');
      return;
    }

    this.socket = io(SOCKET_URL, {
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionDelay: this.reconnectDelay,
      reconnectionDelayMax: 10000,
      reconnectionAttempts: this.maxReconnectAttempts
    });

    this.setupEventListeners();
    console.log('[WebSocket] Connecting to', SOCKET_URL);
  }

  /**
   * 断开连接
   */
  disconnect(): void {
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
      console.log('[WebSocket] Disconnected');
    }
  }

  /**
   * 设置事件监听器
   */
  private setupEventListeners(): void {
    if (!this.socket) return;

    this.socket.on('connect', () => {
      console.log('[WebSocket] Connected:', this.socket?.id);
      this.reconnectAttempts = 0;
    });

    this.socket.on('disconnect', (reason: string) => {
      console.log('[WebSocket] Disconnected:', reason);
    });

    this.socket.on('connect_error', (error: Error) => {
      console.error('[WebSocket] Connection error:', error.message);
      this.reconnectAttempts++;
      
      if (this.reconnectAttempts >= this.maxReconnectAttempts) {
        console.error('[WebSocket] Max reconnection attempts reached');
      }
    });

    this.socket.on('reconnect', (attemptNumber: number) => {
      console.log('[WebSocket] Reconnected after', attemptNumber, 'attempts');
    });
  }

  /**
   * 订阅行情数据
   */
  subscribeMarket(symbols: string[], callback: (data: any) => void): void {
    if (!this.socket || !this.socket.connected) {
      console.warn('[WebSocket] Not connected, cannot subscribe to market');
      return;
    }

    this.socket.emit('subscribe:market', symbols);
    
    this.socket.on('market:data', callback);
    this.socket.on('market:update', callback);
    
    console.log('[WebSocket] Subscribed to market:', symbols);
  }

  /**
   * 取消订阅行情数据
   */
  unsubscribeMarket(): void {
    if (!this.socket) return;

    this.socket.emit('unsubscribe:market');
    this.socket.off('market:data');
    this.socket.off('market:update');
    
    console.log('[WebSocket] Unsubscribed from market');
  }

  /**
   * 订阅持仓更新
   */
  subscribePositions(userId: string, callback: (data: any) => void): void {
    if (!this.socket || !this.socket.connected) {
      console.warn('[WebSocket] Not connected, cannot subscribe to positions');
      return;
    }

    this.socket.emit('subscribe:positions', userId);
    this.socket.on(`positions:${userId}`, callback);
    
    console.log('[WebSocket] Subscribed to positions:', userId);
  }

  /**
   * 取消订阅持仓更新
   */
  unsubscribePositions(userId: string): void {
    if (!this.socket) return;

    this.socket.off(`positions:${userId}`);
    console.log('[WebSocket] Unsubscribed from positions:', userId);
  }

  /**
   * 订阅订单状态更新
   */
  subscribeOrders(userId: string, callback: (data: any) => void): void {
    if (!this.socket || !this.socket.connected) {
      console.warn('[WebSocket] Not connected, cannot subscribe to orders');
      return;
    }

    this.socket.emit('subscribe:orders', userId);
    this.socket.on(`orders:${userId}`, callback);
    this.socket.on('order:update', callback);
    this.socket.on('order:filled', callback);
    this.socket.on('order:cancelled', callback);
    this.socket.on('order:rejected', callback);

    console.log('[WebSocket] Subscribed to orders:', userId);
  }

  /**
   * 取消订阅订单状态更新
   */
  unsubscribeOrders(userId: string): void {
    if (!this.socket) return;

    this.socket.off(`orders:${userId}`);
    this.socket.off('order:update');
    this.socket.off('order:filled');
    this.socket.off('order:cancelled');
    this.socket.off('order:rejected');

    console.log('[WebSocket] Unsubscribed from orders:', userId);
  }

  /**
   * 订阅系统通知
   */
  subscribeNotifications(userId: string, callback: (data: any) => void): void {
    if (!this.socket || !this.socket.connected) {
      console.warn('[WebSocket] Not connected, cannot subscribe to notifications');
      return;
    }

    this.socket.emit('subscribe:notifications', userId);
    this.socket.on(`notifications:${userId}`, callback);
    this.socket.on('notification', callback);

    console.log('[WebSocket] Subscribed to notifications:', userId);
  }

  /**
   * 取消订阅系统通知
   */
  unsubscribeNotifications(userId: string): void {
    if (!this.socket) return;

    this.socket.off(`notifications:${userId}`);
    this.socket.off('notification');

    console.log('[WebSocket] Unsubscribed from notifications:', userId);
  }

  /**
   * 检查连接状态
   */
  isConnected(): boolean {
    return this.socket?.connected || false;
  }

  /**
   * 获取 Socket 实例
   */
  getSocket(): Socket | null {
    return this.socket;
  }
}

// 导出单例
export const socketService = new SocketService();
