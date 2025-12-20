'use client';

import { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { AdaptiveLayout } from '@/components/templates/AdaptiveLayout';
import { PageHeader } from '@/components/ui/PageHeader';
import { useProfileData } from '@/hooks/useProfileData';
import { useProfileTabState } from '@/hooks/useProfileTabState';
import { ProfileCommentsTab } from '@/components/organisms/Profile/ProfileCommentsTab';
import { useAuth } from '@/contexts/AuthContext';
import { Loader2 } from 'lucide-react';

export default function ProfileCommentsPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const t = useTranslations('profile');
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
    <PageHeader
      title={t('tabs.comments')}
      showBack={false}
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
        <ProfileCommentsTab
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

