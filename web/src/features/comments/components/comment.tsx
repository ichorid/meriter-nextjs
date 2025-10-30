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
import { useCommentDetails } from '@/hooks/api/useComments';

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
    activeSlider,
    setActiveSlider,
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
    
    // Use API data directly - no fallbacks
    const authorMeta = meta?.author;
    const authorName = authorMeta?.name || 'Unknown';
    const commentAuthorId = authorId || authorMeta?.id || '';
    const commentText = content || comment || '';
    const commentTimestamp = createdAt || ts || '';
    
    // API provides vote transaction fields (plus, minus, amountTotal) when comment represents a vote
    const hasVoteTransactionData = plus !== undefined || minus !== undefined || amountTotal !== undefined;
    const displayPlus = hasVoteTransactionData ? (plus ?? 0) : (metrics?.upvotes ?? 0);
    const displayMinus = hasVoteTransactionData ? (minus ?? 0) : (metrics?.downvotes ?? 0);
    const displaySum = sum ?? metrics?.score ?? 0;
    
    // Check if current user is the author
    const isAuthor = myId === commentAuthorId;
    
    // Check if there's a beneficiary and it's different from the author
    const beneficiaryMeta = meta?.beneficiary;
    const hasBeneficiary = beneficiaryMeta && beneficiaryMeta.id !== commentAuthorId;
    
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
      (amountTotal !== undefined ? (amountTotal > 0 || displayPlus > 0) : 
       ((displayPlus > displayMinus) || (displaySum > 0)));
    
    // For vote transaction comments, use API-provided plus/minus directly (they reflect the vote amount)
    // For regular comments, use the metrics (votes on the comment itself)
    const displayUpvotes = displayPlus;
    const displayDownvotes = displayMinus;
    
    // Format the rate with currency icon
    const formatRate = () => {
        // Only show vote amount if we have vote transaction data
        if (!hasVoteTransactionData || amountTotal === undefined) {
            // For regular comments without vote transaction, show score from metrics
            const score = displaySum;
            if (score === 0) return "0";
            const sign = score > 0 ? "+" : "-";
            return `${sign} ${Math.abs(score)}`;
        }
        const amount = Math.abs(amountTotal);
        const sign = calculatedDirectionPlus ? "+" : "-";
        return `${sign} ${amount}`;
    };
    
    // Determine vote type based on payment source
    const determineVoteType = () => {
        const withdrawableAmount = optimisticSum ?? withdrawableBalance;
        const amountFree = Math.abs(amountTotal || 0) - Math.abs(withdrawableAmount || 0); // Calculate free amount
        const amountWallet = Math.abs(withdrawableAmount || 0); // Personal wallet amount
        
        const isQuota = amountFree > 0;
        const isWallet = amountWallet > 0;
        
        if (calculatedDirectionPlus) {
            if (isQuota && isWallet) return 'upvote-mixed';
            return isQuota ? 'upvote-quota' : 'upvote-wallet';
        } else {
            if (isQuota && isWallet) return 'downvote-mixed';
            return isQuota ? 'downvote-quota' : 'downvote-wallet';
        }
    };
    
    const voteType = determineVoteType();
    
    // Get currency icon from community info
    const currencyIcon = communityInfo?.settings?.iconUrl;
    
    // Create a unique identifier for this comment
    const postId = _id;
    
    // Calculate withdrawal amounts based on withdrawable balance (metrics.score only)
    const maxWithdrawAmount = isAuthor
        ? Math.floor(10 * withdrawableBalance) / 10
        : 0;
    
    const maxTopUpAmount = isAuthor
        ? Math.floor(10 * currentBalance) / 10
        : 0;
    
    // Fetch comment details when popup is open (for popup display)
    const { data: commentDetails } = useCommentDetails(showDetailsPopup ? _id : '');
    
    // Determine recipient from comment details if available
    let recipientName: string | undefined;
    let recipientAvatar: string | undefined;
    
    if (commentDetails?.beneficiary) {
        recipientName = commentDetails.beneficiary.name;
        recipientAvatar = commentDetails.beneficiary.photoUrl;
    } else if (beneficiaryMeta) {
        recipientName = beneficiaryMeta.name;
        recipientAvatar = beneficiaryMeta.photoUrl;
    }
    
    const {
        comments,
        showPlus,
        currentPlus,
        currentMinus,
        showMinus,
        showComments,
        setShowComments,
        formCommentProps,
    } = useComments(
        true,
        inPublicationSlug,
        forTransactionId || _id,
        balance,
        updBalance,
        displayPlus,
        displayMinus,
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
                commentUnderReply ? "scale-100 opacity-100" : 
                activeSlider && activeSlider !== _id ? "scale-95 opacity-60" : "scale-100 opacity-100",
                highlightTransactionId == _id ? "highlight" : ""
            )}
            data-comment-id={_id}
            key={_id}
            onClick={(e) => {
                if (
                    activeSlider === _id &&
                    !(e.target as any)?.className?.match("clickable")
                ) {
                    setActiveSlider && setActiveSlider(null);
                }
            }}
        >
            <CardCommentVote
                title={authorName}
                subtitle={new Date(commentTimestamp || '').toLocaleString()}
                content={commentText}
                rate={formatRate()}
                currencyIcon={currencyIcon}
                avatarUrl={avatarUrl}
                voteType={voteType}
                amountFree={hasVoteTransactionData && amountTotal !== undefined 
                    ? Math.abs(amountTotal) - Math.abs((optimisticSum ?? withdrawableBalance) || 0) 
                    : 0}
                amountWallet={Math.abs((optimisticSum ?? withdrawableBalance) || 0)}
                beneficiaryName={recipientName}
                beneficiaryAvatarUrl={recipientAvatar}
                upvotes={displayUpvotes}
                downvotes={displayDownvotes}
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
                bottom={
                    // Comments cannot have beneficiaries, so logic is simpler:
                    // - If author: show withdraw (if balance > 0)
                    // - If !author: show vote
                    isAuthor ? (
                        <BarWithdraw
                            balance={maxWithdrawAmount}
                            onWithdraw={() => {
                                useUIStore.getState().openWithdrawPopup(
                                    _id,
                                    'comment-withdraw',
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
                            score={currentPlus - currentMinus}
                            onVoteClick={() => {
                                useUIStore.getState().openVotingPopup(_id, 'comment');
                            }}
                            isAuthor={isAuthor}
                            isBeneficiary={false}
                            hasBeneficiary={false}
                            commentCount={comments?.length || 0}
                            onCommentClick={() => setShowComments(true)}
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
                                activeSlider={activeSlider}
                                setActiveSlider={setActiveSlider}
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
                rate={commentDetails?.voteTransaction ? formatRate() : formatRate()}
                currencyIcon={commentDetails?.community?.iconUrl || currencyIcon}
                amountWallet={commentDetails?.voteTransaction 
                    ? Math.abs(commentDetails.voteTransaction.sum) 
                    : Math.abs((optimisticSum ?? withdrawableBalance) || 0)}
                amountFree={commentDetails?.voteTransaction && commentDetails.voteTransaction.amountTotal !== undefined
                    ? Math.abs(commentDetails.voteTransaction.amountTotal) - Math.abs(commentDetails.voteTransaction.sum)
                    : (hasVoteTransactionData && amountTotal !== undefined 
                        ? Math.abs(amountTotal) - Math.abs((optimisticSum ?? withdrawableBalance) || 0) 
                        : 0)}
                upvotes={commentDetails?.metrics?.upvotes ?? displayUpvotes}
                downvotes={commentDetails?.metrics?.downvotes ?? displayDownvotes}
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
            />
        </div>
    );
};
