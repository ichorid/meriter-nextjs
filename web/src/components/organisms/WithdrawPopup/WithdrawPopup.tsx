'use client';

import React, { useMemo } from 'react';
import { useUIStore } from '@/stores/ui.store';
import { useAuth } from '@/contexts/AuthContext';
import { useTranslations } from 'next-intl';
import { useVoteOnPublicationWithComment, useVoteOnVote, useWithdrawFromPublication, useWithdrawFromVote } from '@/hooks/api/useVotes';
import { usePopupCommunityData } from '@/hooks/usePopupCommunityData';
import { usePopupFormData } from '@/hooks/usePopupFormData';
import { VotingPanel } from '../VotingPopup/VotingPanel';
import { BottomPortal } from '@/shared/components/bottom-portal';
import { useToastStore } from '@/shared/stores/toast.store';
import { trpc } from '@/lib/trpc/client';

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

  // Fetch publication for investment split preview (only when publication withdrawal)
  const { data: publication } = trpc.publications.getById.useQuery(
    { id: activeWithdrawTarget ?? '' },
    {
      enabled: isOpen && withdrawTargetType === 'publication' && !!activeWithdrawTarget,
    }
  );
  const hasInvestments = (publication?.investments?.length ?? 0) > 0;
  const investorSharePercent = publication?.investorSharePercent ?? 0;
  const investmentSplit = useMemo(() => {
    if (!hasInvestments || !formData.amount || formData.amount <= 0) return null;
    const amount = formData.amount;
    const investorTotal = Math.floor(amount * (investorSharePercent / 100));
    const authorAmount = amount - investorTotal;
    return { investorTotal, authorAmount };
  }, [hasInvestments, formData.amount, investorSharePercent]);

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

  const tInvesting = useTranslations('investing');

  return (
    <BottomPortal>
      <div className="fixed inset-0 z-50 pointer-events-auto flex items-center justify-center">
        <div 
          className="absolute inset-0 bg-black/50 backdrop-blur-sm transition-opacity -z-10" 
          onClick={handleClose}
        />
        <div className="relative z-10 flex flex-col gap-4">
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
          {isWithdrawal && hasInvestments && investmentSplit && (
            <div className="rounded-lg border border-base-content/10 bg-base-200/50 p-4 space-y-2 text-sm">
              <p className="font-medium">
                {tInvesting('contractTerms', {
                  defaultValue: 'Contract: {percent}% to investors',
                  percent: investorSharePercent,
                })}
              </p>
              <p className="text-base-content/80">
                {tInvesting('investorsReceive', {
                  defaultValue: 'Investors will receive: {amount} merits',
                  amount: investmentSplit.investorTotal,
                })}
              </p>
              <p className="text-base-content/80">
                {tInvesting('youReceive', {
                  defaultValue: 'You will receive: {amount} merits',
                  amount: investmentSplit.authorAmount,
                })}
              </p>
            </div>
          )}
        </div>
      </div>
    </BottomPortal>
  );
};

