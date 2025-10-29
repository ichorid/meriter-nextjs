'use client';

import React from 'react';
import { useRouter } from 'next/navigation';
import { Comment } from '@/features/comments/components/comment';
import { useComments } from '@/shared/hooks/use-comments';
import { Button } from '@/components/atoms';

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
    communityId
  );

  const handleBack = () => {
    if (onBack) {
      onBack();
    } else {
      // Default: remove post query param
      router.back();
    }
  };

  return (
    <div className="h-full flex flex-col bg-base-100 border-l border-base-300">
      {/* Header with back button (for mobile) */}
      {(showBackButton || onBack) && (
        <div className="flex items-center gap-2 p-4 border-b border-base-300 bg-base-200">
          <Button
            variant="ghost"
            size="sm"
            onClick={handleBack}
            className="lg:hidden"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            <span className="ml-2">Back</span>
          </Button>
          <h2 className="text-lg font-semibold flex-1">Comments</h2>
        </div>
      )}

      {/* Comments list */}
      <div className="flex-1 overflow-y-auto p-4">
        {comments && comments.length > 0 ? (
          <div className="space-y-4">
            {comments.map((c: any) => (
              <Comment
                key={c._id}
                {...c}
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
            ))}
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

