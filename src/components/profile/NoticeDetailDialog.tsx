import { Dialog } from 'tdesign-react';
import { ChevronLeftIcon, TimeIcon } from 'tdesign-icons-react';

interface NoticeDetailDialogProps {
  visible: boolean;
  notice: any;
  onClose: () => void;
}

const NoticeDetailDialog: React.FC<NoticeDetailDialogProps> = ({
  visible,
  notice,
  onClose,
}) => {
  if (!notice) {
    return null;
  }

  return (
    <Dialog
      visible={visible}
      header={null}
      width="600px"
      onClose={onClose}
      footer={null}
      className="!bg-gray-800 !text-white"
    >
      <div className="max-h-[70vh] overflow-y-auto">
        {/* 顶部导航 */}
        <div className="sticky top-0 bg-gray-800/95 backdrop-blur-sm flex items-center gap-3 py-3 border-b border-gray-700">
          <button
            onClick={onClose}
            className="text-amber-400 hover:text-amber-300 transition-colors"
          >
            <ChevronLeftIcon size="20px" />
          </button>
          <div className="text-white font-medium">公告详情</div>
        </div>

        {/* 公告内容 */}
        <div className="p-6 space-y-6">
          {/* 标题 */}
          <div>
            <div className="text-amber-400 text-xs mb-2">
              {notice.type === 'urgent' && '🔴 紧急公告'}
              {notice.type === 'important' && '🟡 重要公告'}
              {notice.type === 'normal' && '🟢 系统公告'}
              {!notice.type && '🟢 系统公告'}
            </div>
            <h1 className="text-white text-xl font-bold leading-relaxed">
              {notice.title}
            </h1>
          </div>

          {/* 发布时间 */}
          <div className="flex items-center gap-2 text-gray-500 text-sm">
            <TimeIcon size="14px" />
            <span>{notice.date}</span>
          </div>

          {/* 内容 */}
          <div className="text-gray-300 text-sm leading-relaxed whitespace-pre-wrap">
            {notice.content}
          </div>

          {/* 附件（可选） */}
          {notice.attachments && notice.attachments.length > 0 && (
            <div>
              <div className="text-white font-medium mb-3">附件</div>
              <div className="space-y-2">
                {notice.attachments.map((attachment: any, index: number) => (
                  <div
                    key={index}
                    className="p-3 rounded-lg bg-gray-700/50 border border-gray-600/30 flex items-center gap-3 cursor-pointer hover:bg-gray-700/80 transition-colors"
                  >
                    <div className="w-8 h-8 rounded bg-amber-500/20 flex items-center justify-center">
                      <span className="text-amber-400 text-sm">📎</span>
                    </div>
                    <div className="flex-1">
                      <div className="text-white text-sm">
                        {attachment.name}
                      </div>
                      <div className="text-gray-500 text-xs">
                        {attachment.size}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* 底部操作 */}
          <div className="pt-4 border-t border-gray-700">
            <button
              onClick={onClose}
              className="w-full py-3 rounded-lg bg-amber-500 text-white font-medium hover:bg-amber-600 transition-colors"
            >
              我知道了
            </button>
          </div>
        </div>
      </div>
    </Dialog>
  );
};

export default NoticeDetailDialog;
