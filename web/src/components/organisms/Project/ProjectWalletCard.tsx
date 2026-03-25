'use client';

import { useState, type ReactNode } from 'react';
import { useTranslations } from 'next-intl';
import { useProjectWallet } from '@/hooks/api/useProjects';
import { TopUpWalletDialog } from './TopUpWalletDialog';
import { Button } from '@/components/ui/shadcn/button';
import { Wallet } from 'lucide-react';

interface ProjectWalletCardProps {
  projectId: string;
  /** Optional title override (e.g. short dashboard label). */
  title?: string;
  /** Extra content below balance (e.g. cooperative share breakdown). */
  footer?: ReactNode;
}

export function ProjectWalletCard({ projectId, title, footer }: ProjectWalletCardProps) {
  const t = useTranslations('projects');
  const tCommon = useTranslations('common');
  const { data: wallet, isLoading } = useProjectWallet(projectId);
  const [topUpOpen, setTopUpOpen] = useState(false);

  const balance = Math.floor(wallet?.balance ?? 0);
  const heading = title ?? t('walletBalance', { defaultValue: 'Wallet balance' });

  return (
    <>
      <div className="flex h-full min-h-0 flex-col gap-3">
        <div className="flex items-center gap-2">
          <Wallet className="h-5 w-5 text-base-content/70" aria-hidden />
          <span className="font-medium">{heading}</span>
        </div>
        {isLoading ? (
          <p className="text-sm text-base-content/60">...</p>
        ) : (
          <p className="text-2xl font-semibold tabular-nums text-base-content">
            {tCommon('meritsAmount', { amount: balance })}
          </p>
        )}
        {footer}
        <Button
          size="sm"
          variant="outline"
          className="mt-auto h-9 min-h-9 w-full shrink-0 rounded-xl px-3 sm:w-auto"
          onClick={() => setTopUpOpen(true)}
        >
          {t('topUp', { defaultValue: 'Top up' })}
        </Button>
      </div>
      <TopUpWalletDialog projectId={projectId} open={topUpOpen} onOpenChange={setTopUpOpen} />
    </>
  );
}
