'use client';

import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/shadcn/avatar';
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
  const sizeClass = size === 24 ? 'w-6 h-6' : size === 32 ? 'w-8 h-8' : size === 48 ? 'w-12 h-12' : size === 64 ? 'w-16 h-16' : '';
  const hasPredefinedSize = size === 24 || size === 32 || size === 48 || size === 64;
  
  return (
    <div className="relative inline-block">
      <Avatar className={`${sizeClass} ${className}`} style={!hasPredefinedSize ? { width: size, height: size } : undefined}>
        <AvatarImage src={avatarUrl} alt={communityName} onError={onError} className="object-cover" />
        <AvatarFallback className="bg-muted text-muted-foreground font-medium">
          {communityName ? communityName.charAt(0).toUpperCase() : '?'}
        </AvatarFallback>
      </Avatar>
      {needsSetup && (
        <div className="absolute -top-1 -right-1 bg-yellow-500 text-white rounded-full p-0.5 border-2 border-white shadow-sm">
          <Settings size={12} />
        </div>
      )}
    </div>
  );
};
