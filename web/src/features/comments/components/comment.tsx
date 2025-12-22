'use client';

import { useComments } from "../hooks/use-comments";
import { CardCommentVote } from "@shared/components/card-comment-vote";
import { BarVoteUnified } from "@shared/components/bar-vote-unified";
import { BarWithdraw } from "@shared/components/bar-withdraw";
import { useUIStore } from "@/stores/ui.store";
import { classList } from "@lib/classList";
import { useState, useEffect } from "react";
import { useTranslations } from 'next-intl';
import { useCommunity } from '@/hooks/api';
import { CommentDetailsPopup } from "@shared/components/comment-details-popup";
import { useCommentVoteDisplay } from '../hooks/useCommentVoteDisplay';
import { useCommentRecipient } from '../hooks/useCommentRecipient';
import { useCommentWithdrawal } from '../hooks/useCommentWithdrawal';
import { useFeaturesConfig } from '@/hooks/useConfig';
import { ResourcePermissions } from '@/types/api-v1';

interface CommentProps {
    _id: string;
    spaceSlug?: string;
    balance?: any;
    updBalance?: any;
    plus?: number;
    minus?: number;
    ts?: string;
    comment?: string;
    directionPlus?: boolean;
    reason?: string;
    amountTotal?: number;
    communityId?: string; // Internal community ID (required)
    // V1 API format
    meta?: {
        author?: {
            id: string;
            name: string;
            username?: string;
            photoUrl?: string;
        };
        beneficiary?: {
            id: string;
            name: string;
            username?: string;
            photoUrl?: string;
        };
    };
    authorId?: string;
    metrics?: {
        upvotes: number;
        downvotes: number;
        score: number;
    };
    content?: string;
    createdAt?: string;
    sum?: number;
    [key: string]: any;
}

