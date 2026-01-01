'use client';

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useTranslations } from 'next-intl';
import { AdaptiveLayout } from '@/components/templates/AdaptiveLayout';
import { SimpleStickyHeader } from '@/components/organisms/ContextTopBar/ContextTopBar';
import { SortToggle } from '@/components/ui/SortToggle';
import { type SortValue } from '@/components/ui/SortTabs';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/shadcn/avatar';
import { Button } from '@/components/ui/shadcn/button';
import { User } from 'lucide-react';
import { Comment } from "@features/comments/components/comment";
import { useUIStore } from '@/stores/ui.store';
import { useComments } from "@shared/hooks/use-comments";
import { useAuth } from '@/contexts/AuthContext';
import { usePublication, useCommunity, useWallets, useUserProfile } from '@/hooks/api';
import { useWalletBalance } from '@/hooks/api/useWallet';
import { Loader2 } from 'lucide-react';
import DOMPurify from 'dompurify';

interface PostPageClientProps {
    communityId: string;
    slug: string;
}

export function PostPageClient({ communityId: chatId, slug }: PostPageClientProps) {
    const router = useRouter();
    const searchParams = useSearchParams();
    const t = useTranslations('common');
    const _tComments = useTranslations('comments');

    // Get highlight parameter from URL for comment highlighting
    const highlightCommentId = searchParams?.get('highlight');

    // Comment sort state
    const [commentSort, setCommentSort] = useState<SortValue>('recent');

    // Use v1 API hooks
    const { user } = useAuth();
    const { data: publication, isLoading: publicationLoading, error: publicationError, isFetched: publicationFetched } = usePublication(slug);
    const { data: community } = useCommunity(chatId);

    // Fetch author profile
    const { data: author } = useUserProfile(publication?.authorId || '');

    const { data: balance = 0 } = useWalletBalance(chatId);
    const { data: wallets = [] } = useWallets();

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
                {/* Publication Header Card */}
                {publication && (
                    <article className="bg-base-100 rounded-xl py-6 sm:py-8">
                        {/* Post Type Badge */}
                        {(publication as any).isProject && (
                            <div className="mb-4">
                                <span className="inline-flex items-center px-3 py-1 text-xs font-semibold bg-blue-500/10 text-blue-600 dark:text-blue-400 rounded-full">
                                    ПРОЕКТ
                                </span>
                            </div>
                        )}

                        {/* Title */}
                        {(publication as any).title && (
                            <h1 className="text-2xl sm:text-3xl font-bold mb-4 text-base-content leading-tight">
                                {(publication as any).title}
                            </h1>
                        )}

                        {/* Author Info */}
                        <div className="flex items-center gap-3 mb-6">
                            <Avatar
                                className="w-10 h-10 cursor-pointer"
                                onClick={() => {
                                    if ((publication as any).authorId) {
                                        router.push(`/meriter/users/${(publication as any).authorId}`);
                                    }
                                }}
                            >
                                <AvatarImage
                                    src={(publication as any).authorAvatarUrl}
                                    alt={(publication as any).authorName || 'Author'}
                                />
                                <AvatarFallback userId={(publication as any).authorId}>
                                    {(publication as any).authorName?.charAt(0).toUpperCase() || 'A'}
                                </AvatarFallback>
                            </Avatar>
                            <div className="flex-1 min-w-0">
                                <div className="text-sm font-semibold text-base-content">
                                    {(publication as any).authorName || t('anonymous')}
                                </div>
                                <div className="text-xs text-base-content/60">
                                    {(publication as any).createdAt && new Date((publication as any).createdAt).toLocaleDateString()}
                                </div>
                            </div>
                        </div>

                        {/* Cover Image */}
                        {(publication as any).imageUrl && (
                            <div className="mb-6 -mx-6 sm:-mx-8">
                                <img
                                    src={(publication as any).imageUrl}
                                    alt={(publication as any).title || 'Post cover'}
                                    className="w-full h-auto max-h-96 object-cover"
                                />
                            </div>
                        )}

                        {/* Content */}
                        {(publication as any).content && (
                            <div
                                className="prose prose-sm sm:prose max-w-none text-base-content/90 leading-relaxed mb-6"
                                dangerouslySetInnerHTML={{
                                    __html: DOMPurify.sanitize((publication as any).content)
                                }}
                            />
                        )}

                        {/* Tags */}
                        {(publication as any).tags && (publication as any).tags.length > 0 && (
                            <div className="flex flex-wrap gap-2 mb-6">
                                {(publication as any).tags.map((tag: string, index: number) => (
                                    <span
                                        key={index}
                                        className="inline-flex items-center px-2.5 py-1 text-xs font-medium bg-base-200/50 text-base-content/70 rounded-lg"
                                    >
                                        #{tag}
                                    </span>
                                ))}
                            </div>
                        )}

                        {/* Stats Bar */}
                        <div className="flex items-center gap-4 pt-4 text-sm text-base-content/60">
                            <div className="flex items-center gap-1.5">
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                                </svg>
                                <span>{(publication as any).viewCount || 0} views</span>
                            </div>
                            <div className="flex items-center gap-1.5">
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                                </svg>
                                <span>{comments?.length || 0} comments</span>
                            </div>
                        </div>
                    </article>
                )}

                {/* Comments Section */}
                {publication && showComments && (
                    <div className="mt-8">
                        <div className="flex items-center justify-between mb-6">
                            <h2 className="text-xl font-bold text-base-content">
                                {t('comments')}
                                <span className="ml-2 text-sm font-normal text-base-content/50">
                                    {comments?.length || 0}
                                </span>
                            </h2>
                        </div>

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
                                {t('addComment')}
                            </Button>
                        </div>

                        {/* Comments List */}
                        <div className="flex flex-col gap-3">
                            {comments?.map((c: any, index: number) => (
                                <Comment
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

