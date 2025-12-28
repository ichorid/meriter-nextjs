import { useTranslations } from 'next-intl';
import { PublicationCardComponent as PublicationCard } from '@/components/organisms/Publication';
import { EmptyState } from '@/components/organisms/EmptyState/EmptyState';
import { CardSkeleton } from '@/components/ui/LoadingSkeleton';
import { sortItems, generateKey } from '@/lib/utils/profileContent';
import type { SortOrder } from '@/hooks/useProfileTabState';
import { Loader2 } from 'lucide-react';
import { useInfiniteScroll } from '@/hooks/useInfiniteScroll';

interface ProfilePublicationsTabProps {
  publications: any[];
  isLoading: boolean;
  isFetching?: boolean;
  wallets: any[];
  sortOrder: SortOrder;
  fetchNextPage?: () => void;
  hasNextPage?: boolean;
  isFetchingNextPage?: boolean;
}

export function ProfilePublicationsTab({
  publications,
  isLoading,
  isFetching = false,
  wallets,
  sortOrder,
  fetchNextPage,
  hasNextPage = false,
  isFetchingNextPage = false,
}: ProfilePublicationsTabProps) {
  const t = useTranslations('home');

  // Infinite scroll trigger
  const observerTarget = useInfiniteScroll({
    hasNextPage,
    fetchNextPage: fetchNextPage || (() => {}),
    isFetchingNextPage,
    threshold: 200,
  });

  // Show loading state if initial loading OR fetching with no data
  const showLoading = isLoading || (isFetching && publications.length === 0);

  if (showLoading) {
    return (
      <div className="space-y-4">
        <CardSkeleton />
        <CardSkeleton />
        <CardSkeleton />
      </div>
    );
  }

  if (publications.length === 0) {
    return (
      <EmptyState
        title={t('empty.publications.title')}
        message={
          t('empty.publications.message')
        }
      />
    );
  }

  const filteredPublications = publications.filter(
    (p) => {
      // Filter out projects: exclude items where isProject is true or postType is 'project'
      const isProject = p.isProject === true || p.postType === 'project';
      return p && !isProject && (p.content || p.type === 'poll' || p.title);
    }
  );

  return (
    <div className="space-y-4 bg-base-100 dark:bg-base-100">
      {sortItems(filteredPublications, sortOrder).map((p, index) => {
        const key = generateKey(p?.id, index, 'pub');
        return (
          <PublicationCard
            key={key}
            publication={p}
            wallets={wallets}
            showCommunityAvatar={true}
          />
        );
      })}
      
      {/* Infinite scroll trigger */}
      <div ref={observerTarget} className="h-4" />
      
      {/* Loading indicator */}
      {isFetchingNextPage && (
        <div className="flex justify-center py-4">
          <Loader2 className="w-6 h-6 animate-spin text-brand-primary" />
        </div>
      )}
    </div>
  );
}

