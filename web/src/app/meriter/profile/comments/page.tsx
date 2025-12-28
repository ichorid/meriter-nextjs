'use client';

import { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { AdaptiveLayout } from '@/components/templates/AdaptiveLayout';
import { SimpleStickyHeader } from '@/components/organisms/ContextTopBar/ContextTopBar';
import { useProfileData } from '@/hooks/useProfileData';
import { useProfileTabState } from '@/hooks/useProfileTabState';
import { ProfileVotesTab } from '@/components/organisms/Profile/ProfileVotesTab';
import { useAuth } from '@/contexts/AuthContext';
import { Loader2 } from 'lucide-react';

export default function ProfileCommentsPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const t = useTranslations('home');
  const { user, isLoading: userLoading, isAuthenticated } = useAuth();
  const { sortByTab, setSortByTab } = useProfileTabState();
  const {
    myComments,
    commentsLoading,
    fetchNextComments,
    hasNextComments,
    isFetchingNextComments,
    wallets,
  } = useProfileData();

  const [activeWithdrawPost, setActiveWithdrawPost] = useState<string | null>(null);
  const activeCommentHook = useState<string | null>(null);

  useEffect(() => {
    const sortParam = searchParams?.get('sort');
    if (sortParam === 'voted' || sortParam === 'recent') {
      setSortByTab((prev) => ({
        ...prev,
        comments: sortParam,
      }));
    }
  }, [searchParams, setSortByTab]);

  const pageHeader = (
    <SimpleStickyHeader
      title={t('hero.stats.comments')}
      showBack={true}
      onBack={() => router.push('/meriter/profile')}
      asStickyHeader={true}
    />
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

  const sortOrder = sortByTab.comments;

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
        <ProfileVotesTab
          comments={myComments}
          isLoading={commentsLoading}
          sortOrder={sortOrder}
          wallets={wallets}
          myId={user?.id}
          fetchNextPage={fetchNextComments}
          hasNextPage={hasNextComments}
          isFetchingNextPage={isFetchingNextComments}
        />
      </div>
    </AdaptiveLayout>
  );
}

