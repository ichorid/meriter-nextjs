'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { useProjectWallet } from '@/hooks/api/useProjects';
import { TopUpWalletDialog } from './TopUpWalletDialog';
import { Card, CardContent, CardHeader } from '@/components/ui/shadcn/card';
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
      <Card>
        <CardHeader className="pb-2">
          <div className="flex items-center gap-2">
            <Wallet className="h-5 w-5" />
            <span className="font-medium">{t('walletBalance', { defaultValue: 'Wallet' })}</span>
          </div>
        </CardHeader>
        <CardContent className="space-y-2">
          {isLoading ? (
            <p className="text-sm text-muted-foreground">...</p>
          ) : (
            <p className="text-2xl font-semibold">{balance} merits</p>
          )}
          <Button size="sm" variant="outline" onClick={() => setTopUpOpen(true)}>
            {t('topUp', { defaultValue: 'Top up' })}
          </Button>
        </CardContent>
      </Card>
      <TopUpWalletDialog projectId={projectId} open={topUpOpen} onOpenChange={setTopUpOpen} />
    </>
  );
}
