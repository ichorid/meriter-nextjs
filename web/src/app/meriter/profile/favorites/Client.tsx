'use client';

import { useMemo } from 'react';
import { useSearchParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { AdaptiveLayout } from '@/components/templates/AdaptiveLayout';
import { ProfileTopBar } from '@/components/organisms/ContextTopBar/ContextTopBar';
import { useAuth } from '@/contexts/AuthContext';
import { Loader2 } from 'lucide-react';
import { useInfiniteFavorites } from '@/hooks/api/useFavorites';
import { ProfileFavoritesTab } from '@/components/organisms/Profile/ProfileFavoritesTab';
import { useWallets } from '@/hooks/api';
import type { Wallet } from '@/types/api-v1';

export default function ProfileFavoritesPage() {
  const searchParams = useSearchParams();
  const tCommon = useTranslations('common');
  const { user, isLoading: userLoading, isAuthenticated } = useAuth();

  const pageHeader = (
    <ProfileTopBar 
      asStickyHeader={true} 
      title={tCommon('favorites')}
      showBack={true}
    />
  );

  const { data: walletsRaw = [] } = useWallets();
  const wallets = walletsRaw as Wallet[];

  const pageSize = useMemo(() => {
    const sizeParam = searchParams?.get('pageSize');
    const parsed = sizeParam ? Number(sizeParam) : undefined;
    return parsed && Number.isFinite(parsed) ? Math.min(Math.max(parsed, 5), 50) : 20;
  }, [searchParams]);

  const {
    data,
    isLoading,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
  } = useInfiniteFavorites(pageSize);

  const favorites = useMemo(() => {
    const pages = data?.pages ?? [];
    return pages.flatMap((p) => p.data ?? []);
  }, [data?.pages]);

  if (userLoading || !isAuthenticated) {
    return (
      <AdaptiveLayout className="feed" stickyHeader={pageHeader}>
        <div className="flex flex-1 items-center justify-center h-64">
          <Loader2 className="w-8 h-8 animate-spin text-brand-primary" />
        </div>
      </AdaptiveLayout>
    );
  }

  return (
    <AdaptiveLayout
      className="feed"
      stickyHeader={pageHeader}
      wallets={wallets}
      myId={user?.id}
    >
      <div className="space-y-4">
        <ProfileFavoritesTab
          favorites={favorites}
          isLoading={isLoading}
          wallets={wallets}
          fetchNextPage={fetchNextPage}
          hasNextPage={hasNextPage}
          isFetchingNextPage={isFetchingNextPage}
        />
      </div>
    </AdaptiveLayout>
  );
}


