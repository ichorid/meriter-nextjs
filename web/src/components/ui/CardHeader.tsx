'use client';

import React from 'react';
import { BrandAvatar } from './BrandAvatar';
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
          <BrandAvatar
            src={avatarUrl}
            fallback={displayName}
            size="sm"
            className="flex-shrink-0"
          />
        )}

        {/* Community Avatar (if needed) */}
        {showCommunityAvatar && community && (
          <BrandAvatar
            src={community.avatarUrl}
            fallback={community.name}
            size="sm"
            className="flex-shrink-0"
          />
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

