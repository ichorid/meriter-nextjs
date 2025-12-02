// Publication actions component
'use client';

import React from 'react';
import { BarVoteUnified } from '@shared/components/bar-vote-unified';
import { BarWithdraw } from '@shared/components/bar-withdraw';
import { useUIStore } from '@/stores/ui.store';
import { useAuth } from '@/contexts/AuthContext';
import { useTranslations } from 'next-intl';
import { getWalletBalance } from '@/lib/utils/wallet';
import { getPublicationIdentifier } from '@/lib/utils/publication';
import { useCanVote } from '@/hooks/useCanVote';
import { useCommunity } from '@/hooks/api/useCommunities';

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
    author?: {
      id: string;
      name: string;
      photoUrl?: string;
      username?: string;
    };
    beneficiary?: {
      id: string;
      name: string;
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

interface Wallet {
  id: string;
  userId: string;
  communityId: string;
  balance: number;
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
  activeSlider?: string | null;
  setActiveSlider?: (slider: string | null) => void;
  wallets?: Wallet[];
  updateAll?: () => void;
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
  activeSlider,
  setActiveSlider,
  wallets = [],
  updateAll,
  className = '',
}) => {
  const { user } = useAuth();
  const t = useTranslations('feed');
  const myId = user?.id;

  // Check if this is a PROJECT post (no voting allowed)
  const isProject = (publication as any).postType === 'project' || (publication as any).isProject === true;

  // Extract beneficiary information
  const beneficiaryId = publication.beneficiaryId || publication.meta?.beneficiary?.id;
  const authorId = publication.authorId;

  // Calculate beneficiary status
  const hasBeneficiary = !!(beneficiaryId && beneficiaryId !== authorId);
  const isAuthor = !!(myId && authorId && myId === authorId);
  const isBeneficiary = !!(hasBeneficiary && myId && beneficiaryId && myId === beneficiaryId);
  const currentScore = publication.metrics?.score || 0;

  // Calculate withdraw amounts
  const maxWithdrawAmount = (isAuthor && !hasBeneficiary) || isBeneficiary
    ? Math.floor(10 * currentScore) / 10
    : 0;

  // Get current wallet balance for topup
  const communityId = publication.communityId;
  const currentBalance = getWalletBalance(wallets, communityId);
  const maxTopUpAmount = Math.floor(10 * currentBalance) / 10;

  // Get community info to check typeTag
  const { data: community } = useCommunity(communityId || '');
  const isSpecialGroup = community?.typeTag === 'marathon-of-good' || community?.typeTag === 'future-vision';

  // Mutual exclusivity logic
  // Hide withdrawal for special groups (marathon-of-good and future-vision)
  const showWithdraw = !isSpecialGroup && ((isAuthor && !hasBeneficiary) || isBeneficiary);
  const showVote = !isAuthor && !isBeneficiary;
  const showVoteForAuthor = isAuthor && hasBeneficiary;

  const publicationId = getPublicationIdentifier(publication);

  // Check if user can vote based on community rules
  const canVote = useCanVote(
    publicationId,
    'publication',
    communityId,
    authorId,
    isAuthor,
    isBeneficiary,
    hasBeneficiary,
    isProject
  );

  const handleVoteClick = () => {
    const mode = isProject ? 'wallet-only' : 'quota-only';
    useUIStore.getState().openVotingPopup(publicationId, 'publication', mode);
  };

  const handleCommentToggle = () => {
    // For now, comment toggle can still use activeCommentHook for backwards compatibility
    // but voting uses the store
    const activeComment = activeCommentHook[0];
    const setActiveComment = activeCommentHook[1];
    setActiveComment(activeComment === publicationId ? null : publicationId);
  };

  // Handle withdraw button click - opens popup
  const handleWithdrawClick = () => {
    useUIStore.getState().openWithdrawPopup(
      publicationId,
      'publication-withdraw',
      maxWithdrawAmount,
      maxTopUpAmount
    );
  };

  // Handle topup button click - opens popup for adding votes
  const handleTopupClick = () => {
    useUIStore.getState().openWithdrawPopup(
      publicationId,
      'publication-topup',
      maxWithdrawAmount,
      maxTopUpAmount
    );
  };

  return (
    <div className={`space-y-4 ${className}`}>
      <div className="flex items-center justify-between">
        {showWithdraw ? (
          <BarWithdraw
            balance={maxWithdrawAmount}
            onWithdraw={handleWithdrawClick}
            onTopup={handleTopupClick}
            showDisabled={isBeneficiary || (isAuthor && !hasBeneficiary)}
            isLoading={false}
            commentCount={publication.metrics?.commentCount || 0}
            onCommentClick={handleCommentToggle}
          />
        ) : (showVote || showVoteForAuthor) ? (
          <BarVoteUnified
            score={currentScore}
            onVoteClick={handleVoteClick}
            isAuthor={isAuthor}
            isBeneficiary={isBeneficiary}
            hasBeneficiary={hasBeneficiary}
            commentCount={publication.metrics?.commentCount || 0}
            onCommentClick={handleCommentToggle}
            canVote={canVote}
          />
        ) : null}
      </div>
    </div>
  );
};
