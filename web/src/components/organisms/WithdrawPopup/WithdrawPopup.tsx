'use client';

import React, { useMemo } from 'react';
import { useUIStore } from '@/stores/ui.store';
import { useAuth } from '@/contexts/AuthContext';
import { usePopupCommunityData } from '@/hooks/usePopupCommunityData';
import { usePopupFormData } from '@/hooks/usePopupFormData';
import { IntlPortalWrapper } from '@/components/providers/IntlPortalWrapper';
import { WithdrawPopupContent } from './WithdrawPopupContent';
import { trpc } from '@/lib/trpc/client';

interface WithdrawPopupProps {
  communityId?: string;
}

export const WithdrawPopup: React.FC<WithdrawPopupProps> = ({
  communityId,
}) => {
  const { user } = useAuth();
  const {
    activeWithdrawTarget,
    withdrawTargetType,
    activeWithdrawFormData,
    closeWithdrawPopup,
    updateWithdrawFormData,
  } = useUIStore();

  const isOpen = !!activeWithdrawTarget && !!withdrawTargetType;

  const { data: publication } = trpc.publications.getById.useQuery(
    { id: activeWithdrawTarget ?? '' },
    {
      enabled: isOpen && withdrawTargetType === 'publication' && !!activeWithdrawTarget,
    }
  );
  const hasInvestments = (publication?.investments?.length ?? 0) > 0;
  const investorSharePercent = publication?.investorSharePercent ?? 0;
  const investments = publication?.investments ?? [];

  const { data: breakdown } = trpc.investments.getInvestmentBreakdown.useQuery(
    { postId: activeWithdrawTarget ?? '' },
    {
      enabled:
        isOpen &&
        withdrawTargetType === 'publication' &&
        !!activeWithdrawTarget &&
        hasInvestments,
    }
  );

  const { targetCommunityId, walletBalance } = usePopupCommunityData(communityId);

  const { formData, handleCommentChange } = usePopupFormData({
    isOpen,
    formData: activeWithdrawFormData,
    defaultFormData: { comment: '', amount: 0, error: '' },
    updateFormData: updateWithdrawFormData,
  });

  // C-9: Match backend C-4 rounding (round to 0.01, remainder to author)
  const investmentSplit = useMemo(() => {
    if (!hasInvestments || !formData.amount || formData.amount <= 0 || investments.length === 0)
      return null;
    const roundToHundredths = (x: number) => Math.round(x * 100) / 100;
    const amount = formData.amount;
    const totalInvested = (investments as Array<{ investorId: string; amount: number }>).reduce(
      (sum, inv) => sum + inv.amount,
      0
    );
    if (totalInvested <= 0) return null;
    const investorTotal = roundToHundredths(amount * (investorSharePercent / 100));
    const perInvestor: Array<{ investorId: string; amount: number; username?: string }> = [];
    let distributedTotal = 0;
    for (const inv of investments as Array<{ investorId: string; amount: number }>) {
      const share = investorTotal * (inv.amount / totalInvested);
      const amt = roundToHundredths(share);
      distributedTotal += amt;
      if (amt > 0) {
        const username = breakdown?.investors?.find((i) => i.userId === inv.investorId)?.username;
        perInvestor.push({ investorId: inv.investorId, amount: amt, username });
      }
    }
    const authorAmount = amount - distributedTotal;
    return {
      investorTotal: distributedTotal,
      authorAmount,
      perInvestor,
    };
  }, [
    hasInvestments,
    formData.amount,
    investorSharePercent,
    investments,
    breakdown?.investors,
  ]);

  const handleAmountChange = (amount: number) => {
    const positiveAmount = Math.abs(amount);
    updateWithdrawFormData({ amount: positiveAmount, error: '' });
  };

  const handleClose = () => {
    closeWithdrawPopup();
    updateWithdrawFormData({ comment: '', amount: 0, error: '' });
  };

  if (!isOpen) {
    return null;
  }

  const maxWithdrawAmount = formData.maxWithdrawAmount || 0;
  const maxTopUpAmount = formData.maxTopUpAmount || walletBalance;
  const isWithdrawal = withdrawTargetType === 'publication' || withdrawTargetType === 'comment' || withdrawTargetType === 'vote';
  const maxPlus = isWithdrawal ? maxWithdrawAmount : maxTopUpAmount;

  return (
    <IntlPortalWrapper>
      <WithdrawPopupContent
        onClose={handleClose}
        amount={formData.amount}
        onAmountChange={handleAmountChange}
        comment={formData.comment}
        onCommentChange={handleCommentChange}
        onUpdateError={(error) => updateWithdrawFormData({ error })}
        maxPlus={maxPlus}
        error={formData.error}
        isWithdrawal={isWithdrawal}
        hasInvestments={hasInvestments}
        investmentSplit={investmentSplit}
        investorSharePercent={investorSharePercent}
        activeWithdrawTarget={activeWithdrawTarget ?? ''}
        withdrawTargetType={withdrawTargetType ?? ''}
        targetCommunityId={targetCommunityId ?? ''}
      />
    </IntlPortalWrapper>
  );
};
