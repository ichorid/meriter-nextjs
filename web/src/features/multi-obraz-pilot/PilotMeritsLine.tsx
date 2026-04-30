'use client';

import React from 'react';
import { useTranslations } from 'next-intl';
import { usePilotMeritsStats } from '@/hooks/api/useProjects';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/shadcn/dialog';
import { Button } from '@/components/ui/shadcn/button';
import Link from 'next/link';
import { formatMerits } from '@/lib/utils/currency';

export function PilotMeritsLine() {
  const t = useTranslations('multiObraz');
  const tCommon = useTranslations('common');
  const { data: stats } = usePilotMeritsStats();
  const [open, setOpen] = React.useState(false);

  if (!stats) return null;

  const quotaRemaining = stats.quota?.remaining ?? 0;
  const dailyQuota = stats.quota?.dailyQuota ?? 100;
  const walletBalance = stats.walletBalance ?? 0;

  return (
    <>
      <div className="mx-auto w-full max-w-3xl px-4">
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="ml-auto block w-fit rounded-xl border border-[#334155] bg-[#0f172a] px-3 py-2 text-sm text-[#e2e8f0] hover:bg-[#0f172a]/80"
        >
          <span className="text-[#94a3b8]">{t('quotaLabel')}</span>
          <span className="ml-1 tabular-nums font-semibold text-white">
            {quotaRemaining}/{dailyQuota}
          </span>
          <span className="mx-2 text-[#334155]" aria-hidden>
            ·
          </span>
          <span className="text-[#94a3b8]">{t('walletLabel')}</span>
          <span className="ml-1 tabular-nums font-semibold text-white">
            {formatMerits(walletBalance)}
          </span>
        </button>
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="border-[#334155] bg-[#1e293b] text-[#f1f5f9]">
          <DialogHeader>
            <DialogTitle>{t('meritsHintTitle')}</DialogTitle>
            <DialogDescription className="text-[#94a3b8]">
              {t('meritsHintBody')}
            </DialogDescription>
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
              onClick={() => setOpen(false)}
            >
              <Link href="/mining">{tCommon('earnMerits')}</Link>
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}

