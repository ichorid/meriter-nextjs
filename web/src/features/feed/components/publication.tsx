'use client';

import { useComments } from "@shared/hooks/use-comments";
import { useEffect, useState } from "react";
import { CardPublication } from "./card-publication";
import { useCommunity, usePoll } from '@/hooks/api';
import { dateVerbose } from "@shared/lib/date";
import { BarVoteUnified } from "@shared/components/bar-vote-unified";
import { BarWithdraw } from "@shared/components/bar-withdraw";
import { WithTelegramEntities } from "@shared/components/with-telegram-entities";
import { FormDimensionsEditor } from "@shared/components/form-dimensions-editor";
import { useUIStore } from "@/stores/ui.store";
import { classList } from "@lib/classList";
import { Comment } from "@features/comments/components/comment";
import { PollCasting } from "@features/polls/components/poll-casting";
import type { IPollData } from "@features/polls/types";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { useTranslations } from 'next-intl';
import type { Publication as PublicationType } from '@/types/api-v1';
import { ResourcePermissions } from '@/types/api-v1';

export const Publication = (props: any) => {
    const {
        minus,
        plus,
        sum,
        slug,
        spaceSlug,
        balance,
        updBalance = () => {},
        messageText,
        authorPhotoUrl,
        keyword,
        ts,
        activeCommentHook,
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
        wallets,
        updateWalletBalance,
        updateAll,
        currency,
        inMerits,
        currencyOfCommunityTgChatId,
        fromTgChatId,
        communityId,
        authorId,
        meta,
        commentSortBy,
        imageUrl,
    } = props;
    
    const originalPublication = props;
    // ALL HOOKS MUST BE CALLED BEFORE ANY CONDITIONAL RETURNS
    // This is required by React's Rules of Hooks
    
    const t = useTranslations('feed');
    const router = useRouter();
    const pathname = usePathname();
    const searchParams = useSearchParams();
    
    // Check if we're on the community feed page (not the detail page)
    const isOnCommunityFeedPage = pathname?.match(/^\/meriter\/communities\/[^/]+$/);
    
    // Use internal IDs only - no legacy fallbacks
    const displayAuthorName = meta?.author?.name || 'Unknown';
    const displayChatName = meta?.origin?.telegramChatName || '';
    
    // Create a unique identifier for this post (needed before useComments)
    const postId = slug || _id;
    
    // Check if current user is the author - use internal IDs for comparison
    const isAuthor = myId === authorId;
    
    // Check if there's a beneficiary and it's different from the author
    const hasBeneficiary = beneficiaryId && beneficiaryId !== authorId;
    
    // Check if current user is the beneficiary (but not the author)
    const isBeneficiary = hasBeneficiary && beneficiaryId === myId;
    
    // Get comments data first (needed for currentPlus/currentMinus)
    // Always call hooks even if we might return early - React requires consistent hook calls
    const {
        comments,
        currentPlus,
        currentMinus,
        showComments,
        setShowComments,
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
        communityId || '',
        wallets,
        commentSortBy || 'recent'
    );
    
    // Get community info to check typeTag
    const { data: communityInfo } = useCommunity(communityId || '');
    const isSpecialGroup = communityInfo?.typeTag === 'marathon-of-good' || communityInfo?.typeTag === 'future-vision';
    
    // Check if this is a PROJECT post (no voting allowed)
    const isProject = type === 'project' || (meta as any)?.isProject === true;
    
    // Use API permissions instead of calculating on frontend
    const canVote = (originalPublication as any).permissions?.canVote ?? false;
    const voteDisabledReason = (originalPublication as any).permissions?.voteDisabledReason;
    
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
    
    // Additional hooks must be called before any conditional returns
    useEffect(() => {
        if (onlyPublication || isDetailPage) {
            setShowComments(true);
        }
    }, [onlyPublication, isDetailPage, setShowComments]);
    
    const [showDimensionsEditor, setShowDimensionsEditor] = useState(false);
    
    // NOW we can do conditional returns after all hooks are called
    // Use internal IDs only - no legacy fallbacks
    if (!displayChatName && type !== 'poll') return null;
    
    // Require communityId and authorId - fail gracefully if missing
    if (!communityId || !authorId) {
        console.warn('Publication missing required IDs:', { communityId, authorId });
        return null;
    }
    
    // Calculate derived values after early return checks
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
    
    // Mutual exclusivity logic:
    // Withdrawal feature is disabled - merits are automatically credited on upvote
    // Topup functionality is still available through the voting popup
    // Show vote if: !isAuthor && !isBeneficiary (or if isAuthor && hasBeneficiary - author can vote for beneficiary)
    // IMPORTANT: If user is beneficiary, NEVER show vote button (even if balance is 0)
    const showWithdraw = false; // Withdrawals disabled
    const showVote = !isAuthor && !isBeneficiary;
    const showVoteForAuthor = isAuthor && hasBeneficiary; // Author can vote when there's a beneficiary
    const currentScore = currentPlus - currentMinus;
    
    // Calculate total votes (current score + withdrawn votes) for display
    // Check if withdrawals data is available in originalPublication
    const totalWithdrawn = (originalPublication as any)?.withdrawals?.totalWithdrawn || 0;
    const totalVotes = totalWithdrawn > 0 ? currentScore + totalWithdrawn : undefined;
    
    // Community info already fetched above - reuse it
    const communityIdForRouting = communityInfo?.id || communityId;
    
    // Display title - use meta.author.name
    const displayTitle = displayAuthorName;
    
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
                "mb-5 transition-all duration-300"
            )}
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
                authorId={authorId}
                beneficiaryId={beneficiaryId}
                coverImageUrl={imageUrl}
                galleryImages={originalPublication?.images || []}
                bottom={
                    (() => {
                        if (showWithdraw) {
                            return (
                                <BarWithdraw
                                    balance={maxWithdrawAmount}
                                    onWithdraw={() => {
                                        useUIStore.getState().openWithdrawPopup(
                                            postId,
                                            'publication-topup',
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
                            if (!routingCommunityId || !slug) return;
                            
                            // If on community feed page, set query parameter to show side panel
                            if (isOnCommunityFeedPage) {
                                const params = new URLSearchParams(searchParams?.toString() || '');
                                params.set('post', slug);
                                router.push(`${pathname}?${params.toString()}`);
                            } else {
                                // Otherwise, navigate to detail page
                                router.push(`/meriter/communities/${routingCommunityId}/posts/${slug}`);
                            }
                        } : undefined}
                                />
                            );
                        } else {
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
                                        if (!routingCommunityId || !slug) return;
                                        
                                        // If on community feed page, set query parameter to show side panel
                                        if (isOnCommunityFeedPage) {
                                            const params = new URLSearchParams(searchParams?.toString() || '');
                                            params.set('post', slug);
                                            router.push(`${pathname}?${params.toString()}`);
                                        } else {
                                            // Otherwise, navigate to detail page
                                            router.push(`/meriter/communities/${routingCommunityId}/posts/${slug}`);
                                        }
                                    } : undefined}
                                    canVote={canVote}
                                    disabledReason={voteDisabledReason}
                                    totalVotes={totalVotes}
                                />
                            );
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
                    {/* Existing Comments */}
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
