'use client';

import React from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import type { UpdateEvent } from '@/types/updates';

export interface UpdateCardProps {
  update: UpdateEvent;
  className?: string;
}

export const UpdateCard: React.FC<UpdateCardProps> = ({
  update,
  className = '',
}) => {
  const router = useRouter();
  const t = useTranslations('home.updates');

  const handleClick = () => {
    if (update.communityId && update.publicationId) {
      // Navigate to publication, optionally with comment highlight
      const basePath = `/meriter/communities/${update.communityId}?post=${update.publicationId}`;
      const params = update.targetType === 'comment' && update.targetId
        ? `&highlight=${update.targetId}`
        : '';
      router.push(basePath + params);
    }
  };

  const formatRelativeTime = (dateString: string): string => {
    try {
      const date = new Date(dateString);
      const now = new Date();
      const diffMs = now.getTime() - date.getTime();
      const diffMins = Math.floor(diffMs / 60000);
      const diffHours = Math.floor(diffMs / 3600000);
      const diffDays = Math.floor(diffMs / 86400000);

      if (diffMins < 1) return t('timeJustNow');
      if (diffMins < 60) return `${diffMins}${t('timeMinutesAgo')}`;
      if (diffHours < 24) return `${diffHours}${t('timeHoursAgo')}`;
      if (diffDays < 7) return `${diffDays}${t('timeDaysAgo')}`;

      return date.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
      });
    } catch {
      return '';
    }
  };

  const getEventIcon = () => {
    if (update.eventType === 'vote') {
      return update.direction === 'up' ? '↑' : '↓';
    }
    return '';
  };

  const getEventDescription = () => {
    const targetTypeLabel = update.targetType === 'publication'
      ? t('targetType.post')
      : t('targetType.comment');

    if (update.eventType === 'vote') {
      if (update.direction === 'up') {
        return t('voteUp', { targetType: targetTypeLabel }) || `upvoted your ${targetTypeLabel}`;
      } else {
        return t('voteDown', { targetType: targetTypeLabel }) || `downvoted your ${targetTypeLabel}`;
      }
    } else {
      return t('beneficiary');
    }
  };

  return (
    <div
      className={`p-3 border border-base-300 rounded-lg hover:bg-base-200 transition-colors cursor-pointer ${className}`}
      onClick={handleClick}
    >
      <div className="flex items-center gap-2">
        <span className="text-lg">{getEventIcon()}</span>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm font-medium text-base-content">
              {update.actor.name}
            </span>
            <span className="text-sm text-base-content/70">
              {getEventDescription()}
            </span>
          </div>
        </div>
        <span className="text-xs text-base-content/60 whitespace-nowrap">
          {formatRelativeTime(update.createdAt)}
        </span>
      </div>
    </div>
  );
};

