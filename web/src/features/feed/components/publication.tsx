'use client';

import { useComments } from "@features/comments/hooks/use-comments";
import { useEffect, useState } from "react";
import { CardPublication } from "./card-publication";
import { dateVerbose } from "@shared/lib/date";
import {
    telegramGetAvatarLink,
    telegramGetAvatarLinkUpd,
} from "@lib/telegram";
import { BarVote } from "@shared/components/bar-vote";
import { BarWithdraw } from "@features/wallet/components/bar-withdraw";
import { WithTelegramEntities } from "@shared/components/withTelegramEntities";
import { FormDimensionsEditor } from "@features/communities/components/form-dimensions-editor";
import Axios from "axios";
import { BottomPortal } from "@shared/components/bottom-portal";
import { FormComment } from "@features/comments/components/form-comment";
import { classList } from "@lib/classList";
import { Comment } from "@features/comments/components/comment";
import { PollVoting } from "@features/polls/components/poll-voting";
import type { IPollData } from "@features/polls/types";
import { apiPOST, apiGET } from "@shared/lib/fetch";
import { useRouter } from "next/navigation";
import { swr } from "@lib/swr";
import { GLOBAL_FEED_TG_CHAT_ID } from "@config/meriter";
import { Spinner } from "@shared/components/misc";
import { FormWithdraw } from "@features/wallet/components/form-withdraw";
import { useTranslation } from 'react-i18next';

export interface IPublication {
    tgChatName;
    tgMessageId;
    minus;
    plus;
    sum;
    slug;
    spaceSlug;
    balance;
    updBalance?;
    messageText;
    authorPhotoUrl;
    tgAuthorName;
    tgAuthorId?;
    beneficiaryName?;
    beneficiaryPhotoUrl?;
    beneficiaryId?;
    beneficiaryUsername?;
    keyword;
    ts;
    type?: string;
    content?: any;
    _id?: string;
}

