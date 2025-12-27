// UserCard molecule component
'use client';

import React from 'react';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/shadcn/avatar';
import { Badge } from '@/components/atoms';
import { useUserProfile } from '@/hooks/api/useUsers';

export interface UserCardProps {
  userId: string;
  showBadges?: boolean;
  size?: 'sm' | 'md' | 'lg';
}

export const UserCard: React.FC<UserCardProps> = ({ userId, showBadges = false, size = 'md' }) => {
  const { data: user } = useUserProfile(userId);
  
  if (!user) return null;
  
  const avatarSizeClass = size === 'sm' ? 'w-6 h-6' : size === 'lg' ? 'w-16 h-16' : 'w-12 h-12';
  const avatarTextSize = size === 'sm' ? 'text-xs' : size === 'lg' ? 'text-lg' : 'text-sm';
  
  return (
    <div className="flex items-center gap-2">
      <Avatar className={avatarSizeClass}>
        <AvatarImage src={user.avatarUrl} alt={user.displayName} />
        <AvatarFallback userId={user.id} className={`font-medium ${avatarTextSize}`}>
          {user.displayName ? user.displayName.charAt(0).toUpperCase() : '?'}
        </AvatarFallback>
      </Avatar>
      <div className="flex flex-col">
        <span className="font-medium">{user.displayName}</span>
        {user.username && <span className="text-sm text-base-content/60">@{user.username}</span>}
      </div>
      {showBadges && user.communityTags && user.communityTags.length > 0 && (
        <div className="flex gap-1 ml-auto">
          {user.communityTags.map((tag: string) => (
            <Badge key={tag} variant="secondary" size="xs">{tag}</Badge>
          ))}
        </div>
      )}
    </div>
  );
};
