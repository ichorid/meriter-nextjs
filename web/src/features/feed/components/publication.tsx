'use client';

import { useComments } from "@shared/hooks/use-comments";
import { useEffect, useState } from "react";
import { CardPublication } from "./card-publication";
import { useCommunity, usePoll } from '@/hooks/api';
import { usersApiV1 } from '@/lib/api/v1';
import { dateVerbose } from "@shared/lib/date";
import {
    telegramGetAvatarLink,
    telegramGetAvatarLinkUpd,
} from "@lib/telegram";
import { BarVoteUnified } from "@shared/components/bar-vote-unified";
import { BarWithdraw } from "@shared/components/bar-withdraw";
import { WithTelegramEntities } from "@shared/components/withTelegramEntities";
import { FormDimensionsEditor } from "@shared/components/form-dimensions-editor";
import { useUIStore } from "@/stores/ui.store";
import { classList } from "@lib/classList";
import { Comment } from "@features/comments/components/comment";
import { PollCasting } from "@features/polls/components/poll-casting";
import type { IPollData } from "@features/polls/types";
import { useRouter } from "next/navigation";
import { useQuery } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';

export interface IPublication {
    tgChatName: string;
    tgMessageId: string;
    minus: number;
    plus: number;
    sum: number;
    slug: string;
    spaceSlug: string;
    balance: any;
    updBalance?: any;
    messageText: string;
    authorPhotoUrl: string;
    tgAuthorName: string;
    tgAuthorId?: string;
    beneficiaryName?: string;
    beneficiaryPhotoUrl?: string;
    beneficiaryId?: string;
    beneficiaryUsername?: string;
    keyword: string;
    ts: string;
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
    updateAll,
    currency,
    inMerits,
    currencyOfCommunityTgChatId,
    fromTgChatId,
}: any) => {
    const t = useTranslations('feed');
    if (!tgChatName && type !== 'poll') return null;
    const router = useRouter();
    
    // Check if current user is the author
    const isAuthor = myId === tgAuthorId;
    
    // Check if there's a beneficiary and it's different from the author
    const hasBeneficiary = beneficiaryId && beneficiaryId !== tgAuthorId;
    
    // Check if current user is the beneficiary (but not the author)
    const isBeneficiary = hasBeneficiary && beneficiaryId === myId;
    
    // Mutual exclusivity logic:
    // Show withdraw if: (isAuthor && !hasBeneficiary) || isBeneficiary
    // Show vote if: !isAuthor && !isBeneficiary (or if isAuthor && hasBeneficiary - author can vote for beneficiary)
    // IMPORTANT: If user is beneficiary, NEVER show vote button (even if balance is 0)
    const showWithdraw = (isAuthor && !hasBeneficiary) || isBeneficiary;
    const showVote = !isAuthor && !isBeneficiary;
    const showVoteForAuthor = isAuthor && hasBeneficiary; // Author can vote when there's a beneficiary
    const currentScore = currentPlus - currentMinus;
    
    // Debug logging
    console.log('[Publication Feed] Mutual Exclusivity Debug:', {
      slug: postId,
      myId,
      tgAuthorId,
      beneficiaryId,
      hasBeneficiary,
      isAuthor,
      isBeneficiary,
      currentScore,
      currentPlus,
      currentMinus,
      meritsAmount,
    });
    
    console.log('[Publication Feed] Button Visibility Logic:', {
      showWithdraw,
      showVote,
      showVoteForAuthor,
      willShowWithdraw: showWithdraw,
      willShowVote: showVote || showVoteForAuthor,
      finalChoice: showWithdraw ? 'WITHDRAW' : (showVote || showVoteForAuthor ? 'VOTE' : 'NONE'),
    });
    
    // Withdrawal state management (for author's own posts)
    const [optimisticSum, setOptimisticSum] = useState(sum);
    const effectiveSum = optimisticSum ?? sum;
    
    useEffect(() => {
        setOptimisticSum(sum);
    }, [sum]);
    
    const curr = currencyOfCommunityTgChatId || fromTgChatId || tgChatId;
    const currentBalance =
        (Array.isArray(wallets) &&
            wallets.find((w) => w.communityId == curr)
                ?.amount) ||
        0;
    const [showselector, setShowselector] = useState(false);
    
    // Rate conversion no longer needed with v1 API - currencies are normalized
    const rate = 1;
    
    // Create a unique identifier for this post
    const postId = slug || _id;
    
    const maxWithdrawAmount = isAuthor
        ? Math.floor(10 * effectiveSum) / 10
        : 0;
    
    const maxTopUpAmount = isAuthor
        ? Math.floor(10 * currentBalance) / 10
        : 0;
    
    // State for polls
    const [pollUserCast, setPollUserCast] = useState(null);
    const [pollUserCastSummary, setPollUserCastSummary] = useState(null);
    const [pollData, setPollData] = useState<IPollData | null>(type === 'poll' ? content : null);
    
    // For polls, fetch the wallet balance for the specific community ONLY when not on community page
    // When on community page (showCommunityAvatar=false), the balance prop is already correct
    const pollCommunityId = type === 'poll' ? content?.communityId : null;
    // Use v1 API for poll balance
    const pollBalance = 0; // TODO: Get from wallets array for poll community
    const communityId = tgChatId || pollCommunityId;
    const { data: communityInfo } = useCommunity(communityId || '');
    
    // Fetch poll cast status if this is a poll using v1 API
    const { data: pollData_v1 } = usePoll(_id || '');
    
    useEffect(() => {
        if (pollData_v1) {
            setPollData(pollData_v1 as any);
            // TODO: Extract user votes and summary from pollData_v1
        }
    }, [pollData_v1]);

    const handlePollCastSuccess = () => {
        // Refresh poll data after casting - polling will be handled by React Query
        if (type === 'poll' && _id) {
            // Refresh balance
            updBalance();
            // Data will auto-refresh via React Query
        }
    };

    // Render poll publication (early return to avoid hooks)
    if (type === 'poll' && pollData) {
        const avatarUrl = authorPhotoUrl || telegramGetAvatarLink(tgAuthorId);
        // For author: use wallet balance from wallets array; for others: use pollBalance or passed balance
        let effectiveBalance = balance;
        if (isAuthor && Array.isArray(wallets) && pollCommunityId) {
            const pollWalletBalance = wallets.find((w: any) => w.communityId === pollCommunityId)?.amount || 0;
            effectiveBalance = pollWalletBalance;
        } else {
            effectiveBalance = showCommunityAvatar ? (pollBalance || 0) : balance;
        }
        
        const disabled = !amount;
        
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
                    communityAvatarUrl={communityInfo?.avatarUrl}
                    communityName={communityInfo?.name || tgChatName}
                    communityIconUrl={communityInfo?.settings?.iconUrl}
                    onCommunityClick={() => {
                        if (!communityId) return;
                        
                        if (communityInfo?.needsSetup) {
                            if (communityInfo?.isAdmin) {
                                // Admin: redirect to settings
                                router.push(`/meriter/communities/${communityId}/settings`);
                            } else {
                                // Non-admin: show toast
                                const { useToastStore } = require('@/shared/stores/toast.store');
                                useToastStore.getState().addToast(
                                    t('communitySetupPending'),
                                    'info'
                                );
                            }
                        } else {
                            // Normal navigation
                            router.push(`/meriter/communities/${communityId}`);
                        }
                    }}
                    communityNeedsSetup={communityInfo?.needsSetup}
                    communityIsAdmin={communityInfo?.isAdmin}
                >
                    <PollCasting
                        pollData={pollData}
                        pollId={_id || slug}
                        userCast={pollUserCast || undefined}
                        userCastSummary={pollUserCastSummary || undefined}
                        balance={effectiveBalance}
                        onCastSuccess={handlePollCastSuccess}
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
        "",
        "", // No longer used - path handled internally
        "", // No longer used - quota handled internally
        balance,
        updBalance,
        plus,
        minus,
        activeCommentHook,
        onlyPublication,
        spaceSlug
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
                    (() => {
                        console.log('[Publication Feed] Rendering bottom component:', {
                            showWithdraw,
                            showVote,
                            showVoteForAuthor,
                            isBeneficiary,
                            isAuthor,
                            hasBeneficiary,
                        });
                        
                        if (showWithdraw) {
                            console.log('[Publication Feed] Rendering BarWithdraw');
                            return (
                                <BarWithdraw
                                    balance={maxWithdrawAmount}
                                    onWithdraw={() => {
                                        useUIStore.getState().openWithdrawPopup(
                                            postId,
                                            'publication-withdraw',
                                            maxWithdrawAmount,
                                            maxTopUpAmount
                                        );
                                    }}
                                    onTopup={() => {
                                        useUIStore.getState().openWithdrawPopup(
                                            postId,
                                            'publication-topup',
                                            maxWithdrawAmount,
                                            maxTopUpAmount
                                        );
                                    }}
                                    showDisabled={isBeneficiary || (isAuthor && !hasBeneficiary)} // Show disabled state for beneficiaries and authors without beneficiary
                                    commentCount={!isDetailPage ? comments?.length || 0 : 0}
                                    onCommentClick={!isDetailPage ? () => {
                                        if (tgChatId && slug) {
                                            router.push(`/meriter/communities/${tgChatId}/posts/${slug}`);
                                        }
                                    } : undefined}
                                />
                            );
                        } else if (showVote || showVoteForAuthor) {
                            console.log('[Publication Feed] Rendering BarVoteUnified', {
                                showVote,
                                showVoteForAuthor,
                                isBeneficiary,
                                isAuthor,
                                hasBeneficiary,
                            });
                            return (
                                <BarVoteUnified
                                    score={currentScore}
                                    onVoteClick={() => {
                                        useUIStore.getState().openVotingPopup(postId, 'publication');
                                    }}
                                    isAuthor={isAuthor}
                                    isBeneficiary={isBeneficiary}
                                    hasBeneficiary={hasBeneficiary}
                                    commentCount={!isDetailPage ? comments?.length || 0 : 0}
                                    onCommentClick={!isDetailPage ? () => {
                                        if (tgChatId && slug) {
                                            router.push(`/meriter/communities/${tgChatId}/posts/${slug}`);
                                        }
                                    } : undefined}
                                />
                            );
                        } else {
                            console.log('[Publication Feed] Rendering null (no buttons)');
                            return null;
                        }
                    })()
                }
                showCommunityAvatar={showCommunityAvatar}
                communityAvatarUrl={communityInfo?.avatarUrl}
                communityName={communityInfo?.name || tgChatName}
                communityIconUrl={communityInfo?.settings?.iconUrl}
                onCommunityClick={() => {
                    if (!communityId) return;
                    
                    if (communityInfo?.needsSetup) {
                        if (communityInfo?.isAdmin) {
                            // Admin: redirect to settings
                            router.push(`/meriter/communities/${communityId}/settings`);
                        } else {
                            // Non-admin: show toast
                            const { useToastStore } = require('@/shared/stores/toast.store');
                            useToastStore.getState().addToast(
                                t('communitySetupPending'),
                                'info'
                            );
                        }
                    } else {
                        // Normal navigation
                        router.push(`/meriter/communities/${communityId}`);
                    }
                }}
                communityNeedsSetup={communityInfo?.needsSetup}
                communityIsAdmin={communityInfo?.isAdmin}
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
                        {comments?.map((c: any) => (
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
                                updateAll={updateAll}
                                isDetailPage={isDetailPage}
                            />
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
};
