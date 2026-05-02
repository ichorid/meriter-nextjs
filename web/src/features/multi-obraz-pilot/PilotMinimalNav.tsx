'use client';

import Link from 'next/link';
import React from 'react';
import { useTranslations } from 'next-intl';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/shadcn/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/shadcn/dialog';
import { routes } from '@/lib/constants/routes';
import { pilotDeletedDreamsHref, pilotHomeHref, pilotProfileHref } from '@/lib/constants/pilot-routes';
import { cn } from '@/lib/utils';
import { usePilotMeritsStats } from '@/hooks/api/useProjects';
import { formatMerits } from '@/lib/utils/currency';
import { usePilotObrazUi } from '@/features/multi-obraz-pilot/PilotObrazUiContext';
import { MeritsHintDialog } from '@/features/multi-obraz-pilot/PilotMeritsLine';

export function PilotMinimalNav() {
  const { user } = useAuth();
  const t = useTranslations('multiObraz');
  const isSuperadmin = user?.globalRole === 'superadmin';
  const { data: stats } = usePilotMeritsStats();
  const [meritsHintOpen, setMeritsHintOpen] = React.useState(false);
  const [miningGateOpen, setMiningGateOpen] = React.useState(false);
  const { openLore, welcomeDismissed } = usePilotObrazUi();

  const quotaRemaining = stats?.quota?.remaining ?? 0;
  const dailyQuota = stats?.quota?.dailyQuota ?? 100;
  const walletBalance = stats?.walletBalance ?? 0;

  const quotaWalletControl =
    user && stats != null ? (
      <button
        type="button"
        onClick={() => setMeritsHintOpen(true)}
        className={cn(
          'max-w-[100vw] shrink-0 rounded-xl border border-[#334155] bg-[#0f172a] px-2 py-2 text-left text-xs text-[#e2e8f0] hover:bg-[#0f172a]/80 sm:px-3 sm:text-sm',
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

  return (
    <header className="sticky top-0 z-40 border-b border-[#334155] bg-[#020617]/95 backdrop-blur">
      <div className="mx-auto flex max-w-3xl items-center justify-between gap-2 px-4 py-3">
        <Link
          href={pilotHomeHref()}
          className={cn('shrink-0 text-sm font-extrabold tracking-tight text-white')}
        >
          {t('brand')}
        </Link>
        <nav className="flex min-w-0 flex-wrap items-center justify-end gap-1.5 sm:gap-2">
          <Button variant="ghost" size="sm" className="text-xs sm:text-sm" asChild>
            <Link href={pilotHomeHref()}>{t('navFeed')}</Link>
          </Button>
          {user ? (
            <Button variant="ghost" size="sm" className="text-xs sm:text-sm" asChild>
              <Link href="/mining">{t('navMining')}</Link>
            </Button>
          ) : (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="text-xs sm:text-sm"
              onClick={() => setMiningGateOpen(true)}
            >
              {t('navMining')}
            </Button>
          )}
          {welcomeDismissed ? (
            <Button type="button" variant="ghost" size="sm" className="text-xs sm:text-sm" onClick={openLore}>
              {t('aboutMeriterra')}
            </Button>
          ) : null}
          {user ? (
            <>
              <Button variant="ghost" size="sm" className="text-xs sm:text-sm" asChild>
                <Link href={pilotProfileHref()}>{t('navProfile')}</Link>
              </Button>
              {isSuperadmin ? (
                <Button variant="ghost" size="sm" className="text-xs sm:text-sm" asChild>
                  <Link href={pilotDeletedDreamsHref()}>{t('navDeletedDreams')}</Link>
                </Button>
              ) : null}
              {quotaWalletControl}
            </>
          ) : (
            <Button variant="default" size="sm" className="text-xs sm:text-sm" asChild>
              <Link href={routes.login}>{t('navLogin')}</Link>
            </Button>
          )}
        </nav>
      </div>
      {user && stats != null ? (
        <MeritsHintDialog open={meritsHintOpen} onOpenChange={setMeritsHintOpen} />
      ) : null}

      <Dialog open={miningGateOpen} onOpenChange={setMiningGateOpen}>
        <DialogContent className="border-[#334155] bg-[#1e293b] text-[#f1f5f9]">
          <DialogHeader>
            <DialogTitle>{t('navMiningAuthTitle')}</DialogTitle>
            <DialogDescription className="text-[#cbd5e1]">{t('navMiningAuthBody')}</DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2 sm:justify-end">
            <Button type="button" variant="outline" className="border-[#334155]" onClick={() => setMiningGateOpen(false)}>
              {t('cancel')}
            </Button>
            <Button className="bg-[#A855F7] text-white hover:bg-[#9333ea]" asChild>
              <Link href={routes.login} onClick={() => setMiningGateOpen(false)}>
                {t('navLogin')}
              </Link>
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </header>
  );
}
