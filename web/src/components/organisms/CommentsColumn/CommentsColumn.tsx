'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useComments } from '@/shared/hooks/use-comments';
import { useTranslations } from 'next-intl';
import { Comment } from '@features/comments/components/comment';
import { Button } from '@/components/ui/shadcn/button';
import { SimpleStickyHeader } from '@/components/organisms/ContextTopBar/ContextTopBar';
import { SortToggle } from '@/components/ui/SortToggle';
import { useUIStore } from '@/stores/ui.store';
import { useCommunity } from '@/hooks/api';

export interface CommentsColumnProps {
  publicationSlug: string;
  communityId: string;
  balance: any;
  wallets: any[];
  myId?: string;
  highlightTransactionId?: string;
  activeCommentHook: [string | null, React.Dispatch<React.SetStateAction<string | null>>];
  activeWithdrawPost: string | null;
  setActiveWithdrawPost: (id: string | null) => void;
  onBack?: () => void;
  showBackButton?: boolean;
}

/**
 * Comments column component that displays comments for a selected publication
 * Renders in a separate column on desktop, or in a drawer/modal on mobile
 */
export const CommentsColumn: React.FC<CommentsColumnProps> = ({
  publicationSlug,
  communityId,
  balance,
  wallets,
  myId,
  highlightTransactionId,
  activeCommentHook,
  activeWithdrawPost,
  setActiveWithdrawPost,
  onBack,
  showBackButton = false,
}) => {
  const router = useRouter();
  const t = useTranslations('common');
  const tCommon = useTranslations('common');

  // Sort state for comments
  const [sortBy, setSortBy] = useState<'recent' | 'voted'>('recent');

  // Get community data for voting mode determination
  const { data: community } = useCommunity(communityId);

  // Get comments data - useComments hook manages comment state
  // API provides enriched data (author, vote transaction fields)
  const {
    comments,
  } = useComments(
    false, // forTransaction
    publicationSlug,
    '', // transactionId
    balance,
    async () => { }, // updBalance - mutations handle invalidation
    0, // plusGiven - not used for display only
    0, // minusGiven - not used for display only
    activeCommentHook,
    true, // onlyPublication - show comments by default
    communityId, // communityId
    wallets, // wallets array for balance lookup
    sortBy // sort preference
  );

  const handleBack = () => {
    if (onBack) {
      onBack();
    } else {
      // Default: remove post query param
      const params = new URLSearchParams(window.location.search);
      params.delete('post');
      router.push(window.location.pathname + (params.toString() ? `?${params.toString()}` : ''));
    }
  };

  const handleAddComment = () => {
    // Regular and team communities: allow spending daily quota first, then overflow into wallet merits
    // Special groups preserve their restrictions.
    const typeTag = community?.typeTag;
    const mode: 'standard' | 'wallet-only' | 'quota-only' =
      typeTag === 'future-vision'
        ? 'wallet-only'
        : typeTag === 'marathon-of-good'
          ? 'quota-only'
          : 'standard';
    useUIStore.getState().openVotingPopup(publicationSlug, 'publication', mode);
  };

  // Check if user has already voted (has a comment/vote)
  const hasUserVoted = React.useMemo(() => {
    if (!myId || !comments) return false;
    return comments.some((c: any) => c.authorId === myId || c.meta?.author?.id === myId);
  }, [myId, comments]);

  const addCommentButton = hasUserVoted ? null : (
    <div className="mb-6 w-full">
      <Button
        variant="outline"
        onClick={handleAddComment}
        className="w-full"
      >
        {t('vote')}
      </Button>
    </div>
  );

  return (
    <div className="h-full flex flex-col bg-base-100 border-l border-base-300 overflow-hidden w-full">
      {/* Header with close/back button and sort toggle */}
      <SimpleStickyHeader
        title="Голоса"
        showBack={!!(showBackButton || onBack)}
        onBack={handleBack}
        rightAction={
          <SortToggle
            value={sortBy}
            onChange={setSortBy}
            compact={true}
          />
        }
        className="border-b border-base-300"
        asStickyHeader={false}
        showScrollToTop={true}
      />

      {/* Comments list */}
      <div className="flex-1 overflow-y-auto overflow-x-hidden p-4 min-h-0">
        {comments && comments.length > 0 ? (
          <>
            {/* Add a comment button */}
            {addCommentButton}

            {/* Comments List */}
            <div className="flex flex-col gap-3">
              {comments.map((c: any, index: number) => (
                <Comment
                  key={c.id || c._id || `comment-${index}`}
                  {...c}
                  _id={c._id || c.id || `comment-${index}`}
                  balance={balance}
                  updBalance={() => { }}
                  spaceSlug=""
                  inPublicationSlug={publicationSlug}
                  activeCommentHook={activeCommentHook}
                  myId={myId}
                  highlightTransactionId={highlightTransactionId}
                  wallets={wallets}
                  updateWalletBalance={() => { }}
                  updateAll={() => { }}
                  communityId={communityId}
                  isDetailPage={false}
                />
              ))}
            </div>
          </>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center">
            {/* Add a comment button (shown even when no comments) */}
            {addCommentButton}
            <span className="text-base-content/60">{t('noVotesYet')}</span>
          </div>
        )}
      </div>
    </div>
  );
};

