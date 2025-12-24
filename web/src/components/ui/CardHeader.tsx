'use client';

import React from 'react';
import { Avatar, AvatarImage, AvatarFallback } from './shadcn/avatar';
import { User } from 'lucide-react';
import { dateVerbose } from '@/shared/lib/date';

interface CardHeaderProps {
  author?: {
    id: string;
    name: string;
    avatarUrl?: string;
  };
  createdAt?: string;
  community?: {
    id: string;
    name: string;
    avatarUrl?: string;
  };
  showCommunityAvatar?: boolean;
  rightElement?: React.ReactNode;
  className?: string;
}

export function CardHeader({
  author,
  createdAt,
  community,
  showCommunityAvatar = false,
  rightElement,
  className = '',
}: CardHeaderProps) {
  const displayName = author?.name || 'Anonymous';
  const avatarUrl = author?.avatarUrl;
  const dateText = createdAt ? dateVerbose(createdAt) : '';

  return (
    <div className={`flex items-center justify-between ${className}`}>
      <div className="flex items-center space-x-3 flex-1 min-w-0">
        {/* Author Avatar */}
        {author && (
          <Avatar className="w-8 h-8 text-xs flex-shrink-0">
            {avatarUrl && (
              <AvatarImage src={avatarUrl} alt={displayName} />
            )}
            <AvatarFallback className="bg-secondary/10 text-secondary-foreground font-medium uppercase">
              {displayName ? displayName.slice(0, 2).toUpperCase() : <User size={14} />}
            </AvatarFallback>
          </Avatar>
        )}

        {/* Community Avatar (if needed) */}
        {showCommunityAvatar && community && (
          <Avatar className="w-8 h-8 text-xs flex-shrink-0">
            {community.avatarUrl && (
              <AvatarImage src={community.avatarUrl} alt={community.name} />
            )}
            <AvatarFallback className="bg-secondary/10 text-secondary-foreground font-medium uppercase">
              {community.name ? community.name.slice(0, 2).toUpperCase() : <User size={14} />}
            </AvatarFallback>
          </Avatar>
        )}

        {/* Author Info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center space-x-2">
            {author && (
              <span className="text-sm font-semibold text-brand-text-primary truncate">
                {displayName}
              </span>
            )}
            {community && showCommunityAvatar && (
              <>
                <span className="text-sm text-brand-text-secondary">in</span>
                <span className="text-sm font-medium text-brand-text-primary truncate">
                  {community.name}
                </span>
              </>
            )}
          </div>
          {dateText && (
            <p className="text-xs text-brand-text-secondary mt-0.5">
              {dateText}
            </p>
          )}
        </div>
      </div>

      {/* Right Element (dropdown menu, etc.) */}
      {rightElement && (
        <div className="ml-4 flex-shrink-0">
          {rightElement}
        </div>
      )}
    </div>
  );
}

