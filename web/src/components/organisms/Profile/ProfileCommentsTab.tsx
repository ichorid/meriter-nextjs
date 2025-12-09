import { useTranslations } from 'next-intl';
import { Comment } from '@/features/comments/components/comment';
import { EmptyState } from '@/components/organisms/EmptyState/EmptyState';
import { CardSkeleton } from '@/components/ui/LoadingSkeleton';
import { sortItems, generateKey } from '@/lib/utils/profileContent';
import type { SortOrder } from '@/hooks/useProfileTabState';
import { useState, useCallback } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Loader2 } from 'lucide-react';
import { useInfiniteScroll } from '@/hooks/useInfiniteScroll';

interface ProfileCommentsTabProps {
  comments: any[];
  isLoading: boolean;
  sortOrder: SortOrder;
  wallets?: any[];
  myId?: string;
  fetchNextPage?: () => void;
  hasNextPage?: boolean;
  isFetchingNextPage?: boolean;
}

export function ProfileCommentsTab({
  comments,
  isLoading,
  sortOrder,
  wallets = [],
  myId,
  fetchNextPage,
  hasNextPage = false,
  isFetchingNextPage = false,
}: ProfileCommentsTabProps) {
  const t = useTranslations('home');
  const queryClient = useQueryClient();
  const activeCommentHook = useState<string | null>(null);
  const [activeSlider, setActiveSlider] = useState<string | null>(null);

  // Infinite scroll trigger
  const observerTarget = useInfiniteScroll({
    hasNextPage,
    fetchNextPage: fetchNextPage || (() => {}),
    isFetchingNextPage,
    threshold: 200,
  });

  // Update balance function - invalidate wallet queries
  const updateWalletBalance = useCallback(async (communityId: string, amountChange: number) => {
    // Invalidate wallet balance queries to trigger refetch
    await queryClient.invalidateQueries({ queryKey: ['wallets', 'balance', communityId] });
  }, [queryClient]);

  // Update all function - invalidate all queries
  const updateAll = useCallback(async () => {
    await queryClient.invalidateQueries();
  }, [queryClient]);

  if (isLoading) {
    return (
      <div className="space-y-4">
        <CardSkeleton />
        <CardSkeleton />
        <CardSkeleton />
      </div>
    );
  }

  if (comments.length === 0) {
    return (
      <EmptyState
        title={t('empty.comments.title')}
        message={
          t('empty.comments.message')
        }
      />
    );
  }

  return (
    <div className="space-y-4 bg-base-100 dark:bg-base-100">
      {sortItems(comments, sortOrder).map((comment: any, index: number) => {
        const key = generateKey(comment?.id, index, 'comment');

        // Get balance for this comment's community
        const communityBalance = wallets.find((w) => w.communityId === comment.communityId)?.balance || 0;

        // Transform comment data to match Comment component props
        return (
          <Comment
            key={key}
            _id={comment.id}
            authorId={comment.authorId}
            content={comment.content}
            createdAt={comment.createdAt}
            meta={comment.meta}
            metrics={comment.metrics}
            communityId={comment.communityId}
            inPublicationSlug={comment.publicationSlug}
            activeCommentHook={activeCommentHook}
            activeSlider={activeSlider}
            setActiveSlider={setActiveSlider}
            myId={myId}
            wallets={wallets}
            balance={communityBalance}
            updBalance={async () => {
              await updateWalletBalance(comment.communityId, 0);
            }}
            updateWalletBalance={updateWalletBalance}
            updateAll={updateAll}
            showCommunityAvatar={true}
            isDetailPage={false}
            // Vote transaction fields if comment represents a vote
            plus={comment.plus}
            minus={comment.minus}
            amountTotal={comment.amountTotal}
            sum={comment.sum}
            directionPlus={comment.directionPlus}
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

