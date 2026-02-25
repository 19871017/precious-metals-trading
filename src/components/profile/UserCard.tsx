import { useState } from 'react';
import { UserIcon, CheckIcon, EditIcon } from 'tdesign-icons-react';

interface UserCardProps {
  name: string;
  phone: string;
  avatar?: string;
  isVerified: boolean;
  onEdit?: () => void;
}

export default function UserCard({ name, phone, avatar, isVerified, onEdit }: UserCardProps) {
  const [imageError, setImageError] = useState(false);

  return (
    <div className="bg-neutral-900/80 backdrop-blur-sm border border-neutral-800 rounded-2xl p-5 shadow-lg hover:shadow-xl transition-shadow duration-300">
      <div className="flex items-center gap-4">
        {/* 头像 */}
        <div className="relative">
          {avatar && !imageError ? (
            <img
              src={avatar}
              alt={name}
              className="w-16 h-16 rounded-full object-cover border-2 border-amber-700/30"
              onError={() => setImageError(true)}
            />
          ) : (
            <div className="w-16 h-16 rounded-full bg-gradient-to-br from-amber-700/40 to-amber-900/40 border-2 border-amber-700/30 flex items-center justify-center">
              <span className="text-2xl font-bold text-amber-600">{name.charAt(0)}</span>
            </div>
          )}
          {/* 认证徽章 */}
          {isVerified && (
            <div className="absolute -bottom-1 -right-1 w-6 h-6 bg-green-600 rounded-full flex items-center justify-center border-2 border-neutral-900">
              <CheckIcon size="12px" className="text-white" />
            </div>
          )}
        </div>

        {/* 用户信息 */}
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-1">
            <h2 className="text-lg font-bold text-white">{name}</h2>
            {isVerified && (
              <div className="flex items-center gap-1 bg-green-900/30 border border-green-800/50 rounded-full px-2 py-0.5">
                <CheckIcon size="10px" className="text-green-600" />
                <span className="text-[10px] text-green-600 font-medium">已实名</span>
              </div>
            )}
          </div>
          <p className="text-xs text-neutral-500 font-mono tracking-wider">{phone}</p>
        </div>

        {/* 编辑按钮 */}
        <button
          onClick={onEdit}
          className="w-9 h-9 rounded-full bg-neutral-800 border border-neutral-700 flex items-center justify-center text-neutral-400 hover:bg-neutral-700 hover:text-neutral-300 hover:border-neutral-600 transition-all duration-200"
        >
          <EditIcon size="16px" />
        </button>
      </div>
    </div>
  );
}
