import React from 'react';
import { Card, CardBody, CardHeader } from '@/components/atoms';
import { PublicationHeader } from './PublicationHeader';
import { PublicationContent } from './PublicationContent';
import { PublicationActions } from './PublicationActions';
import { PublicationMetrics } from './PublicationMetrics';
import type { Publication } from '@meriter/shared-types';

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
        <PublicationHeader
          authorId={publication.authorId}
          communityId={showCommunity ? publication.communityId : undefined}
          communityName={showCommunity ? communityName : undefined}
          createdAt={publication.createdAt}
          hashtags={publication.hashtags}
        />
        
        <PublicationContent
          content={publication.content}
          imageUrl={publication.imageUrl}
          videoUrl={publication.videoUrl}
          type={publication.type}
        />
        
        <PublicationMetrics 
          metrics={publication.metrics}
          commentCount={publication.metrics.commentCount}
        />
        
        <PublicationActions
          onVote={onVote || (() => {})}
          onComment={onComment || (() => {})}
          onShare={onShare}
          commentCount={publication.metrics.commentCount}
        />
      </CardBody>
    </Card>
  );
};
