'use client';

import React, { useState } from 'react';
import { useTranslations } from 'next-intl';
import { PiggyBank, Plus } from 'lucide-react';
import { Button } from '@/components/ui/shadcn/button';
import { useUIStore } from '@/stores/ui.store';
import { InvestDialog } from '@/components/organisms/InvestDialog';

interface InvestButtonProps {
  postId: string;
  communityId: string;
  isAuthor: boolean;
  investingEnabled: boolean;
  investorSharePercent: number;
  investmentPool: number;
  investmentPoolTotal: number;
  investorCount: number;
  walletBalance: number;
  onSuccess?: () => void;
}

export function InvestButton({
  postId,
  communityId,
  isAuthor,
  investingEnabled,
  investorSharePercent,
  investmentPool,
  investmentPoolTotal,
  investorCount,
  walletBalance,
  onSuccess,
}: InvestButtonProps) {
  const t = useTranslations('investing');
  const [dialogOpen, setDialogOpen] = useState(false);
  const openWithdrawPopup = useUIStore((state) => state.openWithdrawPopup);

  if (!investingEnabled) return null;

  if (isAuthor) {
    return (
      <Button
        variant="outline"
        size="sm"
        className="rounded-xl gap-2"
        onClick={(e) => {
          e.stopPropagation();
          openWithdrawPopup(postId, 'publication-topup', 0, walletBalance);
        }}
      >
        <Plus className="w-4 h-4" />
        {t('addMerits', { defaultValue: 'Add merits' })}
      </Button>
    );
  }

  return (
    <>
      <Button
        variant="outline"
        size="sm"
        className="rounded-xl gap-2"
        onClick={(e) => {
          e.stopPropagation();
          setDialogOpen(true);
        }}
      >
        <PiggyBank className="w-4 h-4" />
        {t('invest', { defaultValue: 'Invest' })}
      </Button>
      <InvestDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        postId={postId}
        communityId={communityId}
        investorSharePercent={investorSharePercent}
        investmentPool={investmentPool}
        investmentPoolTotal={investmentPoolTotal}
        investorCount={investorCount}
        onSuccess={onSuccess}
      />
    </>
  );
}
