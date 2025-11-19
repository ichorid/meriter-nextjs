'use client';

import { useEffect, useState } from 'react';
import { AdaptiveLayout } from '@/components/templates/AdaptiveLayout';
import { useHomeTabState, useHomeData, useHomeAuth } from './hooks';
import {
  PublicationsTab,
  CommentsTab,
  PollsTab,
  UpdatesTab,
  PollCreateModal,
} from './components';
import type { HomeTab } from './types';
// Gluestack UI components
import { Box } from '@/components/ui/box';
import { VStack } from '@/components/ui/vstack';
import { Spinner } from '@/components/ui/spinner';

export default function PageHome() {
  const { user, userLoading, isAuthenticated } = useHomeAuth();
  const { currentTab, setCurrentTab, sortByTab, setSortByTab } = useHomeTabState();
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
        <Box flex={1} alignItems="center" justifyContent="center" height={256}>
          <Spinner size="large" />
        </Box>
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
      activeCommentHook={activeCommentHook}
      activeSlider={activeSlider}
      setActiveSlider={setActiveSlider}
      activeWithdrawPost={activeWithdrawPost}
      setActiveWithdrawPost={setActiveWithdrawPost}
      wallets={wallets}
      myId={user?.id}
          >
            <VStack space="md" flex={1}>
        {renderTabContent()}
      </VStack>

      {showPollCreate && (
        <PollCreateModal
          wallets={wallets}
          onClose={() => setShowPollCreate(false)}
        />
      )}
    </AdaptiveLayout>
  );
}
