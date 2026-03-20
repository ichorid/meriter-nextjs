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
  const { data: wallet, isLoading } = useProjectWallet(projectId);
  const [topUpOpen, setTopUpOpen] = useState(false);

  const balance = wallet?.balance ?? 0;
  const heading = title ?? t('walletBalance', { defaultValue: 'Wallet balance' });

  return (
    <>
      <div className="flex flex-col gap-2">
        <div className="flex items-center gap-2">
          <Wallet className="h-5 w-5 text-base-content/70" aria-hidden />
          <span className="font-medium">{heading}</span>
        </div>
        {isLoading ? (
          <p className="text-sm text-base-content/60">...</p>
        ) : (
          <p className="text-2xl font-semibold tabular-nums text-base-content">{balance} merits</p>
        )}
        {footer}
        <Button size="sm" variant="outline" className="w-full sm:w-auto" onClick={() => setTopUpOpen(true)}>
          {t('topUp', { defaultValue: 'Top up' })}
        </Button>
      </div>
      <TopUpWalletDialog projectId={projectId} open={topUpOpen} onOpenChange={setTopUpOpen} />
    </>
  );
}
