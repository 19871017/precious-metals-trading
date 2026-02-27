import { useState, useEffect } from 'react';
import { Drawer, List, Tag, Button, Space, Badge, Empty } from 'tdesign-react';
import { NotificationIcon, CheckIcon, DeleteIcon } from 'tdesign-icons-react';
import { useNotificationUpdates } from '../hooks/useOrderUpdates';

interface NotificationItem {
  id: string;
  type: 'info' | 'success' | 'warning' | 'error';
  title: string;
  content: string;
  timestamp: string;
  read: boolean;
}

export default function NotificationDrawer({ visible, onClose, userId }: { visible: boolean; onClose: () => void; userId: string }) {
  const { notifications, unreadCount, markAsRead, markAllAsRead } = useNotificationUpdates(userId);

  const getTypeTag = (type: string) => {
    const config: Record<string, { text: string; theme: any; icon: any }> = {
      info: { text: '信息', theme: 'primary', icon: NotificationIcon },
      success: { text: '成功', theme: 'success', icon: CheckIcon },
      warning: { text: '警告', theme: 'warning', icon: NotificationIcon },
      error: { text: '错误', theme: 'danger', icon: NotificationIcon },
    };
    const { text, theme } = config[type] || config.info;
    return <Tag theme={theme} variant="light">{text}</Tag>;
  };

  const formatTime = (timestamp: string) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);

    if (days > 0) return `${days}天前`;
    if (hours > 0) return `${hours}小时前`;
    if (minutes > 0) return `${minutes}分钟前`;
    return '刚刚';
  };

  return (
    <Drawer
      header={
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <NotificationIcon size="20px" className="text-amber-500" />
            <span className="text-base font-semibold text-white">系统通知</span>
          </div>
          {unreadCount > 0 && (
            <Badge count={unreadCount} dot={false} theme="primary" size="small">
              <span className="text-xs text-neutral-400">{unreadCount}条未读</span>
            </Badge>
          )}
        </div>
      }
      visible={visible}
      onClose={onClose}
      size="380px"
      footer={
        <div className="flex gap-2">
          {unreadCount > 0 && (
            <Button theme="primary" variant="outline" block onClick={markAllAsRead}>
              全部标记已读
            </Button>
          )}
          <Button theme="default" variant="outline" block onClick={onClose}>
            关闭
          </Button>
        </div>
      }
    >
      <div className="h-full overflow-y-auto">
        {notifications.length === 0 ? (
          <Empty
            description="暂无通知"
            image={
              <div className="text-center py-12">
                <NotificationIcon size="64px" className="text-neutral-700 mx-auto mb-4" />
                <p className="text-sm text-neutral-500">暂无通知消息</p>
              </div>
            }
          />
        ) : (
          <List>
            {notifications.map((notification: NotificationItem) => (
              <List.ListItem
                key={notification.id}
                className={`!px-4 !py-3 hover:bg-neutral-800/50 transition-colors ${
                  !notification.read ? 'bg-neutral-800/30' : ''
                }`}
                onClick={() => !notification.read && markAsRead(notification.id)}
              >
                <div className="flex gap-3">
                  <div className="flex-shrink-0 mt-0.5">
                    {getTypeTag(notification.type)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between mb-1">
                      <h4
                        className={`text-sm font-medium truncate ${
                          !notification.read ? 'text-white' : 'text-neutral-400'
                        }`}
                      >
                        {notification.title}
                      </h4>
                      {!notification.read && (
                        <div className="w-2 h-2 rounded-full bg-amber-500 flex-shrink-0" />
                      )}
                    </div>
                    <p
                      className={`text-xs mb-1 truncate ${
                        !notification.read ? 'text-neutral-300' : 'text-neutral-500'
                      }`}
                    >
                      {notification.content}
                    </p>
                    <span className="text-[10px] text-neutral-600">
                      {formatTime(notification.timestamp)}
                    </span>
                  </div>
                </div>
              </List.ListItem>
            ))}
          </List>
        )}
      </div>
    </Drawer>
  );
}
