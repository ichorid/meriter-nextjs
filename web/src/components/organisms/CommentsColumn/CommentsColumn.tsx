'use client';

import React, { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useComments } from '@/shared/hooks/use-comments';
import { useTranslations } from 'next-intl';
import { CommentsList } from '@/lib/comments/components/CommentsList';
import { buildTree } from '@/lib/comments/tree';
import { transformComments } from '@/lib/comments/utils/transform';
import { BrandButton } from '@/components/ui/BrandButton';
import { ArrowLeft, X } from 'lucide-react';

export interface CommentsColumnProps {
  publicationSlug: string;
  communityId: string;
  balance: any;
  wallets: any[];
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
  wallets,
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
  const t = useTranslations('home');
  
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
    async () => {}, // updBalance - mutations handle invalidation
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
    <div className="h-full flex flex-col bg-base-100 border-l border-base-300">
      {/* Header with close/back button and sort toggle */}
      <div className="border-b border-base-300 bg-base-200">
        <div className="flex items-center gap-2 p-4">
          {(showBackButton || onBack) ? (
            <>
              <BrandButton
                variant="ghost"
                size="sm"
                onClick={handleBack}
                leftIcon={<ArrowLeft size={16} />}
                className="dark:text-base-content"
              >
                Back
              </BrandButton>
              <h2 className="text-lg font-semibold flex-1 text-base-content dark:text-base-content">Comments</h2>
              <BrandButton
                variant="ghost"
                size="sm"
                onClick={handleBack}
                leftIcon={<X size={16} />}
                className="dark:text-base-content"
              />
            </>
          ) : (
            <h2 className="text-lg font-semibold flex-1">Comments</h2>
          )}
        </div>
        {/* Sort Toggle */}
        <div className="flex justify-end gap-2 px-4 pb-3">
          <div className="flex gap-1">
            <BrandButton
              variant={sortBy === 'recent' ? 'primary' : 'outline'}
              size="sm"
              onClick={() => setSortBy('recent')}
            >
              {t('sort.recent')}
            </BrandButton>
            <BrandButton
              variant={sortBy === 'voted' ? 'primary' : 'outline'}
              size="sm"
              onClick={() => setSortBy('voted')}
            >
              {t('sort.voted')}
            </BrandButton>
          </div>
        </div>
      </div>

      {/* Comments list with tree navigation */}
      <div className="flex-1 overflow-y-auto p-4">
        {commentTree.length > 0 ? (
          <CommentsList 
            roots={commentTree}
            myId={myId}
            balance={balance}
            wallets={wallets}
            communityId={communityId}
            publicationSlug={publicationSlug}
            activeCommentHook={activeCommentHook}
            activeSlider={activeSlider}
            setActiveSlider={setActiveSlider}
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

