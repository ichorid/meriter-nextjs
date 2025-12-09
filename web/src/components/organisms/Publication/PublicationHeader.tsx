// Publication header component
'use client';

import React from 'react';
import { useRouter } from 'next/navigation';
import { Edit } from 'lucide-react';
import { Avatar, Badge } from '@/components/atoms';
import { Badge as BrandBadge } from '@/components/ui/Badge';
import { BrandButton } from '@/components/ui/BrandButton';
import { dateVerbose } from '@shared/lib/date';
import { useAuth } from '@/contexts/AuthContext';
import { routes } from '@/lib/constants/routes';

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
  authorId?: string;
  metrics?: {
    upvotes?: number;
    downvotes?: number;
    totalCasts?: number;
  };
  publicationId?: string;
  communityId?: string;
  isPoll?: boolean;
}

export const PublicationHeader: React.FC<PublicationHeaderProps> = ({
  publication,
  showCommunityAvatar = false,
  className = '',
  authorId,
  metrics,
  publicationId,
  communityId,
  isPoll = false,
}) => {
  const router = useRouter();
  const { user } = useAuth();
  const currentUserId = user?.id;

  const author = {
    name: publication.meta?.author?.name || 'Unknown',
    photoUrl: publication.meta?.author?.photoUrl,
    username: publication.meta?.author?.username,
    id: authorId || publication.meta?.author?.id,
  };

  const beneficiary = publication.meta?.beneficiary ? {
    name: publication.meta.beneficiary.name,
    photoUrl: publication.meta.beneficiary.photoUrl,
    username: publication.meta.beneficiary.username,
  } : null;

  // Check if user can edit
  const isAuthor = currentUserId && author.id && currentUserId === author.id;
  const hasVotes = isPoll
    ? (metrics?.totalCasts || 0) > 0
    : ((metrics?.upvotes || 0) + (metrics?.downvotes || 0)) > 0;
  const canEdit = isAuthor && !hasVotes && publicationId && communityId;

  const handleEdit = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (isPoll) {
      router.push(`/meriter/communities/${communityId}/edit-poll/${publicationId}`);
    } else {
      router.push(`/meriter/communities/${communityId}/edit/${publicationId}`);
    }
  };

  const handleAvatarClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (author.id) {
      router.push(routes.userProfile(author.id));
    }
  };

  return (
    <div className={`flex items-start justify-between gap-3 ${className}`}>
      {/* Author Info */}
      <div className="flex items-center gap-3 min-w-0">
        <Avatar 
          src={author.photoUrl} 
          alt={author.name} 
          size="md" 
          onClick={author.id ? handleAvatarClick : undefined}
        />
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
      
      {/* Tags & Badges & Edit Button */}
      <div className="flex items-center gap-1.5 flex-shrink-0">
        {canEdit && (
          <BrandButton
            variant="ghost"
            size="sm"
            onClick={handleEdit}
            className="p-1.5 h-auto min-h-0"
            title="Edit"
          >
            <Edit size={16} />
          </BrandButton>
        )}
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
