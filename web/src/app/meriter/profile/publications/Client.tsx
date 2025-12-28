'use client';

import { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { AdaptiveLayout } from '@/components/templates/AdaptiveLayout';
import { ProfileTopBar } from '@/components/organisms/ContextTopBar/ContextTopBar';
import { useProfileData } from '@/hooks/useProfileData';
import { useProfileTabState } from '@/hooks/useProfileTabState';
import { ProfilePublicationsTab } from '@/components/organisms/Profile/ProfilePublicationsTab';
import { useAuth } from '@/contexts/AuthContext';
import { Loader2 } from 'lucide-react';

export default function ProfilePublicationsPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const t = useTranslations('profile');
  const { user, isLoading: userLoading, isAuthenticated } = useAuth();
  const { sortByTab, setSortByTab } = useProfileTabState();
  const {
    myPublications,
    publicationsLoading,
    publicationsFetching,
    fetchNextPublications,
    hasNextPublications,
    isFetchingNextPublications,
    wallets,
  } = useProfileData();

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
    <ProfileTopBar asStickyHeader={true} />
  );

  if (userLoading || !isAuthenticated) {
    return (
      <AdaptiveLayout className="feed" stickyHeader={pageHeader}>
        <div className="flex flex-1 items-center justify-center h-64">
          <Loader2 className="w-8 h-8 animate-spin text-brand-primary" />
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
      myId={user?.id}
    >
      <div className="space-y-4">
        <ProfilePublicationsTab
          publications={myPublications}
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

