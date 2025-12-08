// Publication header component
'use client';

import React from 'react';
import { Avatar, Badge } from '@/components/atoms';
import { Badge as BrandBadge } from '@/components/ui/Badge';
import { dateVerbose } from '@shared/lib/date';

// Local Publication type definition
interface Publication {
  id: string;
  slug?: string;
  content?: string;
  createdAt: string;
  metrics?: {
    score?: number;
  };
  meta?: {
    commentTgEntities?: any[];
    comment?: string;
    author?: {
      name?: string;
      photoUrl?: string;
      username?: string;
    };
    beneficiary?: {
      name?: string;
      photoUrl?: string;
      username?: string;
    };
    origin?: {
      telegramChatName?: string;
    };
    hashtagName?: string;
  };
  [key: string]: unknown;
}

interface PublicationHeaderProps {
  publication: Publication;
  showCommunityAvatar?: boolean;
  className?: string;
}

export const PublicationHeader: React.FC<PublicationHeaderProps> = ({
  publication,
  showCommunityAvatar = false,
  className = '',
}) => {
  const author = {
    name: publication.meta?.author?.name || 'Unknown',
    photoUrl: publication.meta?.author?.photoUrl,
    username: publication.meta?.author?.username,
  };

  const beneficiary = publication.meta?.beneficiary ? {
    name: publication.meta.beneficiary.name,
    photoUrl: publication.meta.beneficiary.photoUrl,
    username: publication.meta.beneficiary.username,
  } : null;

  return (
    <div className={`flex items-start justify-between gap-3 ${className}`}>
      {/* Author Info */}
      <div className="flex items-center gap-3 min-w-0">
        <Avatar src={author.photoUrl} alt={author.name} size="md" />
        <div className="min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-medium text-sm text-base-content truncate">{author.name}</span>
            {beneficiary && (
              <>
                <span className="text-xs text-base-content/30">→</span>
                <span className="font-medium text-sm text-base-content/70 truncate">{beneficiary.name}</span>
              </>
            )}
          </div>
          <div className="flex items-center gap-2 mt-0.5">
            {author.username && (
              <span className="text-xs text-base-content/40">@{author.username}</span>
            )}
            <span className="text-xs text-base-content/30">·</span>
            <span className="text-xs text-base-content/40">
              {dateVerbose(new Date(publication.createdAt))}
            </span>
          </div>
        </div>
      </div>
      
      {/* Tags & Badges */}
      <div className="flex items-center gap-1.5 flex-shrink-0">
        {(publication as any).postType === 'project' || (publication as any).isProject ? (
          <BrandBadge variant="warning" size="sm">
            PROJECT
          </BrandBadge>
        ) : null}
        {publication.meta?.hashtagName && (
          <Badge variant="primary" size="sm">
            #{publication.meta?.hashtagName}
          </Badge>
        )}
        {showCommunityAvatar && publication.meta?.origin?.telegramChatName && (
          <Badge variant="info" size="sm">
            {publication.meta?.origin?.telegramChatName}
          </Badge>
        )}
      </div>
    </div>
  );
};
