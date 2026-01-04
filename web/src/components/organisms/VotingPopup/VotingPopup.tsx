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
import { useToastStore } from '@/shared/stores/toast.store';
import { canUseWalletForVoting } from './voting-utils';

interface VotingPopupProps {
  communityId?: string;
}

export const VotingPopup: React.FC<VotingPopupProps> = ({
  communityId,
}) => {
  const t = useTranslations('comments');
  const features = useFeaturesConfig();
  const enableCommentVoting = features.commentVoting;
  const enableCommentImageUploads = features.commentImageUploads;
  const { user } = useAuth();
  const {
    activeVotingTarget,
    votingTargetType,
    votingMode,
    activeVotingFormData,
    closeVotingPopup,
    updateVotingFormData,
  } = useUIStore();
  
  const addToast = useToastStore((state) => state.addToast);

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
  const dailyQuota = quotaData?.dailyQuota ?? 0;
  const usedToday = quotaData?.usedToday ?? 0;
  const freePlus = quotaRemaining;
  const freeMinus = 0; // Downvotes typically don't have free quota

  // Get free balance as fallback (different API endpoint)
  const { data: freeBalance } = useFreeBalance(targetCommunityId);
  const freePlusAmount = quotaRemaining > 0 ? quotaRemaining : (typeof freeBalance === 'number' ? freeBalance : 0);

  // Note: Quota and wallet optimistic updates are handled by mutation hooks

  const hasPoints = freePlusAmount > 0 || walletBalance > 0;

  // Check if wallet can be used for voting
  const canUseWallet = canUseWalletForVoting(walletBalance, community);

  // Calculate maxPlus based on effective voting mode (quota-only for viewers)
  let maxPlus = 0;
  if (effectiveVotingMode === 'wallet-only') {
    maxPlus = walletBalance || 0;
  } else if (effectiveVotingMode === 'quota-only') {
    maxPlus = freePlusAmount;
  } else {
    // In mixed mode, include wallet only if it can be used
    maxPlus = freePlusAmount + (canUseWallet ? (walletBalance || 0) : 0);
  }

  // maxMinus should use wallet balance for negative votes (downvotes use wallet only)
  // When walletBalance is 0, maxMinus should be 0 to prevent negative slider positions
  const calculatedMaxMinus = walletBalance || 0;

  // Use shared hook for form data management
  const { formData, handleCommentChange } = usePopupFormData({
    isOpen,
    formData: activeVotingFormData,
    defaultFormData: { comment: '', delta: 0, error: '', images: [] },
    updateFormData: updateVotingFormData,
  });

  const handleAmountChange = (amount: number) => {
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
    updateVotingFormData({ comment: '', delta: 0, error: '', images: [] });
  };

  const handleImagesChange = (images: string[]) => {
    updateVotingFormData({ images });
  };

  const handleSubmit = async (directionPlus: boolean) => {
    console.log('[VotingPopup] handleSubmit called', { directionPlus });
    if (!activeVotingTarget || !votingTargetType || !targetCommunityId) {
      console.log('[VotingPopup] Early return: missing required data', { activeVotingTarget, votingTargetType, targetCommunityId });
      return;
    }

    // Check feature flag - comment voting is disabled by default
    if (votingTargetType === 'comment' && !enableCommentVoting) {
      updateVotingFormData({ error: t('commentVotingDisabled') || 'Voting on comments is disabled. You can only vote on posts/publications.' });
      return;
    }

    const delta = formData.delta;
    console.log('[VotingPopup] Initial values', {
      delta,
      quotaRemaining,
      walletBalance,
      effectiveVotingMode,
      isViewer,
      'quotaRemaining type': typeof quotaRemaining,
      'walletBalance type': typeof walletBalance,
    });
    if (delta === 0) {
      updateVotingFormData({ error: t('pleaseAdjustSlider') });
      return;
    }

    const isUpvote = directionPlus;

    // Check if comment is required and provided (only for positive votes)
    if (isUpvote && !formData.comment?.trim()) {
      updateVotingFormData({ error: t('reasonRequired') });
      return;
    }
    const absoluteAmount = Math.abs(delta);
    console.log('[VotingPopup] After initial checks', {
      absoluteAmount,
      isUpvote,
      'absoluteAmount type': typeof absoluteAmount,
      'absoluteAmount value': absoluteAmount,
    });

    // Calculate vote breakdown for submission (quota first, then wallet overflow).
    // IMPORTANT: Use `freePlusAmount` (quotaRemaining fallback) as the quota budget we allow in UI.
    let quotaAmount = 0;
    let walletAmount = 0;

    if (isUpvote) {
      console.log('[VotingPopup] Calculating upvote amounts, effectiveVotingMode:', effectiveVotingMode);

      if (effectiveVotingMode === 'wallet-only') {
        if (!canUseWallet) {
          updateVotingFormData({ error: t('downvoteRequiresBalance') });
          return;
        }
        quotaAmount = 0;
        walletAmount = absoluteAmount;
      } else if (effectiveVotingMode === 'quota-only') {
        quotaAmount = absoluteAmount;
        walletAmount = 0;
      } else {
        // Standard (mixed): spend quota first, then overflow into wallet (if enabled).
        const quotaBudget = freePlusAmount;
        quotaAmount = Math.min(absoluteAmount, quotaBudget);
        walletAmount = Math.max(0, absoluteAmount - quotaAmount);

        if (walletAmount > 0 && !canUseWallet) {
          updateVotingFormData({ error: t('downvoteRequiresBalance') });
          return;
        }
      }
    } else {
      // Downvotes use wallet only (quota cannot be used for downvotes)
      console.log('[VotingPopup] Calculating downvote amounts');
      if (isViewer) {
        updateVotingFormData({ error: t('downvoteViewerReason') });
        return;
      }
      if (!canUseWallet) {
        updateVotingFormData({ error: t('downvoteRequiresBalance') });
        return;
      }
      quotaAmount = 0;
      walletAmount = absoluteAmount;
    }

    // Validate that at least one amount is non-zero before submission
    // This handles edge cases where calculation resulted in both being 0
    // (e.g., downvotes with no wallet balance, though walletAmount should be > 0 if absoluteAmount > 0)
    console.log('[VotingPopup] After calculation, before validation:', {
      quotaAmount,
      walletAmount,
      absoluteAmount,
      'quotaAmount === 0': quotaAmount === 0,
      'walletAmount === 0': walletAmount === 0,
      'both zero?': quotaAmount === 0 && walletAmount === 0,
    });
    if (quotaAmount === 0 && walletAmount === 0) {
      console.warn('[VotingPopup] Both amounts are 0! This should not happen. Fixing...', { isUpvote, absoluteAmount });
      if (!isUpvote) {
        // For downvotes, we need wallet - can't proceed without it
        updateVotingFormData({ error: 'You have insufficient wallet balance for downvotes.' });
        return;
      }
      // For upvotes, this shouldn't happen due to calculation above, but if it does,
      // try quota anyway (might be stale data) - server will validate
      quotaAmount = absoluteAmount;
      walletAmount = 0;
      console.log('[VotingPopup] Fixed amounts for upvote:', { quotaAmount, walletAmount });
    }

    console.log('[VotingPopup] Final amounts before API call:', {
      quotaAmount,
      walletAmount,
      absoluteAmount,
      isUpvote,
      votingTargetType,
      'quotaAmount type': typeof quotaAmount,
      'walletAmount type': typeof walletAmount,
      'quotaAmount value': quotaAmount,
      'walletAmount value': walletAmount,
    });

    // Close popup immediately to prevent flash of updated progress bars
    // The optimistic updates will happen in onMutate, but the popup will already be closed
    const targetId = activeVotingTarget;
    const commentText = formData.comment.trim();
    const imagesToSubmit = enableCommentImageUploads && formData.images && formData.images.length > 0 ? formData.images : undefined;
    
    // Close popup and reset form immediately
    handleClose();

    try {
      // For publications, use the combined endpoint that creates comment and vote atomically
      if (votingTargetType === 'publication') {
        const mutationPayload = {
          publicationId: targetId,
          data: {
            quotaAmount,
            walletAmount,
            comment: commentText || undefined,
            direction: isUpvote ? 'up' : 'down' as const,
            images: imagesToSubmit,
          },
          communityId: targetCommunityId,
        };
        console.log('[VotingPopup] Calling voteOnPublicationWithCommentMutation with:', JSON.stringify(mutationPayload, null, 2));
        console.log('[VotingPopup] Raw values:', {
          quotaAmount,
          walletAmount,
          'quotaAmount === 0': quotaAmount === 0,
          'walletAmount === 0': walletAmount === 0,
        });
        // Single vote with both quota and wallet amounts
        await voteOnPublicationWithCommentMutation.mutateAsync({
          publicationId: targetId,
          data: {
            quotaAmount,
            walletAmount,
            comment: commentText || undefined,
            direction: isUpvote ? 'up' : 'down',
            images: imagesToSubmit,
          },
          communityId: targetCommunityId,
        });
      } else {
        // For votes, use the vote-on-vote endpoint
        // Include comment field for vote-comments (L2, L3, etc.)
        console.log('[VotingPopup] Calling voteOnVoteMutation with:', {
          voteId: targetId,
          quotaAmount,
          walletAmount,
          comment: commentText || undefined,
          direction: isUpvote ? 'up' : 'down',
        });
        await voteOnVoteMutation.mutateAsync({
          voteId: targetId,
          data: {
            quotaAmount,
            walletAmount,
            comment: commentText || undefined,
            direction: isUpvote ? 'up' : 'down',
            images: imagesToSubmit,
          },
          communityId: targetCommunityId,
        });
      }

      // Popup already closed, mutation successful
      console.log('[VotingPopup] Vote submitted successfully');
      
      // Show success toast
      addToast('Vote submitted successfully', 'success');
    } catch (err: unknown) {
      // Mutation hooks handle rollback automatically via onError
      console.error('[VotingPopup] Error submitting vote:', err);
      const message = err instanceof Error ? err.message : t('errorCommenting');
      
      // Show error in toast notification
      addToast(message, 'error');
    }
  };

  if (!isOpen) {
    return null;
  }

  return (
    <BottomPortal>
      <div className="fixed inset-0 z-50 pointer-events-auto flex items-center justify-center">
        <div 
          className="absolute inset-0 bg-black/50 backdrop-blur-sm transition-opacity -z-10" 
          onClick={handleClose}
        />
        <div className="relative z-10">
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
          dailyQuota={dailyQuota}
          usedToday={usedToday}
          walletBalance={walletBalance}
          community={community}
          error={formData.error}
          isViewer={isViewer}
          images={enableCommentImageUploads ? (formData.images || []) : []}
          onImagesChange={enableCommentImageUploads ? handleImagesChange : undefined}
        />
        </div>
      </div>
    </BottomPortal>
  );
};

