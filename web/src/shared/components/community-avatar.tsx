'use client';

import { Avatar } from '@/components/atoms';
import { Settings } from 'lucide-react';

interface CommunityAvatarProps {
  avatarUrl?: string;
  communityName: string;
  size?: number;
  className?: string;
  onError?: () => void;
  needsSetup?: boolean;
}

/**
 * Simple community avatar component without badge overlay
 * Shows the community's Telegram profile photo (or placeholder)
 * Optionally shows a setup badge when needsSetup is true
 */
export const CommunityAvatar = ({
  avatarUrl,
  communityName,
  size = 48,
  className = '',
  onError,
  needsSetup,
}: CommunityAvatarProps) => {
  return (
    <div className="relative inline-block">
      <Avatar
        src={avatarUrl}
        alt={communityName}
        name={communityName}
        size={size}
        className={className}
        onError={onError}
      />
      {needsSetup && (
        <div className="absolute -top-1 -right-1 bg-yellow-500 text-white rounded-full p-0.5 border-2 border-white shadow-sm">
          <Settings size={12} />
        </div>
      )}
    </div>
  );
};
