'use client';

import { AvatarWithPlaceholder } from './avatar-with-placeholder';

interface CommunityAvatarProps {
  avatarUrl?: string;
  communityName: string;
  size?: number;
  className?: string;
  onError?: () => void;
}

/**
 * Simple community avatar component without badge overlay
 * Shows the community's Telegram profile photo (or placeholder)
 */
export const CommunityAvatar = ({
  avatarUrl,
  communityName,
  size = 48,
  className = '',
  onError,
}: CommunityAvatarProps) => {
  return (
    <AvatarWithPlaceholder
      avatarUrl={avatarUrl}
      name={communityName}
      size={size}
      className={className}
      onError={onError}
    />
  );
};