export const Publication = ({
    tgChatName,
    tgChatId,
    tgMessageId,
    minus,
    plus,
    sum,
    slug,
    spaceSlug,
    balance,
    updBalance = () => {}, // Default no-op function
    messageText,
    authorPhotoUrl,
    tgAuthorName,
    keyword,
    ts,
    activeCommentHook,
    activeSlider,
    setActiveSlider,
    tgAuthorId,
    beneficiaryName,
    beneficiaryPhotoUrl,
    beneficiaryId,
    beneficiaryUsername,
    dimensions,
    dimensionConfig,
    myId,
    onlyPublication,
    entities,
    highlightTransactionId,
    type,
    content,
    _id,
    isDetailPage,
    showCommunityAvatar,
    // New props for author withdraw functionality
    wallets,
    updateWalletBalance,
    activeWithdrawPost,
    setActiveWithdrawPost,
    updateAll,
    currency,
    inMerits,
    currencyOfCommunityTgChatId,
    fromTgChatId,
}: any) => {
    const { t } = useTranslation('feed');
    if (!tgChatName && type !== 'poll') return null;
    const router = useRouter();
    
    // Check if current user is the author
    const isAuthor = myId === tgAuthorId;
    
    // Check if there's a beneficiary and it's different from the author
    const hasBeneficiary = beneficiaryId && beneficiaryId !== tgAuthorId;
    
    // Determine the title based on beneficiary
    const displayTitle = hasBeneficiary 
        ? t('forBeneficiary', { author: tgAuthorName, beneficiary: beneficiaryName })
        : tgAuthorName;
    
    // Withdrawal state management (for author's own posts)
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
    
    const [rate] = swr(
        () => isAuthor && !isMerit && curr ? "/api/rest/rate?fromCurrency=" + curr : null,
        0,
        { key: "rate-" + curr, revalidateOnFocus: false }
    );
    
    // Create a unique identifier for this post
    const postId = slug || _id;
    
    // Parse the activeWithdrawPost to get post ID and direction
    const isThisPostActive = activeWithdrawPost && activeWithdrawPost.startsWith(postId + ':');
    const directionAdd = isThisPostActive 
        ? activeWithdrawPost === postId + ':add' 
        : undefined;
    
    const [amount, setAmount] = useState(0);
    const [comment, setComment] = useState("");
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
                publicationSlug: slug,
                // Don't send transactionId for publications - slug is sufficient
                amount: withdrawMerits ? amountInMerits : amount,
                currency: withdrawMerits ? "merit" : currency,
                directionAdd,
                withdrawMerits,
                comment,
                amountInternal: withdrawMerits
                    ? rate > 0
                        ? amountInMerits / rate
                        : 0
                    : amount,
            });
            
            setAmount(0);
            setAmountInMerits(0);
            setComment("");
            
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
            setActiveSlider && setActiveSlider(null);
        } else {
            const newState = postId + ':' + (direction ? 'add' : 'withdraw');
            if (activeWithdrawPost === newState) {
                setActiveWithdrawPost(null);
                setActiveSlider && setActiveSlider(null);
            } else {
                setActiveWithdrawPost(newState);
                setActiveSlider && setActiveSlider(postId);
            }
        }
    };
    
    // State for polls
    const [pollUserVote, setPollUserVote] = useState(null);
    const [pollUserVoteSummary, setPollUserVoteSummary] = useState(null);
    const [pollData, setPollData] = useState<IPollData | null>(type === 'poll' ? content : null);
    
    // For polls, fetch the wallet balance for the specific community ONLY when not on community page
    // When on community page (showCommunityAvatar=false), the balance prop is already correct
    const pollCommunityId = type === 'poll' ? content?.communityId : null;
    const [pollBalanceResponse] = swr(
        () => pollCommunityId && showCommunityAvatar ? `/api/rest/wallet?tgChatId=${pollCommunityId}` : null,
        { balance: 0 },
        { key: "poll-balance-" + pollCommunityId }
    );
    const pollBalance = pollBalanceResponse?.balance || 0;
    
    // Fetch community info for displaying community avatar
    const communityId = tgChatId || pollCommunityId;
    const [communityInfo] = swr(
        () => communityId && showCommunityAvatar ? `/api/rest/communityinfo?chatId=${communityId}` : null,
        {},
        { revalidateOnFocus: false }
    );
    
    // Fetch poll vote status if this is a poll
    useEffect(() => {
        if (type === 'poll' && _id) {
            apiGET("/api/rest/poll/get", { pollId: _id }).then((response) => {
                if (response.poll && response.poll.content) {
                    setPollData(response.poll.content);
                }
                if (response.userVotes) {
                    setPollUserVote(response.userVotes[0] || null);
                }
                if (response.userVoteSummary) {
                    setPollUserVoteSummary(response.userVoteSummary);
                }
            });
        }
    }, [type, _id]);

    const handlePollVoteSuccess = () => {
        // Refresh poll data after voting
        if (type === 'poll' && _id) {
            // Refresh balance
            updBalance();
            
            // Refresh poll data
            apiGET("/api/rest/poll/get", { pollId: _id }).then((response) => {
                if (response.poll && response.poll.content) {
                    setPollData(response.poll.content);
                }
                if (response.userVotes) {
                    setPollUserVote(response.userVotes[0] || null);
                }
                if (response.userVoteSummary) {
                    setPollUserVoteSummary(response.userVoteSummary);
                }
            });
        }
    };

    // Render poll publication (early return to avoid hooks)
    if (type === 'poll' && pollData) {
        const avatarUrl = authorPhotoUrl || telegramGetAvatarLink(tgAuthorId);
        // For author: use wallet balance from wallets array; for others: use pollBalance or passed balance
        let effectiveBalance = balance;
        if (isAuthor && Array.isArray(wallets) && pollCommunityId) {
            const pollWalletBalance = wallets.find((w: any) => w.currencyOfCommunityTgChatId === pollCommunityId)?.amount || 0;
            effectiveBalance = pollWalletBalance;
        } else {
            effectiveBalance = showCommunityAvatar ? (pollBalance || 0) : balance;
        }
        
        const disabled = withdrawMerits ? !amountInMerits : !amount;
        
        // Prepare withdraw slider content for author's polls
        const withdrawSliderContent = isAuthor && directionAdd !== undefined && (
            <>
                {withdrawMerits &&
                    (loading ? (
                        <Spinner />
                    ) : (
                        <FormWithdraw
                            comment={comment}
                            setComment={setComment}
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
                            comment={comment}
                            setComment={setComment}
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
            <div className="mb-5" key={slug}>
                <CardPublication
                    title={displayTitle}
                    subtitle={dateVerbose(ts)}
                    avatarUrl={avatarUrl}
                    onAvatarUrlNotFound={() => {
                        const fallbackUrl = telegramGetAvatarLinkUpd(tgAuthorId);
                        if (fallbackUrl !== avatarUrl) {
                            // Force re-render with fallback avatar
                            const imgElement = document.querySelector(`img[src="${avatarUrl}"]`) as HTMLImageElement;
                            if (imgElement) imgElement.src = fallbackUrl;
                        }
                    }}
                    description={isAuthor ? t('pollMy') : t('poll')}
                    onClick={undefined}
                    onDescriptionClick={undefined}
                    bottom={undefined}
                    showCommunityAvatar={showCommunityAvatar}
                    communityAvatarUrl={communityInfo?.chat?.photo}
                    communityName={communityInfo?.chat?.title || tgChatName}
                    communityIconUrl={communityInfo?.icon}
                    onCommunityClick={() => {
                        if (communityId) {
                            router.push(`/meriter/communities/${communityId}`);
                        }
                    }}
                    withdrawSliderContent={withdrawSliderContent}
                >
                    <PollVoting
                        pollData={pollData}
                        pollId={_id || slug}
                        userVote={pollUserVote}
                        userVoteSummary={pollUserVoteSummary}
                        balance={effectiveBalance}
                        onVoteSuccess={handlePollVoteSuccess}
                        updateWalletBalance={updateWalletBalance}
                        communityId={pollCommunityId}
                        initiallyExpanded={isDetailPage}
                    />
                </CardPublication>
            </div>
        );
    }
    
    // Regular publication code below - use comments hook
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
        false,
        slug,
        undefined,
        "/api/rest/transactions/publications/" + slug,
        spaceSlug ? "/api/rest/free?inSpaceSlug=" + spaceSlug : null,
        balance,
        updBalance,
        plus,
        minus,
        activeCommentHook,
        onlyPublication
    );

    useEffect(() => {
        if (onlyPublication || isDetailPage) {
            showPlus();
            setShowComments(true);
        }
    }, [onlyPublication, isDetailPage]);

    const publicationUnderReply = activeCommentHook[0] == slug;
    const nobodyUnderReply = activeCommentHook[0] === null;
    const commentUnderReply = activeCommentHook[0] && activeCommentHook[0] !== slug && activeCommentHook[0] !== null;
    const [showDimensionsEditor, setShowDimensionsEditor] = useState(false);
    
    const tagsStr = [
        "#" + keyword,
        ...(Object.entries(dimensions || {}) || [])
            .map(([slug, dim]) => "#" + dim)
            .flat(),
    ].join(" ");

    const avatarUrl = authorPhotoUrl || telegramGetAvatarLink(tgAuthorId);
    
    // Prepare withdraw slider content for author's regular posts
    const disabled = withdrawMerits ? !amountInMerits : !amount;
    
    const withdrawSliderContent = isAuthor && directionAdd !== undefined && (
        <>
            {withdrawMerits &&
                (loading ? (
                    <Spinner />
                ) : (
                    <FormWithdraw
                        comment={comment}
                        setComment={setComment}
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
                        comment={comment}
                        setComment={setComment}
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
                "mb-5 transition-all duration-300",
                publicationUnderReply ? "scale-100 opacity-100" : 
                activeSlider && activeSlider !== postId ? "scale-95 opacity-60" : "scale-100 opacity-100"
            )}
            onClick={(e) => {
                if (
                    activeSlider === postId &&
                    myId !== tgAuthorId &&
                    !(e.target as any)?.className?.match("clickable")
                ) {
                    setActiveSlider && setActiveSlider(null);
                }
            }}
            key={slug}
        >
            <CardPublication
                title={displayTitle}
                subtitle={dateVerbose(ts)}
                avatarUrl={avatarUrl}
                onAvatarUrlNotFound={() => {
                    const fallbackUrl = telegramGetAvatarLinkUpd(tgAuthorId);
                    if (fallbackUrl !== avatarUrl) {
                        // Force re-render with fallback avatar
                        const imgElement = document.querySelector(`img[src="${avatarUrl}"]`) as HTMLImageElement;
                        if (imgElement) imgElement.src = fallbackUrl;
                    }
                }}
                description={tagsStr}
                onClick={!isDetailPage ? () => {
                    // Navigate to post detail page
                    if (tgChatId && slug) {
                        router.push(`/meriter/communities/${tgChatId}/posts/${slug}`);
                    }
                } : undefined}
                onDescriptionClick={
                    myId == tgAuthorId ? () => setShowDimensionsEditor(true) : undefined
                }
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
                            onPlus={() => {
                                showPlus();
                                setActiveSlider && setActiveSlider(postId);
                            }}
                            onMinus={() => {
                                showMinus();
                                setActiveSlider && setActiveSlider(postId);
                            }}
                            onLeft={!isDetailPage ? () => {
                                // Navigate to post detail page
                                if (tgChatId && slug) {
                                    router.push(`/meriter/communities/${tgChatId}/posts/${slug}`);
                                }
                            } : () => {
                                // On detail page, comment counter is visible but not clickable
                            }}
                            commentCount={comments?.length || 0}
                        />
                    )
                }
                showCommunityAvatar={showCommunityAvatar}
                communityAvatarUrl={communityInfo?.chat?.photo}
                communityName={communityInfo?.chat?.title || tgChatName}
                communityIconUrl={communityInfo?.icon}
                onCommunityClick={() => {
                    if (communityId) {
                        router.push(`/meriter/communities/${communityId}`);
                    }
                }}
                withdrawSliderContent={withdrawSliderContent}
            >
                <WithTelegramEntities entities={entities}>
                    {messageText}
                </WithTelegramEntities>
            </CardPublication>
            {showDimensionsEditor && dimensionConfig && tgAuthorId == myId && (
                <FormDimensionsEditor
                    level="publication"
                    dimensions={dimensions}
                    dimensionConfig={dimensionConfig}
                    onSave={(dimensions) => {
                        // Dead API call - endpoint /api/d/meriter/setdimensions doesn't exist
                        console.warn('SetDimensions endpoint not implemented', { slug, dimensions });
                    }}
                />
            )}

            {showComments && (
                <div className="publication-comments">
                    <div className="comments">
                        {comments?.map((c) => (
                            <Comment
                                key={c._id}
                                {...c}
                                balance={balance}
                                updBalance={updBalance}
                                spaceSlug={spaceSlug}
                                inPublicationSlug={slug}
                                activeCommentHook={activeCommentHook}
                                activeSlider={activeSlider}
                                setActiveSlider={setActiveSlider}
                                myId={myId}
                                highlightTransactionId={highlightTransactionId}
                                wallets={wallets}
                                updateWalletBalance={updateWalletBalance}
                                activeWithdrawPost={activeWithdrawPost}
                                setActiveWithdrawPost={setActiveWithdrawPost}
                                updateAll={updateAll}
                                isDetailPage={isDetailPage}
                            />
                        ))}
                    </div>
                </div>
            )}
            {publicationUnderReply && !(tgAuthorId == myId) && (
                <BottomPortal>
                    {" "}
                    <FormComment key={formCommentProps.uid} {...formCommentProps} />
                </BottomPortal>
            )}
        </div>
    );
};
