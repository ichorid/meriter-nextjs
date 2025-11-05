'use client';

import React, { useEffect, useMemo } from 'react';
import { useUIStore } from '@/stores/ui.store';
import { BottomPortal } from '@/shared/components/bottom-portal';
import { FormComment } from '@/features/comments/components/form-comment';
import { useAuth } from '@/contexts/AuthContext';
import { useWallets, useCommunity } from '@/hooks/api';
import { useFreeBalance } from '@/hooks/api/useWallet';
import { useCommunityQuotas } from '@/hooks/api/useCommunityQuota';
import { useTranslations } from 'next-intl';
import { useVoteOnPublicationWithComment, useVoteOnVote } from '@/hooks/api/useVotes';

interface VotingPopupProps {
  communityId?: string;
}

export const VotingPopup: React.FC<VotingPopupProps> = ({
  communityId,
}) => {
  const t = useTranslations('comments');
  const { user } = useAuth();
  const {
    activeVotingTarget,
    votingTargetType,
    activeVotingFormData,
    closeVotingPopup,
    updateVotingFormData,
  } = useUIStore();

  // Use mutation hooks for voting and commenting
  const voteOnPublicationWithCommentMutation = useVoteOnPublicationWithComment();
  const voteOnVoteMutation = useVoteOnVote();

  const isOpen = !!activeVotingTarget && !!votingTargetType;

  // Get wallets to find balance for the target community
  const { data: wallets = [] } = useWallets();
  
  // Determine which community to use - prefer prop, otherwise try to derive from target
  const targetCommunityId = communityId || (wallets[0]?.communityId);

  // Get community data to access currency icon
  const { data: communityData } = useCommunity(targetCommunityId || '');
  const currencyIconUrl = communityData?.settings?.iconUrl;

  // Get quota for the community
  const { quotasMap } = useCommunityQuotas(targetCommunityId ? [targetCommunityId] : []);
  const quotaData = targetCommunityId ? quotasMap.get(targetCommunityId) : null;
  const quotaRemaining = quotaData?.remainingToday ?? 0;
  const freePlus = quotaRemaining;
  const freeMinus = 0; // Downvotes typically don't have free quota

  // Get wallet balance for the community
  const walletBalance = useMemo(() => {
    if (!targetCommunityId || !Array.isArray(wallets)) return 0;
    const wallet = wallets.find((w: any) => w.communityId === targetCommunityId);
    return wallet?.balance || 0;
  }, [targetCommunityId, wallets]);

  // Get free balance as fallback (different API endpoint)
  const { data: freeBalance } = useFreeBalance(targetCommunityId);
  const freePlusAmount = quotaRemaining > 0 ? quotaRemaining : (typeof freeBalance === 'number' ? freeBalance : 0);

  // Note: Quota and wallet optimistic updates are handled by mutation hooks

  const hasPoints = freePlusAmount > 0 || walletBalance > 0;
  const maxPlus = freePlusAmount + (walletBalance || 0);
  // maxMinus should use wallet balance for negative votes (downvotes use wallet only)
  // When walletBalance is 0, maxMinus should be 0 to prevent negative slider positions
  const calculatedMaxMinus = walletBalance || 0;

  // Initialize form data if not present
  useEffect(() => {
    if (isOpen && !activeVotingFormData) {
      updateVotingFormData({ comment: '', delta: 0, error: '' });
    }
  }, [isOpen, activeVotingFormData, updateVotingFormData]);

  const formData = activeVotingFormData || { comment: '', delta: 0, error: '' };

  const handleCommentChange = (comment: string) => {
    updateVotingFormData({ comment, error: '' });
  };

  const handleAmountChange = (amount: number) => {
    // FormCommentVoteVertical passes signed values (can be negative)
    updateVotingFormData({ delta: amount, error: '' });
  };

  // Calculate vote breakdown: quota vs wallet
  const voteBreakdown = useMemo(() => {
    const amount = Math.abs(formData.delta);
    const isUpvote = formData.delta > 0;
    
    if (!isUpvote) {
      // Downvotes use wallet only (no quota)
      return {
        quotaAmount: 0,
        walletAmount: amount,
        isSplit: false,
      };
    }
    
    // Upvotes: use quota first, then wallet
    const quotaAmount = Math.min(amount, quotaRemaining);
    const walletAmount = Math.max(0, amount - quotaRemaining);
    
    return {
      quotaAmount,
      walletAmount,
      isSplit: walletAmount > 0,
    };
  }, [formData.delta, quotaRemaining]);

  const handleClose = () => {
    closeVotingPopup();
    updateVotingFormData({ comment: '', delta: 0, error: '' });
  };

  const handleSubmit = async (directionPlus: boolean) => {
    if (!activeVotingTarget || !votingTargetType || !targetCommunityId) return;

    const delta = formData.delta;
    if (delta === 0) {
      updateVotingFormData({ error: t('pleaseAdjustSlider') || 'Please adjust the slider to vote' });
      return;
    }

    // Check if comment is required and provided
    if (!formData.comment?.trim()) {
      updateVotingFormData({ error: t('reasonRequired') || 'A reason for your vote is required' });
      return;
    }

    const isUpvote = directionPlus;
    const absoluteAmount = Math.abs(delta);
    
    // Calculate vote breakdown
    let quotaAmount = 0;
    let walletAmount = 0;
    
    if (isUpvote) {
      quotaAmount = Math.min(absoluteAmount, quotaRemaining);
      walletAmount = Math.max(0, absoluteAmount - quotaRemaining);
    } else {
      // Downvotes use wallet only
      walletAmount = absoluteAmount;
    }

    try {
      updateVotingFormData({ error: '' });

      const targetId = activeVotingTarget;

      // For publications, use the combined endpoint that creates comment and vote atomically
      if (votingTargetType === 'publication') {
        // Single vote with both quota and wallet amounts
        await voteOnPublicationWithCommentMutation.mutateAsync({
          publicationId: targetId,
          data: {
            quotaAmount,
            walletAmount,
            comment: formData.comment.trim() || undefined,
          },
          communityId: targetCommunityId,
        });
      } else {
        // For votes, use the vote-on-vote endpoint
        // Include comment field for vote-comments (L2, L3, etc.)
        await voteOnVoteMutation.mutateAsync({
          voteId: targetId,
          data: {
            quotaAmount,
            walletAmount,
            comment: formData.comment.trim() || undefined,
          },
          communityId: targetCommunityId,
        });
      }

      // Close popup and reset form
      handleClose();
    } catch (err: unknown) {
      // Mutation hooks handle rollback automatically via onError
      const message = err instanceof Error ? err.message : t('errorCommenting') || 'Failed to submit';
      updateVotingFormData({ error: message });
    }
  };

  if (!isOpen) {
    return null;
  }

  return (
    <BottomPortal>
      <div className="fixed inset-0 z-50 flex items-end justify-center p-4 pointer-events-auto">
        {/* Backdrop */}
        <div
          className="fixed inset-0 bg-black/50 backdrop-blur-sm"
          onClick={handleClose}
        />
        {/* Form Container */}
        <div className="relative z-10 w-full max-w-md bg-base-100 rounded-t-2xl shadow-2xl pointer-events-auto max-h-[90vh] overflow-y-auto">
          <FormComment
            uid={activeVotingTarget}
            hasPoints={hasPoints}
            comment={formData.comment}
            setComment={handleCommentChange}
            amount={formData.delta}
            setAmount={handleAmountChange}
            free={freePlusAmount}
            maxPlus={maxPlus}
            maxMinus={calculatedMaxMinus}
            commentAdd={handleSubmit}
            error={formData.error}
            onClose={handleClose}
            quotaAmount={voteBreakdown.quotaAmount}
            walletAmount={voteBreakdown.walletAmount}
            quotaRemaining={quotaRemaining}
            currencyIconUrl={currencyIconUrl}
          />
        </div>
      </div>
    </BottomPortal>
  );
};

