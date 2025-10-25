// CardWithAvatar molecule component with avatar retry logic
'use client';

import React, { useState } from 'react';
import { Avatar } from '@/components/atoms/Avatar';
import { Card } from '@/components/atoms/Card';

interface CardWithAvatarProps {
  avatarUrl?: string;
  avatarUrlUpd?: (userId: string) => any;
  iconUrl?: string;
  iconOnClick?: () => any;
  children: React.ReactNode;
  onClick?: () => any;
  userName?: string;
  className?: string;
}

export const CardWithAvatar: React.FC<CardWithAvatarProps> = ({
  avatarUrl,
  avatarUrlUpd,
  iconUrl,
  iconOnClick,
  children,
  onClick,
  userName,
  className = ''
}) => {
  const [retryCount, setRetryCount] = useState(0);
  
  const baseClasses = "card bg-base-100 shadow-md rounded-2xl mb-5 p-5";
  const clickableClass = onClick ? " cursor-pointer hover:shadow-lg transition-shadow" : "";
  
  if (!avatarUrl && !iconUrl) {
    return (
      <Card
        className={`${baseClasses}${clickableClass} ${className}`}
        onClick={onClick}
      >
        <div>{children}</div>
      </Card>
    );
  }

  if (iconUrl && !avatarUrl) {
    return (
      <Card
        className={`${baseClasses}${clickableClass} ${className}`}
        onClick={onClick}
      >
        <div className="flex items-start gap-4">
          <div className="flex-1">{children}</div>
          <div 
            className="cursor-pointer w-12 h-12"
            onClick={iconOnClick}
          >
            {iconUrl && <img src={iconUrl} alt="Icon" className="w-full h-full object-contain" />}
          </div>
        </div>
      </Card>
    );
  }
  
  return (
    <Card
      className={`${baseClasses}${clickableClass} ${className}`}
      onClick={onClick}
    >
      <div className="flex items-start gap-4">
        <Avatar
          src={avatarUrl}
          alt={userName || 'User'}
          size={48}
          onError={() => {
            if (retryCount < 1 && avatarUrlUpd) {
              avatarUrlUpd(userName || '');
              setRetryCount(retryCount + 1);
            }
          }}
        />
        <div className="flex-1">{children}</div>
      </div>
    </Card>
  );
};
