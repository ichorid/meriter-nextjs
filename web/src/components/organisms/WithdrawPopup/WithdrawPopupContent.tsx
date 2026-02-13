'use client';

import React, { useState } from 'react';
import { useTranslations } from 'next-intl';
import { ChevronDown, ChevronRight } from 'lucide-react';
import { VotingPanel } from '../VotingPopup/VotingPanel';
import { useVoteOnPublicationWithComment, useVoteOnVote, useWithdrawFromPublication, useWithdrawFromVote } from '@/hooks/api/useVotes';
import { useToastStore } from '@/shared/stores/toast.store';
import { extractErrorMessage } from '@/shared/lib/utils/error-utils';

export interface WithdrawInvestmentSplit {
  investorTotal: number;
  authorAmount: number;
  perInvestor: Array<{ investorId: string; amount: number; username?: string }>;
}

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
  investmentSplit: WithdrawInvestmentSplit | null;
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
  const [distributionDetailsOpen, setDistributionDetailsOpen] = useState(false);
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
      let message = extractErrorMessage(err, t('errorSubmitting') || 'Failed to submit');
      if (message === 'This community only allows neutral comments') {
        message = t('voteDisabled.neutralOnlyError');
      }
      onUpdateError(message);
    }
  };

  return (
    <div className="fixed inset-0 z-50 pointer-events-auto flex flex-col items-center justify-start pt-[12vh] overflow-y-auto pb-8">
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
          hintMode={isWithdrawal ? 'withdraw' : 'add'}
        />
        {isWithdrawal && hasInvestments && investmentSplit && amount > 0 && (
          <div className="rounded-lg border border-base-content/10 bg-base-200/50 p-4 space-y-3 text-sm">
            <p className="font-medium">
              {tInvesting('youAreWithdrawing', {
                amount,
                defaultValue: 'You are withdrawing: {amount} merits',
              })}
            </p>
            <p className="text-base-content/80">
              {tInvesting('toInvestors', {
                percent: investorSharePercent,
                amount: investmentSplit.investorTotal,
                defaultValue: 'To investors ({percent}%): {amount} merits',
              })}
            </p>
            <p className="text-base-content/80">
              {tInvesting('toYou', {
                amount: investmentSplit.authorAmount,
                defaultValue: 'To you: {amount} merits',
              })}
            </p>
            {investmentSplit.perInvestor.length > 0 && (
              <div>
                <button
                  type="button"
                  onClick={() => setDistributionDetailsOpen((o) => !o)}
                  className="flex items-center gap-1 text-base-content/70 hover:text-base-content/90 font-medium"
                >
                  {distributionDetailsOpen ? (
                    <ChevronDown className="w-4 h-4" />
                  ) : (
                    <ChevronRight className="w-4 h-4" />
                  )}
                  {tInvesting('distributionDetails', { defaultValue: 'Distribution details' })}
                </button>
                {distributionDetailsOpen && (
                  <ul className="mt-2 pl-5 space-y-1 text-base-content/70">
                    {investmentSplit.perInvestor.map((item) => (
                      <li key={item.investorId} className="flex justify-between gap-2">
                        <span>{item.username ?? item.investorId}</span>
                        <span className="tabular-nums">{tInvesting('meritsAmount', { amount: item.amount })}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
