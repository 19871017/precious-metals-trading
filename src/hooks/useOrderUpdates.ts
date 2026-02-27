import { useEffect, useState, useCallback } from 'react';
import { socketService } from '../services/socket.service';
import { Order } from '../types';

export interface OrderUpdateData {
  orderId: string;
  status: 'pending' | 'filled' | 'cancelled' | 'rejected';
  filledPrice?: number;
  filledQuantity?: number;
  filledTime?: string;
  reason?: string;
}

export function useOrderUpdates(userId: string, orders: Order[], setOrders: React.Dispatch<React.SetStateAction<Order[]>>) {
  const [connected, setConnected] = useState(false);

  useEffect(() => {
    if (!userId) return;

    console.log('[OrderUpdates] Subscribing to order updates for user:', userId);

    const handleOrderUpdate = (data: OrderUpdateData) => {
      console.log('[OrderUpdates] Received order update:', data);

      setOrders(prevOrders => {
        return prevOrders.map(order => {
          if (order.id === data.orderId || order.orderId === data.orderId) {
            const updatedOrder = { ...order };

            if (data.status) {
              updatedOrder.status = data.status;
            }

            if (data.filledPrice !== undefined) {
              updatedOrder.price = data.filledPrice;
            }

            if (data.filledQuantity !== undefined) {
              updatedOrder.quantity = data.filledQuantity;
            }

            if (data.filledTime) {
              updatedOrder.createTime = data.filledTime;
            }

            if (data.reason) {
              updatedOrder.reason = data.reason;
            }

            return updatedOrder;
          }
          return order;
        });
      });
    };

    const handleOrderFilled = (data: OrderUpdateData) => {
      console.log('[OrderUpdates] Order filled:', data);
      handleOrderUpdate({ ...data, status: 'filled' });

      if (typeof window !== 'undefined' && 'Audio' in window) {
        try {
          const audio = new Audio('/sounds/order-filled.mp3');
          audio.play().catch(err => console.log('Audio play failed:', err));
        } catch (err) {
          console.log('Audio not available');
        }
      }
    };

    const handleOrderCancelled = (data: OrderUpdateData) => {
      console.log('[OrderUpdates] Order cancelled:', data);
      handleOrderUpdate({ ...data, status: 'cancelled' });
    };

    const handleOrderRejected = (data: OrderUpdateData) => {
      console.log('[OrderUpdates] Order rejected:', data);
      handleOrderUpdate({ ...data, status: 'rejected' });
    };

    socketService.subscribeOrders(userId, handleOrderUpdate);
    socketService.getSocket()?.on('order:filled', handleOrderFilled);
    socketService.getSocket()?.on('order:cancelled', handleOrderCancelled);
    socketService.getSocket()?.on('order:rejected', handleOrderRejected);

    setConnected(socketService.isConnected());

    return () => {
      socketService.unsubscribeOrders(userId);
      socketService.getSocket()?.off('order:filled', handleOrderFilled);
      socketService.getSocket()?.off('order:cancelled', handleOrderCancelled);
      socketService.getSocket()?.off('order:rejected', handleOrderRejected);
    };
  }, [userId, setOrders]);

  return { connected };
}

export function usePositionUpdates(userId: string, positions: any[], setPositions: React.Dispatch<React.SetStateAction<any[]>>) {
  const [connected, setConnected] = useState(false);

  useEffect(() => {
    if (!userId) return;

    console.log('[PositionUpdates] Subscribing to position updates for user:', userId);

    const handlePositionUpdate = (data: any) => {
      console.log('[PositionUpdates] Received position update:', data);

      setPositions(prevPositions => {
        return prevPositions.map(pos => {
          if (pos.id === data.id || pos.positionId === data.positionId) {
            return { ...pos, ...data };
          }
          return pos;
        });
      });
    };

    socketService.subscribePositions(userId, handlePositionUpdate);
    setConnected(socketService.isConnected());

    return () => {
      socketService.unsubscribePositions(userId);
    };
  }, [userId, setPositions]);

  return { connected };
}

export function useNotificationUpdates(userId: string, onNotification?: (data: any) => void) {
  const [notifications, setNotifications] = useState<any[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);

  useEffect(() => {
    if (!userId) return;

    console.log('[NotificationUpdates] Subscribing to notifications for user:', userId);

    const handleNotification = (data: any) => {
      console.log('[NotificationUpdates] Received notification:', data);
      setNotifications(prev => [data, ...prev].slice(0, 50));
      setUnreadCount(prev => prev + 1);

      if (onNotification) {
        onNotification(data);
      }
    };

    socketService.subscribeNotifications(userId, handleNotification);

    return () => {
      socketService.unsubscribeNotifications(userId);
    };
  }, [userId, onNotification]);

  const markAsRead = useCallback((notificationId: string) => {
    setNotifications(prev => {
      const updated = prev.map(n => {
        if (n.id === notificationId) {
          return { ...n, read: true };
        }
        return n;
      });
      setUnreadCount(updated.filter(n => !n.read).length);
      return updated;
    });
  }, []);

  const markAllAsRead = useCallback(() => {
    setNotifications(prev => {
      const updated = prev.map(n => ({ ...n, read: true }));
      setUnreadCount(0);
      return updated;
    });
  }, []);

  return {
    notifications,
    unreadCount,
    markAsRead,
    markAllAsRead,
  };
}
