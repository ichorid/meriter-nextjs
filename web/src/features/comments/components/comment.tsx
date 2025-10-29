'use client';

import { useComments } from "../hooks/use-comments";
import { CardCommentVote } from "@shared/components/card-comment-vote";
import { telegramGetAvatarLink, telegramGetAvatarLinkUpd } from "@lib/telegram";
import { BarVoteUnified } from "@shared/components/bar-vote-unified";
import { BarWithdraw } from "@shared/components/bar-withdraw";
import { useUIStore } from "@/stores/ui.store";
import { classList } from "@lib/classList";
import { useState, useEffect } from "react";
import { GLOBAL_FEED_TG_CHAT_ID } from "@config/meriter";
import { useVoteOnComment, useWithdrawFromComment } from '@/hooks/api/useVotes';
import { Spinner } from "@shared/components/misc";
import { FormWithdraw } from "@shared/components/form-withdraw";
import { useTranslations } from 'next-intl';
import { useCommunity } from '@/hooks/api';
import { CommentDetailsPopup } from "@shared/components/comment-details-popup";

interface CommentProps {
    _id: string;
    spaceSlug?: string;
    balance?: any;
    updBalance?: any;
    plus?: number;
    minus?: number;
    fromUserTgName?: string;
    ts?: string;
    comment?: string;
    directionPlus?: boolean;
    reason?: string;
    toUserTgId?: string;
    toUserTgName?: string;
    fromUserTgId?: string;
    amountTotal?: number;
    [key: string]: any;
}

