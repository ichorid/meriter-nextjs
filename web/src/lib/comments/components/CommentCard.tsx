'use client';

import { useState, useEffect } from 'react';
import { useTranslations } from 'next-intl';
import { useCommunity } from '@/hooks/api';
import { useComments } from '@/shared/hooks/use-comments';
import { useUIStore } from '@/stores/ui.store';
import { CardCommentVote } from '@/shared/components/card-comment-vote';
import { BarVoteUnified } from '@/shared/components/bar-vote-unified';
import { BarWithdraw } from '@/shared/components/bar-withdraw';
import { CommentDetailsPopup } from '@/shared/components/comment-details-popup';
import { classList } from '@/shared/lib/classList';
import { Button } from '@/components/atoms';
import type { TreeNode, FlatItem } from '../types';
import { getSubtreeSize } from '../tree';
import { getAvatarUrl } from '../utils/avatar';
import { calculatePadding } from '../utils/connections';
import { useCommentVoteDisplay } from '@/features/comments/hooks/useCommentVoteDisplay';
import { useCommentRecipient } from '@/features/comments/hooks/useCommentRecipient';
import { useCommentWithdrawal } from '@/features/comments/hooks/useCommentWithdrawal';
import { useCanVote } from '@/hooks/useCanVote';

interface CommentCardProps {
  node: TreeNode;
  depth: number;
  onNavigate: () => void;
  isChainMode?: boolean;
  connectionMetadata: FlatItem;
  maxSiblingGroups: Map<number, number>;
  // Props from CommentsColumn
  myId?: string;
  balance?: any;
  wallets?: any[];
  communityId?: string;
  publicationSlug?: string;
  activeCommentHook?: [string | null, React.Dispatch<React.SetStateAction<string | null>>];
  activeSlider?: string | null;
  setActiveSlider?: (id: string | null) => void;
  activeWithdrawPost?: string | null;
  setActiveWithdrawPost?: (id: string | null) => void;
  highlightTransactionId?: string;
  showCommunityAvatar?: boolean;
  isDetailPage?: boolean;
}

/**
 * CommentCard - The card component displayed for each item in the tree
 * 
 * Uses CardCommentVote with all interactive features (vote, withdraw, etc.)
 * while preserving tree navigation functionality.
 */
