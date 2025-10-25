// UserCard molecule component
'use client';

import React from 'react';
import { Avatar, Badge } from '@/components/atoms';
import { useUserProfile } from '@/hooks/api/useUsers';

export interface UserCardProps {
  userId: string;
  showBadges?: boolean;
  size?: 'sm' | 'md' | 'lg';
}

export const UserCard: React.FC<UserCardProps> = ({ userId, showBadges = false, size = 'md' }) => {
  const { data: user } = useUserProfile(userId);
  
  if (!user) return null;
  
  const avatarSize = size === 'sm' ? 'xs' : size === 'lg' ? 'lg' : 'md';
  
  return (
    <div className="flex items-center gap-2">
      <Avatar src={user.avatarUrl} alt={user.displayName} size={avatarSize} />
      <div className="flex flex-col">
        <span className="font-medium">{user.displayName}</span>
        {user.username && <span className="text-sm text-base-content/60">@{user.username}</span>}
      </div>
      {showBadges && user.communityTags.length > 0 && (
        <div className="flex gap-1 ml-auto">
          {user.communityTags.map((tag) => (
            <Badge key={tag} variant="secondary" size="xs">{tag}</Badge>
          ))}
        </div>
      )}
    </div>
  );
};
