'use client';

import React from 'react';
import { useTranslations } from 'next-intl';
import { VotingPanel } from '../VotingPopup/VotingPanel';
import { useVoteOnPublicationWithComment, useVoteOnVote, useWithdrawFromPublication, useWithdrawFromVote } from '@/hooks/api/useVotes';
import { useToastStore } from '@/shared/stores/toast.store';

interface WithdrawPopupContentProps {
  onClose: () => void;
  amount: number;
  onAmountChange: (amount: number) => void;
  comment: string;
  onCommentChange: (comment: string) => void;
  onUpdateError: (error: string) => void;
  maxPlus: number;
  error: string;
  isWithdrawal: boolean;
  hasInvestments: boolean;
  investmentSplit: { investorTotal: number; authorAmount: number } | null;
  investorSharePercent: number;
  activeWithdrawTarget: string;
  withdrawTargetType: string;
  targetCommunityId: string;
}

export function WithdrawPopupContent({
  onClose,
  amount,
  onAmountChange,
  comment,
  onCommentChange,
  onUpdateError,
  maxPlus,
  error,
  isWithdrawal,
  hasInvestments,
  investmentSplit,
  investorSharePercent,
  activeWithdrawTarget,
  withdrawTargetType,
  targetCommunityId,
}: WithdrawPopupContentProps) {
  const t = useTranslations('shared');
  const tInvesting = useTranslations('investing');
  const popupTitle = isWithdrawal ? t('withdraw') : t('addMeritsToPost');
  const submitButtonLabel = isWithdrawal ? undefined : t('addMeritsButton');
  const addToast = useToastStore((state) => state.addToast);
  const voteOnPublicationWithCommentMutation = useVoteOnPublicationWithComment();
  const voteOnVoteMutation = useVoteOnVote();
  const withdrawFromPublicationMutation = useWithdrawFromPublication();
  const withdrawFromVoteMutation = useWithdrawFromVote();

  const handleSubmit = async () => {
    if (!activeWithdrawTarget || !withdrawTargetType) return;

    if (amount <= 0) {
      onUpdateError(t('pleaseChooseWithdrawAmount') || 'Please choose an amount to withdraw');
      return;
    }

    try {
      onUpdateError('');

      const targetId = activeWithdrawTarget;

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
      } else if (withdrawTargetType === 'publication-topup') {
        await voteOnPublicationWithCommentMutation.mutateAsync({
          publicationId: targetId,
          data: {
            quotaAmount: 0,
            walletAmount: amount,
            comment: comment.trim() || undefined,
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

      onClose();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : t('errorSubmitting') || 'Failed to submit';
      onUpdateError(message);
    }
  };

  return (
    <div className="fixed inset-0 z-50 pointer-events-auto flex items-center justify-center">
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-sm transition-opacity -z-10"
        onClick={onClose}
      />
      <div className="relative z-10 flex flex-col gap-4">
        <VotingPanel
          onClose={onClose}
          amount={amount}
          setAmount={onAmountChange}
          comment={comment}
          setComment={onCommentChange}
          onSubmit={() => {}}
          onSubmitSimple={handleSubmit}
          maxPlus={maxPlus}
          maxMinus={0}
          quotaRemaining={0}
          dailyQuota={0}
          usedToday={0}
          error={error}
          hideComment={true}
          hideQuota={true}
          hideDirectionToggle={true}
          hideImages={true}
          title={popupTitle}
          submitButtonLabel={submitButtonLabel}
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
  );
}
