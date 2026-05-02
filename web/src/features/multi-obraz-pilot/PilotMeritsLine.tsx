'use client';

import React from 'react';
import { useTranslations } from 'next-intl';
import { usePilotMeritsStats } from '@/hooks/api/useProjects';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/shadcn/dialog';
import { Button } from '@/components/ui/shadcn/button';
import Link from 'next/link';
import { formatMerits } from '@/lib/utils/currency';
import { usePilotObrazUi } from '@/features/multi-obraz-pilot/PilotObrazUiContext';
import { cn } from '@/lib/utils';

function MeritsHintDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
}) {
  const t = useTranslations('multiObraz');
  const tCommon = useTranslations('common');
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="border-[#334155] bg-[#1e293b] text-[#f1f5f9]">
        <DialogHeader>
          <DialogTitle>{t('meritsHintTitle')}</DialogTitle>
          <DialogDescription className="text-[#94a3b8]">{t('meritsHintBody')}</DialogDescription>
        </DialogHeader>

        <div className="space-y-3 text-sm leading-relaxed text-[#cbd5e1]">
          <p>{t('meritsHintQuota')}</p>
          <p>{t('meritsHintWallet')}</p>
          <p>{t('meritsHintHowToEarn')}</p>
        </div>

        <div className="mt-4 flex justify-center">
          <Button
            asChild
            className="h-11 min-w-[220px] rounded-lg bg-[#A855F7] px-6 text-base font-semibold text-white hover:bg-[#9333ea]"
            onClick={() => onOpenChange(false)}
          >
            <Link href="/mining">{tCommon('earnMerits')}</Link>
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export function PilotMeritsLine() {
  const t = useTranslations('multiObraz');
  const { data: stats } = usePilotMeritsStats();
  const [meritsHintOpen, setMeritsHintOpen] = React.useState(false);
  const { welcomeDismissed, openLore } = usePilotObrazUi();

  const quotaRemaining = stats?.quota?.remaining ?? 0;
  const dailyQuota = stats?.quota?.dailyQuota ?? 100;
  const walletBalance = stats?.walletBalance ?? 0;

  const quotaWalletButton =
    stats != null ? (
      <button
        type="button"
        onClick={() => setMeritsHintOpen(true)}
        className={cn(
          'rounded-xl border border-[#334155] bg-[#0f172a] px-2 py-2 text-xs text-[#e2e8f0] hover:bg-[#0f172a]/80 sm:px-3 sm:text-sm',
        )}
      >
        <span className="text-[#94a3b8]">{t('quotaLabel')}</span>
        <span className="ml-1 tabular-nums font-semibold text-white">
          {quotaRemaining}/{dailyQuota}
        </span>
        <span className="mx-1.5 text-[#334155] sm:mx-2" aria-hidden>
          ·
        </span>
        <span className="text-[#94a3b8]">{t('walletLabel')}</span>
        <span className="ml-1 tabular-nums font-semibold text-white">{formatMerits(walletBalance)}</span>
      </button>
    ) : null;

  const aboutButton = (
    <Button
      type="button"
      variant="outline"
      size="sm"
      onClick={openLore}
      className="h-9 shrink-0 border-[#334155] bg-[#0f172a] text-xs text-[#e2e8f0] hover:bg-[#0f172a]/80 sm:h-9 sm:text-sm"
    >
      {t('aboutMeriterra')}
    </Button>
  );

  if (!welcomeDismissed) {
    if (!quotaWalletButton) return null;
    return (
      <>
        <div className="mx-auto w-full max-w-3xl px-4">
          <div className="flex justify-end">{quotaWalletButton}</div>
        </div>
        <MeritsHintDialog open={meritsHintOpen} onOpenChange={setMeritsHintOpen} />
      </>
    );
  }

  return (
    <>
      <div className="mx-auto flex w-full max-w-3xl flex-nowrap items-center justify-between gap-2 px-4 sm:gap-3">
        <div className="min-w-0 shrink">{aboutButton}</div>
        <div className="min-w-0 shrink-0">{quotaWalletButton}</div>
      </div>
      {stats != null ? <MeritsHintDialog open={meritsHintOpen} onOpenChange={setMeritsHintOpen} /> : null}
    </>
  );
}