export const Comment: React.FC<CommentProps> = ({
    _id,
    spaceSlug,
    balance,
    updBalance,
    plus,
    minus,
    ts,
    comment,
    directionPlus,
    reason,
    amountTotal,
    inPublicationSlug,
    activeCommentHook,
    myId,
    highlightTransactionId,
    forTransactionId,
    // New props for author withdraw functionality
    wallets,
    updateWalletBalance,
    updateAll,
    sum,
    currency,
    inMerits,
    communityId,
    showCommunityAvatar,
    isDetailPage,
    // V1 API format
    meta,
    authorId,
    metrics,
    content,
    createdAt,
    ...rest
}) => {
    const t = useTranslations('comments');
    const features = useFeaturesConfig();
    const enableCommentVoting = features.commentVoting;
    
    // Use API data directly - no fallbacks
    const authorMeta = meta?.author;
    const authorName = authorMeta?.name || 'Unknown';
    const commentAuthorId = authorId || authorMeta?.id || '';
    const commentText = content || comment || '';
    const commentTimestamp = createdAt || ts || '';
    
    // API provides vote transaction fields (plus, minus, amountTotal) when comment represents a vote
    const hasVoteTransactionData = plus !== undefined || minus !== undefined || amountTotal !== undefined;
    // For UI display of comment stats, always use metrics (accumulated votes on the comment)
    const commentUpvotes = metrics?.upvotes ?? 0;
    const commentDownvotes = metrics?.downvotes ?? 0;
    const commentScore = metrics?.score ?? 0;
    // Sum from API is used only for displaying transaction header when present
    const displaySum = sum ?? commentScore;
    
    // Check if current user is the author
    const isAuthor = myId === commentAuthorId;
    
    // Check if there's a beneficiary and it's different from the author
    const beneficiaryMeta = meta?.beneficiary;
    const hasBeneficiary = beneficiaryMeta && beneficiaryMeta.id !== commentAuthorId;
    const isBeneficiary = hasBeneficiary && myId === beneficiaryMeta?.id;
    
    // Withdrawal state management (for author's own comments)
    // IMPORTANT: For withdrawal, we only use metrics.score (votes cast ON the comment)
    // NOT sum from vote transaction data (which is the vote amount, not withdrawable)
    // Vote transaction comments can't withdraw the vote amount - only votes cast on the comment itself
    const withdrawableBalance = metrics?.score ?? 0; // Only use metrics.score for withdrawal
    const [optimisticSum, setOptimisticSum] = useState(withdrawableBalance);
    
    useEffect(() => {
        // For withdrawal, only use metrics.score (votes cast on the comment itself)
        // Don't use sum from vote transaction data
        const currentSum = metrics?.score ?? 0;
        setOptimisticSum(currentSum);
    }, [metrics?.score]);
    
    // Fetch community info once (consolidated from two calls)
    const { data: communityInfo } = useCommunity(communityId || '');
    
    const currentBalance =
        (Array.isArray(wallets) &&
            wallets.find((w) => w.communityId === communityId)
                ?.balance) ||
        0;
    const [showselector, setShowselector] = useState(false);
    
    // State for comment details popup
    const [showDetailsPopup, setShowDetailsPopup] = useState(false);
    
    // Rate conversion no longer needed with v1 API - currencies are normalized
    const rate = 1;
    
    // API provides directionPlus for vote transaction comments
    // Calculate from vote data if available, otherwise infer from metrics
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
        commentId: _id,
        showDetailsPopup,
        beneficiaryMeta,
    });

    const { maxWithdrawAmount, maxTopUpAmount } = useCommentWithdrawal({
        isAuthor,
        withdrawableBalance,
        currentBalance,
    });

    const totalWithdrawn =
        (rest as { withdrawals?: { totalWithdrawn?: number } }).withdrawals
            ?.totalWithdrawn ?? 0;
    
    // Check if community is special group (withdrawals disabled)
    const isSpecialGroup = communityInfo?.typeTag === 'marathon-of-good' || communityInfo?.typeTag === 'future-vision';
    
    // Use API permissions instead of calculating on frontend
    const canVoteFromApi = (rest as any).permissions?.canVote ?? false;
    const voteDisabledReasonFromApi = (rest as any).permissions?.voteDisabledReason;
    
    // Override reason if comment voting is disabled via feature flag
    const canVote = enableCommentVoting ? canVoteFromApi : false;
    const voteDisabledReason = enableCommentVoting 
        ? voteDisabledReasonFromApi 
        : 'voteDisabled.commentVotingDisabled';
    
    // Get currency icon from community info
    const currencyIcon = communityInfo?.settings?.iconUrl;
    
    const {
        comments,
        showPlus,
        currentPlus,
        currentMinus,
        showMinus,
        showComments,
        setShowComments,
    } = useComments(
        true,
        inPublicationSlug,
        forTransactionId || _id,
        balance,
        updBalance,
        commentUpvotes,
        commentDownvotes,
        activeCommentHook,
        false, // onlyPublication
        communityId, // communityId
        wallets // wallets array for balance lookup
    );
    const commentUnderReply = activeCommentHook[0] == (forTransactionId || _id);
    const nobodyUnderReply = activeCommentHook[0] === null;
    const avatarUrl = authorMeta?.photoUrl || '';
    
    return (
        <div
            className={classList(
                "comment-vote-wrapper transition-all duration-300",
                commentUnderReply ? "scale-100 opacity-100" : "scale-100 opacity-100",
                highlightTransactionId == _id ? "highlight" : ""
            )}
            data-comment-id={_id}
            key={_id}
        >
            <CardCommentVote
                title={authorName}
                subtitle={new Date(commentTimestamp || '').toLocaleString()}
                content={commentText}
                rate={voteDisplay.rate}
                currencyIcon={currencyIcon}
                avatarUrl={avatarUrl}
                voteType={voteDisplay.voteType}
                amountFree={voteDisplay.amountFree}
                amountWallet={voteDisplay.amountWallet}
                beneficiaryName={recipientName}
                beneficiaryAvatarUrl={recipientAvatar}
                upvotes={voteDisplay.displayUpvotes}
                downvotes={voteDisplay.displayDownvotes}
                images={(rest as any).images || []}
                onDetailsClick={() => setShowDetailsPopup(true)}
                onClick={!isDetailPage ? () => {
                    // Navigate to the post page only when not on detail page
                    if (inPublicationSlug && communityId) {
                        window.location.href = `/meriter/communities/${communityId}/posts/${inPublicationSlug}`;
                    }
                } : undefined}
                onAvatarUrlNotFound={() => {
                    // Avatar error handling - use meta.author.photoUrl as fallback
                    const fallbackUrl = authorMeta?.photoUrl;
                    if (fallbackUrl && fallbackUrl !== avatarUrl) {
                        // Force re-render with fallback avatar
                        const imgElement = document.querySelector(`img[src="${avatarUrl}"]`) as HTMLImageElement;
                        if (imgElement) imgElement.src = fallbackUrl;
                    }
                }}
                communityId={communityId}
                publicationSlug={inPublicationSlug}
                commentId={_id}
                bottom={
                    // Comments cannot have beneficiaries, so logic is simpler:
                    // - If author: show withdraw (if balance > 0) UNLESS special group
                    // - If !author: show vote
                    isAuthor && !isSpecialGroup ? (
                        <BarWithdraw
                            balance={maxWithdrawAmount}
                            score={commentScore}
                            totalVotes={totalWithdrawn > 0 ? commentScore + totalWithdrawn : undefined}
                            onWithdraw={() => {
                                useUIStore.getState().openWithdrawPopup(
                                    _id,
                                    'comment-topup',
                                    maxWithdrawAmount,
                                    maxTopUpAmount
                                );
                            }}
                            onTopup={() => {
                                useUIStore.getState().openWithdrawPopup(
                                    _id,
                                    'comment-topup',
                                    maxWithdrawAmount,
                                    maxTopUpAmount
                                );
                            }}
                            commentCount={comments?.length || 0}
                            onCommentClick={() => setShowComments(true)}
                        />
                    ) : (
                        <BarVoteUnified
                            score={commentScore}
                            onVoteClick={() => {
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
                                useUIStore.getState().openVotingPopup(_id, 'comment', mode);
                            }}
                            isAuthor={isAuthor}
                            isBeneficiary={isBeneficiary}
                            hasBeneficiary={hasBeneficiary}
                            commentCount={comments?.length || 0}
                            onCommentClick={() => setShowComments(true)}
                            canVote={canVote}
                            disabledReason={voteDisabledReason}
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
                            // Admin: redirect to settings
                            window.location.href = `/meriter/communities/${communityId}/settings`;
                        } else {
                            // Non-admin: show toast
                            const { useToastStore } = require('@/shared/stores/toast.store');
                            useToastStore.getState().addToast(
                                'Community setup pending, your admin will set it up soon',
                                'info'
                            );
                        }
                    } else {
                        // Normal navigation
                        window.location.href = `/meriter/communities/${communityId}`;
                    }
                }}
                communityNeedsSetup={communityInfo?.needsSetup}
                communityIsAdmin={communityInfo?.isAdmin}
                authorId={commentAuthorId}
                beneficiaryId={beneficiaryMeta?.id}
            />
            {showComments && (
                <div className="transaction-comments">
                    <div className="comments">
                        {comments?.map((c: any) => (
                            <Comment
                                key={c._id}
                                {...c}
                                myId={myId}
                                balance={balance}
                                updBalance={updBalance}
                                spaceSlug={spaceSlug}
                                inPublicationSlug={inPublicationSlug}
                                activeCommentHook={activeCommentHook}
                                highlightTransactionId={highlightTransactionId}
                        wallets={wallets}
                        updateWalletBalance={updateWalletBalance}
                        updateAll={updateAll}
                        communityId={communityId}
                        showCommunityAvatar={showCommunityAvatar}
                        isDetailPage={isDetailPage}
                            />
                        ))}
                    </div>
                </div>
            )}
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
                    : voteDisplay.amountFree}
                upvotes={commentDetails?.metrics?.upvotes ?? voteDisplay.displayUpvotes}
                downvotes={commentDetails?.metrics?.downvotes ?? voteDisplay.displayDownvotes}
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
};
