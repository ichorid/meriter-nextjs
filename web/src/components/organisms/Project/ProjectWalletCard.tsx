'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { useProjectWallet } from '@/hooks/api/useProjects';
import { TopUpWalletDialog } from './TopUpWalletDialog';
import { Button } from '@/components/ui/shadcn/button';
import { Wallet } from 'lucide-react';

interface ProjectWalletCardProps {
  projectId: string;
}

export function ProjectWalletCard({ projectId }: ProjectWalletCardProps) {
  const t = useTranslations('projects');
  const { data: wallet, isLoading } = useProjectWallet(projectId);
  const [topUpOpen, setTopUpOpen] = useState(false);

  const balance = wallet?.balance ?? 0;

  return (
    <>
      <div className="flex flex-col gap-2">
        <div className="flex items-center gap-2">
          <Wallet className="h-5 w-5 text-base-content/70" aria-hidden />
          <span className="font-medium">{t('walletBalance', { defaultValue: 'Wallet balance' })}</span>
        </div>
        {isLoading ? (
          <p className="text-sm text-base-content/60">...</p>
        ) : (
          <p className="text-2xl font-semibold tabular-nums">{balance} merits</p>
        )}
        <Button size="sm" variant="outline" onClick={() => setTopUpOpen(true)}>
          {t('topUp', { defaultValue: 'Top up' })}
        </Button>
      </div>
      <TopUpWalletDialog projectId={projectId} open={topUpOpen} onOpenChange={setTopUpOpen} />
    </>
  );
}
