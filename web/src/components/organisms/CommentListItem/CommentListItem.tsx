'use client';

import React from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { AvatarWithPlaceholder } from '@/shared/components/avatar-with-placeholder';
import { formatDate } from '@/shared/lib/date';

export interface CommentListItemProps {
  id: string;
  content: string;
  authorName?: string;
  authorId?: string;
  createdAt?: string;
  targetType?: 'publication' | 'comment';
  targetId?: string;
  publicationSlug?: string;
  communityId?: string;
  metrics?: {
    upvotes?: number;
    downvotes?: number;
    score?: number;
  };
  className?: string;
  authorAvatarUrl?: string;
}

export const CommentListItem: React.FC<CommentListItemProps> = ({
  id,
  content,
  authorName,
  authorId,
  createdAt,
  targetType,
  targetId,
  publicationSlug,
  communityId,
  metrics,
  className = '',
  authorAvatarUrl,
}) => {
  const router = useRouter();
  const t = useTranslations('comments');

  const handleClick = () => {
    if (communityId && publicationSlug) {
      router.push(`/meriter/communities/${communityId}/posts/${publicationSlug}?highlight=${id}`);
    } else if (targetType === 'publication' && targetId) {
      // If we don't have slug/communityId, we can still try to navigate using the publication ID
      // But for now, we'll just show the comment without navigation
      console.log('Cannot navigate: missing publicationSlug or communityId', { targetId, targetType });
    }
  };

  const score = metrics?.score ?? 0;
  const isPositive = score > 0;
  const isNegative = score < 0;
  
  // Format score display
  const formatScore = () => {
    if (score === 0) return '0';
    return score > 0 ? `+${score}` : `${score}`;
  };

  return (
    <div className={`mb-4 ${className}`}>
      <div
        className="card bg-base-100 shadow-md rounded-xl overflow-hidden cursor-pointer hover:shadow-lg transition-shadow"
        onClick={handleClick}
      >
        <div className="flex">
          {/* Score sidebar */}
          <div
            className={`font-bold text-center py-2 px-3 min-w-[3rem] flex flex-col items-center justify-center gap-1 ${
              isPositive
                ? 'bg-success text-success-content'
                : isNegative
                ? 'bg-error text-error-content'
                : 'bg-secondary text-secondary-content'
            }`}
          >
            <div className="flex items-center justify-center">
              <span>{formatScore()}</span>
            </div>
          </div>
          
          {/* Main content */}
          <div className="flex-1">
            <div className="p-4">
              {/* Author info */}
              <div className="flex gap-2 mb-2 items-start">
                <div className="flex gap-2 flex-1">
                  <AvatarWithPlaceholder
                    avatarUrl={authorAvatarUrl}
                    name={authorName || 'Unknown'}
                    size={32}
                  />
                  <div className="info">
                    <div className="text-xs font-medium">{authorName || 'Unknown'}</div>
                    {createdAt && (
                      <div className="text-[10px] opacity-60">
                        {formatDate(createdAt, 'relative')}
                      </div>
                    )}
                  </div>
                </div>
              </div>
              
              {/* Comment content */}
              <div className="content text-sm mb-2">{content}</div>
              
              {/* Metrics */}
              {metrics && (metrics.upvotes !== undefined || metrics.downvotes !== undefined) && (
                <div className="flex items-center gap-4 text-xs text-base-content/60 mb-2">
                  {metrics.upvotes !== undefined && (
                    <span>↑ {metrics.upvotes}</span>
                  )}
                  {metrics.downvotes !== undefined && (
                    <span>↓ {metrics.downvotes}</span>
                  )}
                </div>
              )}
              
              {/* Navigation hint */}
              {communityId && publicationSlug && (
                <div className="mt-2 text-xs text-primary">
                  {t('viewInPublication') || 'View in publication →'}
                </div>
              )}
              {!publicationSlug && targetType === 'publication' && (
                <div className="mt-2 text-xs text-base-content/60">
                  Comment on publication
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

