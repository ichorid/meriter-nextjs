'use client';

import React, { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { ChevronDown, ChevronRight } from 'lucide-react';
import { VotingPanel } from '../VotingPopup/VotingPanel';
import { useVoteOnPublicationWithComment, useVoteOnVote, useWithdrawFromPublication, useWithdrawFromVote } from '@/hooks/api/useVotes';
import { useTopUpPublicationRating } from '@/hooks/api/useBirzhaSource';
import { useToastStore } from '@/shared/stores/toast.store';
import { extractErrorMessage } from '@/shared/lib/utils/error-utils';
import { resolveApiErrorToastMessage } from '@/lib/i18n/api-error-toast';

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
  /** When choosing top-up wallet (Birzha source posts) */
  maxTopUpPersonal?: number;
  maxTopUpSourceWallet?: number;
  topUpFromSourceWallet?: boolean;
  error: string;
  isWithdrawal: boolean;
  hasInvestments: boolean;
  investmentSplit: WithdrawInvestmentSplit | null;
  investorSharePercent: number;
  activeWithdrawTarget: string;
  withdrawTargetType: string;
  targetCommunityId: string;
  /** Birzha post from project/community source: withdraw credits source wallet, not personal */
  withdrawMeritsDestination?: 'personal' | 'sourceProject' | 'sourceCommunity';
}

export function WithdrawPopupContent({
  onClose,
  amount,
  onAmountChange,
  comment,
  onCommentChange,
  onUpdateError,
  maxPlus,
  maxTopUpPersonal,
  maxTopUpSourceWallet = 0,
  topUpFromSourceWallet = false,
  error,
  isWithdrawal,
  hasInvestments,
  investmentSplit,
  investorSharePercent,
  activeWithdrawTarget,
  withdrawTargetType,
  targetCommunityId,
  withdrawMeritsDestination = 'personal',
}: WithdrawPopupContentProps) {
  const t = useTranslations('shared');
  const tInvesting = useTranslations('investing');
  const tBirzha = useTranslations('birzhaSource');
  const [distributionDetailsOpen, setDistributionDetailsOpen] = useState(false);
  const [topUpFundingSource, setTopUpFundingSource] = useState<'personal' | 'source_entity'>(
    'personal',
  );
  const popupTitle = isWithdrawal ? t('withdraw') : t('addMeritsToPost');
  const submitButtonLabel = isWithdrawal ? undefined : t('addMeritsButton');
  const addToast = useToastStore((state) => state.addToast);
  const voteOnPublicationWithCommentMutation = useVoteOnPublicationWithComment();
  const voteOnVoteMutation = useVoteOnVote();
  const withdrawFromPublicationMutation = useWithdrawFromPublication();
  const withdrawFromVoteMutation = useWithdrawFromVote();
  const topUpPublicationMutation = useTopUpPublicationRating();

  const personalCap = maxTopUpPersonal ?? maxPlus;
  const effectiveMaxPlus =
    withdrawTargetType === 'publication-topup' && topUpFromSourceWallet
      ? topUpFundingSource === 'source_entity'
        ? maxTopUpSourceWallet
        : personalCap
      : maxPlus;

  useEffect(() => {
    setTopUpFundingSource('personal');
  }, [activeWithdrawTarget, withdrawTargetType]);

  const handleSubmit = async () => {
    if (!activeWithdrawTarget || !withdrawTargetType) return;

    if (amount <= 0) {
      onUpdateError(t('pleaseChooseWithdrawAmount'));
      return;
    }

    if (amount > effectiveMaxPlus) {
      onUpdateError(t('pleaseAdjustSlider'));
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
        if (topUpFromSourceWallet && topUpFundingSource === 'source_entity') {
          await topUpPublicationMutation.mutateAsync({
            publicationId: targetId,
            amount,
            fundingSource: 'source_entity',
            comment: comment.trim() || undefined,
          });
        } else {
          await voteOnPublicationWithCommentMutation.mutateAsync({
            publicationId: targetId,
            data: {
              quotaAmount: 0,
              walletAmount: amount,
              comment: comment.trim() || undefined,
            },
            communityId: targetCommunityId || '',
          });
        }
        addToast(t('addMerits', { amount }), 'success');
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
      let message = extractErrorMessage(err, t('errorSubmitting'));
      if (message === 'This community only allows neutral comments') {
        message = t('voteDisabled.neutralOnlyError');
      }
      onUpdateError(resolveApiErrorToastMessage(message));
    }
  };

  return (
    <div className="fixed inset-0 z-50 pointer-events-auto flex flex-col items-center justify-start pt-[12vh] overflow-y-auto pb-8">
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-sm transition-opacity -z-10"
        onClick={onClose}
      />
      <div className="relative z-10 flex flex-col gap-4">
        {withdrawTargetType === 'publication-topup' && topUpFromSourceWallet ? (
          <div className="w-full max-w-[400px] rounded-xl border border-base-300/50 bg-base-100 p-4 text-sm shadow-xl">
            <p className="mb-2 font-medium text-base-content">{tBirzha('topUpFundingLabel')}</p>
            <label className="flex cursor-pointer items-center gap-2 py-1">
              <input
                type="radio"
                className="radio radio-sm"
                name="birzha-topup-wallet"
                checked={topUpFundingSource === 'personal'}
                onChange={() => {
                  setTopUpFundingSource('personal');
                  onAmountChange(0);
                }}
              />
              <span>{tBirzha('topUpFromPersonalWallet')}</span>
            </label>
            <label className="flex cursor-pointer items-center gap-2 py-1">
              <input
                type="radio"
                className="radio radio-sm"
                name="birzha-topup-wallet"
                checked={topUpFundingSource === 'source_entity'}
                onChange={() => {
                  setTopUpFundingSource('source_entity');
                  onAmountChange(0);
                }}
              />
              <span>{tBirzha('topUpFromSourceWallet')}</span>
            </label>
          </div>
        ) : null}
        <VotingPanel
          onClose={onClose}
          amount={amount}
          setAmount={onAmountChange}
          comment={comment}
          setComment={onCommentChange}
          onSubmit={() => {}}
          onSubmitSimple={handleSubmit}
          maxPlus={effectiveMaxPlus}
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
          withdrawMeritsDestination={isWithdrawal ? withdrawMeritsDestination : 'personal'}
        />
        {isWithdrawal && hasInvestments && investmentSplit && amount > 0 && (
          <div className="w-full max-w-[400px] rounded-xl border border-base-300/50 bg-base-100 shadow-xl p-4 space-y-3 text-sm">
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
