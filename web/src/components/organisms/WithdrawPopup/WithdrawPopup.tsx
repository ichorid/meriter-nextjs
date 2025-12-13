'use client';

import React from 'react';
import { useUIStore } from '@/stores/ui.store';
import { FormWithdrawVertical } from '@/shared/components/form-withdraw-vertical';
import { useAuth } from '@/contexts/AuthContext';
import { useTranslations } from 'next-intl';
// Withdrawals are disabled - removed withdrawal hooks
import { useVoteOnPublicationWithComment, useVoteOnVote } from '@/hooks/api/useVotes';
import { BasePopup } from '../BasePopup/BasePopup';
import { usePopupCommunityData } from '@/hooks/usePopupCommunityData';
import { usePopupFormData } from '@/hooks/usePopupFormData';

interface WithdrawPopupProps {
  communityId?: string;
}

export const WithdrawPopup: React.FC<WithdrawPopupProps> = ({
  communityId,
}) => {
  const t = useTranslations('shared');
  const { user } = useAuth();
  const {
    activeWithdrawTarget,
    withdrawTargetType,
    activeWithdrawFormData,
    closeWithdrawPopup,
    updateWithdrawFormData,
  } = useUIStore();

  // Use mutation hooks - withdrawals are disabled, only topups are supported
  const voteOnPublicationWithCommentMutation = useVoteOnPublicationWithComment();
  const voteOnVoteMutation = useVoteOnVote();

  const isOpen = !!activeWithdrawTarget && !!withdrawTargetType;

  // Use shared hook for community data
  const { targetCommunityId, currencyIconUrl, walletBalance } = usePopupCommunityData(communityId);

  // Use shared hook for form data management
  const { formData, handleCommentChange } = usePopupFormData({
    isOpen,
    formData: activeWithdrawFormData,
    defaultFormData: { comment: '', amount: 0, error: '' },
    updateFormData: updateWithdrawFormData,
  });

  const handleAmountChange = (amount: number) => {
    updateWithdrawFormData({ amount, error: '' });
  };

  const handleClose = () => {
    closeWithdrawPopup();
    updateWithdrawFormData({ comment: '', amount: 0, error: '' });
  };

  const handleSubmit = async () => {
    if (!activeWithdrawTarget || !withdrawTargetType) return;

    const amount = formData.amount;
    if (amount <= 0) {
      updateWithdrawFormData({ error: t('pleaseAdjustSlider') || 'Please adjust the slider' });
      return;
    }

    try {
      updateWithdrawFormData({ error: '' });

      const targetId = activeWithdrawTarget;
      // Withdrawals are disabled - only handle topups
      if (withdrawTargetType === 'publication-topup') {
        // Handle top-up (adding votes) - use vote mutation
        // Top-ups use wallet only (quotaAmount = 0)
        await voteOnPublicationWithCommentMutation.mutateAsync({
          publicationId: targetId,
          data: {
            quotaAmount: 0,
            walletAmount: amount,
            comment: formData.comment.trim() || undefined,
          },
          communityId: targetCommunityId || '',
        });
      } else if (withdrawTargetType === 'comment-topup') {
        await voteOnVoteMutation.mutateAsync({
          voteId: targetId,
          data: {
            targetType: 'vote',
            targetId: targetId,
            quotaAmount: 0,
            walletAmount: amount,
          },
          communityId: targetCommunityId || '',
        });
      }

      // Close popup and reset form
      handleClose();
      // Mutations handle query invalidation automatically
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : t('errorSubmitting') || 'Failed to submit';
      updateWithdrawFormData({ error: message });
    }
  };

  if (!isOpen) {
    return null;
  }

  // Get max amounts - this should come from the component that opened the popup
  // For now, we'll use wallet balance as fallback
  const maxWithdrawAmount = formData.maxWithdrawAmount || 0;
  const maxTopUpAmount = formData.maxTopUpAmount || walletBalance;
  const isWithdrawal = false; // Withdrawals are disabled

  return (
    <BasePopup isOpen={isOpen} onClose={handleClose}>
      <FormWithdrawVertical
        comment={formData.comment}
        setComment={handleCommentChange}
        amount={formData.amount}
        setAmount={handleAmountChange}
        maxWithdrawAmount={maxWithdrawAmount}
        maxTopUpAmount={maxTopUpAmount}
        onSubmit={handleSubmit}
        onClose={handleClose}
        isWithdrawal={isWithdrawal}
        isLoading={voteOnPublicationWithCommentMutation.isPending || voteOnVoteMutation.isPending}
        currencyIconUrl={currencyIconUrl}
      />
    </BasePopup>
  );
};

