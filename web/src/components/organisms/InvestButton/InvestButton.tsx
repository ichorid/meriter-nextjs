'use client';

import React, { useState } from 'react';
import { useTranslations } from 'next-intl';
import { useRouter } from 'next/navigation';
import { PiggyBank, Plus } from 'lucide-react';
import { Button } from '@/components/ui/shadcn/button';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/shadcn/dialog';
import { useUIStore } from '@/stores/ui.store';
import { useCommunity } from '@/hooks/api/useCommunities';
import { routes } from '@/lib/constants/routes';
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
  /** E-6: When true, hide label on small screens (icon-only) */
  iconOnlyOnMobile?: boolean;
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
  iconOnlyOnMobile = false,
}: InvestButtonProps) {
  const t = useTranslations('investing');
  const tCommon = useTranslations('common');
  const router = useRouter();
  const { data: community } = useCommunity(communityId);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [noMeritsDialogOpen, setNoMeritsDialogOpen] = useState(false);
  const openWithdrawPopup = useUIStore((state) => state.openWithdrawPopup);
  const tappalkaEnabled = community?.tappalkaSettings?.enabled ?? false;

  if (!investingEnabled) return null;

  if (isAuthor) {
    return (
      <Button
        variant="outline"
        size="sm"
        className="rounded-xl gap-2 px-2 sm:px-3"
        onClick={(e) => {
          e.stopPropagation();
          openWithdrawPopup(postId, 'publication-topup', 0, walletBalance);
        }}
      >
        <Plus className="w-4 h-4 shrink-0" />
        {iconOnlyOnMobile ? (
          <span className="hidden sm:inline">{t('topUp', { defaultValue: 'Top up' })}</span>
        ) : (
          t('topUp', { defaultValue: 'Top up' })
        )}
      </Button>
    );
  }

  const handleInvestClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (walletBalance === 0) {
      setNoMeritsDialogOpen(true);
    } else {
      setDialogOpen(true);
    }
  };

  const handleEarnMerits = () => {
    setNoMeritsDialogOpen(false);
    router.push(`${routes.community(communityId)}?tappalka=1`);
  };

  return (
    <>
      <Button
        variant="outline"
        size="sm"
        className="rounded-xl gap-2 px-2 sm:px-3"
        onClick={handleInvestClick}
      >
        <PiggyBank className="w-4 h-4 shrink-0" />
        {iconOnlyOnMobile ? (
          <span className="hidden sm:inline">{t('invest', { defaultValue: 'Invest' })}</span>
        ) : (
          t('invest', { defaultValue: 'Invest' })
        )}
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
      <Dialog open={noMeritsDialogOpen} onOpenChange={setNoMeritsDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{t('invest', { defaultValue: 'Invest' })}</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-base-content/90">
            {t('noMeritsMessage', {
              defaultValue: 'You have no merits to invest. Earn some first.',
            })}
          </p>
          <DialogFooter>
            {tappalkaEnabled && (
              <Button onClick={handleEarnMerits}>
                {t('earnMeritsButton', { defaultValue: 'Earn merits' })}
              </Button>
            )}
            <Button variant="outline" onClick={() => setNoMeritsDialogOpen(false)}>
              {tCommon('close', { defaultValue: 'Close' })}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
