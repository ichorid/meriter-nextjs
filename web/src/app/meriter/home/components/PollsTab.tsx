import { useTranslations } from 'next-intl';
import { PublicationCardComponent as PublicationCard } from '@/components/organisms/Publication';
import { EmptyState } from '@/components/organisms/EmptyState/EmptyState';
import { CardSkeleton } from '@/components/ui/LoadingSkeleton';
import { sortItems, generateKey } from '../utils';
import type { SortOrder } from '../types';
import { Loader2 } from 'lucide-react';
import { useInfiniteScroll } from '@/hooks/useInfiniteScroll';

interface PollsTabProps {
  polls: any[];
  isLoading: boolean;
  wallets: any[];
  sortOrder: SortOrder;
  fetchNextPage?: () => void;
  hasNextPage?: boolean;
  isFetchingNextPage?: boolean;
}

export function PollsTab({
  polls,
  isLoading,
  wallets,
  sortOrder,
  fetchNextPage,
  hasNextPage = false,
  isFetchingNextPage = false,
}: PollsTabProps) {
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
        title={t('empty.polls.title') || 'No Polls'}
        message={
          t('empty.polls.message') || "You haven't created any polls yet."
        }
      />
    );
  }

  return (
    <div className="space-y-4 bg-base-100 dark:bg-base-100">
      {sortItems(polls, sortOrder).map((poll: any, index: number) => {
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

