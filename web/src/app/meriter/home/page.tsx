'use client';

import { useEffect, useState } from 'react';
import { AdaptiveLayout } from '@/components/templates/AdaptiveLayout';
import { EmptyCommunitiesBanner } from '@/components/organisms';
import { useHomeTabState, useHomeData, useHomeAuth } from './hooks';
import {
  PublicationsTab,
  CommentsTab,
  PollsTab,
  UpdatesTab,
  PollCreateModal,
} from './components';
import type { HomeTab } from './types';

export default function PageHome() {
  const { user, userLoading, isAuthenticated } = useHomeAuth();
  const { currentTab, sortByTab } = useHomeTabState();
  const {
    myPublications,
    publicationsLoading,
    myComments,
    commentsLoading,
    myPolls,
    pollsLoading,
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

  // Show loading state during auth check
  if (userLoading || !isAuthenticated) {
    return (
      <AdaptiveLayout className="feed">
        <div className="flex justify-center items-center h-64">
          <span className="loading loading-spinner loading-lg"></span>
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
          />
        );

      case 'polls':
        return (
          <PollsTab
            polls={myPolls}
            isLoading={pollsLoading}
            wallets={wallets}
            sortOrder={sortOrder}
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
      className="feed"
      activeCommentHook={activeCommentHook}
      activeSlider={activeSlider}
      setActiveSlider={setActiveSlider}
      activeWithdrawPost={activeWithdrawPost}
      setActiveWithdrawPost={setActiveWithdrawPost}
      wallets={wallets}
      myId={user?.id}
    >
      <EmptyCommunitiesBanner />
      <div className="space-y-4">{renderTabContent()}</div>

      {showPollCreate && (
        <PollCreateModal
          wallets={wallets}
          onClose={() => setShowPollCreate(false)}
        />
      )}
    </AdaptiveLayout>
  );
}
