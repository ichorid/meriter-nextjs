'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { Loader2 } from 'lucide-react';
import { AdaptiveLayout } from '@/components/templates/AdaptiveLayout';
import { ProfileTopBar } from '@/components/organisms/ContextTopBar/ContextTopBar';
import { useAuth } from '@/contexts/AuthContext';
import { useUserRoles } from '@/hooks/api/useProfile';
import { trpc } from '@/lib/trpc/client';
import { MeritTransferButton, MeritTransferFeed } from '@/features/merit-transfer';
import { buildProfileMeritTransferContext } from '@/features/merit-transfer/lib/profile-merit-transfer-context';
import { useUserProfile } from '@/hooks/api/useUsers';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/shadcn/tabs';
import { Button } from '@/components/ui/shadcn/button';
import { useInfiniteScroll } from '@/hooks/useInfiniteScroll';
import { useWallets } from '@/hooks/api/useWallet';
import { routes } from '@/lib/constants/routes';
import type { Wallet } from '@/types/api-v1';

const PAGE_LIMIT = 20;

type DirectionTab = 'incoming' | 'outgoing';

export default function UserMeritTransfersClient({ userId }: { userId: string }) {
  const router = useRouter();
  const t = useTranslations('meritTransfer');
  const tCommon = useTranslations('common');
  const { user: me, isLoading: authLoading, isAuthenticated } = useAuth();
  const [tab, setTab] = useState<DirectionTab>('incoming');

  const viewingOther = Boolean(me?.id && me.id !== userId);
  const peerListEnabled = Boolean(userId && me?.id && me.id !== userId);

  useEffect(() => {
    if (authLoading || !isAuthenticated || !me?.id) return;
    if (userId !== me.id) return;
    router.replace(routes.profileMeritTransfers);
  }, [authLoading, isAuthenticated, me?.id, router, userId]);
  const { data: viewedUser } = useUserProfile(userId);
  const { data: viewedRoles = [] } = useUserRoles(userId);
  const { data: viewerRoles = [] } = useUserRoles(viewingOther && me?.id ? me.id : '');

  const profileMeritTransfer = useMemo(
    () => (viewingOther ? buildProfileMeritTransferContext(viewerRoles, viewedRoles) : null),
    [viewingOther, viewerRoles, viewedRoles],
  );

  const receiverDisplayName =
    viewedUser?.displayName || viewedUser?.username || tCommon('user');

  const incomingQuery = trpc.meritTransfer.getByUser.useInfiniteQuery(
    {
      userId,
      transferDirection: 'incoming',
      page: 1,
      limit: PAGE_LIMIT,
    },
    {
      initialPageParam: 1,
      getNextPageParam: (last) => (last.pagination.hasMore ? last.pagination.page + 1 : undefined),
      enabled: peerListEnabled && tab === 'incoming',
    },
  );

  const outgoingQuery = trpc.meritTransfer.getByUser.useInfiniteQuery(
    {
      userId,
      transferDirection: 'outgoing',
      page: 1,
      limit: PAGE_LIMIT,
    },
    {
      initialPageParam: 1,
      getNextPageParam: (last) => (last.pagination.hasMore ? last.pagination.page + 1 : undefined),
      enabled: peerListEnabled && tab === 'outgoing',
    },
  );

  const activeQuery = tab === 'incoming' ? incomingQuery : outgoingQuery;

  const incomingItems = useMemo(
    () => incomingQuery.data?.pages.flatMap((p) => p.data) ?? [],
    [incomingQuery.data?.pages],
  );

  const outgoingItems = useMemo(
    () => outgoingQuery.data?.pages.flatMap((p) => p.data) ?? [],
    [outgoingQuery.data?.pages],
  );

  const loadMoreRef = useInfiniteScroll({
    hasNextPage: activeQuery.hasNextPage ?? false,
    fetchNextPage: () => {
      void activeQuery.fetchNextPage();
    },
    isFetchingNextPage: activeQuery.isFetchingNextPage,
    threshold: 200,
  });

  const { data: walletsRaw = [] } = useWallets();
  const wallets = walletsRaw as Wallet[];

  const pageHeader = (
    <ProfileTopBar asStickyHeader title={t('peerTransfersPublicPageTitle')} showBack />
  );

  if (!authLoading && isAuthenticated && me?.id === userId) {
    return (
      <AdaptiveLayout className="feed" stickyHeader={pageHeader} wallets={wallets}>
        <div className="flex h-64 flex-1 items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-brand-primary" />
        </div>
      </AdaptiveLayout>
    );
  }

  if (authLoading || !isAuthenticated) {
    return (
      <AdaptiveLayout className="feed" stickyHeader={pageHeader} wallets={wallets}>
        <div className="flex h-64 flex-1 items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-brand-primary" />
        </div>
      </AdaptiveLayout>
    );
  }

  if (!me?.id) {
    return (
      <AdaptiveLayout className="feed" stickyHeader={pageHeader} wallets={wallets}>
        <p className="p-4 text-sm text-base-content/70">{t('pageLoginRequired')}</p>
      </AdaptiveLayout>
    );
  }

  return (
    <AdaptiveLayout className="feed" stickyHeader={pageHeader} wallets={wallets}>
      <div className="mx-auto w-full max-w-4xl space-y-4 p-4">
        {profileMeritTransfer ? (
          <div className="flex flex-wrap items-center justify-end gap-2">
            <MeritTransferButton
              receiverId={userId}
              receiverDisplayName={receiverDisplayName}
              profileContext={profileMeritTransfer}
              variant="outline"
              size="sm"
              className="inline-flex h-9 shrink-0 items-center justify-center whitespace-nowrap rounded-xl border border-input bg-gray-200 px-3 text-sm font-medium text-base-content transition-colors hover:bg-gray-300 focus-visible:outline-none active:scale-[0.98] disabled:pointer-events-none disabled:opacity-50 dark:bg-gray-700 dark:text-base-content/70 dark:hover:bg-gray-600"
            />
          </div>
        ) : null}
        <Tabs
          value={tab}
          onValueChange={(v) => setTab(v as DirectionTab)}
          className="w-full"
        >
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="incoming">{t('tabIncoming')}</TabsTrigger>
            <TabsTrigger value="outgoing">{t('tabOutgoing')}</TabsTrigger>
          </TabsList>
          <TabsContent value="incoming" className="mt-4 outline-none">
            <MeritTransferFeed
              mode="incoming"
              items={incomingItems}
              isLoading={incomingQuery.isLoading && tab === 'incoming'}
            />
            {incomingQuery.error ? (
              <p className="mt-2 text-sm text-destructive">{incomingQuery.error.message}</p>
            ) : null}
          </TabsContent>
          <TabsContent value="outgoing" className="mt-4 outline-none">
            <MeritTransferFeed
              mode="outgoing"
              items={outgoingItems}
              isLoading={outgoingQuery.isLoading && tab === 'outgoing'}
            />
            {outgoingQuery.error ? (
              <p className="mt-2 text-sm text-destructive">{outgoingQuery.error.message}</p>
            ) : null}
          </TabsContent>
        </Tabs>

        {activeQuery.hasNextPage ? (
          <div ref={loadMoreRef} className="flex justify-center py-4">
            {activeQuery.isFetchingNextPage ? (
              <Loader2 className="h-6 w-6 animate-spin text-brand-primary" />
            ) : (
              <Button type="button" variant="outline" size="sm" onClick={() => void activeQuery.fetchNextPage()}>
                {t('loadMore')}
              </Button>
            )}
          </div>
        ) : null}
      </div>
    </AdaptiveLayout>
  );
}
