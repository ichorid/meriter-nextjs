'use client';

import React, { useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { Comment } from '@/features/comments/components/comment';
import { useComments } from '@/shared/hooks/use-comments';
import { Button } from '@/components/atoms';
import type { Comment as ApiComment } from '@/types/api-v1';

export interface CommentsColumnProps {
  publicationSlug: string;
  communityId: string;
  balance: any;
  updBalance: () => Promise<void>;
  wallets: any[];
  updateWalletBalance: (communityId: string, change: number) => void;
  updateAll: () => Promise<void>;
  myId?: string;
  highlightTransactionId?: string;
  activeCommentHook: [string | null, React.Dispatch<React.SetStateAction<string | null>>];
  activeSlider: string | null;
  setActiveSlider: (id: string | null) => void;
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
  updBalance,
  wallets,
  updateWalletBalance,
  updateAll,
  myId,
  highlightTransactionId,
  activeCommentHook,
  activeSlider,
  setActiveSlider,
  activeWithdrawPost,
  setActiveWithdrawPost,
  onBack,
  showBackButton = false,
}) => {
  const router = useRouter();
  
  // Get comments data - useComments hook manages comment state
  // Note: We don't need currentPlus/currentMinus here as this is read-only display
  const {
    comments,
  } = useComments(
    false, // forTransaction
    publicationSlug,
    '', // transactionId
    '', // getCommentsApiPath
    '', // getFreeBalanceApiPath
    balance,
    updBalance,
    0, // plusGiven - not used for display only
    0, // minusGiven - not used for display only
    activeCommentHook,
    true, // onlyPublication - show comments by default
    communityId, // communityId
    wallets // wallets array for balance lookup
  );

  // Transform v1 API comment format to legacy format expected by Comment component
  // Author data is now included in API response via meta.author
  const transformedComments = useMemo(() => {
    if (!comments || !Array.isArray(comments)) return [];
    
    return comments.map((c: ApiComment | any) => {
      // Use author data from API response (meta.author) if available
      const author = c.meta?.author || {};
      
      return {
        _id: c.id || c._id,
        comment: c.content || c.comment || '',
        ts: c.createdAt || c.ts || new Date().toISOString(),
        plus: c.metrics?.upvotes || c.plus || 0,
        minus: c.metrics?.downvotes || c.minus || 0,
        sum: c.metrics?.score || c.sum || 0,
        fromUserTgName: author.name || c.fromUserTgName || 'Unknown',
        fromUserTgId: c.authorId || author.telegramId || c.fromUserTgId,
        fromUserTgUsername: author.username || c.fromUserTgUsername,
        authorPhotoUrl: author.photoUrl || c.authorPhotoUrl,
        // Calculate directionPlus from metrics if not provided
        directionPlus: c.directionPlus ?? ((c.metrics?.score ?? 0) > 0 || ((c.metrics?.upvotes ?? 0) > (c.metrics?.downvotes ?? 0))),
        // Keep other properties that might be useful
        ...c,
      };
    });
  }, [comments]);

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

  return (
    <div className="h-full flex flex-col bg-base-100 border-l border-base-300">
      {/* Header with close/back button */}
      <div className="flex items-center gap-2 p-4 border-b border-base-300 bg-base-200">
        {(showBackButton || onBack) ? (
          <>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleBack}
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
              <span className="ml-2 hidden sm:inline">Back</span>
            </Button>
            <h2 className="text-lg font-semibold flex-1">Comments</h2>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleBack}
              className="hidden lg:flex"
              title="Close comments"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </Button>
          </>
        ) : (
          <h2 className="text-lg font-semibold flex-1">Comments</h2>
        )}
      </div>

      {/* Comments list */}
      <div className="flex-1 overflow-y-auto p-4">
        {transformedComments && transformedComments.length > 0 ? (
          <div className="space-y-4">
            {transformedComments.map((c: any, index: number) => {
              // Use id (v1 API) or _id (legacy) with index fallback to ensure unique key
              const commentKey = c._id || c.id || `comment-${index}`;
              return (
                <Comment
                  key={commentKey}
                  {...c}
                  _id={commentKey}
                  myId={myId}
                  balance={balance}
                  updBalance={updBalance}
                  spaceSlug=""
                  inPublicationSlug={publicationSlug}
                  activeCommentHook={activeCommentHook}
                  activeSlider={activeSlider}
                  setActiveSlider={setActiveSlider}
                  highlightTransactionId={highlightTransactionId}
                  wallets={wallets}
                  updateWalletBalance={updateWalletBalance}
                  activeWithdrawPost={activeWithdrawPost}
                  setActiveWithdrawPost={setActiveWithdrawPost}
                  updateAll={updateAll}
                  tgChatId={communityId}
                  showCommunityAvatar={false}
                  isDetailPage={false}
                />
              );
            })}
          </div>
        ) : (
          <div className="flex items-center justify-center h-full text-base-content/60">
            <p>No comments yet</p>
          </div>
        )}
      </div>
    </div>
  );
};

