'use client';

import { useMemo } from 'react';
import { useTranslations } from 'next-intl';
import { ProfilePollsTab } from '@/components/organisms/Profile/ProfilePollsTab';
import { useInfiniteMyPolls } from '@/hooks/api/usePolls';
import { useAuth } from '@/contexts/AuthContext';
import { useWallets } from '@/hooks/api/useWallet';
import { ProfileTabPageFrame } from './ProfileTabPageFrame';
import { useProfileTabSortFromSearch, useProfileTabPageSize } from '../hooks';

export interface PollsTabShellProps {
  userId: string;
  pageSize?: number;
  contentClassName?: string;
}

export function PollsTabShell({
  userId,
  pageSize: pageSizeProp,
  contentClassName = 'space-y-4',
}: PollsTabShellProps) {
  const t = useTranslations('profile');
  const defaultPageSize = useProfileTabPageSize();
  const pageSize = pageSizeProp ?? defaultPageSize;
  const { user: me } = useAuth();
  const sortOrder = useProfileTabSortFromSearch('polls');

  const {
    data: pollsData,
    isLoading: pollsLoading,
    fetchNextPage: fetchNextPolls,
    hasNextPage: hasNextPolls,
    isFetchingNextPage: isFetchingNextPolls,
  } = useInfiniteMyPolls(userId, pageSize);

  const polls = useMemo(
    () => (pollsData?.pages ?? []).flatMap((page) => page?.data || []),
    [pollsData?.pages],
  );

  const { data: wallets = [] } = useWallets();

  return (
    <ProfileTabPageFrame
      title={t('hero.stats.polls')}
      contentClassName={contentClassName}
      wallets={wallets}
      myId={me?.id}
      withFeedInteractions
    >
      <ProfilePollsTab
        polls={polls}
        isLoading={pollsLoading}
        wallets={wallets}
        sortOrder={sortOrder}
        fetchNextPage={fetchNextPolls}
        hasNextPage={hasNextPolls}
        isFetchingNextPage={isFetchingNextPolls}
      />
    </ProfileTabPageFrame>
  );
}