export function CommentCard({
  node,
  depth,
  onNavigate,
  isChainMode = false,
  connectionMetadata,
  maxSiblingGroups,
  myId,
  balance,
  wallets = [],
  communityId,
  publicationSlug,
  activeCommentHook,
  activeSlider,
  setActiveSlider,
  activeWithdrawPost,
  setActiveWithdrawPost,
  highlightTransactionId,
  showCommunityAvatar = false,
  isDetailPage = false,
}: CommentCardProps) {
  const t = useTranslations('comments');
  const originalComment = node.originalComment;
  const authorMeta = originalComment.meta?.author;
  const authorName = authorMeta?.name || 'Unknown';
  const commentAuthorId = originalComment.authorId || authorMeta?.id || '';
  const commentText = node.content || '';
  const commentTimestamp = node.createdAt || '';
  
  // API provides vote transaction fields when comment represents a vote
  const hasVoteTransactionData = (originalComment as any).plus !== undefined || 
                                 (originalComment as any).minus !== undefined || 
                                 (originalComment as any).amountTotal !== undefined;
  const plus = (originalComment as any).plus;
  const minus = (originalComment as any).minus;
  const amountTotal = (originalComment as any).amountTotal;
  const directionPlus = (originalComment as any).directionPlus;
  const sum = (originalComment as any).sum;
  
  // For UI display of comment stats, always use metrics (accumulated votes on the comment)
  const commentUpvotes = originalComment.metrics?.upvotes ?? 0;
  const commentDownvotes = originalComment.metrics?.downvotes ?? 0;
  const commentScore = originalComment.metrics?.score ?? 0;
  const displaySum = sum ?? commentScore;
  
  // Check if current user is the author
  const isAuthor = myId === commentAuthorId;
  
  // Check if there's a beneficiary and it's different from the author
  const beneficiaryMeta = (originalComment.meta as any)?.beneficiary;
  const hasBeneficiary = beneficiaryMeta && beneficiaryMeta.id !== commentAuthorId;
  const isBeneficiary = hasBeneficiary && myId === beneficiaryMeta?.id;
  
  // Check if user can vote on this comment based on community rules
  const canVote = useCanVote(
    node.id,
    'comment',
    communityId,
    commentAuthorId,
    isAuthor,
    isBeneficiary,
    hasBeneficiary,
    false // Comments are not projects
  );
  
  // Withdrawal state management
  const withdrawableBalance = originalComment.metrics?.score ?? 0;
  const [optimisticSum, setOptimisticSum] = useState(withdrawableBalance);
  
  useEffect(() => {
    const currentSum = originalComment.metrics?.score ?? 0;
    setOptimisticSum(currentSum);
  }, [originalComment.metrics?.score]);
  
  // Fetch community info
  const { data: communityInfo } = useCommunity(communityId || '');
  
  // Check if community is special group (withdrawals disabled)
  const isSpecialGroup = communityInfo?.typeTag === 'marathon-of-good' || communityInfo?.typeTag === 'future-vision';
  
  const currentBalance =
    (Array.isArray(wallets) &&
      wallets.find((w) => w.communityId === communityId)?.balance) ||
    0;
  
  // State for comment details popup
  const [showDetailsPopup, setShowDetailsPopup] = useState(false);
  
  // Calculate direction
  const calculatedDirectionPlus = directionPlus ?? 
    (amountTotal !== undefined ? (amountTotal > 0 || commentUpvotes > 0) : 
     ((commentUpvotes > commentDownvotes) || (displaySum > 0)));
  
  // Use extracted hooks for vote display, recipient, and withdrawal
  const voteDisplay = useCommentVoteDisplay({
    amountTotal,
    hasVoteTransactionData,
    displaySum,
    commentUpvotes,
    commentDownvotes,
    directionPlus: calculatedDirectionPlus,
    optimisticSum,
    withdrawableBalance,
  });

  const { recipientName, recipientAvatar, commentDetails } = useCommentRecipient({
    commentId: node.id,
    showDetailsPopup,
    beneficiaryMeta,
  });

  const { maxWithdrawAmount, maxTopUpAmount } = useCommentWithdrawal({
    isAuthor,
    withdrawableBalance,
    currentBalance,
  });

  const voteType = voteDisplay.voteType;
  const currencyIcon = communityInfo?.settings?.iconUrl;
  
  // Get replies count
  const {
    comments: replyComments,
  } = useComments(
    true,
    publicationSlug || '',
    node.id,
    balance,
    async () => {},
    commentUpvotes,
    commentDownvotes,
    activeCommentHook || [null, () => {}],
    false,
    communityId,
    wallets
  );
  
  const commentUnderReply = activeCommentHook?.[0] === node.id;
  const avatarUrl = authorMeta?.photoUrl || '';
  
  // Connection line metadata
  const paddingLeft = calculatePadding(depth, maxSiblingGroups);
  const {
    parentId,
    hasSiblings,
    isFirstSibling,
    isLastSibling,
    hasChildren,
  } = connectionMetadata;

  // Determine which lines to draw
  const needsParentChildLine = parentId !== null;
  const needsSiblingVerticalLine = hasSiblings;
  const needsHorizontalFork = hasSiblings;
  const needsVerticalLineDown = hasChildren || !isLastSibling;
  
  return (
    <div 
      className="relative"
      style={{ paddingLeft: `${paddingLeft}px` }}
    >
      {/* Connection lines */}
      {needsHorizontalFork && (
        <div
          className="absolute left-0 top-1/2 w-[20px] h-[1px] -translate-y-1/2 bg-base-300"
          style={{ left: `${paddingLeft - 20}px` }}
        />
      )}
      
      {needsSiblingVerticalLine && (
        <div
          className={classList(
            "absolute left-0 w-[1px] bg-base-300",
            isFirstSibling ? "top-1/2" : "-top-[12px]",
            isLastSibling ? "bottom-1/2" : "-bottom-[12px]"
          )}
          style={{ 
            left: `${paddingLeft - 20}px`,
          }}
        />
      )}

      {needsParentChildLine && !hasSiblings && (
        <div
          className="absolute left-0 -top-[12px] w-[1px] bg-base-300"
          style={{ 
            left: `${paddingLeft - 20}px`,
            height: 'calc(50% + 12px)',
          }}
        />
      )}

      {needsVerticalLineDown && (
        <div
          className={classList(
            "absolute left-0 w-[1px] bg-base-300",
            hasSiblings ? "top-1/2 -bottom-[12px]" : "top-1/2 -bottom-[12px]"
          )}
          style={{ left: `${paddingLeft - 20}px` }}
        />
      )}

      <div
        className={classList(
          "comment-vote-wrapper transition-all duration-300 mb-4 relative z-10",
          { 'ring-2 ring-warning': isChainMode },
          commentUnderReply ? "scale-100 opacity-100" : 
          activeSlider && activeSlider !== node.id ? "scale-95 opacity-60" : "scale-100 opacity-100",
          highlightTransactionId === node.id ? "highlight" : ""
        )}
        data-comment-id={node.id}
        onClick={(e) => {
          if (
            activeSlider === node.id &&
            !(e.target as any)?.className?.match("clickable")
          ) {
            setActiveSlider && setActiveSlider(null);
          }
        }}
      >
      {/* Details button - positioned in top right */}
      <Button
        variant="ghost"
        size="xs"
        className="absolute top-2 right-2 z-10 btn-sm opacity-60 hover:opacity-100"
        onClick={(e: React.MouseEvent) => {
          e.stopPropagation();
          setShowDetailsPopup(true);
        }}
        title="View details"
      >
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      </Button>
      <CardCommentVote
        title={authorName}
        subtitle={new Date(commentTimestamp || '').toLocaleString()}
        content={commentText}
        rate={voteDisplay.rate}
        currencyIcon={currencyIcon}
        avatarUrl={avatarUrl}
        voteType={voteType}
        amountFree={voteDisplay.amountFree}
        amountWallet={voteDisplay.amountWallet}
        beneficiaryName={recipientName}
        beneficiaryAvatarUrl={recipientAvatar}
        upvotes={voteDisplay.displayUpvotes}
        downvotes={voteDisplay.displayDownvotes}
        onClick={() => {
          onNavigate();
        }}
        onAvatarUrlNotFound={() => {
          const fallbackUrl = authorMeta?.photoUrl;
          if (fallbackUrl && fallbackUrl !== avatarUrl) {
            const imgElement = document.querySelector(`img[src="${avatarUrl}"]`) as HTMLImageElement;
            if (imgElement) imgElement.src = fallbackUrl;
          }
        }}
        bottom={
          false ? ( // Withdrawals disabled - merits are automatically credited on upvote
            <BarWithdraw
              balance={maxWithdrawAmount}
              onWithdraw={() => {
                // Withdrawals disabled
              }}
              onTopup={() => {
                // Vote-comments can't be topped up (they're synthetic)
                // Only allow topup on actual comments
                if (node.id.startsWith('vote_')) {
                  const { useToastStore } = require('@/shared/stores/toast.store');
                  useToastStore.getState().addToast(
                    'Cannot top up votes',
                    'error'
                  );
                  return;
                }
                useUIStore.getState().openWithdrawPopup(
                  node.id,
                  'comment-topup',
                  maxWithdrawAmount,
                  maxTopUpAmount
                );
              }}
              commentCount={replyComments?.length || 0}
              onCommentClick={() => {
                // For tree navigation, clicking comment count navigates to show replies
                onNavigate();
              }}
            />
          ) : (
            <BarVoteUnified
              score={commentScore}
              onVoteClick={() => {
                // If this is a vote-comment (ID starts with 'vote_'), pass the vote-comment ID
                // The backend will handle creating the proper hierarchy
                const commentIdToVoteOn = node.id; // Use the node ID directly (includes vote_ prefix if applicable)
                // Set voting mode based on community type
                let mode: 'standard' | 'wallet-only' | 'quota-only' = 'quota-only';
                if (communityInfo?.typeTag === 'future-vision') {
                  // Future Vision: wallet-only (M), no quota (Q)
                  mode = 'wallet-only';
                } else if (communityInfo?.typeTag === 'marathon-of-good') {
                  // Marathon-of-Good: quota-only (Q), no wallet (M)
                  mode = 'quota-only';
                } else if (communityInfo?.typeTag === 'team') {
                  // Team groups: quota-only (Q), no wallet (M)
                  mode = 'quota-only';
                } else {
                  // Non-special groups: quota-only
                  mode = 'quota-only';
                }
                useUIStore.getState().openVotingPopup(commentIdToVoteOn, 'comment', mode);
              }}
              isAuthor={isAuthor}
              isBeneficiary={isBeneficiary}
              hasBeneficiary={hasBeneficiary}
              commentCount={node.children.length || replyComments?.length || 0}
              onCommentClick={() => {
                // For tree navigation, clicking comment count navigates to show replies
                onNavigate();
              }}
              canVote={canVote}
            />
          )
        }
        showCommunityAvatar={showCommunityAvatar}
        communityAvatarUrl={communityInfo?.avatarUrl}
        communityName={communityInfo?.name}
        communityIconUrl={communityInfo?.settings?.iconUrl}
        onCommunityClick={() => {
          if (!communityId) return;
          
          if (communityInfo?.needsSetup) {
            if (communityInfo?.isAdmin) {
              window.location.href = `/meriter/communities/${communityId}/settings`;
            } else {
              const { useToastStore } = require('@/shared/stores/toast.store');
              useToastStore.getState().addToast(
                'Community setup pending, your admin will set it up soon',
                'info'
              );
            }
          } else {
            window.location.href = `/meriter/communities/${communityId}`;
          }
        }}
        communityNeedsSetup={communityInfo?.needsSetup}
        communityIsAdmin={communityInfo?.isAdmin}
      />
      </div>
      <CommentDetailsPopup
        isOpen={showDetailsPopup}
        onClose={() => setShowDetailsPopup(false)}
        rate={commentDetails?.voteTransaction ? voteDisplay.rate : voteDisplay.rate}
        currencyIcon={commentDetails?.community?.iconUrl || currencyIcon}
        amountWallet={commentDetails?.voteTransaction 
          ? Math.abs(commentDetails.voteTransaction.sum) 
          : Math.abs((optimisticSum ?? withdrawableBalance) || 0)}
        amountFree={commentDetails?.voteTransaction && commentDetails.voteTransaction.amountTotal !== undefined
          ? Math.abs(commentDetails.voteTransaction.amountTotal) - Math.abs(commentDetails.voteTransaction.sum)
          : (hasVoteTransactionData && amountTotal !== undefined 
            ? Math.abs(amountTotal) - Math.abs((optimisticSum ?? withdrawableBalance) || 0) 
            : 0)}
        upvotes={commentDetails?.metrics?.upvotes ?? commentUpvotes}
        downvotes={commentDetails?.metrics?.downvotes ?? commentDownvotes}
        isUpvote={commentDetails?.voteTransaction?.directionPlus ?? calculatedDirectionPlus}
        authorName={commentDetails?.author?.name ?? authorName}
        authorAvatar={commentDetails?.author?.photoUrl ?? avatarUrl}
        commentContent={commentDetails?.comment?.content ?? commentText}
        timestamp={commentDetails?.comment?.createdAt ?? commentTimestamp}
        communityName={commentDetails?.community?.name ?? communityInfo?.name}
        communityAvatar={commentDetails?.community?.avatarUrl ?? communityInfo?.avatarUrl}
        beneficiaryName={commentDetails?.beneficiary?.name ?? recipientName}
        beneficiaryAvatar={commentDetails?.beneficiary?.photoUrl ?? recipientAvatar}
        isVoteTransaction={!!commentDetails?.voteTransaction || hasVoteTransactionData}
        totalScore={commentDetails?.metrics?.score ?? displaySum}
        totalReceived={commentDetails?.metrics?.totalReceived}
        totalWithdrawn={commentDetails?.withdrawals?.totalWithdrawn}
      />
    </div>
  );
}
