// Publication actions component
'use client';

import React from 'react';
import { BarVoteUnified } from '@shared/components/bar-vote-unified';
import { BarWithdraw } from '@shared/components/bar-withdraw';
import { useUIStore } from '@/stores/ui.store';
import { useAuth } from '@/contexts/AuthContext';

// Local Publication type definition
interface Publication {
  id: string;
  slug?: string;
  authorId?: string;
  beneficiaryId?: string;
  content?: string;
  createdAt: string;
  communityId?: string;
  metrics?: {
    score?: number;
    commentCount?: number;
  };
  meta?: {
    beneficiary?: {
      telegramId?: string;
      username?: string;
      name?: string;
      photoUrl?: string;
    };
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
  const { user } = useAuth();
  const myId = user?.id || user?.telegramId;
  
  // Extract beneficiary information
  const beneficiaryId = publication.beneficiaryId || publication.meta?.beneficiary?.telegramId;
  const authorId = publication.authorId;
  
  // Calculate beneficiary status
  const hasBeneficiary = !!(beneficiaryId && beneficiaryId !== authorId);
  const isAuthor = !!(myId && authorId && myId === authorId);
  const isBeneficiary = !!(hasBeneficiary && myId && beneficiaryId && myId === beneficiaryId);
  const currentScore = publication.metrics?.score || 0;
  
  // Debug logging
  console.log('[PublicationActions] Mutual Exclusivity Debug:', {
    publicationId: publication.id,
    myId,
    authorId,
    beneficiaryId,
    hasBeneficiary,
    isAuthor,
    isBeneficiary,
    currentScore,
    publicationMeta: publication.meta,
  });
  
  // Mutual exclusivity logic
  const showWithdraw = (isAuthor && !hasBeneficiary) || isBeneficiary;
  const showVote = !isAuthor && !isBeneficiary;
  const showVoteForAuthor = isAuthor && hasBeneficiary;
  
  console.log('[PublicationActions] Button Visibility Logic:', {
    showWithdraw,
    showVote,
    showVoteForAuthor,
    finalChoice: showWithdraw ? 'WITHDRAW' : (showVote || showVoteForAuthor ? 'VOTE' : 'NONE'),
  });
  
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
        {showWithdraw ? (
          <BarWithdraw
            balance={currentScore}
            onWithdraw={() => {
              console.log('[PublicationActions] Withdraw clicked');
              // TODO: Implement withdraw functionality
            }}
            onTopup={() => {
              console.log('[PublicationActions] Topup clicked');
              // TODO: Implement topup functionality
            }}
            showDisabled={isBeneficiary || (isAuthor && !hasBeneficiary)}
          >
            <span></span>
          </BarWithdraw>
        ) : (showVote || showVoteForAuthor) ? (
          <BarVoteUnified
            score={currentScore}
            onVoteClick={handleVoteClick}
            isAuthor={isAuthor}
            isBeneficiary={isBeneficiary}
            hasBeneficiary={hasBeneficiary}
            commentCount={publication.metrics?.commentCount || 0}
            onCommentClick={handleCommentToggle}
          />
        ) : null}
      </div>
    </div>
  );
};
