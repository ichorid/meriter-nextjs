// Publication header component
'use client';

import React from 'react';
import { Avatar, Badge } from '@/components/atoms';
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
  // Console logging for debugging
  console.log('🎨 PublicationHeader rendering:', {
    id: publication.id,
    hasMeta: !!publication.meta,
    hasAuthor: !!publication.meta?.author,
    hasBeneficiary: !!publication.meta?.beneficiary,
    beneficiary: publication.meta?.beneficiary,
    meta: publication.meta,
  });

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

  // Log when beneficiary exists
  if (beneficiary) {
    console.log('✅ Beneficiary will be displayed:', beneficiary);
  } else {
    console.log('❌ No beneficiary to display');
  }

  return (
    <div className={`flex items-start justify-between ${className}`}>
      <div className="flex items-start gap-3">
        <div className="flex items-center gap-2">
          <Avatar src={author.photoUrl} alt={author.name} size="md" />
          <div className="flex flex-col">
            <span className="font-medium">{author.name}</span>
            {author.username && <span className="text-sm text-base-content/60">@{author.username}</span>}
          </div>
        </div>
        
        {beneficiary && (
          <div className="flex items-center gap-2">
            <span className="text-sm text-base-content/60">→</span>
            <div className="flex items-center gap-2">
              <Avatar src={beneficiary.photoUrl} alt={beneficiary.name} size="sm" />
              <div className="flex flex-col">
                <span className="font-medium text-sm">{beneficiary.name}</span>
                {beneficiary.username && <span className="text-xs text-base-content/60">@{beneficiary.username}</span>}
              </div>
            </div>
          </div>
        )}
        
        {showCommunityAvatar && publication.meta?.origin?.telegramChatName && (
          <div className="flex items-center gap-2">
            <span className="text-sm text-base-content/60">in</span>
            <Badge variant="info" size="sm">
              {publication.meta?.origin?.telegramChatName}
            </Badge>
          </div>
        )}
      </div>
      
      <div className="flex flex-col items-end gap-1">
        <span className="text-xs text-base-content/60">
          {dateVerbose(new Date(publication.createdAt))}
        </span>
        {publication.meta?.hashtagName && (
          <Badge variant="primary" size="sm">
            #{publication.meta?.hashtagName}
          </Badge>
        )}
      </div>
    </div>
  );
};