export const Comment: React.FC<CommentProps> = ({
    _id,
    spaceSlug,
    balance,
    updBalance,
    plus,
    minus,
    fromUserTgName,
    ts,
    comment,
    directionPlus,
    reason,
    toUserTgId,
    toUserTgName,
    fromUserTgId,
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
    activeWithdrawPost,
    setActiveWithdrawPost,
    updateAll,
    sum,
    currency,
    inMerits,
    currencyOfCommunityTgChatId,
    fromTgChatId,
    tgChatId,
    showCommunityAvatar,
    isDetailPage,
    // Support v1 API format with meta.author
    meta,
    authorId,
    metrics,
    content,
    createdAt,
    ...rest
}) => {
    const t = useTranslations('comments');
    
    // Support both legacy format and v1 API format with meta.author
    // API now provides enriched data including author metadata and vote transaction fields
    const authorMeta = meta?.author || {};
    const effectiveFromUserTgName = fromUserTgName || authorMeta.name || 'Unknown';
    const effectiveFromUserTgId = fromUserTgId || authorId || authorMeta.telegramId;
    const effectiveComment = comment || content || '';
    const effectiveTs = ts || createdAt || '';
    
    // API provides vote transaction fields (plus, minus, amountTotal) when comment represents a vote
    // Prefer these over comment metrics for vote transaction comments
    const hasVoteTransactionData = plus !== undefined || minus !== undefined || amountTotal !== undefined;
    const effectivePlus = hasVoteTransactionData ? (plus ?? 0) : (metrics?.upvotes ?? plus ?? 0);
    const effectiveMinus = hasVoteTransactionData ? (minus ?? 0) : (metrics?.downvotes ?? minus ?? 0);
    const baseSum = sum ?? metrics?.score ?? 0;
    
    // Check if current user is the author
    const isAuthor = myId === effectiveFromUserTgId;
    
    // Check if there's a beneficiary and it's different from the author
    const hasBeneficiary = toUserTgId && toUserTgId !== effectiveFromUserTgId;
    
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
    
    // Use effectiveSum which handles both vote transaction data and legacy format
    // This is used throughout the component for wallet calculations and display
    const effectiveSum = optimisticSum ?? withdrawableBalance;
    
    const curr = currencyOfCommunityTgChatId || fromTgChatId || tgChatId;
    const currentBalance =
        (Array.isArray(wallets) &&
            wallets.find((w) => w.communityId == curr)
                ?.amount) ||
        0;
    const [showselector, setShowselector] = useState(false);
    
    // State for comment details popup
    const [showDetailsPopup, setShowDetailsPopup] = useState(false);
    
    // Fetch community info to get currency icon using v1 API
    const { data: currencyCommunityInfo } = useCommunity(curr || '');
    
    // Rate conversion no longer needed with v1 API - currencies are normalized
    const rate = 1;
    
    // API provides directionPlus for vote transaction comments
    // Calculate from vote data if available, otherwise infer from metrics
    const calculatedDirectionPlus = directionPlus ?? 
      (amountTotal !== undefined ? (amountTotal > 0 || effectivePlus > 0) : 
       ((effectivePlus > effectiveMinus) || (baseSum > 0)));
    
    // For vote transaction comments, use API-provided plus/minus directly (they reflect the vote amount)
    // For regular comments, use the metrics (votes on the comment itself)
    const displayUpvotes = hasVoteTransactionData 
      ? effectivePlus  // API provides plus which is the upvote amount
      : effectivePlus; // For regular comments, use metrics.upvotes
    const displayDownvotes = hasVoteTransactionData
      ? effectiveMinus  // API provides minus which is the downvote amount  
      : effectiveMinus; // For regular comments, use metrics.downvotes
    
    // Format the rate with currency icon
    const formatRate = () => {
        // Only show vote amount if we have vote transaction data
        if (!hasVoteTransactionData || amountTotal === undefined) {
            // For regular comments without vote transaction, show score from metrics
            const score = baseSum;
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
        const amountFree = Math.abs(amountTotal || 0) - Math.abs(effectiveSum || 0); // Calculate free amount
        const amountWallet = Math.abs(effectiveSum || 0); // Personal wallet amount
        
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
    
    // Get currency icon for separate rendering
    const currencyIcon = currencyCommunityInfo?.settings?.iconUrl;
    
    // Create a unique identifier for this comment
    const postId = _id;
    
    // Parse the activeWithdrawPost to get post ID and direction
    const isThisPostActive = activeWithdrawPost && activeWithdrawPost.startsWith(postId + ':');
    const directionAdd = isThisPostActive 
        ? activeWithdrawPost === postId + ':add' 
        : undefined;
    
    const [amount, setAmount] = useState(0);
    // Mutation hooks
    const voteOnCommentMutation = useVoteOnComment();
    const withdrawMutation = useWithdrawFromComment();
    
    // Use loading state from mutations
    const loading = voteOnCommentMutation.isPending || withdrawMutation.isPending;
    
    const submitWithdrawal = async () => {
        if (!isAuthor) return;
        
        if (directionAdd) {
            // Adding votes - use vote mutation
            const changeAmount = amount;
            const newSum = optimisticSum + changeAmount;
            
            setOptimisticSum(newSum);
            
            const walletChange = -changeAmount;
            
            if (updateWalletBalance && curr) {
                updateWalletBalance(curr, walletChange);
            }
            
            try {
                await voteOnCommentMutation.mutateAsync({
                    commentId: _id,
                    data: {
                        targetType: 'comment',
                        targetId: _id,
                        amount: changeAmount,
                        sourceType: 'quota',
                    },
                    communityId: commentCommunityId,
                });
                
                setAmount(0);
                
                if (updateAll) await updateAll();
            } catch (error) {
                console.error("Adding votes failed:", error);
                setOptimisticSum(withdrawableBalance);
                if (updateWalletBalance && curr) {
                    updateWalletBalance(curr, -walletChange);
                }
            }
        } else {
            // Withdrawing votes - use withdraw mutation
            const withdrawAmount = amount;
            
            if (withdrawAmount <= 0) {
                return;
            }
            
            // Check if there's actually a balance to withdraw
            // Use withdrawableBalance which matches what backend checks (metrics.score)
            if (withdrawableBalance <= 0) {
                console.warn("Cannot withdraw: comment has no balance", {
                    withdrawableBalance,
                    metricsScore: metrics?.score,
                    effectiveSum,
                    baseSum,
                    sum,
                });
                return;
            }
            
            const newSum = optimisticSum - withdrawAmount;
            setOptimisticSum(newSum);
            
            // Optimistic wallet update
            if (updateWalletBalance && curr) {
                updateWalletBalance(curr, withdrawAmount);
            }
            
            try {
                // Use withdraw mutation
                await withdrawMutation.mutateAsync({
                    commentId: _id,
                    amount: withdrawAmount,
                });
                
                setAmount(0);
                
                if (updateAll) await updateAll();
            } catch (error: any) {
                // Log detailed error information - extract all properties properly
                let errorMessage = 'Unknown error';
                let errorCode = 'UNKNOWN';
                let errorDetails: any = null;
                
                // Try to extract error information from various possible structures
                if (error?.message) {
                    errorMessage = error.message;
                } else if (error?.details?.message) {
                    errorMessage = error.details.message;
                } else if (error?.details?.data?.message) {
                    errorMessage = error.details.data.message;
                } else if (error?.details?.data?.error?.message) {
                    errorMessage = error.details.data.error.message;
                } else if (typeof error === 'string') {
                    errorMessage = error;
                } else {
                    // Try to extract from error object properties
                    try {
                        errorMessage = JSON.stringify(error, Object.getOwnPropertyNames(error));
                    } catch {
                        errorMessage = String(error);
                    }
                }
                
                if (error?.code) {
                    errorCode = error.code;
                } else if (error?.details?.status) {
                    errorCode = `HTTP_${error.details.status}`;
                } else if (error?.details?.code) {
                    errorCode = error.details.code;
                }
                
                if (error?.details) {
                    errorDetails = error.details;
                }
                
                console.error("Withdrawal failed:", {
                    message: errorMessage,
                    code: errorCode,
                    details: errorDetails,
                    fullError: error,
                    errorType: typeof error,
                    errorKeys: error ? Object.keys(error) : [],
                });
                setOptimisticSum(withdrawableBalance);
                if (updateWalletBalance && curr) {
                    updateWalletBalance(curr, -withdrawAmount);
                }
                
                // Show user-friendly error message
                if (errorMessage.includes('No balance available')) {
                    // This is expected - the comment doesn't have a balance to withdraw
                    console.warn('Comment has no balance available for withdrawal');
                }
                
                throw error;
            }
        }
    };
    
    // Calculate withdrawal amounts based on withdrawable balance (metrics.score only)
    // NOT effectiveSum which might include vote transaction data
    const maxWithdrawAmount = isAuthor
        ? Math.floor(10 * withdrawableBalance) / 10
        : 0;
    
    const maxTopUpAmount = isAuthor
        ? Math.floor(10 * currentBalance) / 10
        : 0;
    
    const handleSetDirectionAdd = (direction: boolean | undefined) => {
        if (!setActiveWithdrawPost) return;
        
        if (direction === undefined) {
            setActiveWithdrawPost(null);
            setActiveSlider && setActiveSlider(null);
        } else {
            const newState = postId + ':' + (direction ? 'add' : 'withdraw');
            if (activeWithdrawPost === newState) {
                setActiveWithdrawPost(null);
                setActiveSlider && setActiveSlider(null);
            } else {
                setActiveWithdrawPost(newState);
                setActiveSlider && setActiveSlider(_id);
            }
        }
    };
    
    // Fetch community info for displaying community avatar using v1 API
    const communityId = currencyOfCommunityTgChatId || fromTgChatId || tgChatId;
    const { data: communityInfo } = useCommunity(communityId || '');
    
    // Get the correct community ID for wallet lookup
    const commentCommunityId = currencyOfCommunityTgChatId || fromTgChatId || tgChatId;
    
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
        "", // No longer used - path handled internally
        "", // No longer used - quota handled internally
        balance,
        updBalance,
        effectivePlus,
        effectiveMinus,
        activeCommentHook,
        false, // onlyPublication
        commentCommunityId, // communityId
        wallets // wallets array for balance lookup
    );
    const commentUnderReply = activeCommentHook[0] == (forTransactionId || _id);
    const nobodyUnderReply = activeCommentHook[0] === null;
    const userTgId = reason === "withdrawalFromPublication" ? toUserTgId : effectiveFromUserTgId;
    const avatarUrl = authorMeta.photoUrl || telegramGetAvatarLink(userTgId || '');
    
    // Prepare withdraw slider content for author's comments
    const disabled = !amount;
    
    const withdrawSliderContent = isAuthor && directionAdd !== undefined && (
        loading ? (
            <Spinner />
        ) : (
            <FormWithdraw
                comment=""
                setComment={() => {}}
                amount={amount}
                setAmount={setAmount}
                maxWithdrawAmount={maxWithdrawAmount}
                maxTopUpAmount={maxTopUpAmount}
                isWithdrawal={!directionAdd}
                onSubmit={() => !disabled && submitWithdrawal()}
            >
                <div>
                    {directionAdd ? t('addCommunityPoints', { amount }) : t('removeCommunityPoints', { amount })}
                </div>
            </FormWithdraw>
        )
    );
    
    return (
        <div
            className={classList(
                "comment-vote-wrapper transition-all duration-300",
                commentUnderReply ? "scale-100 opacity-100" : 
                activeSlider && activeSlider !== _id ? "scale-95 opacity-60" : "scale-100 opacity-100",
                highlightTransactionId == _id ? "highlight" : ""
            )}
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
                title={effectiveFromUserTgName}
                subtitle={new Date(effectiveTs || '').toLocaleString()}
                content={effectiveComment}
                rate={formatRate()}
                currencyIcon={currencyIcon}
                avatarUrl={avatarUrl}
                voteType={voteType}
                amountFree={hasVoteTransactionData && amountTotal !== undefined 
                    ? Math.abs(amountTotal) - Math.abs(effectiveSum || 0) 
                    : 0}
                amountWallet={Math.abs(effectiveSum || 0)}
                beneficiaryName={toUserTgName}
                beneficiaryAvatarUrl={telegramGetAvatarLink(toUserTgId || '')}
                upvotes={displayUpvotes}
                downvotes={displayDownvotes}
                onDetailsClick={() => setShowDetailsPopup(true)}
                onClick={!isDetailPage ? () => {
                    // Navigate to the post page only when not on detail page
                    if (inPublicationSlug && currencyOfCommunityTgChatId) {
                        window.location.href = `/meriter/communities/${currencyOfCommunityTgChatId}/posts/${inPublicationSlug}`;
                    }
                } : undefined}
                onAvatarUrlNotFound={() => {
                    const fallbackUrl = telegramGetAvatarLinkUpd(userTgId || '');
                    if (fallbackUrl !== avatarUrl) {
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
                            onWithdraw={() => handleSetDirectionAdd(false)}
                            onTopup={() => handleSetDirectionAdd(true)}
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
                withdrawSliderContent={withdrawSliderContent}
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
                                activeWithdrawPost={activeWithdrawPost}
                                setActiveWithdrawPost={setActiveWithdrawPost}
                                updateAll={updateAll}
                                tgChatId={tgChatId}
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
                rate={formatRate()}
                currencyIcon={currencyIcon}
                amountWallet={Math.abs(effectiveSum || 0)}
                amountFree={hasVoteTransactionData && amountTotal !== undefined 
                    ? Math.abs(amountTotal) - Math.abs(effectiveSum || 0) 
                    : 0}
                upvotes={displayUpvotes}
                downvotes={displayDownvotes}
                isUpvote={calculatedDirectionPlus}
            />
        </div>
    );
};
