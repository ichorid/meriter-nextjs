'use client';

import React, { useEffect, useMemo } from 'react';
import { useUIStore } from '@/stores/ui.store';
import { BottomPortal } from '@/shared/components/bottom-portal';
import { FormComment } from '@/features/comments/components/form-comment';
import { useAuth } from '@/contexts/AuthContext';
import { useWallets } from '@/hooks/api';
import { useFreeBalance } from '@/hooks/api/useWallet';
import { useCommunityQuotas } from '@/hooks/api/useCommunityQuota';
import { apiClient } from '@/lib/api/client';
import { commentsApiV1, votesApiV1 } from '@/lib/api/v1';
import { useQueryClient } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';

interface VotingPopupProps {
  communityId?: string;
  updateWalletBalance?: (communityId: string, change: number) => void;
  updBalance?: () => Promise<void>;
}

export const VotingPopup: React.FC<VotingPopupProps> = ({
  communityId,
  updateWalletBalance,
  updBalance = async () => {},
}) => {
  const t = useTranslations('comments');
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const {
    activeVotingTarget,
    votingTargetType,
    activeVotingFormData,
    closeVotingPopup,
    updateVotingFormData,
  } = useUIStore();

  const isOpen = !!activeVotingTarget && !!votingTargetType;

  // Get wallets to find balance for the target community
  const { data: wallets = [] } = useWallets();
  
  // Determine which community to use - prefer prop, otherwise try to derive from target
  const targetCommunityId = communityId || (wallets[0]?.communityId);

  // Get quota for the community
  const { quotasMap } = useCommunityQuotas(targetCommunityId ? [targetCommunityId] : []);
  const quotaData = targetCommunityId ? quotasMap.get(targetCommunityId) : null;
  const freePlus = quotaData?.remainingToday ?? 0;
  const freeMinus = 0; // Downvotes typically don't have free quota

  // Get wallet balance for the community
  const walletBalance = useMemo(() => {
    if (!targetCommunityId || !Array.isArray(wallets)) return 0;
    const wallet = wallets.find((w: any) => w.communityId === targetCommunityId);
    return wallet?.balance || 0;
  }, [targetCommunityId, wallets]);

  // Get free balance as fallback (different API endpoint)
  const { data: freeBalance } = useFreeBalance(targetCommunityId);
  const effectiveFreePlus = freePlus > 0 ? freePlus : (typeof freeBalance === 'number' ? freeBalance : 0);

  const hasPoints = effectiveFreePlus > 0 || walletBalance > 0;
  const maxPlus = Math.max(effectiveFreePlus, walletBalance || 0);
  const calculatedMaxMinus = effectiveFreePlus > 0
    ? Math.min(effectiveFreePlus, Math.max(walletBalance || 0, 1))
    : Math.max(walletBalance || 0, 1);

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

  const handleClose = () => {
    closeVotingPopup();
    updateVotingFormData({ comment: '', delta: 0, error: '' });
  };

  const handleSubmit = async (directionPlus: boolean) => {
    if (!activeVotingTarget || !votingTargetType) return;

    const delta = formData.delta;
    if (delta === 0) {
      updateVotingFormData({ error: t('pleaseAdjustSlider') || 'Please adjust the slider to vote' });
      return;
    }

    try {
      updateVotingFormData({ error: '' });

      if (votingTargetType === 'comment') {
        // Vote on a comment (comment text is handled via separate comment creation if needed)
        const response = await votesApiV1.voteOnComment(activeVotingTarget, {
          targetType: 'comment',
          targetId: activeVotingTarget,
          amount: directionPlus ? Math.abs(delta) : -Math.abs(delta),
          sourceType: 'personal',
        });
        
        // If there's a comment text, create a comment separately
        if (formData.comment.trim()) {
          await commentsApiV1.createComment({
            targetType: 'comment',
            targetId: activeVotingTarget,
            content: formData.comment.trim(),
          });
        }

        if (response) {
          // Update wallet balance optimistically if needed
          if (targetCommunityId && updateWalletBalance && delta !== 0) {
            const amountChange = directionPlus ? -Math.abs(delta) : Math.abs(delta);
            updateWalletBalance(targetCommunityId, amountChange);
          }

          // Invalidate queries
          await updBalance();
          queryClient.invalidateQueries({ queryKey: ['comments'] });
          queryClient.invalidateQueries({ queryKey: ['quota'] });

          // Close popup and reset form
          handleClose();
        }
      } else if (votingTargetType === 'publication') {
        // Vote on a publication
        const response = await votesApiV1.voteOnPublication(activeVotingTarget, {
          targetType: 'publication',
          targetId: activeVotingTarget,
          amount: directionPlus ? Math.abs(delta) : -Math.abs(delta),
          sourceType: 'personal',
        });
        
        // If there's a comment text, create a comment separately
        if (formData.comment.trim()) {
          await commentsApiV1.createComment({
            targetType: 'publication',
            targetId: activeVotingTarget,
            content: formData.comment.trim(),
          });
        }

        if (response) {
          // Update wallet balance optimistically if needed
          if (targetCommunityId && updateWalletBalance && delta !== 0) {
            const amountChange = directionPlus ? -Math.abs(delta) : Math.abs(delta);
            updateWalletBalance(targetCommunityId, amountChange);
          }

          // Invalidate queries
          await updBalance();
          queryClient.invalidateQueries({ queryKey: ['comments'] });
          queryClient.invalidateQueries({ queryKey: ['publications'] });
          queryClient.invalidateQueries({ queryKey: ['quota'] });

          // Close popup and reset form
          handleClose();
        }
      }
    } catch (err: unknown) {
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
            free={effectiveFreePlus}
            maxPlus={maxPlus}
            maxMinus={calculatedMaxMinus}
            commentAdd={handleSubmit}
            error={formData.error}
            onClose={handleClose}
          />
        </div>
      </div>
    </BottomPortal>
  );
};

