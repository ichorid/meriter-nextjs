'use client';

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useTranslations } from 'next-intl';
import { AdaptiveLayout } from '@/components/templates/AdaptiveLayout';
import { SimpleStickyHeader } from '@/components/organisms/ContextTopBar/ContextTopBar';
import { SortToggle } from '@/components/ui/SortToggle';
import { type SortValue } from '@/components/ui/SortTabs';
import { Loader2, User } from 'lucide-react';
import { useComments } from "@shared/hooks/use-comments";
import { useAuth } from '@/contexts/AuthContext';
import { useUIStore } from '@/stores/ui.store';
import { useToastStore } from '@/shared/stores/toast.store';
import { usePublication, useCommunity, useWallets } from '@/hooks/api';
import { useUserRoles } from '@/hooks/api/useProfile';
import { useWalletBalance } from '@/hooks/api/useWallet';
import { getWalletBalance } from '@/lib/utils/wallet';
import { trpc } from '@/lib/trpc/client';
import { getPublicationIdentifier } from '@/lib/utils/publication';
import { PublicationHeader } from '@/components/organisms/Publication/PublicationHeader';
import { PublicationContent } from '@/components/organisms/Publication/PublicationContent';
import { PublicationActions } from '@/components/organisms/Publication/PublicationActions';
import { InvestmentBreakdownInline } from '@/components/organisms/InvestmentBreakdownPopup';
import { PostInvestingSettingsReadOnly } from '@/components/organisms/Publication/PostInvestingSettingsReadOnly';
import { CollapsibleSection } from '@/components/ui/taxonomy/CollapsibleSection';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/shadcn/avatar';
import { Button } from '@/components/ui/shadcn/button';
import { Comment as CommentComponent } from "@features/comments/components/comment";
import {
  TicketPostPanel,
  type TicketPostPanelPublication,
} from '@/components/organisms/Project/TicketPostPanel';
import { TicketPostPageHeaderBlock } from '@/components/organisms/Project/ticket-post-page-header';
import { TicketOpenNeutralApply } from '@/components/organisms/Project/TicketOpenNeutralApply';
import { TicketActivityLogCollapsible } from '@/components/organisms/Project/TicketActivityLogCollapsible';
import type { TicketStatus } from '@meriter/shared-types';
import type { TicketActivityPublicationSlice } from '@/components/organisms/Project/mergeTicketActivity';
import {
    resolveVoteCtaCommentMode,
    voteCtaUsesCommentLabel,
} from '@/lib/utils/vote-cta-label';
import { ticketHasWorkAccepted } from '@/lib/utils/project-ticket';

interface PostPageClientProps {
    communityId: string;
    slug: string;
}

