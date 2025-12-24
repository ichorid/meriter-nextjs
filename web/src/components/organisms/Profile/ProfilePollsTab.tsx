import { useTranslations } from 'next-intl';
import { PublicationCardComponent as PublicationCard } from '@/components/organisms/Publication';
import { EmptyState } from '@/components/organisms/EmptyState/EmptyState';
import { CardSkeleton } from '@/components/ui/LoadingSkeleton';
import { sortItems, generateKey } from '@/lib/utils/profileContent';
import type { SortOrder } from '@/hooks/useProfileTabState';
import { Loader2 } from 'lucide-react';
import { useInfiniteScroll } from '@/hooks/useInfiniteScroll';

interface ProfilePollsTabProps {
  polls: unknown[];
  isLoading: boolean;
  wallets: unknown[];
  sortOrder: SortOrder;
  fetchNextPage?: () => void;
  hasNextPage?: boolean;
  isFetchingNextPage?: boolean;
}

export function ProfilePollsTab({
  polls,
  isLoading,
  wallets,
  sortOrder,
  fetchNextPage,
  hasNextPage = false,
  isFetchingNextPage = false,
}: ProfilePollsTabProps) {
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

  if (polls.length === 0) {
    return (
      <EmptyState
        title={t('empty.polls.title')}
        message={
          t('empty.polls.message')
        }
      />
    );
  }

  return (
    <div className="space-y-4 bg-base-100 dark:bg-base-100">
      {sortItems(polls, sortOrder).map((poll: unknown, index: number) => {
        const key = generateKey(poll?.id, index, 'poll');
        return (
          <PublicationCard
            key={key}
            publication={poll}
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

