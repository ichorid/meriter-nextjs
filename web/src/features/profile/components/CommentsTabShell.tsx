'use client';

import { useMemo } from 'react';
import { useTranslations } from 'next-intl';
import { ProfileVotesTab } from '@/components/organisms/Profile/ProfileVotesTab';
import { useInfiniteMyComments } from '@/hooks/api/useComments';
import { useAuth } from '@/contexts/AuthContext';
import { useWallets } from '@/hooks/api/useWallet';
import { ProfileTabPageFrame } from './ProfileTabPageFrame';
import { useProfileTabSortFromSearch, useProfileTabPageSize } from '../hooks';

export interface CommentsTabShellProps {
  userId: string;
  pageSize?: number;
  contentClassName?: string;
}

export function CommentsTabShell({
  userId,
  pageSize: pageSizeProp,
  contentClassName = 'space-y-4 pb-24',
}: CommentsTabShellProps) {
  const t = useTranslations('profile');
  const defaultPageSize = useProfileTabPageSize();
  const pageSize = pageSizeProp ?? defaultPageSize;
  const { user: me } = useAuth();
  const sortOrder = useProfileTabSortFromSearch('comments');

  const {
    data: commentsData,
    isLoading: commentsLoading,
    fetchNextPage: fetchNextComments,
    hasNextPage: hasNextComments,
    isFetchingNextPage: isFetchingNextComments,
  } = useInfiniteMyComments(userId, pageSize);

  const comments = useMemo(
    () => (commentsData?.pages ?? []).flatMap((page) => page?.data || []),
    [commentsData?.pages],
  );

  const { data: wallets = [] } = useWallets();

  return (
    <ProfileTabPageFrame
      title={t('hero.stats.comments')}
      contentClassName={contentClassName}
      wallets={wallets}
      myId={me?.id}
      withFeedInteractions
    >
      <ProfileVotesTab
        comments={comments}
        isLoading={commentsLoading}
        sortOrder={sortOrder}
        wallets={wallets}
        myId={me?.id}
        fetchNextPage={fetchNextComments}
        hasNextPage={hasNextComments}
        isFetchingNextPage={isFetchingNextComments}
      />
    </ProfileTabPageFrame>
  );
}
