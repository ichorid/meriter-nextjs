'use client';

import { Avatar } from '@/components/atoms';

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
 * Optionally shows a "!" badge when needsSetup is true
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
        <div className="absolute -top-1 -right-1 bg-warning text-warning-content rounded-full flex items-center justify-center text-xs font-bold" style={{ width: size * 0.4, height: size * 0.4, minWidth: '16px', minHeight: '16px' }}>
          !
        </div>
      )}
    </div>
  );
};
