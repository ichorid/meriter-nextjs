// Publication actions component
'use client';

import React from 'react';
import { BarVoteUnified } from '@shared/components/bar-vote-unified';
import { useUIStore } from '@/stores/ui.store';

// Local Publication type definition
interface Publication {
  id: string;
  slug?: string;
  content?: string;
  createdAt: string;
  communityId?: string;
  metrics?: {
    score?: number;
    commentCount?: number;
  };
  [key: string]: unknown;
}

interface PublicationActionsProps {
  publication: Publication;
  onVote: (direction: 'plus' | 'minus', amount: number) => void;
  onComment: (comment: string, amount: number, directionPlus: boolean) => void;
  activeCommentHook: readonly [string | null, (commentId: string | null) => void];
  isVoting?: boolean;
  isCommenting?: boolean;
  maxPlus?: number;
  maxMinus?: number;
  className?: string;
}

export const PublicationActions: React.FC<PublicationActionsProps> = ({
  publication,
  onVote,
  onComment,
  activeCommentHook,
  isVoting = false,
  isCommenting = false,
  maxPlus = 100,
  maxMinus = 100,
  className = '',
}) => {
  const handleVoteClick = () => {
    const publicationId = String(publication.id || publication.slug || '');
    useUIStore.getState().openVotingPopup(publicationId, 'publication');
  };
  
  const handleCommentToggle = () => {
    // For now, comment toggle can still use activeCommentHook for backwards compatibility
    // but voting uses the store
    const activeComment = activeCommentHook[0];
    const setActiveComment = activeCommentHook[1];
    const publicationId = String(publication.id || publication.slug || '');
    setActiveComment(activeComment === publicationId ? null : publicationId);
  };

  return (
    <div className={`space-y-4 ${className}`}>
      <div className="flex items-center justify-between">
        <BarVoteUnified
          score={publication.metrics?.score || 0}
          onVoteClick={handleVoteClick}
          isAuthor={false}
          commentCount={publication.metrics?.commentCount || 0}
          onCommentClick={handleCommentToggle}
        />
      </div>
    </div>
  );
};
