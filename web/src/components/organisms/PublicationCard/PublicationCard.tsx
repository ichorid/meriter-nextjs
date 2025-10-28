import React from 'react';
import { Card, CardBody, CardHeader } from '@/components/atoms';
import { PublicationCardHeader } from './PublicationHeader';
import { PublicationCardContent } from './PublicationContent';
import { PublicationCardActions } from './PublicationActions';
import { PublicationMetrics } from './PublicationMetrics';

// Local Publication type definition
interface Publication {
  id: string;
  slug?: string;
  content?: string;
  createdAt: string;
  authorId?: string;
  communityId?: string;
  hashtags?: string[];
  imageUrl?: string;
  videoUrl?: string;
  type?: 'video' | 'image' | 'text';
  metrics?: {
    score?: number;
    commentCount?: number;
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

export interface PublicationCardProps {
  publication: Publication;
  onVote?: () => void;
  onComment?: () => void;
  onShare?: () => void;
  onClick?: () => void;
  showCommunity?: boolean;
  communityName?: string;
}

export const PublicationCard: React.FC<PublicationCardProps> = ({
  publication,
  onVote,
  onComment,
  onShare,
  onClick,
  showCommunity = false,
  communityName,
}) => {
  return (
    <Card hover bordered className="cursor-pointer" onClick={onClick}>
      <CardBody>
        <PublicationCardHeader
          authorId={publication.authorId || ''}
          communityId={showCommunity ? publication.communityId : undefined}
          communityName={showCommunity ? communityName : undefined}
          createdAt={publication.createdAt}
          hashtags={publication.hashtags}
          beneficiaryName={publication.meta?.beneficiary?.name}
          beneficiaryPhotoUrl={publication.meta?.beneficiary?.photoUrl}
          beneficiaryUsername={publication.meta?.beneficiary?.username}
        />
        
        <PublicationCardContent
          content={publication.content || ''}
          imageUrl={publication.imageUrl}
          videoUrl={publication.videoUrl}
          type={publication.type || 'text'}
        />
        
        <PublicationMetrics 
          metrics={publication.metrics || { score: 0, commentCount: 0 }}
          commentCount={publication.metrics?.commentCount || 0}
        />
        
        <PublicationCardActions
          onVote={onVote || (() => {})}
          onComment={onComment || (() => {})}
          onShare={onShare}
          commentCount={publication.metrics?.commentCount || 0}
        />
      </CardBody>
    </Card>
  );
};
