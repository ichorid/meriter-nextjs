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
import { usePublication, useCommunity, useWallets } from '@/hooks/api';
import { useWalletBalance } from '@/hooks/api/useWallet';
import { getWalletBalance } from '@/lib/utils/wallet';
import { trpc } from '@/lib/trpc/client';
import { getPublicationIdentifier } from '@/lib/utils/publication';
import { PublicationHeader } from '@/components/organisms/Publication/PublicationHeader';
import { PublicationContent } from '@/components/organisms/Publication/PublicationContent';
import { PublicationActions } from '@/components/organisms/Publication/PublicationActions';
import { InvestmentBreakdownInline } from '@/components/organisms/InvestmentBreakdownPopup';
import { PostSettingsReadOnly } from '@/components/organisms/Publication/PostSettingsReadOnly';
import { CollapsibleSection } from '@/components/ui/taxonomy/CollapsibleSection';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/shadcn/avatar';
import { Button } from '@/components/ui/shadcn/button';
import { Comment as CommentComponent } from "@features/comments/components/comment";

interface PostPageClientProps {
    communityId: string;
    slug: string;
}

export function PostPageClient({ communityId: chatId, slug }: PostPageClientProps) {
    const router = useRouter();
    const searchParams = useSearchParams();
    const t = useTranslations('common');
    const tShared = useTranslations('shared');
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
    const utils = trpc.useUtils();
    const { data: publication, isLoading: publicationLoading, error: publicationError, isFetched: publicationFetched } = usePublication(slug);
    const { data: community } = useCommunity(chatId);
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
        chatId, // communityId
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
                    // Transform meta to include id fields expected by child components
                    const transformedMeta = {
                        ...(publication as any).meta,
                        author: {
                            ...(publication as any).meta?.author,
                            id: (publication as any).authorId,
                        },
                        beneficiary: (publication as any).beneficiaryId && (publication as any).meta?.beneficiary
                            ? {
                                ...(publication as any).meta.beneficiary,
                                id: (publication as any).beneficiaryId,
                            }
                            : undefined,
                    };

                    return (
                    <article className="bg-[#F5F5F5] dark:bg-[#2a3239] rounded-xl p-5 shadow-none">

                        <PublicationHeader
                            publication={{
                                id: (publication as any).id,
                                slug: (publication as any).slug || (publication as any).id,
                                createdAt: (publication as any).createdAt,
                                meta: transformedMeta,
                                postType: (publication as any).postType,
                                isProject: (publication as any).isProject,
                                permissions: (publication as any).permissions,
                            }}
                            showCommunityAvatar={false}
                            className="mb-3"
                            authorId={(publication as any).authorId}
                            metrics={(publication as any).metrics}
                            publicationId={(publication as any).id}
                            communityId={chatId}
                            isPoll={false}
                        />

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
                        />

                        <PublicationActions
                            publication={{
                                id: (publication as Record<string, unknown>).id,
                                createdAt: (publication as Record<string, unknown>).createdAt,
                                authorId: (publication as Record<string, unknown>).authorId,
                                beneficiaryId: (publication as Record<string, unknown>).beneficiaryId,
                                communityId: chatId,
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
                            }}
                            onVote={() => {}}
                            onComment={() => {}}
                            activeCommentHook={activeCommentHook}
                            isVoting={false}
                            isCommenting={false}
                            maxPlus={currentBalance}
                            wallets={wallets}
                            hideVoteAndScore={false}
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
                        {investingEnabled && publicationId && (
                            <CollapsibleSection
                                title={tInvesting('breakdownTitle', { defaultValue: 'Investments' })}
                                open={investmentBreakdownOpen}
                                setOpen={setInvestmentBreakdownOpen}
                            >
                                <InvestmentBreakdownInline postId={publicationId} compact />
                            </CollapsibleSection>
                        )}

                        <CollapsibleSection
                            title={tPublicationsCreate('postSettings', { defaultValue: 'Post settings' })}
                            open={postSettingsOpen}
                            setOpen={setPostSettingsOpen}
                        >
                            <PostSettingsReadOnly
                                title={(publication as Record<string, unknown>).title as string | undefined}
                                description={(publication as Record<string, unknown>).description as string | undefined}
                                postType={(publication as Record<string, unknown>).postType as string | undefined}
                                hashtags={((publication as Record<string, unknown>).hashtags as string[]) ?? []}
                                categories={((publication as Record<string, unknown>).categories as string[]) ?? []}
                                impactArea={(publication as Record<string, unknown>).impactArea as string | undefined}
                                beneficiaries={((publication as Record<string, unknown>).beneficiaries as string[]) ?? []}
                                methods={((publication as Record<string, unknown>).methods as string[]) ?? []}
                                stage={(publication as Record<string, unknown>).stage as string | undefined}
                                helpNeeded={((publication as Record<string, unknown>).helpNeeded as string[]) ?? []}
                                compact
                            />
                        </CollapsibleSection>
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
                            // Check if user has already voted (has a comment/vote)
                            const hasUserVoted = user?.id && comments?.some((c: any) => 
                                c.authorId === user.id || c.meta?.author?.id === user.id
                            );
                            
                            return !hasUserVoted && (
                                <div className="mb-6">
                                    <Button
                                        variant="outline"
                                        onClick={() => {
                                            // Regular and team communities: allow spending daily quota first, then overflow into wallet merits
                                            // Special groups preserve their restrictions.
                                            const typeTag = community?.typeTag;
                                            const mode: 'standard' | 'wallet-only' | 'quota-only' =
                                                typeTag === 'future-vision'
                                                    ? 'wallet-only'
                                                    : typeTag === 'marathon-of-good'
                                                        ? 'quota-only'
                                                        : 'standard';
                                            useUIStore.getState().openVotingPopup(slug, 'publication', mode);
                                        }}
                                        className="w-full"
                                    >
                                        {t('vote')}
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
                                    communityId={chatId}
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

