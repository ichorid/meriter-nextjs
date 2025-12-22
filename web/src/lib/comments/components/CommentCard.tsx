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
import { useFeaturesConfig } from '@/hooks/useConfig';
import { useUpdateComment, useDeleteComment } from '@/hooks/api/useComments';
import { ResourcePermissions } from '@/types/api-v1';
import { CommentEditModal } from '@/components/organisms/CommentEditModal/CommentEditModal';
import { DeleteConfirmationModal } from '@/components/organisms/DeleteConfirmationModal/DeleteConfirmationModal';
import { Edit, Trash2 } from 'lucide-react';
import { useToastStore } from '@/shared/stores/toast.store';

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
  activeWithdrawPost,
  setActiveWithdrawPost,
  highlightTransactionId,
  showCommunityAvatar = false,
  isDetailPage = false,
}: CommentCardProps) {
  const t = useTranslations('comments');
  const tShared = useTranslations('shared');
  const features = useFeaturesConfig();
  const enableCommentVoting = features.commentVoting;
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
  
  // Use API permissions instead of calculating on frontend
  const canVoteFromApi = originalComment.permissions?.canVote ?? false;
  const voteDisabledReasonFromApi = originalComment.permissions?.voteDisabledReason;
  
  // Override reason if comment voting is disabled via feature flag
  const canVote = enableCommentVoting ? canVoteFromApi : false;
  const voteDisabledReason = enableCommentVoting 
    ? voteDisabledReasonFromApi 
    : 'voteDisabled.commentVotingDisabled';
  
  // Withdrawal state management
  const withdrawableBalance = originalComment.metrics?.score ?? 0;
  const totalWithdrawn = (originalComment as any).withdrawals?.totalWithdrawn || 0;
  const availableForWithdrawal = Math.max(0, withdrawableBalance - totalWithdrawn);
  const [optimisticSum, setOptimisticSum] = useState(withdrawableBalance);
  
  useEffect(() => {
    const currentSum = originalComment.metrics?.score ?? 0;
    setOptimisticSum(currentSum);
  }, [originalComment.metrics?.score]);
  
  // Fetch community info
  const { data: communityInfo } = useCommunity(communityId || '');
  
  // Withdrawals are now enabled
  const isSpecialGroup = communityInfo?.typeTag === 'marathon-of-good' || communityInfo?.typeTag === 'future-vision';
  
  const currentBalance =
    (Array.isArray(wallets) &&
      wallets.find((w) => w.communityId === communityId)?.balance) ||
    0;
  
  // State for comment details popup
  const [showDetailsPopup, setShowDetailsPopup] = useState(false);
  
  // State for edit/delete modals
  const [showEditModal, setShowEditModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  
  // Use API permissions instead of calculating on frontend
  const canEdit = originalComment.permissions?.canEdit ?? false;
  const canDelete = originalComment.permissions?.canDelete ?? false;
  
  // Determine if edit/delete is enabled (not disabled by reason)
  const canEditEnabled = canEdit && !originalComment.permissions?.editDisabledReason;
  const canDeleteEnabled = canDelete && !originalComment.permissions?.deleteDisabledReason;
  
  // Show edit button if user can edit, disable if canEdit but not canEditEnabled
  const showEditButton = canEdit;
  const editButtonDisabled = !!(canEdit && !canEditEnabled);
  
  // Show delete button if user can delete, disable if canDelete but not canDeleteEnabled
  const deleteButtonDisabled = !!(canDelete && !canDeleteEnabled);
  
  // Mutations
  const updateComment = useUpdateComment();
  const deleteComment = useDeleteComment();
  const addToast = useToastStore((state) => state.addToast);
  
  // Handlers
  const handleEdit = async (newContent: string) => {
    try {
      await updateComment.mutateAsync({
        id: node.id,
        data: { content: newContent },
      });
      setShowEditModal(false);
      addToast('Comment updated successfully', 'success');
    } catch (error: any) {
      addToast(error?.message || 'Failed to update comment', 'error');
    }
  };
  
  const handleDelete = async () => {
    try {
      await deleteComment.mutateAsync(node.id);
      setShowDeleteModal(false);
      addToast('Comment deleted successfully', 'success');
    } catch (error: any) {
      addToast(error?.message || 'Failed to delete comment', 'error');
    }
  };
  
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

  // Calculate withdrawal amounts
  const maxWithdrawAmount = isAuthor
    ? Math.floor(10 * availableForWithdrawal) / 10
    : 0;
  const maxTopUpAmount = isAuthor
    ? Math.floor(10 * currentBalance) / 10
    : 0;

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
      className="relative w-full overflow-hidden"
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
          "comment-vote-wrapper transition-all duration-300 mb-4 relative z-10 w-full overflow-hidden",
          { 'ring-2 ring-warning': isChainMode },
          commentUnderReply ? "scale-100 opacity-100" : "scale-100 opacity-100",
          highlightTransactionId === node.id ? "highlight" : ""
        )}
        data-comment-id={node.id}
      >
      {/* Action buttons - positioned in top right */}
      <div className="absolute top-2 right-2 z-10 flex items-center gap-1">
        {(showEditButton || canDelete) && (
          <>
            {showEditButton && (
              <Button
                variant="ghost"
                size="xs"
                className={`btn-sm ${editButtonDisabled ? 'opacity-30 cursor-not-allowed' : 'opacity-60 hover:opacity-100'}`}
                onClick={(e: React.MouseEvent) => {
                  e.stopPropagation();
                  if (!editButtonDisabled) {
                    setShowEditModal(true);
                  }
                }}
                disabled={editButtonDisabled}
                title={editButtonDisabled && originalComment.permissions?.editDisabledReason 
                  ? tShared(originalComment.permissions.editDisabledReason) 
                  : 'Edit comment'}
              >
                <Edit size={14} />
              </Button>
            )}
            {canDelete && (
              <Button
                variant="ghost"
                size="xs"
                className={`btn-sm ${deleteButtonDisabled ? 'opacity-30 cursor-not-allowed' : 'opacity-60 hover:opacity-100'} text-error hover:text-error`}
                onClick={(e: React.MouseEvent) => {
                  e.stopPropagation();
                  if (!deleteButtonDisabled) {
                    setShowDeleteModal(true);
                  }
                }}
                disabled={deleteButtonDisabled}
                title={deleteButtonDisabled && originalComment.permissions?.deleteDisabledReason 
                  ? tShared(originalComment.permissions.deleteDisabledReason) 
                  : 'Delete comment'}
              >
                <Trash2 size={14} />
              </Button>
            )}
          </>
        )}
        <Button
          variant="ghost"
          size="xs"
          className="btn-sm opacity-60 hover:opacity-100"
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
      </div>
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
        images={(originalComment as any).images || []}
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
        communityId={communityId}
        publicationSlug={publicationSlug}
        commentId={node.id}
        bottom={
          (isAuthor && maxWithdrawAmount > 0) ? ( // Show withdraw button if user is author and has withdrawable balance
            <BarWithdraw
              balance={maxWithdrawAmount}
              score={commentScore}
              totalVotes={totalWithdrawn > 0 ? commentScore + totalWithdrawn : undefined}
              onWithdraw={() => {
                useUIStore.getState().openWithdrawPopup(
                  node.id,
                  'comment',
                  maxWithdrawAmount,
                  maxTopUpAmount
                );
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
          ) : enableCommentVoting ? (
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
              disabledReason={voteDisabledReason}
            />
          ) : (
            // Vote button and counter are hidden - comments cannot be voted on (feature flag disabled)
            // Only show comment count for navigation if there are replies
            (node.children.length || replyComments?.length || 0) > 0 ? (
              <div className="flex items-center justify-start pt-3 border-t border-base-content/5">
                <button 
                  className="flex items-center gap-1.5 text-base-content/40 hover:text-base-content/60 transition-colors"
                  onClick={(e) => {
                    e.stopPropagation();
                    onNavigate();
                  }}
                >
                  <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
                  </svg>
                  <span className="text-xs font-medium">{node.children.length || replyComments?.length || 0}</span>
                </button>
              </div>
            ) : null
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
        authorId={commentAuthorId}
        beneficiaryId={beneficiaryMeta?.id}
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
      
      {/* Edit Modal */}
      <CommentEditModal
        isOpen={showEditModal}
        onClose={() => setShowEditModal(false)}
        onSave={handleEdit}
        initialContent={commentText}
        isLoading={updateComment.isPending}
      />
      
      {/* Delete Confirmation Modal */}
      <DeleteConfirmationModal
        isOpen={showDeleteModal}
        onClose={() => setShowDeleteModal(false)}
        onConfirm={handleDelete}
        itemType="comment"
        isLoading={deleteComment.isPending}
      />
    </div>
  );
}
