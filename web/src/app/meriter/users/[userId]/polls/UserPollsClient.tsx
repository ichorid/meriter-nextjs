'use client';

import { useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { AdaptiveLayout } from '@/components/templates/AdaptiveLayout';
import { ProfileTopBar } from '@/components/organisms/ContextTopBar/ContextTopBar';
import { useInfiniteMyPolls } from '@/hooks/api/usePolls';
import { useProfileTabState } from '@/hooks/useProfileTabState';
import { ProfilePollsTab } from '@/components/organisms/Profile/ProfilePollsTab';
import { useAuth } from '@/contexts/AuthContext';
import { useWallets } from '@/hooks/api/useWallet';
import { Loader2 } from 'lucide-react';
import { useMemo } from 'react';

export default function UserPollsClient({ userId }: { userId: string }) {
  const searchParams = useSearchParams();
  const t = useTranslations('profile');
  const { user: me, isLoading: userLoading, isAuthenticated } = useAuth();
  const { sortByTab, setSortByTab } = useProfileTabState();

  const {
    data: pollsData,
    isLoading: pollsLoading,
    fetchNextPage: fetchNextPolls,
    hasNextPage: hasNextPolls,
    isFetchingNextPage: isFetchingNextPolls,
  } = useInfiniteMyPolls(userId, 20);

  const listPolls = useMemo(
    () => (pollsData?.pages ?? []).flatMap((page) => page?.data || []),
    [pollsData?.pages],
  );

  const { data: wallets = [] } = useWallets();

  const [activeWithdrawPost, setActiveWithdrawPost] = useState<string | null>(null);
  const activeCommentHook = useState<string | null>(null);

  useEffect(() => {
    const sortParam = searchParams?.get('sort');
    if (sortParam === 'voted' || sortParam === 'recent') {
      setSortByTab((prev) => ({
        ...prev,
        polls: sortParam,
      }));
    }
  }, [searchParams, setSortByTab]);

  const pageHeader = (
    <ProfileTopBar asStickyHeader={true} title={t('hero.stats.polls')} showBack={true} />
  );

  if (userLoading || !isAuthenticated) {
    return (
      <AdaptiveLayout className="feed" stickyHeader={pageHeader}>
        <div className="flex h-64 flex-1 items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-brand-primary" />
        </div>
      </AdaptiveLayout>
    );
  }

  const sortOrder = sortByTab.polls;

  return (
    <AdaptiveLayout
      className="feed"
      stickyHeader={pageHeader}
      activeCommentHook={activeCommentHook}
      activeWithdrawPost={activeWithdrawPost}
      setActiveWithdrawPost={setActiveWithdrawPost}
      wallets={wallets}
      myId={me?.id}
    >
      <div className="space-y-4 p-4">
        <ProfilePollsTab
          polls={listPolls}
          isLoading={pollsLoading}
          sortOrder={sortOrder}
          wallets={wallets}
          fetchNextPage={fetchNextPolls}
          hasNextPage={hasNextPolls}
          isFetchingNextPage={isFetchingNextPolls}
        />
      </div>
    </AdaptiveLayout>
  );
}
