'use client';

import { useTranslations } from 'next-intl';
import { Loader2 } from 'lucide-react';
import { AdaptiveLayout } from '@/components/templates/AdaptiveLayout';
import { ProfileTopBar } from '@/components/organisms/ContextTopBar/ContextTopBar';
import { useAuth } from '@/contexts/AuthContext';
import { useWallets } from '@/hooks/api/useWallet';
import type { Wallet } from '@/types/api-v1';
import { MeritHistoryTabContent } from './MeritHistoryTabContent';

export function ProfileMeritHistoryShell() {
  const tMt = useTranslations('meritTransfer');
  const tHist = useTranslations('meritHistory');
  const { user, isLoading: authLoading, isAuthenticated } = useAuth();
  const userId = user?.id ?? '';

  const { data: walletsRaw = [] } = useWallets();
  const wallets = walletsRaw as Wallet[];

  const pageHeader = (
    <ProfileTopBar asStickyHeader title={tHist('pageTitle')} showBack />
  );

  if (authLoading || !isAuthenticated) {
    return (
      <AdaptiveLayout className="feed" stickyHeader={pageHeader} wallets={wallets}>
        <div className="flex h-64 flex-1 items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-brand-primary" />
        </div>
      </AdaptiveLayout>
    );
  }

  if (!user?.id) {
    return (
      <AdaptiveLayout className="feed" stickyHeader={pageHeader} wallets={wallets}>
        <p className="p-4 text-sm text-base-content/70">{tMt('pageLoginRequired')}</p>
      </AdaptiveLayout>
    );
  }

  return (
    <AdaptiveLayout className="feed" stickyHeader={pageHeader} wallets={wallets}>
      <MeritHistoryTabContent
        userId={userId}
        queryEnabled={Boolean(userId)}
        dashboardEnabled={Boolean(userId)}
      />
    </AdaptiveLayout>
  );
}
