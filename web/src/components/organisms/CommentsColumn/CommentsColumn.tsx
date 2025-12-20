'use client';

import React, { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useComments } from '@/shared/hooks/use-comments';
import { useTranslations } from 'next-intl';
import { CommentsList } from '@/lib/comments/components/CommentsList';
import { buildTree } from '@/lib/comments/tree';
import { transformComments } from '@/lib/comments/utils/transform';
import { BrandButton } from '@/components/ui/BrandButton';
import { SimpleStickyHeader } from '@/components/organisms/ContextTopBar/ContextTopBar';
import { SortToggle } from '@/components/ui/SortToggle';

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
  const t = useTranslations('home');
  const tCommon = useTranslations('common');

  // Sort state for comments
  const [sortBy, setSortBy] = useState<'recent' | 'voted'>('recent');

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

  // Transform Meriter comments to template format and build tree
  const commentTree = useMemo(() => {
    if (!comments || comments.length === 0) {
      return [];
    }
    // Transform comments from Meriter format to template format
    const transformedComments = transformComments(comments as any);

    // Build tree structure from flat list
    const tree = buildTree(transformedComments);
    return tree;
  }, [comments]);

  return (
    <div className="h-full flex flex-col bg-base-100 border-l border-base-300 overflow-hidden w-full">
      {/* Header with close/back button and sort toggle */}
      <SimpleStickyHeader
        title={tCommon('comments')}
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
      />

      {/* Comments list with tree navigation */}
      <div className="flex-1 overflow-y-auto overflow-x-hidden p-4 min-h-0">
        {commentTree.length > 0 ? (
          <CommentsList
            roots={commentTree}
            myId={myId}
            balance={balance}
            wallets={wallets}
            communityId={communityId}
            publicationSlug={publicationSlug}
            activeCommentHook={activeCommentHook}
            activeWithdrawPost={activeWithdrawPost}
            setActiveWithdrawPost={setActiveWithdrawPost}
            highlightTransactionId={highlightTransactionId}
            showCommunityAvatar={false}
            isDetailPage={false}
          />
        ) : (
          <div className="flex-1 flex items-center justify-center">
            <span className="text-base-content/60">No comments yet</span>
          </div>
        )}
      </div>
    </div>
  );
};

