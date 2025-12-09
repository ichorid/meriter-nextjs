'use client';

import React, { useMemo } from 'react';
import { useUIStore } from '@/stores/ui.store';
import { useAuth } from '@/contexts/AuthContext';
import { useFreeBalance } from '@/hooks/api/useWallet';
import { useCommunityQuotas } from '@/hooks/api/useCommunityQuota';
import { useTranslations } from 'next-intl';
import { useVoteOnPublicationWithComment, useVoteOnVote } from '@/hooks/api/useVotes';
import { usePopupCommunityData } from '@/hooks/usePopupCommunityData';
import { usePopupFormData } from '@/hooks/usePopupFormData';
import { useUserRoles } from '@/hooks/api/useProfile';
import { useCommunity } from '@/hooks/api';
import { VotingPanel } from './VotingPanel';
import { BottomPortal } from '@/shared/components/bottom-portal';
import { useFeaturesConfig } from '@/hooks/useConfig';

interface VotingPopupProps {
  communityId?: string;
}

export const VotingPopup: React.FC<VotingPopupProps> = ({
  communityId,
}) => {
  const t = useTranslations('comments');
  const features = useFeaturesConfig();
  const enableCommentVoting = features.commentVoting;
  const { user } = useAuth();
  const {
    activeVotingTarget,
    votingTargetType,
    votingMode,
    activeVotingFormData,
    closeVotingPopup,
    updateVotingFormData,
  } = useUIStore();

  // Use shared hook for community data
  const { targetCommunityId, currencyIconUrl, walletBalance } = usePopupCommunityData(communityId);

  // Get user role to check if viewer
  const { data: userRoles = [] } = useUserRoles(user?.id || '');
  const { data: community } = useCommunity(targetCommunityId || '');
  
  // Check if user is a viewer
  const isViewer = useMemo(() => {
    if (!user?.id || !targetCommunityId || !community) return false;
    if (user.globalRole === 'superadmin') return false;
    const role = userRoles.find(r => r.communityId === targetCommunityId);
    return role?.role === 'viewer';
  }, [user?.id, user?.globalRole, userRoles, targetCommunityId, community]);

  // Force quota-only mode for viewers
  const effectiveVotingMode = isViewer ? 'quota-only' : votingMode;

  // Use mutation hooks for voting and commenting
  const voteOnPublicationWithCommentMutation = useVoteOnPublicationWithComment();
  const voteOnVoteMutation = useVoteOnVote();

  const isOpen = !!activeVotingTarget && !!votingTargetType;

  // Get quota for the community
  const { quotasMap } = useCommunityQuotas(targetCommunityId ? [targetCommunityId] : []);
  const quotaData = targetCommunityId ? quotasMap.get(targetCommunityId) : null;
  const quotaRemaining = quotaData?.remainingToday ?? 0;
  const freePlus = quotaRemaining;
  const freeMinus = 0; // Downvotes typically don't have free quota

  // Get free balance as fallback (different API endpoint)
  const { data: freeBalance } = useFreeBalance(targetCommunityId);
  const freePlusAmount = quotaRemaining > 0 ? quotaRemaining : (typeof freeBalance === 'number' ? freeBalance : 0);

  // Note: Quota and wallet optimistic updates are handled by mutation hooks

  const hasPoints = freePlusAmount > 0 || walletBalance > 0;

  // Calculate maxPlus based on effective voting mode (quota-only for viewers)
  let maxPlus = 0;
  if (effectiveVotingMode === 'wallet-only') {
    maxPlus = walletBalance || 0;
  } else if (effectiveVotingMode === 'quota-only') {
    maxPlus = freePlusAmount;
  } else {
    maxPlus = freePlusAmount + (walletBalance || 0);
  }

  // maxMinus should use wallet balance for negative votes (downvotes use wallet only)
  // When walletBalance is 0, maxMinus should be 0 to prevent negative slider positions
  const calculatedMaxMinus = walletBalance || 0;

  // Use shared hook for form data management
  const { formData, handleCommentChange } = usePopupFormData({
    isOpen,
    formData: activeVotingFormData,
    defaultFormData: { comment: '', delta: 0, error: '' },
    updateFormData: updateVotingFormData,
  });

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

    // Handle restricted modes (use effectiveVotingMode to enforce quota-only for viewers)
    if (effectiveVotingMode === 'wallet-only') {
      return {
        quotaAmount: 0,
        walletAmount: amount,
        isSplit: false,
      };
    }

    if (effectiveVotingMode === 'quota-only') {
      return {
        quotaAmount: Math.min(amount, quotaRemaining),
        walletAmount: 0,
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
  }, [formData.delta, quotaRemaining, effectiveVotingMode]);

  const handleClose = () => {
    closeVotingPopup();
    updateVotingFormData({ comment: '', delta: 0, error: '' });
  };

  const handleSubmit = async (directionPlus: boolean) => {
    if (!activeVotingTarget || !votingTargetType || !targetCommunityId) return;

    // Check feature flag - comment voting is disabled by default
    if (votingTargetType === 'comment' && !enableCommentVoting) {
      updateVotingFormData({ error: 'Voting on comments is disabled. You can only vote on posts/publications.' });
      return;
    }

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
      if (effectiveVotingMode === 'wallet-only') {
        walletAmount = absoluteAmount;
        quotaAmount = 0;
      } else if (effectiveVotingMode === 'quota-only') {
        quotaAmount = Math.min(absoluteAmount, quotaRemaining);
        walletAmount = 0;
      } else {
        quotaAmount = Math.min(absoluteAmount, quotaRemaining);
        walletAmount = Math.max(0, absoluteAmount - quotaRemaining);
      }
    } else {
      // Downvotes use wallet only (but viewers can't downvote since they can't use wallet)
      if (isViewer) {
        updateVotingFormData({ error: 'Viewers can only vote using daily quota. Downvotes require wallet merits.' });
        return;
      }
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
      <div className="fixed inset-0 z-50 pointer-events-auto flex items-end justify-center">
        <div 
          className="fixed inset-0 bg-black/50 backdrop-blur-sm transition-opacity" 
          onClick={handleClose}
        />
        <VotingPanel
          onClose={handleClose}
          amount={formData.delta}
          setAmount={handleAmountChange}
          comment={formData.comment}
          setComment={handleCommentChange}
          onSubmit={handleSubmit}
          maxPlus={maxPlus}
          maxMinus={calculatedMaxMinus}
          quotaRemaining={quotaRemaining}
          error={formData.error}
          isViewer={isViewer}
        />
      </div>
    </BottomPortal>
  );
};

