'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { Loader2 } from 'lucide-react';
import { AdaptiveLayout } from '@/components/templates/AdaptiveLayout';
import { SimpleStickyHeader } from '@/components/organisms/ContextTopBar/ContextTopBar';
import { useAuth } from '@/contexts/AuthContext';
import { trpc } from '@/lib/trpc/client';
import {
  MeritHistoryFeed,
  type MeritHistoryFeedRow,
} from '@/features/merit-transfer/components/MeritHistoryFeed';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/shadcn/tabs';
import { Button } from '@/components/ui/shadcn/button';
import { useInfiniteScroll } from '@/hooks/useInfiniteScroll';

const PAGE_LIMIT = 20;

type MeritHistoryFilterTab =
  | 'all'
  | 'peer_transfer'
  | 'voting'
  | 'investment'
  | 'tappalka'
  | 'fees_and_forward'
  | 'withdrawals'
  | 'welcome_and_system'
  | 'other';

const FILTER_TABS: MeritHistoryFilterTab[] = [
  'all',
  'peer_transfer',
  'voting',
  'investment',
  'tappalka',
  'fees_and_forward',
  'withdrawals',
  'welcome_and_system',
  'other',
];

export interface CommunityContextMeritHistoryClientProps {
  contextCommunityId: string;
  backHref: string;
  titleKey: 'communityMeritHistoryTitle' | 'projectMeritHistoryTitle';
}

export function CommunityContextMeritHistoryClient({
  contextCommunityId,
  backHref,
  titleKey,
}: CommunityContextMeritHistoryClientProps) {
  const router = useRouter();
  const tHist = useTranslations('meritHistory');
  const { user, isLoading: authLoading } = useAuth();
  const [tab, setTab] = useState<MeritHistoryFilterTab>('all');

  const txQuery = trpc.wallets.getCommunityMeritHistory.useInfiniteQuery(
    {
      communityId: contextCommunityId,
      limit: PAGE_LIMIT,
      category: tab === 'all' ? undefined : tab,
    },
    {
      initialPageParam: 0,
      getNextPageParam: (lastPage) =>
        lastPage.hasMore ? lastPage.skip + lastPage.data.length : undefined,
      enabled: Boolean(contextCommunityId && user?.id),
    },
  );

  const rows = useMemo(() => {
    const pages = txQuery.data?.pages ?? [];
    const flat = pages.flatMap((p) => p.data);
    return flat.map(
      (row): MeritHistoryFeedRow => ({
        id: row.id,
        type: row.type,
        amount: row.amount,
        description: row.description,
        referenceType: row.referenceType,
        createdAt: typeof row.createdAt === 'string' ? row.createdAt : String(row.createdAt),
        meritHistoryCategory: row.meritHistoryCategory,
        ledgerMultiplier: row.ledgerMultiplier,
        meritHistoryEnrichment: row.meritHistoryEnrichment ?? null,
        subjectUserId: row.subjectUserId ?? null,
        subjectDisplayName: row.subjectDisplayName ?? null,
      }),
    );
  }, [txQuery.data?.pages]);

  const tabLabelKey = (key: MeritHistoryFilterTab): string => `filter.${key}`;

  const loadMoreRef = useInfiniteScroll({
    hasNextPage: txQuery.hasNextPage ?? false,
    fetchNextPage: () => {
      void txQuery.fetchNextPage();
    },
    isFetchingNextPage: txQuery.isFetchingNextPage,
    threshold: 200,
  });

  const pageHeader = (
    <SimpleStickyHeader
      title={tHist(titleKey)}
      showBack
      onBack={() => router.push(backHref)}
      asStickyHeader
      showScrollToTop
    />
  );

  if (authLoading) {
    return (
      <AdaptiveLayout
        className="feed"
        communityId={contextCommunityId}
        myId={user?.id}
        stickyHeader={pageHeader}
      >
        <div className="flex min-h-[240px] items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-brand-primary" />
        </div>
      </AdaptiveLayout>
    );
  }

  if (!user?.id) {
    return (
      <AdaptiveLayout className="feed" stickyHeader={pageHeader}>
        <p className="p-4 text-sm text-base-content/70">{tHist('loginRequiredCommunityHistory')}</p>
      </AdaptiveLayout>
    );
  }

  return (
    <AdaptiveLayout
      className="feed"
      communityId={contextCommunityId}
      myId={user.id}
      stickyHeader={pageHeader}
    >
      <div className="mx-auto w-full max-w-4xl space-y-4 p-4">
        <p className="text-sm text-base-content/70">{tHist('communityContextDescription')}</p>

        <Tabs value={tab} onValueChange={(v) => setTab(v as MeritHistoryFilterTab)}>
          <TabsList className="flex h-auto w-full flex-wrap justify-start gap-1 overflow-x-auto rounded-xl bg-base-200/60 p-1">
            {FILTER_TABS.map((key) => (
              <TabsTrigger
                key={key}
                value={key}
                className="shrink-0 rounded-lg px-2 py-1.5 text-xs sm:text-sm"
              >
                {tHist(tabLabelKey(key))}
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>

        <MeritHistoryFeed items={rows} isLoading={txQuery.isLoading} />

        <div ref={loadMoreRef} className="h-4" />
        {txQuery.hasNextPage ? (
          <div className="flex justify-center">
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="rounded-xl"
              disabled={txQuery.isFetchingNextPage}
              onClick={() => void txQuery.fetchNextPage()}
            >
              {tHist('loadMore')}
            </Button>
          </div>
        ) : null}
      </div>
    </AdaptiveLayout>
  );
}
