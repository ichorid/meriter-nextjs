'use client';

import { useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { Loader2 } from 'lucide-react';
import { AdaptiveLayout } from '@/components/templates/AdaptiveLayout';
import { ProfileTopBar } from '@/components/organisms/ContextTopBar/ContextTopBar';
import { useAuth } from '@/contexts/AuthContext';
import { routes } from '@/lib/constants/routes';
import { useWallets } from '@/hooks/api/useWallet';
import type { Wallet } from '@/types/api-v1';
import { MeritHistoryTabContent } from './MeritHistoryTabContent';

export interface UserMeritHistoryShellProps {
  userId: string;
}

export function UserMeritHistoryShell({ userId }: UserMeritHistoryShellProps) {
  const router = useRouter();
  const tHist = useTranslations('meritHistory');
  const searchParams = useSearchParams();
  const permissionCommunityId = searchParams.get('context')?.trim() ?? '';
  const { user: me, isLoading: authLoading, isAuthenticated } = useAuth();
  const isSuperadmin = me?.globalRole === 'superadmin';

  useEffect(() => {
    if (authLoading || !isAuthenticated || !me?.id) return;
    if (me.id === userId) {
      router.replace(routes.profileMeritTransfers);
    }
  }, [authLoading, isAuthenticated, me?.id, router, userId]);

  const dashboardEnabled = Boolean(
    userId && me?.id && me.id !== userId && (permissionCommunityId.length > 0 || isSuperadmin),
  );

  const { data: walletsRaw = [] } = useWallets();
  const wallets = walletsRaw as Wallet[];

  const pageHeader = <ProfileTopBar asStickyHeader title={tHist('pageTitle')} showBack />;

  if (authLoading || !isAuthenticated) {
    return (
      <AdaptiveLayout className="feed" stickyHeader={pageHeader} wallets={wallets}>
        <div className="flex h-64 flex-1 items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-brand-primary" />
        </div>
      </AdaptiveLayout>
    );
  }

  if (!authLoading && isAuthenticated && me?.id === userId) {
    return (
      <AdaptiveLayout className="feed" stickyHeader={pageHeader} wallets={wallets}>
        <div className="flex h-64 flex-1 items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-brand-primary" />
        </div>
      </AdaptiveLayout>
    );
  }

  if (!permissionCommunityId && !isSuperadmin) {
    return (
      <AdaptiveLayout className="feed" stickyHeader={pageHeader} wallets={wallets}>
        <p className="p-4 text-sm text-base-content/70" role="alert">
          {tHist('missingPermissionContext')}
        </p>
      </AdaptiveLayout>
    );
  }

  return (
    <AdaptiveLayout className="feed" stickyHeader={pageHeader} wallets={wallets}>
      <MeritHistoryTabContent
        userId={userId}
        queryEnabled={dashboardEnabled}
        dashboardEnabled={dashboardEnabled}
        permissionCommunityId={permissionCommunityId || undefined}
      />
    </AdaptiveLayout>
  );
}