export function PostPageClient({ communityId: chatId, slug }: PostPageClientProps) {
    const router = useRouter();
    const searchParams = useSearchParams();
    const t = useTranslations('common');
    const tShared = useTranslations('shared');
    const tComments = useTranslations('comments');
    const tInvesting = useTranslations('investing');
    const tPublicationsCreate = useTranslations('publications.create');

    // Collapsible sections: collapsed by default
    const [investmentBreakdownOpen, setInvestmentBreakdownOpen] = useState(false);
    const [postSettingsOpen, setPostSettingsOpen] = useState(false);

    // Get highlight parameter from URL for comment highlighting
    const highlightCommentId = searchParams?.get('highlight');

    // Comment sort state
    const [commentSort, setCommentSort] = useState<SortValue>('recent');

    // Use v1 API hooks
    const { user } = useAuth();
    const addToast = useToastStore((s) => s.addToast);
    const utils = trpc.useUtils();
    const { data: publication, isLoading: publicationLoading, error: publicationError, isFetched: publicationFetched } = usePublication(slug);
    const publicationCommunityId =
        (publication as { communityId?: string } | undefined)?.communityId ?? chatId;
    const { data: community } = useCommunity(chatId);
    const { data: votingContextCommunity } = useCommunity(publicationCommunityId);
    const { data: userRoles = [] } = useUserRoles(user?.id || '');
    const isLeadInCommunity = userRoles.some(
        (r: { communityId: string; role: string }) => r.communityId === chatId && r.role === 'lead',
    );
    const canModerateTicketsOnPost = Boolean(
        user &&
        (publication as { postType?: string } | undefined)?.postType === 'ticket' &&
        community &&
        (community as { isProject?: boolean }).isProject &&
        (isLeadInCommunity || user.globalRole === 'superadmin'),
    );
    const publicationId = (publication as { id?: string })?.id;
    const investingEnabled = (publication as { investingEnabled?: boolean })?.investingEnabled ?? false;
    
    const { data: balance = 0 } = useWalletBalance(chatId);
    const { data: wallets = [] } = useWallets();
    const currentBalance = getWalletBalance(wallets, chatId);

    const activeCommentHook = useState<string | null>(null);
    const [activeWithdrawPost, setActiveWithdrawPost] = useState<string | null>(null);

    // Get comments for this publication
    const {
        comments,
        showComments,
        setShowComments,
    } = useComments(
        false, // forTransaction
        slug, // publicationSlug
        "", // transactionId
        balance, // balance
        async () => { }, // updBalance
        0, // plusGiven
        0, // minusGiven
        activeCommentHook, // activeCommentHook - still needed for reply comments
        true, // onlyPublication - show comments by default
        publicationCommunityId, // publication's home community (OB vs URL community)
        wallets, // wallets
        commentSort // sortBy
    );

    // Show comments by default on detail page
    useEffect(() => {
        setShowComments(true);
    }, [setShowComments]);

    useEffect(() => {
        if (!user?.id) {
            router.push("/meriter/login?returnTo=" + encodeURIComponent(window.location.pathname));
        }
    }, [user, router]);

    // Handle 404 - redirect to not-found if publication doesn't exist
    useEffect(() => {
        // Only check after query has completed and user is authenticated
        if (publicationFetched && !publicationLoading && user?.id) {
            // Check if publication doesn't exist (error with NOT_FOUND code)
            const isNotFound =
                publicationError &&
                ((publicationError as any)?.data?.code === 'NOT_FOUND' ||
                    (publicationError as any)?.message?.includes('not found'));

            if (isNotFound) {
                // Redirect to not-found page
                router.replace('/meriter/not-found');
            }
        }
    }, [publicationFetched, publicationLoading, publicationError, user, router]);

    // Auto-scroll to highlighted comment when page loads
    useEffect(() => {
        if (highlightCommentId && publication) {
            const timer = setTimeout(() => {
                const highlightedElement = document.querySelector(`[data-comment-id="${highlightCommentId}"]`);
                if (highlightedElement) {
                    highlightedElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
                    highlightedElement.classList.add('highlight');
                    setTimeout(() => {
                        highlightedElement.classList.remove('highlight');
                    }, 3000);
                }
            }, 500);
            return () => clearTimeout(timer);
        }
        return undefined;
    }, [highlightCommentId, publication]);

    // Page title based on publication (unused but kept for future use)
    const _pageTitle = publication?.title || t('post');

    const pageHeader = (
        <SimpleStickyHeader
            title={
                <button
                    onClick={() => router.push(`/meriter/communities/${chatId}`)}
                    className="flex items-center gap-2 hover:opacity-80 transition-opacity"
                >
                    {community && (
                        <>
                            <Avatar className="w-6 h-6 text-xs">
                                {community.avatarUrl && (
                                    <AvatarImage src={community.avatarUrl} alt={community.name} />
                                )}
                                <AvatarFallback communityId={community.id} className="font-medium uppercase">
                                    {community.name ? community.name.slice(0, 2).toUpperCase() : <User size={14} />}
                                </AvatarFallback>
                            </Avatar>
                            <span className="font-medium truncate max-w-[150px]">
                                {community.name}
                            </span>
                            {community.settings?.iconUrl && (
                                <img
                                    src={community.settings.iconUrl}
                                    alt=""
                                    className="w-4 h-4"
                                />
                            )}
                        </>
                    )}
                </button>
            }
            showBack={true}
            onBack={() => router.push(`/meriter/communities/${chatId}`)}
            rightAction={
                <SortToggle
                    value={commentSort as 'recent' | 'voted'}
                    onChange={(val) => setCommentSort(val)}
                    compact={true}
                />
            }
            asStickyHeader={true}
        />
    );

    // Show loading state
    if (publicationLoading) {
        return (
            <AdaptiveLayout
                className="feed"
                communityId={chatId}
                balance={balance}
                wallets={wallets}
                myId={user?.id}
                activeCommentHook={activeCommentHook}
                activeWithdrawPost={activeWithdrawPost}
                setActiveWithdrawPost={setActiveWithdrawPost}
                stickyHeader={pageHeader}
            >
                <div className="flex justify-center items-center h-64">
                    <Loader2 className="w-8 h-8 animate-spin text-brand-primary" />
                </div>
            </AdaptiveLayout>
        );
    }

    // Show error state
    if (publicationError || !publication) {
        return (
            <AdaptiveLayout
                className="feed"
                communityId={chatId}
                balance={balance}
                wallets={wallets}
                myId={user?.id}
                activeCommentHook={activeCommentHook}
                activeWithdrawPost={activeWithdrawPost}
                setActiveWithdrawPost={setActiveWithdrawPost}
                stickyHeader={pageHeader}
            >
                <div className="flex flex-col items-center justify-center h-64">
                    <p className="text-error">{t('publicationNotFound')}</p>
                    <button
                        className="btn btn-primary mt-4"
                        onClick={() => router.push(`/meriter/communities/${chatId}`)}
                    >
                        {t('backToCommunity')}
                    </button>
                </div>
            </AdaptiveLayout>
        );
    }

    const isProjectCommunity = Boolean(
        (votingContextCommunity as { isProject?: boolean } | undefined)?.isProject,
    );
    const isTicketPost = (publication as { postType?: string }).postType === 'ticket';
    const ticketClosedAccepted =
        isTicketPost &&
        isProjectCommunity &&
        (publication as { ticketStatus?: string }).ticketStatus === 'closed' &&
        ticketHasWorkAccepted(
            publication as { ticketActivityLog?: Array<{ action?: string }> },
        );
    const isProjectDiscussion =
        (publication as { postType?: string }).postType === 'discussion' && isProjectCommunity;
    const hideWithdrawFromProjectAppreciation =
        (isProjectCommunity && isProjectDiscussion) || ticketClosedAccepted;

    const voteCtaMode = resolveVoteCtaCommentMode({
        publicationStatus: (publication as { status?: string }).status,
        postType: (publication as { postType?: string }).postType,
        communitySettings: votingContextCommunity?.settings as
            | { commentMode?: 'all' | 'neutralOnly' | 'weightedOnly'; tappalkaOnlyMode?: boolean }
            | undefined,
    });
    const voteCtaPrimaryLabel = voteCtaUsesCommentLabel(voteCtaMode)
        ? tComments('commentButton')
        : tComments('voteTitle');

    return (
        <AdaptiveLayout
            className="feed"
            communityId={chatId}
            balance={balance}
            wallets={wallets}
            myId={user?.id}
            activeCommentHook={activeCommentHook}
            activeWithdrawPost={activeWithdrawPost}
            setActiveWithdrawPost={setActiveWithdrawPost}
            stickyHeader={pageHeader}
        >
            <div className="space-y-4 pb-24">
                {/* Publication Card - same style as feed */}
                {publication && (() => {
                    const pub = publication as Record<string, unknown> & {
                        authorId?: string;
                        authorKind?: 'user' | 'community';
                        authoredCommunityId?: string;
                        publishedByUserId?: string;
                        beneficiaryId?: string;
                        meta?: {
                            author?: { id?: string; name?: string; photoUrl?: string; username?: string };
                            beneficiary?: { id?: string; name?: string; photoUrl?: string; username?: string };
                            publishedBy?: { id?: string; name?: string; photoUrl?: string; username?: string };
                        };
                    };
                    const isCommunityAuthorDetail =
                        pub.authorKind === 'community' && Boolean(pub.authoredCommunityId);

                    // Align with PublicationCard: stable author id for content + header (community id when posting as community)
                    const transformedMeta = {
                        ...pub.meta,
                        author: {
                            ...pub.meta?.author,
                            id:
                                isCommunityAuthorDetail && pub.authoredCommunityId
                                    ? pub.authoredCommunityId
                                    : pub.authorId,
                        },
                        beneficiary:
                            pub.beneficiaryId && pub.meta?.beneficiary
                                ? {
                                      ...pub.meta.beneficiary,
                                      id: pub.beneficiaryId,
                                  }
                                : undefined,
                    };

                    return (
                    <article className="bg-[#F5F5F5] dark:bg-[#2a3239] rounded-xl p-5 shadow-none">

                        <PublicationHeader
                            publication={{
                                id: pub.id as string,
                                slug: (pub.slug as string | undefined) || (pub.id as string),
                                createdAt: pub.createdAt as string,
                                meta: transformedMeta,
                                postType: pub.postType as string | undefined,
                                isProject: pub.isProject as boolean | undefined,
                                permissions: pub.permissions as Record<string, unknown> | undefined,
                                authorKind: pub.authorKind,
                                authoredCommunityId: pub.authoredCommunityId,
                                publishedByUserId: pub.publishedByUserId,
                            }}
                            showCommunityAvatar={false}
                            className="mb-3"
                            authorId={(publication as any).authorId}
                            metrics={(publication as any).metrics}
                            publicationId={(publication as any).id}
                            communityId={chatId}
                            isPoll={false}
                            ticketToolbarOnly={isTicketPost}
                        />

                        {isTicketPost ? (() => {
                            const pub = publication as Record<string, unknown>;
                            const ticketStatus = (pub.ticketStatus ?? 'in_progress') as TicketStatus;
                            const beneficiaryId = typeof pub.beneficiaryId === 'string' ? pub.beneficiaryId : '';
                            const assigneeUnset = Boolean(
                                pub.isNeutralTicket &&
                                    pub.ticketStatus === 'open' &&
                                    !beneficiaryId,
                            );
                            const assignee = beneficiaryId
                                ? {
                                    id: beneficiaryId,
                                    name:
                                        transformedMeta.beneficiary?.name?.trim() ||
                                        transformedMeta.beneficiary?.username ||
                                        beneficiaryId.slice(0, 8),
                                    photoUrl: transformedMeta.beneficiary?.photoUrl,
                                    username: transformedMeta.beneficiary?.username,
                                }
                                : null;
                            const authorIdStr =
                                typeof pub.authorId === 'string' ? pub.authorId : '';
                            return (
                                <TicketPostPageHeaderBlock
                                    title={(pub.title as string | undefined) || undefined}
                                    publicationId={String(pub.id ?? '')}
                                    ticketStatus={ticketStatus}
                                    author={{
                                        id: authorIdStr || undefined,
                                        name: transformedMeta.author?.name || 'Unknown',
                                        photoUrl: transformedMeta.author?.photoUrl,
                                        username: transformedMeta.author?.username,
                                    }}
                                    assignee={assignee}
                                    assigneeUnset={assigneeUnset}
                                />
                            );
                        })() : null}

                        {isTicketPost && publication && (
                            <TicketOpenNeutralApply
                                ticketId={(publication as { id: string }).id}
                                currentUserId={user?.id}
                                canModerateTickets={canModerateTicketsOnPost}
                                isNeutralTicket={Boolean(
                                    (publication as { isNeutralTicket?: boolean }).isNeutralTicket,
                                )}
                                ticketStatus={String(
                                    (publication as { ticketStatus?: string }).ticketStatus ?? 'open',
                                )}
                                applicants={
                                    Array.isArray((publication as { applicants?: unknown }).applicants)
                                        ? (publication as { applicants: string[] }).applicants
                                        : []
                                }
                            />
                        )}

                        {isTicketPost && (
                            <TicketPostPanel
                                communityId={chatId}
                                communityIsProject={Boolean(
                                    community && (community as { isProject?: boolean }).isProject,
                                )}
                                publication={publication as unknown as TicketPostPanelPublication}
                                layout="actionsOnly"
                                onInvalidate={() => {
                                    void utils.publications.getById.invalidate({
                                        id: getPublicationIdentifier(publication) ?? '',
                                    });
                                }}
                            />
                        )}

                        <PublicationContent
                            publication={{
                                id: (publication as any).id,
                                createdAt: (publication as any).createdAt,
                                content: (publication as any).content,
                                title: (publication as any).title,
                                description: (publication as any).description,
                                isProject: (publication as any).isProject,
                                postType: (publication as any).postType,
                                images: (publication as any).images,
                                hashtags: (publication as any).hashtags || [],
                                categories: (publication as any).categories || [],
                                impactArea: (publication as any).impactArea,
                                stage: (publication as any).stage,
                                beneficiaries: (publication as any).beneficiaries,
                                methods: (publication as any).methods,
                                helpNeeded: (publication as any).helpNeeded,
                                meta: transformedMeta,
                            }}
                            className="mb-4"
                            hideTitle={isTicketPost}
                        />

                        <PublicationActions
                            publication={{
                                id: (publication as Record<string, unknown>).id,
                                createdAt: (publication as Record<string, unknown>).createdAt,
                                authorId: (publication as Record<string, unknown>).authorId,
                                beneficiaryId: (publication as Record<string, unknown>).beneficiaryId,
                                communityId: publicationCommunityId,
                                slug: (publication as Record<string, unknown>).slug || (publication as Record<string, unknown>).id,
                                content: (publication as Record<string, unknown>).content,
                                permissions: (publication as Record<string, unknown>).permissions,
                                type: ((publication as Record<string, unknown>).type as string) || 'text',
                                metrics: (publication as Record<string, unknown>).metrics,
                                meta: transformedMeta,
                                postType: (publication as Record<string, unknown>).postType,
                                isProject: (publication as Record<string, unknown>).isProject,
                                withdrawals: ((publication as Record<string, unknown>).withdrawals as Record<string, unknown>) || { totalWithdrawn: 0 },
                                investingEnabled: (publication as Record<string, unknown>).investingEnabled ?? false,
                                investorSharePercent: (publication as Record<string, unknown>).investorSharePercent ?? 50,
                                investmentPool: (publication as Record<string, unknown>).investmentPool ?? 0,
                                investmentPoolTotal: (publication as Record<string, unknown>).investmentPoolTotal ?? 0,
                                status: (publication as Record<string, unknown>).status as string | undefined,
                                closingSummary: (publication as Record<string, unknown>).closingSummary as { totalEarned: number; distributedToInvestors: number; authorReceived: number; spentOnShows: number } | undefined,
                                ttlExpiresAt: (publication as Record<string, unknown>).ttlExpiresAt as Date | string | null | undefined,
                                ticketStatus: (publication as Record<string, unknown>).ticketStatus as string | undefined,
                                ticketActivityLog: (publication as Record<string, unknown>).ticketActivityLog as
                                    | Array<{ action?: string }>
                                    | undefined,
                            }}
                            onVote={() => {}}
                            onComment={() => {}}
                            activeCommentHook={activeCommentHook}
                            isVoting={false}
                            isCommenting={false}
                            maxPlus={currentBalance}
                            wallets={wallets}
                            ticketPostMode={isTicketPost && !ticketClosedAccepted}
                            hideWithdrawFromProjectAppreciation={hideWithdrawFromProjectAppreciation}
                            updateAll={() => {
                                void utils.publications.getById.invalidate({ id: getPublicationIdentifier(publication) ?? '' });
                            }}
                        />
                    </article>
                    );
                })()}

                {/* Expanded sections (E-4): collapsible Investment breakdown, Post settings - collapsed by default */}
                {publication && (
                    <div className="mt-6 space-y-4">
                        {isTicketPost ? (
                            <TicketActivityLogCollapsible publication={publication as TicketActivityPublicationSlice} />
                        ) : (
                            <>
                                {investingEnabled && publicationId && (
                                    <CollapsibleSection
                                        title={tInvesting('breakdownTitle')}
                                        open={investmentBreakdownOpen}
                                        setOpen={setInvestmentBreakdownOpen}
                                    >
                                        <InvestmentBreakdownInline postId={publicationId} compact />
                                    </CollapsibleSection>
                                )}

                                {!isProjectDiscussion && (
                                    <CollapsibleSection
                                        title={tPublicationsCreate('postParamsReadOnly')}
                                        open={postSettingsOpen}
                                        setOpen={setPostSettingsOpen}
                                    >
                                        <PostInvestingSettingsReadOnly
                                            investorSharePercent={(publication as Record<string, unknown>).investorSharePercent as number | undefined}
                                            ttlExpiresAt={(publication as Record<string, unknown>).ttlExpiresAt as Date | string | null | undefined}
                                            stopLoss={(publication as Record<string, unknown>).stopLoss as number | undefined}
                                            noAuthorWalletSpend={(publication as Record<string, unknown>).noAuthorWalletSpend as boolean | undefined}
                                        />
                                    </CollapsibleSection>
                                )}
                            </>
                        )}
                    </div>
                )}

                {/* Vote history (comments = votes, inline) */}
                {publication && showComments && (
                    <div className="mt-8">
                        <div className="flex items-center justify-between mb-6">
                            <h2 className="text-xl font-bold text-base-content">
                                {tShared('comments')}
                                <span className="ml-2 text-sm font-normal text-base-content/50">
                                    {comments?.length || 0}
                                </span>
                            </h2>
                        </div>

                        {(() => {
                            const hasUserVoted = Boolean(
                                user?.id &&
                                    comments?.some(
                                        (c: { authorId?: string; meta?: { author?: { id?: string } } }) =>
                                            c.authorId === user.id || c.meta?.author?.id === user.id,
                                    ),
                            );
                            const postStatus = (publication as { status?: string }).status ?? 'active';
                            const votePerms = (
                                publication as {
                                    permissions?: { canVote?: boolean; voteDisabledReason?: string };
                                }
                            ).permissions;
                            const canVoteOnPost = votePerms?.canVote ?? false;

                            if (hasUserVoted || !canVoteOnPost || postStatus === 'closed') {
                                return null;
                            }

                            return (
                                <div className="mb-6">
                                    <Button
                                        variant="outline"
                                        onClick={() => {
                                            if (!canVoteOnPost) {
                                                const reason = votePerms?.voteDisabledReason;
                                                let msg = tShared('voteDisabled.default');
                                                if (reason) {
                                                    try {
                                                        const tr = tShared(reason);
                                                        if (tr !== reason) {
                                                            msg = tr;
                                                        }
                                                    } catch {
                                                        /* use default */
                                                    }
                                                }
                                                addToast(msg, 'error');
                                                return;
                                            }
                                            const typeTag = votingContextCommunity?.typeTag;
                                            const mode: 'standard' | 'wallet-only' | 'quota-only' =
                                                typeTag === 'future-vision'
                                                    ? 'wallet-only'
                                                    : typeTag === 'marathon-of-good'
                                                      ? 'quota-only'
                                                      : 'standard';
                                            useUIStore.getState().openVotingPopup(slug, 'publication', mode, {
                                                publicationIsTask: isTicketPost && !ticketClosedAccepted,
                                                taskAllowWeightedMerits: ticketClosedAccepted,
                                            });
                                        }}
                                        className="w-full"
                                    >
                                        {voteCtaPrimaryLabel}
                                    </Button>
                                </div>
                            );
                        })()}

                        {/* Comments List */}
                        <div className="flex flex-col gap-3">
                            {comments?.map((c: any, index: number) => (
                                <CommentComponent
                                    key={c.id || c._id || `comment-${index}`}
                                    {...c}
                                    _id={c._id || c.id || `comment-${index}`}
                                    balance={balance}
                                    updBalance={() => { }}
                                    spaceSlug=""
                                    inPublicationSlug={slug}
                                    activeCommentHook={activeCommentHook}
                                    myId={user?.id}
                                    highlightTransactionId={highlightCommentId || undefined}
                                    wallets={wallets}
                                    updateWalletBalance={() => { }}
                                    updateAll={() => { }}
                                    communityId={publicationCommunityId}
                                    isDetailPage={true}
                                />
                            ))}
                        </div>
                    </div>
                )}
            </div>
        </AdaptiveLayout>
    );
}

