'use client';

import { AvatarWithPlaceholder } from './avatar-with-placeholder';

interface CommunityAvatarWithBadgeProps {
  avatarUrl?: string;
  communityName: string;
  iconUrl?: string;
  size?: number;
  className?: string;
  onError?: () => void;
}

/**
 * Community avatar component with currency icon badge overlay
 * Shows the community's Telegram profile photo (or placeholder) with a small currency icon badge
 */
export const CommunityAvatarWithBadge = ({
  avatarUrl,
  communityName,
  iconUrl,
  size = 48,
  className = '',
  onError,
}: CommunityAvatarWithBadgeProps) => {
  const badgeSize = Math.round(size * 0.4); // Badge is 40% of avatar size

  return (
    <div className={`relative inline-block ${className}`} style={{ width: size, height: size }}>
      {/* Main avatar/placeholder */}
      <AvatarWithPlaceholder
        avatarUrl={avatarUrl}
        name={communityName}
        size={size}
        onError={onError}
      />
      
      {/* Currency icon badge overlay */}
      {iconUrl && (
        <div
          className="absolute bottom-0 right-0 bg-base-100 rounded-full flex items-center justify-center shadow-md"
          style={{
            width: badgeSize,
            height: badgeSize,
            transform: 'translate(10%, 10%)', // Slightly outside the avatar circle
          }}
        >
          <img
            src={iconUrl}
            alt="Currency icon"
            className="w-full h-full object-contain p-0.5"
          />
        </div>
      )}
    </div>
  );
};

