'use client';

import React from 'react';
import { useUIStore } from '@/stores/ui.store';
import { useAuth } from '@/contexts/AuthContext';
import { useTranslations } from 'next-intl';
import { useVoteOnPublicationWithComment, useVoteOnVote, useWithdrawFromPublication, useWithdrawFromVote } from '@/hooks/api/useVotes';
import { usePopupCommunityData } from '@/hooks/usePopupCommunityData';
import { usePopupFormData } from '@/hooks/usePopupFormData';
import { VotingPanel } from '../VotingPopup/VotingPanel';
import { BottomPortal } from '@/shared/components/bottom-portal';
import { useToastStore } from '@/shared/stores/toast.store';

interface WithdrawPopupProps {
  communityId?: string;
}

export const WithdrawPopup: React.FC<WithdrawPopupProps> = ({
  communityId,
}) => {
  const t = useTranslations('shared');
  const { user } = useAuth();
  const addToast = useToastStore((state) => state.addToast);
  const {
    activeWithdrawTarget,
    withdrawTargetType,
    activeWithdrawFormData,
    closeWithdrawPopup,
    updateWithdrawFormData,
  } = useUIStore();

  // Use mutation hooks for both withdrawals and topups
  const voteOnPublicationWithCommentMutation = useVoteOnPublicationWithComment();
  const voteOnVoteMutation = useVoteOnVote();
  const withdrawFromPublicationMutation = useWithdrawFromPublication();
  const withdrawFromVoteMutation = useWithdrawFromVote();

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
    // Ensure amount is always positive for withdrawals
    const positiveAmount = Math.abs(amount);
    updateWithdrawFormData({ amount: positiveAmount, error: '' });
  };

  const handleClose = () => {
    closeWithdrawPopup();
    updateWithdrawFormData({ comment: '', amount: 0, error: '' });
  };

  const handleSubmit = async () => {
    if (!activeWithdrawTarget || !withdrawTargetType) return;

    const amount = formData.amount;
    if (amount <= 0) {
      updateWithdrawFormData({ error: t('pleaseChooseWithdrawAmount') || 'Please choose an amount to withdraw' });
      return;
    }

    try {
      updateWithdrawFormData({ error: '' });

      const targetId = activeWithdrawTarget;
      
      // Handle withdrawals
      if (withdrawTargetType === 'publication') {
        await withdrawFromPublicationMutation.mutateAsync({
          publicationId: targetId,
          amount,
        });
        addToast(t('withdrewMerits', { amount }), 'success');
      } else if (withdrawTargetType === 'comment' || withdrawTargetType === 'vote') {
        await withdrawFromVoteMutation.mutateAsync({
          voteId: targetId,
          amount,
        });
        addToast(t('withdrewMerits', { amount }), 'success');
      }
      // Handle topups
      else if (withdrawTargetType === 'publication-topup') {
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
  const maxWithdrawAmount = formData.maxWithdrawAmount || 0;
  const maxTopUpAmount = formData.maxTopUpAmount || walletBalance;
  const isWithdrawal = withdrawTargetType === 'publication' || withdrawTargetType === 'comment' || withdrawTargetType === 'vote';
  
  // Calculate maxPlus based on withdrawal or topup mode
  const maxPlus = isWithdrawal ? maxWithdrawAmount : maxTopUpAmount;
  
  // Determine title based on mode
  const popupTitle = isWithdrawal 
    ? t('withdraw') 
    : t('addCommunityPoints', { amount: 0 }).replace(': {amount}', '').replace('{amount}', '');

  const isLoading = 
    voteOnPublicationWithCommentMutation.isPending || 
    voteOnVoteMutation.isPending || 
    withdrawFromPublicationMutation.isPending || 
    withdrawFromVoteMutation.isPending;

  return (
    <BottomPortal>
      <div className="fixed inset-0 z-50 pointer-events-auto flex items-end justify-center">
        <div 
          className="fixed inset-0 bg-black/50 backdrop-blur-sm transition-opacity" 
          onClick={handleClose}
        />
        <VotingPanel
          onClose={handleClose}
          amount={formData.amount}
          setAmount={handleAmountChange}
          comment={formData.comment}
          setComment={handleCommentChange}
          onSubmit={() => {}} // Not used when onSubmitSimple is provided
          onSubmitSimple={handleSubmit}
          maxPlus={maxPlus}
          maxMinus={0}
          quotaRemaining={0}
          dailyQuota={0}
          usedToday={0}
          error={formData.error}
          hideComment={true}
          hideQuota={true}
          hideDirectionToggle={true}
          hideImages={true}
          title={popupTitle}
        />
      </div>
    </BottomPortal>
  );
};

