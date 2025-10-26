import React from 'react';
import { Avatar, Badge } from '@/components/atoms';
import { useUserProfile } from '@/hooks/api/useUsers';
import { formatDate } from '@/lib/utils/date';

export interface PublicationHeaderProps {
  authorId: string;
  communityId?: string;
  communityName?: string;
  createdAt: string;
  hashtags?: string[];
}

export const PublicationCardHeader: React.FC<PublicationHeaderProps> = ({
  authorId,
  communityName,
  createdAt,
  hashtags = [],
}) => {
  const { data: author } = useUserProfile(authorId);

  if (!author) return null;

  return (
    <div className="flex items-start justify-between mb-3">
      <div className="flex items-center gap-2">
        <Avatar src={author.avatarUrl} alt={author.displayName} size="sm" />
        <div className="flex flex-col">
          <span className="font-medium text-sm">{author.displayName}</span>
          <div className="flex items-center gap-2 text-xs text-base-content/60">
            {communityName && <span>in {communityName}</span>}
            <span>•</span>
            <time>{formatDate(createdAt, 'relative')}</time>
          </div>
        </div>
      </div>
      
      {hashtags.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {hashtags.slice(0, 3).map((tag) => (
            <Badge key={tag} variant="secondary" size="xs">
              #{tag}
            </Badge>
          ))}
        </div>
      )}
    </div>
  );
};
