'use client';

import { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { AdaptiveLayout } from '@/components/templates/AdaptiveLayout';
import { useHomeTabState, useHomeData, useHomeAuth } from './hooks';
import {
  PublicationsTab,
  CommentsTab,
  PollsTab,
  UpdatesTab,
  PollCreateModal,
  HeroSection,
} from './components';
import type { HomeTab } from './types';
import { InviteHandler } from '@/components/InviteHandler';
import { HomeFabMenu } from '@/components/molecules/FabMenu/HomeFabMenu';
import { usePublication } from '@/hooks/api/usePublications';

import { Loader2 } from 'lucide-react';

export default function PageHome() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user, userLoading, isAuthenticated } = useHomeAuth();
  const { currentTab, setCurrentTab, sortByTab, setSortByTab } = useHomeTabState();
  const {
    myPublications,
    publicationsLoading,
    fetchNextPublications,
    hasNextPublications,
    isFetchingNextPublications,
    myComments,
    commentsLoading,
    fetchNextComments,
    hasNextComments,
    isFetchingNextComments,
    myPolls,
    pollsLoading,
    fetchNextPolls,
    hasNextPolls,
    isFetchingNextPolls,
    updatesArray,
    updatesLoading,
    wallets,
  } = useHomeData();

  const [showPollCreate, setShowPollCreate] = useState(false);
  const [activeWithdrawPost, setActiveWithdrawPost] = useState<string | null>(
    null
  );
  const [activeSlider, setActiveSlider] = useState<string | null>(null);
  const activeCommentHook = useState<string | null>(null);

  // Get post ID from URL if present
  const targetPostId = searchParams?.get('post');
  
  // Fetch publication data if post ID is in URL
  const { data: targetPublication, isLoading: targetPublicationLoading } = usePublication(targetPostId || '');

  // Redirect to community page when publication data is loaded
  useEffect(() => {
    if (targetPostId && targetPublication?.communityId) {
      // Redirect to the community page with the post parameter
      router.replace(`/meriter/communities/${targetPublication.communityId}?post=${targetPostId}`);
    }
  }, [targetPostId, targetPublication?.communityId, router]);

  // Handle updates redirect
  useEffect(() => {
    if (document.location.search.match('updates')) {
      setTimeout(() => (document.location.href = '#updates-frequency'), 500);
      setTimeout(() => (document.location.href = '#updates-frequency'), 1000);
    }
  }, [wallets]);

  // Reset active withdraw slider when switching tabs
  useEffect(() => {
    setActiveWithdrawPost(null);
  }, [currentTab]);

  // Show loading state during auth check or while redirecting to post
  if (userLoading || !isAuthenticated || (targetPostId && targetPublicationLoading)) {
    return (
      <AdaptiveLayout className="feed">
        <div className="flex flex-1 items-center justify-center h-64">
          <Loader2 className="w-8 h-8 animate-spin text-brand-primary" />
        </div>
      </AdaptiveLayout>
    );
  }

  const renderTabContent = () => {
    const sortOrder = sortByTab[currentTab];

    switch (currentTab) {
      case 'publications':
        return (
          <PublicationsTab
            publications={myPublications}
            isLoading={publicationsLoading}
            wallets={wallets}
            sortOrder={sortOrder}
            fetchNextPage={fetchNextPublications}
            hasNextPage={hasNextPublications}
            isFetchingNextPage={isFetchingNextPublications}
          />
        );

      case 'comments':
        return (
          <CommentsTab
            comments={myComments}
            isLoading={commentsLoading}
            sortOrder={sortOrder}
            wallets={wallets}
            myId={user?.id}
            fetchNextPage={fetchNextComments}
            hasNextPage={hasNextComments}
            isFetchingNextPage={isFetchingNextComments}
          />
        );

      case 'polls':
        return (
          <PollsTab
            polls={myPolls}
            isLoading={pollsLoading}
            wallets={wallets}
            sortOrder={sortOrder}
            fetchNextPage={fetchNextPolls}
            hasNextPage={hasNextPolls}
            isFetchingNextPage={isFetchingNextPolls}
          />
        );

      case 'updates':
        return (
          <UpdatesTab
            updates={updatesArray}
            isLoading={updatesLoading}
            sortOrder={sortOrder}
          />
        );

      default:
        return null;
    }
  };

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
      <InviteHandler />
      <div className="flex-1 space-y-4">
        {/* Hero Section with greeting and statistics */}
        <HeroSection
          userName={
            user?.firstName && user?.lastName
              ? `${user.firstName} ${user.lastName}`
              : user?.firstName || user?.displayName || user?.username || undefined
          }
          userAvatar={undefined}
          stats={{
            publications: myPublications.length,
            comments: myComments.length,
            polls: myPolls.length,
            updates: updatesArray.length,
          }}
          isLoading={
            publicationsLoading ||
            commentsLoading ||
            pollsLoading ||
            updatesLoading
          }
        />

        {renderTabContent()}
      </div>

      {showPollCreate && (
        <PollCreateModal
          wallets={wallets}
          onClose={() => setShowPollCreate(false)}
        />
      )}

      {/* FAB Menu for creating content */}
      <HomeFabMenu />
    </AdaptiveLayout>
  );
}
