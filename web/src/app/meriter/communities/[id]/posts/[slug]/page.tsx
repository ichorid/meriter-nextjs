'use client';

import { use, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useTranslations } from 'next-intl';
import { AdaptiveLayout } from '@/components/templates/AdaptiveLayout';
import { PageHeader } from '@/components/ui/PageHeader';
import { SortTabs, type SortValue } from '@/components/ui/SortTabs';
import { BrandAvatar } from '@/components/ui/BrandAvatar';
import { useRouter } from "next/navigation";
import { Comment } from "@features/comments/components/comment";
import { useComments } from "@shared/hooks/use-comments";
import { useAuth } from '@/contexts/AuthContext';
import { usePublication, useCommunity, useWallets, useUserProfile } from '@/hooks/api';
import { useWalletBalance } from '@/hooks/api/useWallet';
import { Loader2 } from 'lucide-react';
import DOMPurify from 'dompurify';

const PostPage = ({ params }: { params: Promise<{ id: string; slug: string }> }) => {
    const router = useRouter();
    const searchParams = useSearchParams();
    const t = useTranslations('common');
    const tComments = useTranslations('comments');
    const resolvedParams = use(params);
    const chatId = resolvedParams.id;
    const slug = resolvedParams.slug;
    
    // Get highlight parameter from URL for comment highlighting
    const highlightCommentId = searchParams?.get('highlight');
    
    // Comment sort state
    const [commentSort, setCommentSort] = useState<SortValue>('recent');

    // Use v1 API hooks
    const { user } = useAuth();
    const { data: publication, isLoading: publicationLoading, error: publicationError } = usePublication(slug);
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
        async () => {}, // updBalance
        0, // plusGiven
        0, // minusGiven
        activeCommentHook, // activeCommentHook
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

    // Page title based on publication
    const pageTitle = publication?.title || t('post');

    const pageHeader = (
        <PageHeader
            title={
                <button 
                    onClick={() => router.push(`/meriter/communities/${chatId}`)}
                    className="flex items-center gap-2 hover:opacity-80 transition-opacity"
                >
                    {community && (
                        <>
                            <BrandAvatar
                                src={community.avatarUrl}
                                fallback={community.name}
                                size="sm"
                                className="w-6 h-6"
                            />
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
                <SortTabs
                    value={commentSort}
                    onChange={setCommentSort}
                    size="sm"
                />
            }
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
            <div className="space-y-4">
                {/* Publication Header Card with Cover as Background */}
                {publication && (
                    <article 
                        className="relative rounded-2xl overflow-hidden border border-base-content/5"
                        style={(publication as any).imageUrl ? {
                            backgroundImage: `linear-gradient(to bottom, rgba(0,0,0,0.2), rgba(0,0,0,0.6)), url(${(publication as any).imageUrl})`,
                            backgroundSize: 'cover',
                            backgroundPosition: 'center',
                            minHeight: '200px',
                        } : undefined}
                    >
                        <div className={`p-5 h-full flex flex-col justify-end ${(publication as any).imageUrl ? 'text-white min-h-[200px]' : 'bg-base-100'}`}>
                            {/* Post Type Badge */}
                            {(publication as any).isProject && (
                                <div className="mb-3">
                                    <span className="inline-block px-2 py-1 text-xs font-semibold bg-blue-600 text-white rounded">
                                        ПРОЕКТ
                                    </span>
                                </div>
                            )}
                            
                            {/* Title */}
                            {(publication as any).title && (
                                <h1 className={`text-xl sm:text-2xl font-bold mb-3 ${(publication as any).imageUrl ? 'text-white drop-shadow-lg' : 'text-base-content'}`}>
                                    {(publication as any).title}
                                </h1>
                            )}
                            
                            {/* Author Info */}
                            <div className={`flex items-center gap-3 ${(publication as any).imageUrl ? '' : 'mt-2 pt-2 border-t border-base-content/10'}`}>
                                <BrandAvatar
                                    src={author?.avatarUrl}
                                    fallback={author?.displayName || (publication as any).authorDisplay || 'Author'}
                                    size="md"
                                    className="w-10 h-10"
                                />
                                <div>
                                    <div className={`font-medium ${(publication as any).imageUrl ? 'text-white drop-shadow' : 'text-base-content'}`}>
                                        {author?.displayName || (publication as any).authorDisplay || 'Author'}
                                    </div>
                                    <div className={`text-xs ${(publication as any).imageUrl ? 'text-white/80' : 'text-base-content/60'}`}>
                                        {new Date(publication.createdAt).toLocaleDateString()}
                                    </div>
                                </div>
                                
                                {/* Score */}
                                {publication.metrics?.score !== undefined && (
                                    <div className={`ml-auto text-lg font-bold ${(publication as any).imageUrl ? 'text-white drop-shadow' : 'text-base-content'}`}>
                                        {publication.metrics.score > 0 ? '+' : ''}{publication.metrics.score}
                                    </div>
                                )}
                            </div>
                        </div>
                    </article>
                )}
                
                {/* Post Content - Outside the card */}
                {publication && ((publication as any).description || publication.content) && (
                    <div className="bg-base-100 rounded-2xl p-5 border border-base-content/5">
                        <div className="prose prose-sm dark:prose-invert max-w-none">
                            {(() => {
                                const content = (publication as any).description || publication.content || '';
                                const isHtml = content.includes('<') && content.includes('>');
                                if (isHtml && typeof window !== 'undefined') {
                                    const sanitized = DOMPurify.sanitize(content, {
                                        ALLOWED_TAGS: ['p', 'br', 'strong', 'em', 'u', 'h1', 'h2', 'h3', 'ul', 'ol', 'li', 'a', 'blockquote', 'code'],
                                        ALLOWED_ATTR: ['href', 'target', 'rel'],
                                    });
                                    return <div dangerouslySetInnerHTML={{ __html: sanitized }} />;
                                }
                                return <p className="whitespace-pre-wrap">{content}</p>;
                            })()}
                        </div>
                    </div>
                )}

                {/* Comments Section */}
                {publication && showComments && (
                    <div className="bg-base-100 rounded-2xl p-5 border border-base-content/5">
                        <h3 className="text-lg font-semibold mb-4">{t('comments')} ({comments?.length || 0})</h3>
                        
                        {/* Comments List */}
                        <div className="space-y-4">
                            {comments?.map((c: any, index: number) => (
                                <Comment
                                    key={c.id || c._id || `comment-${index}`}
                                    {...c}
                                    _id={c._id || c.id || `comment-${index}`}
                                    balance={balance}
                                    updBalance={() => {}}
                                    spaceSlug=""
                                    inPublicationSlug={slug}
                                    activeCommentHook={activeCommentHook}
                                    myId={user?.id}
                                    highlightTransactionId={highlightCommentId || undefined}
                                    wallets={wallets}
                                    updateWalletBalance={() => {}}
                                    updateAll={() => {}}
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
};

export default PostPage;

