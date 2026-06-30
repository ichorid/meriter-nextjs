'use client';

import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { AdaptiveLayout } from '@/components/templates/AdaptiveLayout';
import { ProfileTopBar } from '@/components/organisms/ContextTopBar/ContextTopBar';
import { useInfiniteMyPublications } from '@/hooks/api/usePublications';
import { useProfileTabState } from '@/hooks/useProfileTabState';
import { ProfilePublicationsTab } from '@/components/organisms/Profile/ProfilePublicationsTab';
import { useAuth } from '@/contexts/AuthContext';
import { useWallets } from '@/hooks/api/useWallet';
import { useMediaQuery } from '@/hooks/useMediaQuery';
import { Loader2 } from 'lucide-react';

export default function UserPublicationsClient({ userId }: { userId: string }) {
  const searchParams = useSearchParams();
  const t = useTranslations('profile');
  const { user: me, isLoading: userLoading, isAuthenticated } = useAuth();
  const isMobile = useMediaQuery('(max-width: 640px)');
  const pageSize = isMobile ? 10 : 20;
  const { sortByTab, setSortByTab } = useProfileTabState();

  const {
    data: publicationsData,
    isLoading: publicationsLoading,
    isFetching: publicationsFetching,
    fetchNextPage: fetchNextPublications,
    hasNextPage: hasNextPublications,
    isFetchingNextPage: isFetchingNextPublications,
  } = useInfiniteMyPublications(userId, pageSize);

  const listPublications = useMemo(() => {
    return (publicationsData?.pages ?? [])
      .flatMap((page) => page?.data || [])
      .filter((pub: { isProject?: boolean; postType?: string }) => {
        return !pub.isProject && pub.postType !== 'project';
      });
  }, [publicationsData?.pages]);

  const { data: wallets = [] } = useWallets();

  const [activeWithdrawPost, setActiveWithdrawPost] = useState<string | null>(null);
  const activeCommentHook = useState<string | null>(null);

  useEffect(() => {
    const sortParam = searchParams?.get('sort');
    if (sortParam === 'voted' || sortParam === 'recent') {
      setSortByTab((prev) => ({
        ...prev,
        publications: sortParam,
      }));
    }
  }, [searchParams, setSortByTab]);

  const pageHeader = (
    <ProfileTopBar asStickyHeader={true} title={t('hero.stats.publications')} showBack={true} />
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

  const sortOrder = sortByTab.publications;

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
        <ProfilePublicationsTab
          publications={listPublications}
          isLoading={publicationsLoading}
          isFetching={publicationsFetching}
          wallets={wallets}
          sortOrder={sortOrder}
          fetchNextPage={fetchNextPublications}
          hasNextPage={hasNextPublications}
          isFetchingNextPage={isFetchingNextPublications}
        />
      </div>
    </AdaptiveLayout>
  );
}
