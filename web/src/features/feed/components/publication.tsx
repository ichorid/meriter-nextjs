'use client';

import { useComments } from "@shared/hooks/use-comments";
import { useEffect, useState } from "react";
import { CardPublication } from "./card-publication";
import { useCommunity, usePoll } from '@/hooks/api';
import { dateVerbose } from "@shared/lib/date";
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
import { useTranslations } from 'next-intl';
import type { Publication as PublicationType } from '@/types/api-v1';

export const Publication = ({
    minus,
    plus,
    sum,
    slug,
    spaceSlug,
    balance,
    updBalance = () => {}, // Default no-op function
    messageText,
    authorPhotoUrl,
    keyword,
    ts,
    activeCommentHook,
    activeSlider,
    setActiveSlider,
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
    // Internal IDs (required)
    communityId,
    authorId,
    meta,
}: any) => {
    const t = useTranslations('feed');
    // Use internal IDs only - no legacy fallbacks
    const displayAuthorName = meta?.author?.name || 'Unknown';
    const displayChatName = meta?.origin?.telegramChatName || '';
    
    if (!displayChatName && type !== 'poll') return null;
    const router = useRouter();
    
    // Require communityId and authorId - fail gracefully if missing
    if (!communityId || !authorId) {
        console.warn('Publication missing required IDs:', { communityId, authorId });
        return null;
    }
    
    // Check if current user is the author - use internal IDs for comparison
    const isAuthor = myId === authorId;
    
    // Check if there's a beneficiary and it's different from the author
    const hasBeneficiary = beneficiaryId && beneficiaryId !== authorId;
    
    // Check if current user is the beneficiary (but not the author)
    const isBeneficiary = hasBeneficiary && beneficiaryId === myId;
    
    // Create a unique identifier for this post (needed before useComments)
    const postId = slug || _id;
    
    // Get comments data first (needed for currentPlus/currentMinus)
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
        balance,
        updBalance,
        plus,
        minus,
        activeCommentHook,
        onlyPublication,
        communityId,
        wallets
    );
    
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
      authorId,
      beneficiaryId,
      hasBeneficiary,
      isAuthor,
      isBeneficiary,
      currentScore,
      currentPlus,
      currentMinus,
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
    
    useEffect(() => {
        setOptimisticSum(sum);
    }, [sum]);
    
    const curr = communityId;
    const currentBalance =
        (Array.isArray(wallets) &&
            wallets.find((w) => w.communityId === curr)
                ?.balance) ||
        0;
    const [showselector, setShowselector] = useState(false);
    
    // Rate conversion no longer needed with v1 API - currencies are normalized
    const rate = 1;
    
    // Ensure we have a valid number before doing arithmetic
    // Handle NaN, null, and undefined values
    const isValidNumber = (value: number | null | undefined): value is number => {
        return typeof value === 'number' && !isNaN(value);
    };
    const calculatedSum = isValidNumber(optimisticSum) ? optimisticSum : (isValidNumber(sum) ? sum : 0);
    const maxWithdrawAmount = isAuthor
        ? Math.floor(10 * calculatedSum) / 10
        : 0;
    
    const maxTopUpAmount = isAuthor
        ? Math.floor(10 * currentBalance) / 10
        : 0;
    
    // Community info - use communityId
    const { data: communityInfo } = useCommunity(communityId || '');
    const communityIdForRouting = communityInfo?.id || communityId;
    
    // Display title - use meta.author.name
    const displayTitle = displayAuthorName;
    
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

    const avatarUrl = authorPhotoUrl || meta?.author?.photoUrl;
    
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
                    myId !== authorId &&
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
                    // Avatar error handling - use meta.author.photoUrl as fallback
                    const fallbackUrl = meta?.author?.photoUrl;
                    if (fallbackUrl && fallbackUrl !== avatarUrl) {
                        // Force re-render with fallback avatar
                        const imgElement = document.querySelector(`img[src="${avatarUrl}"]`) as HTMLImageElement;
                        if (imgElement) imgElement.src = fallbackUrl;
                    }
                }}
                description={tagsStr}
                onClick={!isDetailPage ? () => {
                    // Navigate to post detail page - use internal community ID
                    const routingCommunityId = communityInfo?.id || communityId;
                    if (routingCommunityId && slug) {
                        router.push(`/meriter/communities/${routingCommunityId}/posts/${slug}`);
                    }
                } : undefined}
                onDescriptionClick={
                    myId == authorId ? () => setShowDimensionsEditor(true) : undefined
                }
                beneficiaryName={hasBeneficiary ? beneficiaryName : undefined}
                beneficiaryAvatarUrl={hasBeneficiary ? beneficiaryPhotoUrl : undefined}
                beneficiarySubtitle={hasBeneficiary ? beneficiaryUsername : undefined}
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
                            const routingCommunityId = communityInfo?.id || communityId;
                            if (routingCommunityId && slug) {
                                router.push(`/meriter/communities/${routingCommunityId}/posts/${slug}`);
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
                            const routingCommunityId = communityInfo?.id || communityId;
                            if (routingCommunityId && slug) {
                                router.push(`/meriter/communities/${routingCommunityId}/posts/${slug}`);
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
                communityName={communityInfo?.name || displayChatName}
                communityIconUrl={communityInfo?.settings?.iconUrl}
                onCommunityClick={() => {
                    // Use internal community ID for routing if available
                    const routingCommunityId = communityInfo?.id || communityIdForRouting;
                    if (!routingCommunityId) return;
                    
                    if (communityInfo?.needsSetup) {
                        if (communityInfo?.isAdmin) {
                            // Admin: redirect to settings
                            router.push(`/meriter/communities/${routingCommunityId}/settings`);
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
                        router.push(`/meriter/communities/${routingCommunityId}`);
                    }
                }}
                communityNeedsSetup={communityInfo?.needsSetup}
                communityIsAdmin={communityInfo?.isAdmin}
            >
                <WithTelegramEntities entities={entities}>
                    {messageText}
                </WithTelegramEntities>
            </CardPublication>
            {showDimensionsEditor && dimensionConfig && authorId == myId && (
                <FormDimensionsEditor
                    level="publication"
                    dimensions={dimensions}
                    dimensionConfig={dimensionConfig}
                    onSave={(dimensions) => {
                        // Dimensions editing removed - endpoint not implemented
                        console.warn('Dimensions editing not implemented', { slug, dimensions });
                        setShowDimensionsEditor(false);
                    }}
                />
            )}

            {showComments && (
                <div className="publication-comments">
                    <div className="comments">
                        {comments?.map((c: any, index: number) => (
                            <Comment
                                key={c.id || c._id || `comment-${index}`}
                                {...c}
                                _id={c._id || c.id || `comment-${index}`}
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
                                communityId={communityId}
                                isDetailPage={isDetailPage}
                            />
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
};
