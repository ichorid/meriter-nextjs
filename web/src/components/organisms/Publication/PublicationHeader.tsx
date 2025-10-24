// Publication header component
'use client';

import React from 'react';
import { UserCard } from '@/components/molecules/UserCard';
import { Badge } from '@/components/atoms/Badge';
import { dateVerbose } from '@shared/lib/date';
import type { Publication } from '@/types/entities';

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
    name: publication.tgAuthorName,
    photoUrl: publication.authorPhotoUrl,
    username: publication.tgAuthorId,
  };

  const beneficiary = publication.beneficiaryName ? {
    name: publication.beneficiaryName,
    photoUrl: publication.beneficiaryPhotoUrl,
    username: publication.beneficiaryUsername,
  } : null;

  return (
    <div className={`flex items-start justify-between ${className}`}>
      <div className="flex items-start gap-3">
        <UserCard user={author} size="md" />
        
        {beneficiary && (
          <div className="flex items-center gap-2">
            <span className="text-sm text-base-content/60">→</span>
            <UserCard user={beneficiary} size="sm" />
          </div>
        )}
        
        {showCommunityAvatar && publication.tgChatName && (
          <div className="flex items-center gap-2">
            <span className="text-sm text-base-content/60">in</span>
            <Badge variant="info" size="sm">
              {publication.tgChatName}
            </Badge>
          </div>
        )}
      </div>
      
      <div className="flex flex-col items-end gap-1">
        <span className="text-xs text-base-content/60">
          {dateVerbose(new Date(publication.ts))}
        </span>
        {publication.keyword && (
          <Badge variant="default" size="sm">
            #{publication.keyword}
          </Badge>
        )}
      </div>
    </div>
  );
};
