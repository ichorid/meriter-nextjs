'use client';

import { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { AdaptiveLayout } from '@/components/templates/AdaptiveLayout';
import { useProfileData } from '@/hooks/useProfileData';
import { useProfileTabState } from '@/hooks/useProfileTabState';
import { ProfileCommentsTab } from '@/components/organisms/Profile/ProfileCommentsTab';
import { useAuth } from '@/contexts/AuthContext';
import { Loader2 } from 'lucide-react';

export default function ProfileCommentsPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
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
  const [activeSlider, setActiveSlider] = useState<string | null>(null);
  const activeCommentHook = useState<string | null>(null);

  // Get sort from URL params
  useEffect(() => {
    const sortParam = searchParams?.get('sort');
    if (sortParam === 'voted' || sortParam === 'recent') {
      setSortByTab((prev) => ({
        ...prev,
        comments: sortParam,
      }));
    }
  }, [searchParams, setSortByTab]);

  // Show loading state during auth check
  if (userLoading || !isAuthenticated) {
    return (
      <AdaptiveLayout className="feed">
        <div className="flex flex-1 items-center justify-center h-64">
          <Loader2 className="w-8 h-8 animate-spin text-brand-primary" />
        </div>
      </AdaptiveLayout>
    );
  }

  const sortOrder = sortByTab.comments;

  return (
    <AdaptiveLayout
      activeCommentHook={activeCommentHook}
      activeSlider={activeSlider}
      setActiveSlider={setActiveSlider}
      activeWithdrawPost={activeWithdrawPost}
      setActiveWithdrawPost={setActiveWithdrawPost}
      wallets={wallets}
      myId={user?.id}
    >
      <div className="flex-1 space-y-4">
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

