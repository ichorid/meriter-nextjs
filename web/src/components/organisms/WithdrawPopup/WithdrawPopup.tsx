'use client';

import React, { useEffect, useMemo } from 'react';
import { useUIStore } from '@/stores/ui.store';
import { BottomPortal } from '@/shared/components/bottom-portal';
import { FormWithdrawVertical } from '@/shared/components/form-withdraw-vertical';
import { useAuth } from '@/contexts/AuthContext';
import { useWallets, useCommunity } from '@/hooks/api';
import { useTranslations } from 'next-intl';
import { useWithdrawFromPublication, useWithdrawFromComment } from '@/hooks/api/useVotes';
import { useVoteOnPublicationWithComment, useVoteOnComment } from '@/hooks/api/useVotes';

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

  // Use mutation hooks
  const withdrawFromPublicationMutation = useWithdrawFromPublication();
  const withdrawFromCommentMutation = useWithdrawFromComment();
  const voteOnPublicationWithCommentMutation = useVoteOnPublicationWithComment();
  const voteOnCommentMutation = useVoteOnComment();

  const isOpen = !!activeWithdrawTarget && !!withdrawTargetType;

  // Get wallets to find balance for the target community
  const { data: wallets = [] } = useWallets();
  
  // Determine which community to use - prefer prop, otherwise try to derive from target
  const targetCommunityId = communityId || (wallets[0]?.communityId);

  // Get community data to access currency icon
  const { data: communityData } = useCommunity(targetCommunityId || '');
  const currencyIconUrl = communityData?.settings?.iconUrl;

  // Get wallet balance for the community
  const walletBalance = useMemo(() => {
    if (!targetCommunityId || !Array.isArray(wallets)) return 0;
    const wallet = wallets.find((w: any) => w.communityId === targetCommunityId);
    return wallet?.balance || 0;
  }, [targetCommunityId, wallets]);

  // Initialize form data if not present
  useEffect(() => {
    if (isOpen && !activeWithdrawFormData) {
      updateWithdrawFormData({ comment: '', amount: 0, error: '' });
    }
  }, [isOpen, activeWithdrawFormData, updateWithdrawFormData]);

  const formData = activeWithdrawFormData || { comment: '', amount: 0, error: '' };

  const handleCommentChange = (comment: string) => {
    updateWithdrawFormData({ comment, error: '' });
  };

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
      const isWithdrawal = withdrawTargetType.includes('withdraw');
      const isTopUp = withdrawTargetType.includes('topup');

      if (isWithdrawal) {
        // Handle withdrawal
        if (withdrawTargetType === 'publication-withdraw') {
          await withdrawFromPublicationMutation.mutateAsync({
            publicationId: targetId,
            amount: amount,
          });
        } else if (withdrawTargetType === 'comment-withdraw') {
          await withdrawFromCommentMutation.mutateAsync({
            commentId: targetId,
            amount: amount,
          });
        }
      } else if (isTopUp) {
        // Handle top-up (adding votes) - use vote mutation
        if (withdrawTargetType === 'publication-topup') {
          await voteOnPublicationWithCommentMutation.mutateAsync({
            publicationId: targetId,
            data: {
              amount: amount,
              sourceType: 'personal',
              comment: formData.comment.trim() || undefined,
            },
            communityId: targetCommunityId || '',
          });
        } else if (withdrawTargetType === 'comment-topup') {
          await voteOnCommentMutation.mutateAsync({
            commentId: targetId,
            data: {
              targetType: 'comment',
              targetId: targetId,
              amount: amount,
              sourceType: 'personal',
            },
            communityId: targetCommunityId || '',
          });
        }
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
  const isWithdrawal = withdrawTargetType?.includes('withdraw') || false;

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
            isLoading={withdrawFromPublicationMutation.isPending || withdrawFromCommentMutation.isPending || voteOnPublicationWithCommentMutation.isPending || voteOnCommentMutation.isPending}
            currencyIconUrl={currencyIconUrl}
          />
        </div>
      </div>
    </BottomPortal>
  );
};

