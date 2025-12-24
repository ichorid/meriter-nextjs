import { useTranslations } from 'next-intl';
import { PublicationCardComponent as PublicationCard } from '@/components/organisms/Publication';
import { EmptyState } from '@/components/organisms/EmptyState/EmptyState';
import { CardSkeleton } from '@/components/ui/LoadingSkeleton';
import { sortItems, generateKey } from '@/lib/utils/profileContent';
import type { SortOrder } from '@/hooks/useProfileTabState';
import { Loader2 } from 'lucide-react';
import { useInfiniteScroll } from '@/hooks/useInfiniteScroll';

interface ProfileProjectsTabProps {
  projects: unknown[];
  isLoading: boolean;
  wallets: unknown[];
  sortOrder: SortOrder;
  fetchNextPage?: () => void;
  hasNextPage?: boolean;
  isFetchingNextPage?: boolean;
}

export function ProfileProjectsTab({
  projects,
  isLoading,
  wallets,
  sortOrder,
  fetchNextPage,
  hasNextPage = false,
  isFetchingNextPage = false,
}: ProfileProjectsTabProps) {
  const t = useTranslations('home');

  // Infinite scroll trigger
  const observerTarget = useInfiniteScroll({
    hasNextPage,
    fetchNextPage: fetchNextPage || (() => {}),
    isFetchingNextPage,
    threshold: 200,
  });

  if (isLoading) {
    return (
      <div className="space-y-4">
        <CardSkeleton />
        <CardSkeleton />
        <CardSkeleton />
      </div>
    );
  }

  if (projects.length === 0) {
    return (
      <EmptyState
        title={t('empty.projects.title')}
        message={
          t('empty.projects.message')
        }
      />
    );
  }

  return (
    <div className="space-y-4 bg-base-100 dark:bg-base-100">
      {sortItems(projects, sortOrder).map((project: unknown, index: number) => {
        const key = generateKey(project?.id, index, 'project');
        return (
          <PublicationCard
            key={key}
            publication={project}
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



