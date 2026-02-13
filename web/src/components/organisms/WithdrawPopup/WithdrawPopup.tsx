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

  const { targetCommunityId, walletBalance } = usePopupCommunityData(communityId);

  const { formData, handleCommentChange } = usePopupFormData({
    isOpen,
    formData: activeWithdrawFormData,
    defaultFormData: { comment: '', amount: 0, error: '' },
    updateFormData: updateWithdrawFormData,
  });

  const investmentSplit = useMemo(() => {
    if (!hasInvestments || !formData.amount || formData.amount <= 0) return null;
    const amount = formData.amount;
    const investorTotal = Math.floor(amount * (investorSharePercent / 100));
    const authorAmount = amount - investorTotal;
    return { investorTotal, authorAmount };
  }, [hasInvestments, formData.amount, investorSharePercent]);

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
