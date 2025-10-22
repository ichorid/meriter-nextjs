'use client';

import { useComments } from "../hooks/use-comments";
import { CardCommentVote } from "./card-comment-vote";
import { telegramGetAvatarLink, telegramGetAvatarLinkUpd } from "@lib/telegram";
import { BarVote } from "@shared/components/bar-vote";
import { BarWithdraw } from "@features/wallet/components/bar-withdraw";
import { BottomPortal } from "@shared/components/bottom-portal";
import { FormComment } from "./form-comment";
import { classList } from "@lib/classList";
import { useState, useEffect } from "react";
import { GLOBAL_FEED_TG_CHAT_ID } from "@config/meriter";
import { swr } from "@lib/swr";
import Axios from "axios";
import { Spinner } from "@shared/components/misc";
import { FormWithdraw } from "@features/wallet/components/form-withdraw";
import { useTranslation } from 'react-i18next';

export const Comment = ({
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
}) => {
    const { t } = useTranslation('comments');
    
    // Check if current user is the author
    const isAuthor = myId === fromUserTgId;
    
    // Withdrawal state management (for author's own comments)
    const [optimisticSum, setOptimisticSum] = useState(sum);
    const effectiveSum = optimisticSum ?? sum;
    
    useEffect(() => {
        setOptimisticSum(sum);
    }, [sum]);
    
    const curr = currencyOfCommunityTgChatId || fromTgChatId || tgChatId;
    const currentBalance =
        (Array.isArray(wallets) &&
            wallets.find((w) => w.currencyOfCommunityTgChatId == curr)
                ?.amount) ||
        0;
    const isMerit = tgChatId === GLOBAL_FEED_TG_CHAT_ID;
    const [showselector, setShowselector] = useState(false);
    
    // Fetch community info to get currency icon
    const [currencyCommunityInfo] = swr(
        curr ? `/api/rest/communityinfo?chatId=${curr}` : null,
        {},
        { revalidateOnFocus: false }
    );
    
    const [rate] = swr(
        () => isAuthor && !isMerit && curr ? "/api/rest/rate?fromCurrency=" + curr : null,
        0,
        { key: "rate-comment-" + curr + "-" + _id, revalidateOnFocus: false }
    );
    
    // Format the rate with currency icon
    const formatRate = () => {
        const amount = Math.abs(amountTotal);
        const sign = directionPlus ? "+" : "-";
        return `${sign} ${amount}`;
    };
    
    // Determine vote type based on payment source
    const determineVoteType = () => {
        const amountFree = Math.abs(amountTotal) - Math.abs(sum || 0); // Calculate free amount
        const amountWallet = Math.abs(sum || 0); // Personal wallet amount
        
        const isQuota = amountFree > 0;
        const isWallet = amountWallet > 0;
        
        if (directionPlus) {
            if (isQuota && isWallet) return 'upvote-mixed';
            return isQuota ? 'upvote-quota' : 'upvote-wallet';
        } else {
            if (isQuota && isWallet) return 'downvote-mixed';
            return isQuota ? 'downvote-quota' : 'downvote-wallet';
        }
    };
    
    const voteType = determineVoteType();
    
    // Get currency icon for separate rendering
    const currencyIcon = currencyCommunityInfo?.icon;
    
    // Create a unique identifier for this comment
    const postId = _id;
    
    // Parse the activeWithdrawPost to get post ID and direction
    const isThisPostActive = activeWithdrawPost && activeWithdrawPost.startsWith(postId + ':');
    const directionAdd = isThisPostActive 
        ? activeWithdrawPost === postId + ':add' 
        : undefined;
    
    const [amount, setAmount] = useState(0);
    const [amountInMerits, setAmountInMerits] = useState(0);
    const [withdrawMerits, setWithdrawMerits] = useState(isMerit);
    const [loading, setLoading] = useState(false);
    
    const submitWithdrawal = async () => {
        if (!isAuthor) return;
        
        setLoading(true);
        const changeAmount = amount;
        const newSum = directionAdd 
            ? optimisticSum + changeAmount
            : optimisticSum - changeAmount;
        
        setOptimisticSum(newSum);
        
        const walletChange = directionAdd 
            ? -changeAmount
            : changeAmount;
        
        if (updateWalletBalance && curr) {
            updateWalletBalance(curr, walletChange);
        }
        
        try {
            await Axios.post("/api/rest/withdraw", {
                transactionId: _id,
                amount: withdrawMerits ? amountInMerits : amount,
                currency: withdrawMerits ? "merit" : currency,
                directionAdd,
                withdrawMerits,
                comment: '', // No comment required
                amountInternal: withdrawMerits
                    ? rate > 0
                        ? amountInMerits / rate
                        : 0
                    : amount,
            });
            
            setAmount(0);
            setAmountInMerits(0);
            
            if (updateAll) await updateAll();
        } catch (error) {
            console.error("Withdrawal failed:", error);
            setOptimisticSum(sum);
            if (updateWalletBalance && curr) {
                updateWalletBalance(curr, -walletChange);
            }
        } finally {
            setLoading(false);
        }
    };
    
    const meritsAmount = isAuthor
        ? Math.floor(10 * (withdrawMerits ? rate * effectiveSum : effectiveSum)) / 10
        : 0;
    
    const maxWithdrawAmount = isAuthor
        ? Math.floor(10 * (withdrawMerits ? rate * effectiveSum : effectiveSum)) / 10
        : 0;
    
    const maxTopUpAmount = isAuthor
        ? Math.floor(
            10 * (withdrawMerits ? rate * currentBalance : currentBalance)
        ) / 10
        : 0;
    
    const handleSetDirectionAdd = (direction: boolean | undefined) => {
        if (!setActiveWithdrawPost) return;
        
        if (direction === undefined) {
            setActiveWithdrawPost(null);
        } else {
            const newState = postId + ':' + (direction ? 'add' : 'withdraw');
            if (activeWithdrawPost === newState) {
                setActiveWithdrawPost(null);
            } else {
                setActiveWithdrawPost(newState);
            }
        }
    };
    
    // Fetch community info for displaying community avatar
    const communityId = currencyOfCommunityTgChatId || fromTgChatId || tgChatId;
    const [communityInfo] = swr(
        () => isAuthor && communityId && showCommunityAvatar ? `/api/rest/communityinfo?chatId=${communityId}` : null,
        {},
        { revalidateOnFocus: false }
    );
    
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
        "/api/rest/transactions/" + (forTransactionId || _id) + "/replies",
        spaceSlug ? "/api/rest/free?inSpaceSlug=" + spaceSlug : null,
        balance,
        updBalance,
        plus,
        minus,
        activeCommentHook
    );
    const commentUnderReply = activeCommentHook[0] == (forTransactionId || _id);
    const nobodyUnderReply = activeCommentHook[0] === null;
    const userTgId = reason === "withdrawalFromPublication" ? toUserTgId : fromUserTgId;
    const avatarUrl = telegramGetAvatarLink(userTgId);
    
    // Prepare withdraw slider content for author's comments
    const disabled = withdrawMerits ? !amountInMerits : !amount;
    
    const withdrawSliderContent = isAuthor && directionAdd !== undefined && (
        <>
            {withdrawMerits &&
                (loading ? (
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
                            {directionAdd ? t('addMerits', { amount }) : t('removeMerits', { amount })}
                        </div>
                    </FormWithdraw>
                ))}

            {!withdrawMerits &&
                (loading ? (
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
                ))}
        </>
    );
    
    return (
        <div
            className={classList(
                "comment-vote-wrapper transition-all duration-300",
                commentUnderReply ? "scale-100 opacity-100" : 
                nobodyUnderReply ? "scale-100 opacity-100" : 
                "scale-95 opacity-60",
                highlightTransactionId == _id && "highlight"
            )}
            key={_id}
            onClick={(e) => {
                if (
                    activeCommentHook[0] &&
                    //(myId!==fromUserTgId) &&
                    !(e.target as any)?.className?.match("clickable")
                ) {
                    activeCommentHook[1](null);
                }
            }}
        >
            <CardCommentVote
                title={fromUserTgName}
                subtitle={new Date(ts).toLocaleString()}
                content={comment}
                rate={formatRate()}
                currencyIcon={currencyIcon}
                avatarUrl={avatarUrl}
                voteType={voteType}
                amountFree={Math.abs(amountTotal) - Math.abs(sum || 0)}
                amountWallet={Math.abs(sum || 0)}
                beneficiaryName={toUserTgName}
                beneficiaryAvatarUrl={telegramGetAvatarLink(toUserTgId)}
                onClick={!isDetailPage ? () => {
                    // Navigate to the post page only when not on detail page
                    if (inPublicationSlug && currencyOfCommunityTgChatId) {
                        window.location.href = `/meriter/communities/${currencyOfCommunityTgChatId}/posts/${inPublicationSlug}`;
                    }
                } : undefined}
                onAvatarUrlNotFound={() => {
                    const fallbackUrl = telegramGetAvatarLinkUpd(userTgId);
                    if (fallbackUrl !== avatarUrl) {
                        // Force re-render with fallback avatar
                        const imgElement = document.querySelector(`img[src="${avatarUrl}"]`) as HTMLImageElement;
                        if (imgElement) imgElement.src = fallbackUrl;
                    }
                }}
                bottom={
                    isAuthor ? (
                        <BarWithdraw
                            balance={meritsAmount}
                            onWithdraw={() => handleSetDirectionAdd(false)}
                            onTopup={() => handleSetDirectionAdd(true)}
                        >
                            {showselector && (
                                <div className="select-currency">
                                    <span
                                        className={
                                            !withdrawMerits
                                                ? "clickable bar-withdraw-select"
                                                : "bar-withdraw-select-active"
                                        }
                                        onClick={() => setWithdrawMerits(true)}
                                    >
                                        {t('merits')}{" "}
                                    </span>
                                    <span
                                        className={
                                            withdrawMerits
                                                ? "clickable bar-withdraw-select"
                                                : "bar-withdraw-select-active"
                                        }
                                        onClick={() => setWithdrawMerits(false)}
                                    >
                                        {t('points')}
                                    </span>
                                </div>
                            )}
                        </BarWithdraw>
                    ) : (
                        <BarVote
                            plus={currentPlus}
                            minus={currentMinus}
                            onPlus={showPlus}
                            onMinus={showMinus}
                            onLeft={setShowComments}
                            commentCount={comments?.length || 0}
                        />
                    )
                }
                showCommunityAvatar={showCommunityAvatar}
                communityAvatarUrl={communityInfo?.chat?.photo}
                communityName={communityInfo?.chat?.title}
                communityIconUrl={communityInfo?.icon}
                onCommunityClick={() => {
                    if (communityId) {
                        window.location.href = `/meriter/communities/${communityId}`;
                    }
                }}
                withdrawSliderContent={withdrawSliderContent}
            />
            {showComments && (
                <div className="transaction-comments">
                    <div className="comments">
                        {comments?.map((c) => (
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
            {commentUnderReply && fromUserTgId !== myId && (
                <BottomPortal>
                    {" "}
                    <FormComment key={formCommentProps.uid} {...formCommentProps} />
                </BottomPortal>
            )}
        </div>
    );
};
