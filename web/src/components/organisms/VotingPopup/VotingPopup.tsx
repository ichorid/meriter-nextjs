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
import { resolveApiErrorToastMessage } from '@/lib/i18n/api-error-toast';
import { canUseWalletForVoting } from './voting-utils';
import { isPublicationEntitySourced } from '@/lib/publication-source';
import { GLOBAL_COMMUNITY_ID } from '@/lib/constants/app';

interface VotingPopupProps {
  communityId?: string;
}

export const VotingPopup: React.FC<VotingPopupProps> = ({
  communityId,
}) => {
  const t = useTranslations('comments');
  const tPilot = useTranslations('multiObraz');
  const tShared = useTranslations('shared');
  const features = useFeaturesConfig();
  const enableCommentVoting = features.commentVoting;
  const enableCommentImageUploads = features.commentImageUploads;
  const { user } = useAuth();
  const {
    activeVotingTarget,
    votingTargetType,
    votingMode,
    votingPublicationIsTask,
    votingTaskAllowWeightedMerits,
    activeVotingFormData,
    closeVotingPopup,
    updateVotingFormData,
  } = useUIStore();
  
  const addToast = useToastStore((state) => state.addToast);

  const { data: publication } = usePublication(
    votingTargetType === 'publication' && activeVotingTarget ? activeVotingTarget : '',
  );

  const pilotTaskAppreciation = useMemo(() => {
    const isTicketPost = (publication as { postType?: string } | undefined)?.postType === 'ticket';
    return (
      communityId === GLOBAL_COMMUNITY_ID &&
      votingPublicationIsTask === true &&
      votingTaskAllowWeightedMerits === true &&
      isTicketPost
    );
  }, [communityId, votingPublicationIsTask, votingTaskAllowWeightedMerits, publication]);

  const voteContextCommunityId = useMemo(() => {
    if (votingTargetType === 'publication' && publication?.communityId) {
      const isTicketPost = (publication as { postType?: string } | undefined)?.postType === 'ticket';
      // Pilot shell uses VotingPopup outside AdaptiveLayout. For task appreciation we spend global merits
      // (same as dreams) even though the ticket's community is the dream project.
      if (votingPublicationIsTask === true && isTicketPost && communityId === GLOBAL_COMMUNITY_ID) {
        return GLOBAL_COMMUNITY_ID;
      }
      return publication.communityId;
    }
    return communityId;
  }, [votingTargetType, publication, communityId, votingPublicationIsTask]);

  // Wallet / quota context: publication's community when voting on a post (e.g. OB in future-vision)
  const { targetCommunityId, currencyIconUrl, walletBalance } =
    usePopupCommunityData(voteContextCommunityId);

  const { data: freeBalance } = useFreeBalance(targetCommunityId || undefined);

  // Get user role in community
  const { data: userRoles = [] } = useUserRoles(user?.id || '');
  const { data: community } = useCommunity(targetCommunityId || '');
  
  // Personal author or beneficiary: wallet-only / own-post helpers (entity-sourced posts are not "own personal post")
  const isOwnPost = useMemo(() => {
    if (!user?.id || !publication || votingTargetType !== 'publication') return false;
    const authorId = publication.authorId;
    const beneficiaryId = publication.beneficiaryId || publication.meta?.beneficiary?.id;
    const isTicketPost = (publication as { postType?: string } | undefined)?.postType === 'ticket';
    const entitySourced = isPublicationEntitySourced(
      publication as { authorKind?: 'user' | 'community'; sourceEntityType?: 'project' | 'community' },
    );
    // Tickets: do NOT treat task creator as "own post" when they are rewarding someone else.
    // Own-post restrictions still apply when user is the beneficiary/assignee.
    if (isTicketPost && beneficiaryId && beneficiaryId !== authorId && user.id === authorId) {
      return false;
    }
    const isPersonalAuthor = !!(authorId && user.id === authorId && !entitySourced);
    const hasBeneficiary = !!(beneficiaryId && beneficiaryId !== authorId);
    const isBeneficiary = !!(hasBeneficiary && beneficiaryId && user.id === beneficiaryId);
    return isPersonalAuthor || isBeneficiary;
  }, [user?.id, publication, votingTargetType]);
  
  const isProjectCommunity = community?.isProject === true;

  /** Match API: project defaults to quota-and-wallet unless community explicitly sets another source. */
  const effectiveVotingMode = useMemo(() => {
    if (isOwnPost) return 'wallet-only';
    if (isProjectCommunity) {
      const src = community?.votingSettings?.currencySource;
      if (src === 'quota-only') return 'quota-only';
      if (src === 'wallet-only') return 'wallet-only';
      return votingMode ?? 'standard';
    }
    return votingMode ?? 'standard';
  }, [isOwnPost, isProjectCommunity, community?.votingSettings?.currencySource, votingMode]);

  // Comment mode from community (neutralOnly = only text; weightedOnly = weight required; all = both allowed)
  const commentMode = useMemo(
    () =>
      (community?.settings as { commentMode?: 'all' | 'neutralOnly' | 'weightedOnly'; tappalkaOnlyMode?: boolean })?.commentMode ??
      ((community?.settings as { tappalkaOnlyMode?: boolean })?.tappalkaOnlyMode ? 'neutralOnly' : 'all'),
    [community?.settings],
  );

  /** Closed project task with accepted work: full vote UI (quota + wallet), merits credit assignee project wallet */
  const ticketWeightedAppreciation = useMemo(
    () =>
      votingTargetType === 'publication' &&
      votingTaskAllowWeightedMerits === true &&
      (publication as { postType?: string } | undefined)?.postType === 'ticket',
    [votingTargetType, votingTaskAllowWeightedMerits, publication],
  );

  // D-10: Closed posts — force neutral-only (no weighted vote) unless project task appreciation voting
  const effectiveCommentMode =
    (publication as { status?: string })?.status === 'closed' && !ticketWeightedAppreciation
      ? 'neutralOnly'
      : commentMode;

  const isTicketPost = useMemo(
    () =>
      votingTargetType === 'publication' &&
      (votingPublicationIsTask === true ||
        (publication as { postType?: string } | undefined)?.postType === 'ticket'),
    [votingTargetType, votingPublicationIsTask, publication],
  );

  const ticketFreeCommentOnlyUi = isTicketPost && !votingTaskAllowWeightedMerits;

  /** Tasks: free text comments only unless accepted project task with weighted merits */
  const effectiveCommentModeForSubmit = useMemo(
    () =>
      isTicketPost && !votingTaskAllowWeightedMerits
        ? 'neutralOnly'
        : effectiveCommentMode,
    [isTicketPost, votingTaskAllowWeightedMerits, effectiveCommentMode],
  );

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
  const calculatedMaxMinus =
    community?.votingSettings?.allowNegativeVoting === false ? 0 : (walletBalance || 0);

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
    if (!activeVotingTarget || !votingTargetType || !targetCommunityId) {
      return;
    }

    // Check feature flag - comment voting is disabled by default
    if (votingTargetType === 'comment' && !enableCommentVoting) {
      updateVotingFormData({ error: t('commentVotingDisabled') });
      return;
    }

    const delta = formData.delta;
    if (delta === 0) {
      if (pilotTaskAppreciation) {
        updateVotingFormData({ error: t('pleaseAdjustSlider') });
        return;
      }
      if (effectiveCommentModeForSubmit === 'weightedOnly') {
        updateVotingFormData({ error: t('weightRequired') });
        return;
      }
      if (effectiveCommentModeForSubmit === 'all' || effectiveCommentModeForSubmit === 'neutralOnly') {
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
    if (!pilotTaskAppreciation && isUpvote && delta !== 0 && !formData.comment?.trim()) {
      updateVotingFormData({ error: t('reasonRequired') });
      return;
    }
    const absoluteAmount = Math.abs(delta);

    // Calculate vote breakdown for submission (quota first, then wallet overflow).
    // Neutral comment (delta === 0) when effectiveCommentMode is all or neutralOnly: submit 0,0
    let quotaAmount = 0;
    let walletAmount = 0;

    if (absoluteAmount === 0) {
      quotaAmount = 0;
      walletAmount = 0;
    } else if (isUpvote) {
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
        effectiveCommentModeForSubmit === 'neutralOnly' ||
        (effectiveCommentModeForSubmit === 'all' && formData.comment?.trim());
      if (!allowedNeutral) {
        if (absoluteAmount === 0 && effectiveCommentModeForSubmit === 'weightedOnly') {
          updateVotingFormData({ error: t('weightRequired') });
          return;
        }
        if (!formData.comment?.trim()) {
          updateVotingFormData({ error: t('reasonRequired') });
          return;
        }
        updateVotingFormData({ error: t('insufficientWalletForDownvotes') });
        return;
      }
    }

    // Close popup immediately to prevent flash of updated progress bars
    // The optimistic updates will happen in onMutate, but the popup will already be closed
    const targetId = activeVotingTarget;
    const commentText = pilotTaskAppreciation ? '' : formData.comment.trim();
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
      // Show success toast
      addToast(t('voteSubmittedSuccess'), 'success');
    } catch (err: unknown) {
      // Mutation hooks handle rollback automatically via onError
      console.error('[VotingPopup] Error submitting vote:', err);
      const raw = err instanceof Error ? err.message : '';
      let message: string;
      if (raw === 'This community only allows neutral comments') {
        message = tShared('voteDisabled.neutralOnlyError');
      } else if (
        raw === 'QUOTA_OR_WALLET_REQUIRED' ||
        (typeof raw === 'string' && raw.includes('quotaAmount or walletAmount'))
      ) {
        message = t('quotaOrWalletRequired');
      } else {
        message = resolveApiErrorToastMessage(raw || undefined);
      }
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
          images={enableCommentImageUploads ? (formData.images || []) : []}
          onImagesChange={enableCommentImageUploads ? handleImagesChange : undefined}
          commentMode={ticketFreeCommentOnlyUi ? 'neutralOnly' : effectiveCommentMode}
          title={pilotTaskAppreciation ? tPilot('taskThanksTitle') : undefined}
          mechanicsTextOverride={pilotTaskAppreciation ? tPilot('taskThanksHint') : undefined}
          hideComment={pilotTaskAppreciation ? true : undefined}
          hideDirectionToggle={pilotTaskAppreciation ? true : undefined}
          hideQuota={
            ticketFreeCommentOnlyUi ||
            (effectiveCommentMode === 'neutralOnly' && !ticketWeightedAppreciation)
          }
          submitButtonLabel={
            pilotTaskAppreciation
              ? tPilot('taskThanksSubmit')
              : ticketFreeCommentOnlyUi ||
                  (effectiveCommentMode === 'neutralOnly' && !ticketWeightedAppreciation)
                ? t('commentButton')
                : undefined
          }
          isOwnPost={ticketFreeCommentOnlyUi ? false : isOwnPost}
          neutralHelperText={ticketFreeCommentOnlyUi ? t('taskCommentFreeHint') : undefined}
        />
        </div>
      </div>
      </IntlPortalWrapper>
    </BottomPortal>
  );
};

