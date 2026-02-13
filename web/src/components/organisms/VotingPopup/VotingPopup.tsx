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
import { usePublication } from '@/hooks/api/usePublications';
import { VotingPanel } from './VotingPanel';
import { BottomPortal } from '@/shared/components/bottom-portal';
import { IntlPortalWrapper } from '@/components/providers/IntlPortalWrapper';
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

  // Get user role in community
  const { data: userRoles = [] } = useUserRoles(user?.id || '');
  const { data: community } = useCommunity(targetCommunityId || '');
  
  // Get publication to check if user is voting for own post
  const { data: publication } = usePublication(
    votingTargetType === 'publication' && activeVotingTarget ? activeVotingTarget : ''
  );
  
  // Check if user is voting for own post (author or beneficiary)
  const isOwnPost = useMemo(() => {
    if (!user?.id || !publication || votingTargetType !== 'publication') return false;
    const authorId = publication.authorId;
    const beneficiaryId = publication.beneficiaryId || publication.meta?.beneficiary?.id;
    const isAuthor = !!(authorId && user.id === authorId);
    const hasBeneficiary = !!(beneficiaryId && beneficiaryId !== authorId);
    const isBeneficiary = !!(hasBeneficiary && beneficiaryId && user.id === beneficiaryId);
    return isAuthor || isBeneficiary;
  }, [user?.id, publication, votingTargetType]);
  
  // Force wallet-only mode for own posts
  const effectiveVotingMode = isOwnPost ? 'wallet-only' : votingMode;

  // Comment mode from community (neutralOnly = only text; weightedOnly = weight required; all = both allowed)
  const commentMode = useMemo(
    () =>
      (community?.settings as { commentMode?: 'all' | 'neutralOnly' | 'weightedOnly'; tappalkaOnlyMode?: boolean })?.commentMode ??
      ((community?.settings as { tappalkaOnlyMode?: boolean })?.tappalkaOnlyMode ? 'neutralOnly' : 'all'),
    [community?.settings],
  );

  // D-10: Closed posts — force neutral-only (no weighted vote) regardless of community setting
  const effectiveCommentMode =
    (publication as { status?: string })?.status === 'closed' ? 'neutralOnly' : commentMode;

  // Use mutation hooks for voting and commenting
  const voteOnPublicationWithCommentMutation = useVoteOnPublicationWithComment();
  const voteOnVoteMutation = useVoteOnVote();

  const isOpen = !!activeVotingTarget && !!votingTargetType;

  // Get quota for the community
  const { quotasMap } = useCommunityQuotas(targetCommunityId ? [targetCommunityId] : []);
  const quotaData = targetCommunityId ? quotasMap.get(targetCommunityId) : null;
  
  // Check if quota is enabled in community settings
  const quotaEnabled = community?.meritSettings?.quotaEnabled !== false;
  const quotaRemaining = quotaEnabled ? (quotaData?.remainingToday ?? 0) : 0;
  const dailyQuota = quotaEnabled ? (quotaData?.dailyQuota ?? 0) : 0;
  const usedToday = quotaEnabled ? (quotaData?.usedToday ?? 0) : 0;
  const freePlus = quotaRemaining;
  const freeMinus = 0; // Downvotes typically don't have free quota

  // Get free balance as fallback (different API endpoint)
  const freePlusAmount = quotaRemaining > 0 ? quotaRemaining : (typeof freeBalance === 'number' ? freeBalance : 0);

  // Note: Quota and wallet optimistic updates are handled by mutation hooks

  const hasPoints = freePlusAmount > 0 || walletBalance > 0;

  // Check if wallet can be used for voting
  const canUseWallet = canUseWalletForVoting(walletBalance, community);

  // Calculate maxPlus based on effective voting mode
  let maxPlus = 0;
  if (effectiveVotingMode === 'wallet-only') {
    maxPlus = walletBalance || 0;
  } else if (effectiveVotingMode === 'quota-only') {
    maxPlus = freePlusAmount;
  } else {
    // In mixed mode (standard), always include both quota and wallet
    // Use quotaRemaining directly (not freePlusAmount which is a fallback)
    maxPlus = quotaRemaining + (walletBalance || 0);
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
      commentMode: effectiveCommentMode,
      quotaRemaining,
      walletBalance,
      effectiveVotingMode,
    });
    if (delta === 0) {
      if (effectiveCommentMode === 'weightedOnly') {
        updateVotingFormData({ error: t('weightRequired') });
        return;
      }
      if (effectiveCommentMode === 'all' || effectiveCommentMode === 'neutralOnly') {
        // Neutral comment: allow with 0 weight (require comment text)
        if (!formData.comment?.trim()) {
          updateVotingFormData({ error: t('reasonRequired') });
          return;
        }
        // Fall through to submit with quotaAmount=0, walletAmount=0
      } else {
        updateVotingFormData({ error: t('pleaseAdjustSlider') });
        return;
      }
    }

    const isUpvote = directionPlus;

    // Check if comment is required and provided (only for positive votes; neutral already validated above)
    if (isUpvote && delta !== 0 && !formData.comment?.trim()) {
      updateVotingFormData({ error: t('reasonRequired') });
      return;
    }
    const absoluteAmount = Math.abs(delta);
    console.log('[VotingPopup] After initial checks', {
      absoluteAmount,
      isUpvote,
      commentMode,
    });

    // Calculate vote breakdown for submission (quota first, then wallet overflow).
    // Neutral comment (delta === 0) when effectiveCommentMode is all or neutralOnly: submit 0,0
    let quotaAmount = 0;
    let walletAmount = 0;

    if (absoluteAmount === 0) {
      quotaAmount = 0;
      walletAmount = 0;
    } else if (isUpvote) {
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
      if (!canUseWallet) {
        updateVotingFormData({ error: t('downvoteRequiresBalance') });
        return;
      }
      quotaAmount = 0;
      walletAmount = absoluteAmount;
    }

    // Validate that at least one amount is non-zero before submission (except for neutral comment)
    const isNeutralSubmit = quotaAmount === 0 && walletAmount === 0;
    if (isNeutralSubmit) {
      const allowedNeutral =
        effectiveCommentMode === 'neutralOnly' || (effectiveCommentMode === 'all' && formData.comment?.trim());
      if (!allowedNeutral) {
        if (absoluteAmount === 0 && effectiveCommentMode === 'weightedOnly') {
          updateVotingFormData({ error: t('weightRequired') });
          return;
        }
        if (!formData.comment?.trim()) {
          updateVotingFormData({ error: t('reasonRequired') });
          return;
        }
        updateVotingFormData({ error: 'You have insufficient wallet balance for downvotes.' });
        return;
      }
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
      <IntlPortalWrapper>
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
          isOwnPost={isOwnPost}
          images={enableCommentImageUploads ? (formData.images || []) : []}
          onImagesChange={enableCommentImageUploads ? handleImagesChange : undefined}
          commentMode={effectiveCommentMode}
          hideQuota={effectiveCommentMode === 'neutralOnly'}
          submitButtonLabel={effectiveCommentMode === 'neutralOnly' ? (t('commentButton') || 'Comment') : undefined}
        />
        </div>
      </div>
      </IntlPortalWrapper>
    </BottomPortal>
  );
};

