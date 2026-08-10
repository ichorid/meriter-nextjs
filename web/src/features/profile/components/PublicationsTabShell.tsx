'use client';

import { useMemo } from 'react';
import { useTranslations } from 'next-intl';
import { ProfilePublicationsTab } from '@/components/organisms/Profile/ProfilePublicationsTab';
import { useInfiniteMyPublications } from '@/hooks/api/usePublications';
import { useAuth } from '@/contexts/AuthContext';
import { useWallets } from '@/hooks/api/useWallet';
import { ProfileTabPageFrame } from './ProfileTabPageFrame';
import { useProfileTabSortFromSearch, useProfileTabPageSize } from '../hooks';

export interface PublicationsTabShellProps {
  userId: string;
  pageSize?: number;
  contentClassName?: string;
}

export function PublicationsTabShell({
  userId,
  pageSize: pageSizeProp,
  contentClassName = 'space-y-4',
}: PublicationsTabShellProps) {
  const t = useTranslations('profile');
  const defaultPageSize = useProfileTabPageSize();
  const pageSize = pageSizeProp ?? defaultPageSize;
  const { user: me } = useAuth();
  const sortOrder = useProfileTabSortFromSearch('publications');

  const {
    data: publicationsData,
    isLoading: publicationsLoading,
    isFetching: publicationsFetching,
    fetchNextPage: fetchNextPublications,
    hasNextPage: hasNextPublications,
    isFetchingNextPage: isFetchingNextPublications,
  } = useInfiniteMyPublications(userId, pageSize);

  const publications = useMemo(() => {
    return (publicationsData?.pages ?? [])
      .flatMap((page) => page?.data || [])
      .filter((pub: { isProject?: boolean; postType?: string }) => {
        return !pub.isProject && pub.postType !== 'project';
      });
  }, [publicationsData?.pages]);

  const { data: wallets = [] } = useWallets();

  return (
    <ProfileTabPageFrame
      title={t('hero.stats.publications')}
      contentClassName={contentClassName}
      wallets={wallets}
      myId={me?.id}
      withFeedInteractions
    >
      <ProfilePublicationsTab
        publications={publications}
        isLoading={publicationsLoading}
        isFetching={publicationsFetching}
        wallets={wallets}
        sortOrder={sortOrder}
        fetchNextPage={fetchNextPublications}
        hasNextPage={hasNextPublications}
        isFetchingNextPage={isFetchingNextPublications}
      />
    </ProfileTabPageFrame>
  );
}
