import { useTranslations } from 'next-intl';
import { Comment } from '@/features/comments/components/comment';
import { EmptyState } from '@/components/organisms/EmptyState/EmptyState';
import { sortItems, generateKey } from '../utils';
import type { SortOrder } from '../types';
import { useState, useCallback } from 'react';
import { useQueryClient } from '@tanstack/react-query';

interface CommentsTabProps {
  comments: any[];
  isLoading: boolean;
  sortOrder: SortOrder;
  wallets?: any[];
  myId?: string;
}

export function CommentsTab({
  comments,
  isLoading,
  sortOrder,
  wallets = [],
  myId,
}: CommentsTabProps) {
  const t = useTranslations('home');
  const queryClient = useQueryClient();
  const activeCommentHook = useState<string | null>(null);
  const [activeSlider, setActiveSlider] = useState<string | null>(null);

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
      <div className="flex justify-center items-center h-32">
        <span className="loading loading-spinner loading-lg"></span>
      </div>
    );
  }

  if (comments.length === 0) {
    return (
      <EmptyState
        title={t('empty.comments.title') || 'No Comments'}
        message={
          t('empty.comments.message') || "You haven't written any comments yet."
        }
        icon="💬"
      />
    );
  }

  return (
    <div className="balance-inpublications-list">
      <div className="balance-inpublications-publications">
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
      </div>
    </div>
  );
}

