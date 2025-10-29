// Publication actions component
'use client';

import React, { useState, useEffect } from 'react';
import { BarVoteUnified } from '@shared/components/bar-vote-unified';
import { BarWithdraw } from '@shared/components/bar-withdraw';
import { FormWithdraw } from '@shared/components/form-withdraw';
import { Spinner } from '@shared/components/misc';
import { useUIStore } from '@/stores/ui.store';
import { useAuth } from '@/contexts/AuthContext';
import { useWithdrawFromPublication } from '@/hooks/api/useVotes';
import { useTranslations } from 'next-intl';

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
  activeWithdrawPost?: string | null;
  setActiveWithdrawPost?: (post: string | null) => void;
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
  activeWithdrawPost,
  setActiveWithdrawPost,
  activeSlider,
  setActiveSlider,
  wallets = [],
  updateAll,
  className = '',
}) => {
  const { user } = useAuth();
  const t = useTranslations('feed');
  const myId = user?.id || user?.telegramId;
  
  // Withdraw mutation hook
  const withdrawMutation = useWithdrawFromPublication();
  
  // Extract beneficiary information
  const beneficiaryId = publication.beneficiaryId || publication.meta?.beneficiary?.telegramId;
  const authorId = publication.authorId;
  
  // Calculate beneficiary status
  const hasBeneficiary = !!(beneficiaryId && beneficiaryId !== authorId);
  const isAuthor = !!(myId && authorId && myId === authorId);
  const isBeneficiary = !!(hasBeneficiary && myId && beneficiaryId && myId === beneficiaryId);
  const currentScore = publication.metrics?.score || 0;
  
  // Withdraw slider state
  const publicationId = String(publication.id || publication.slug || '');
  const isThisPostActive = activeWithdrawPost && activeWithdrawPost.startsWith(publicationId + ':');
  const directionAdd = isThisPostActive 
    ? activeWithdrawPost === publicationId + ':add' 
    : undefined;
  
  const [amount, setAmount] = useState(0);
  const [comment, setComment] = useState('');
  const [withdrawMerits, setWithdrawMerits] = useState(false);
  const [optimisticScore, setOptimisticScore] = useState(currentScore);
  
  // Update optimistic score when publication score changes
  useEffect(() => {
    setOptimisticScore(currentScore);
  }, [currentScore]);
  
  // Calculate withdraw amounts
  const effectiveScore = optimisticScore ?? currentScore;
  const meritsAmount = (isAuthor && !hasBeneficiary) || isBeneficiary
    ? Math.floor(10 * (withdrawMerits ? effectiveScore : effectiveScore)) / 10
    : 0;
  
  const maxWithdrawAmount = meritsAmount;
  
  // Get current wallet balance for topup
  const communityId = publication.communityId;
  const currentBalance = communityId
    ? (wallets.find(w => w.communityId === communityId)?.balance || 0)
    : 0;
  const maxTopUpAmount = Math.floor(10 * (withdrawMerits ? currentBalance : currentBalance)) / 10;
  
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
  
  // Handle withdraw slider toggle
  const handleSetDirectionAdd = (direction: boolean | undefined) => {
    if (!setActiveWithdrawPost) return;
    
    if (direction === undefined) {
      setActiveWithdrawPost(null);
      setActiveSlider && setActiveSlider(null);
    } else {
      const newState = publicationId + ':' + (direction ? 'add' : 'withdraw');
      if (activeWithdrawPost === newState) {
        setActiveWithdrawPost(null);
        setActiveSlider && setActiveSlider(null);
      } else {
        setActiveWithdrawPost(newState);
        setActiveSlider && setActiveSlider(publicationId || null);
      }
    }
  };
  
  // Handle withdraw button click - opens slider
  const handleWithdrawClick = () => {
    handleSetDirectionAdd(false);
  };
  
  // Handle topup button click - opens slider for adding votes
  const handleTopupClick = () => {
    handleSetDirectionAdd(true);
  };
  
  // Submit withdrawal/topup
  const submitWithdrawal = async () => {
    if (!publicationId) return;
    
    // Only handle withdrawal (not adding votes through this flow)
    if (directionAdd) {
      // Topup should use voting popup instead
      console.warn('[PublicationActions] Topup through withdraw flow - opening voting popup');
      useUIStore.getState().openVotingPopup(publicationId, 'publication');
      handleSetDirectionAdd(undefined); // Close slider
      return;
    }
    
    const withdrawAmount = amount;
    
    if (withdrawAmount <= 0) {
      return;
    }
    
    const newScore = optimisticScore - withdrawAmount;
    setOptimisticScore(newScore);
    
    try {
      console.log('[PublicationActions] Withdrawing from publication:', {
        publicationId,
        amount: withdrawAmount,
      });
      
      await withdrawMutation.mutateAsync({
        publicationId,
        amount: withdrawAmount,
      });
      
      console.log('[PublicationActions] Withdraw successful');
      
      // Reset form
      setAmount(0);
      setComment('');
      handleSetDirectionAdd(undefined);
      
      // Refresh data
      if (updateAll) {
        await updateAll();
      }
    } catch (error: any) {
      console.error('[PublicationActions] Withdraw failed:', error);
      // Revert optimistic update
      setOptimisticScore(currentScore);
      throw error;
    }
  };
  
  const disabled = !amount || amount <= 0;

  // Withdraw slider content
  const withdrawSliderContent = showWithdraw && directionAdd !== undefined && (
    <>
      {withdrawMerits ? (
        withdrawMutation.isPending ? (
          <Spinner />
        ) : (
          <FormWithdraw
            comment={comment}
            setComment={setComment}
            amount={amount}
            setAmount={setAmount}
            maxWithdrawAmount={maxWithdrawAmount}
            maxTopUpAmount={maxTopUpAmount}
            isWithdrawal={!directionAdd}
            onSubmit={() => !disabled && submitWithdrawal()}
          >
            <div>
              {directionAdd ? t('addMerits', { amount }) : t('removeMerits', { amount })}
            </div>
          </FormWithdraw>
        )
      ) : (
        withdrawMutation.isPending ? (
          <Spinner />
        ) : (
          <FormWithdraw
            comment={comment}
            setComment={setComment}
            amount={amount}
            setAmount={setAmount}
            maxWithdrawAmount={maxWithdrawAmount}
            maxTopUpAmount={maxTopUpAmount}
            isWithdrawal={!directionAdd}
            onSubmit={() => !disabled && submitWithdrawal()}
          >
            <div>
              {directionAdd ? t('addCommunityPoints', { amount }) : t('removeCommunityPoints', { amount })}
            </div>
          </FormWithdraw>
        )
      )}
    </>
  );

  return (
    <div className={`space-y-4 ${className}`}>
      <div className="flex items-center justify-between">
        {showWithdraw ? (
          <BarWithdraw
            balance={meritsAmount}
            onWithdraw={handleWithdrawClick}
            onTopup={handleTopupClick}
            showDisabled={isBeneficiary || (isAuthor && !hasBeneficiary)}
            isLoading={withdrawMutation.isPending}
          >
            <div className="select-currency">
              <span
                className={
                  !withdrawMerits
                    ? "clickable bar-withdraw-select"
                    : "bar-withdraw-select-active"
                }
                onClick={() => setWithdrawMerits(true)}
              >
                {t('merits')}{" "}
              </span>
              <span
                className={
                  withdrawMerits
                    ? "clickable bar-withdraw-select"
                    : "bar-withdraw-select-active"
                }
                onClick={() => setWithdrawMerits(false)}
              >
                {t('points')}
              </span>
            </div>
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
      
      {/* Withdraw slider */}
      {withdrawSliderContent}
    </div>
  );
};
