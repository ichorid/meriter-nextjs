// AvatarBalanceWidget organism component
'use client';

import React from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { Settings } from 'lucide-react';
import { Avatar } from '@/components/atoms/Avatar';
import { Button } from '@/components/atoms/Button';

interface BalanceInfo {
  icon?: string;
  amount: number;
}

interface AvatarBalanceWidgetProps {
  balance1?: BalanceInfo;
  balance2?: BalanceInfo;
  avatarUrl?: string;
  onAvatarUrlNotFound?: () => void;
  onClick?: () => void;
  userName?: string;
  className?: string;
}

export const AvatarBalanceWidget: React.FC<AvatarBalanceWidgetProps> = ({
  balance1,
  balance2,
  avatarUrl,
  onAvatarUrlNotFound,
  onClick,
  userName,
  className = ''
}) => {
  const t = useTranslations('shared');
  const router = useRouter();

  const handleSettingsClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    router.push('/meriter/settings');
  };

  return (
    <div className={`cursor-pointer ${className}`} onClick={onClick}>
      <div className="bg-base-100 shadow-md rounded-2xl p-1.5 sm:p-4 flex items-center gap-1.5 sm:gap-3 relative">
        <div className="flex-1 min-w-0 text-right text-xs sm:text-sm">
          {balance1 && (
            <div className="flex items-center justify-end gap-1 mb-1">
              {balance1.icon && <span className="text-xs opacity-60">{t('balance')} </span>}
              {balance1.icon && <img className="w-4 h-4 inline" src={balance1.icon} alt="Currency" />}
              <span className="font-medium">{balance1.amount}</span>
            </div>
          )}
          {balance2 && (
            <div className="flex items-center justify-end gap-1">
              <img className="w-4 h-4 inline" src={balance2.icon} alt="Currency" />
              <span className="font-medium">{balance2.amount}</span>
            </div>
          )}
        </div>
        <div className="flex items-center gap-2 sm:gap-3 shrink-0 flex-1">
          <div className="text-right min-w-0 flex-1">
            <div className="text-xs sm:text-sm font-medium text-base-content truncate">
              {userName || 'User'}
            </div>
          </div>
          <div className="flex items-center gap-1 sm:gap-1.5">
            <Avatar
              src={avatarUrl}
              alt={userName || 'User'}
              size={40}
              onError={onAvatarUrlNotFound}
            />
            <Button
              variant="ghost"
              size="sm"
              onClick={handleSettingsClick}
              className="btn-circle btn-xs opacity-60 hover:opacity-100"
              aria-label="Settings"
              title="Settings"
            >
              <Settings className="w-3 h-3" />
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};
