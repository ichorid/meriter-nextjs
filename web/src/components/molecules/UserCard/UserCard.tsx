// UserCard molecule component
'use client';

import React from 'react';
import { Avatar } from '@/components/atoms/Avatar';
import { Badge } from '@/components/atoms/Badge';

interface UserCardProps {
  user: {
    name?: string;
    username?: string;
    photoUrl?: string;
    avatarUrl?: string;
    isAdmin?: boolean;
    isVerified?: boolean;
  };
  size?: 'sm' | 'md' | 'lg';
  showBadges?: boolean;
  onClick?: () => void;
  className?: string;
}

export const UserCard: React.FC<UserCardProps> = ({
  user,
  size = 'md',
  showBadges = true,
  onClick,
  className = '',
}) => {
  const displayName = user.name || user.username || 'User';
  const avatarUrl = user.photoUrl || user.avatarUrl;

  return (
    <div
      className={`flex items-center gap-3 ${onClick ? 'cursor-pointer' : ''} ${className}`}
      onClick={onClick}
    >
      <Avatar
        src={avatarUrl}
        alt={displayName}
        size={size}
        fallback={displayName.charAt(0).toUpperCase()}
      />
      <div className="flex flex-col">
        <div className="flex items-center gap-2">
          <span className="font-medium text-sm">{displayName}</span>
          {showBadges && user.isAdmin && (
            <Badge variant="info" size="sm">Admin</Badge>
          )}
          {showBadges && user.isVerified && (
            <Badge variant="success" size="sm">Verified</Badge>
          )}
        </div>
        {user.username && user.username !== user.name && (
          <span className="text-xs text-base-content/60">@{user.username}</span>
        )}
      </div>
    </div>
  );
};
