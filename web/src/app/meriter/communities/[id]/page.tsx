'use client';

import { useEffect, useRef, useState, use, useMemo } from "react";
import { useQueryClient } from '@tanstack/react-query';
import { AdaptiveLayout } from '@/components/templates/AdaptiveLayout';
import { useRouter, useSearchParams } from "next/navigation";
import { PublicationCardComponent as PublicationCard } from "@/components/organisms/Publication";
import { FormPollCreate } from "@features/polls";
import { BottomPortal } from "@shared/components/bottom-portal";
import { useTranslations } from 'next-intl';
import { useWallets, useCommunity } from '@/hooks/api';
import { useCommunityFeed } from '@/hooks/api/useCommunityFeed';
import { useWalletBalance } from '@/hooks/api/useWallet';
import { useAuth } from '@/contexts/AuthContext';
import { routes } from '@/lib/constants/routes';
import { queryKeys } from '@/lib/constants/queryKeys';
import type { FeedItem, PublicationFeedItem, PollFeedItem } from '@meriter/shared-types';

// Publication type imported from shared-types (single source of truth)


const CommunityPage = ({ params }: { params: Promise<{ id: string }> }) => {
    const router = useRouter();
    const searchParams = useSearchParams();
    const t = useTranslations('pages');
    const tCommunities = useTranslations('communities');
    const resolvedParams = use(params);
    const chatId = resolvedParams.id;
    const pathname = `/meriter/communities/${chatId}`;
    
    // Get the post parameter from URL for deep linking
    const targetPostSlug = searchParams.get('post');
    
    // Get sort and modal state from URL params
    const sortBy = searchParams.get('sort') || 'recent';
    const selectedTag = searchParams.get('tag');
    const showPollCreate = searchParams.get('modal') === 'createPoll';

    const [paginationEnd, setPaginationEnd] = useState(false);
    const [highlightedPostId, setHighlightedPostId] = useState<string | null>(null);
    
    // Handle poll modal close
    const handlePollClose = () => {
        const params = new URLSearchParams(searchParams.toString());
        params.delete('modal');
        router.push(`?${params.toString()}`);
    };

    // Use v1 API hook
    const { data: comms } = useCommunity(chatId);

    const {
        data,
        fetchNextPage,
        hasNextPage,
        isFetchingNextPage,
        error: err
    } = useCommunityFeed(chatId, {
        pageSize: 5,
        sort: sortBy === 'recent' ? 'recent' : 'score',
        tag: selectedTag || undefined,
    });

    // Derive paginationEnd from hasNextPage instead of setting it in getNextPageParam
    useEffect(() => {
        if (!hasNextPage) {
            setPaginationEnd(true);
        }
    }, [hasNextPage]);

    // Memoize feed items array (can contain both publications and polls)
    const publications = useMemo(() => {
        return (data?.pages ?? [])
            .flatMap((page: any) => {
                // The API returns PaginatedResponse which has a 'data' property with the array
                if (page?.data && Array.isArray(page.data)) {
                    return page.data;
                }
                // Fallback: empty array
                return [];
            })
            .map((p: any) => ({
                ...p,
                slug: p.slug || p.id, // Ensure slug is set (use id as fallback)
                beneficiaryId: p.beneficiaryId || p.meta?.beneficiary?.username,
                beneficiaryName: p.meta?.beneficiary?.name,
                beneficiaryPhotoUrl: p.meta?.beneficiary?.photoUrl,
                beneficiaryUsername: p.meta?.beneficiary?.username,
                // Ensure type is set
                type: p.type || (p.content ? 'publication' : 'poll'),
            }))
            .filter((p: FeedItem, index: number, self: FeedItem[]) => 
                index === self.findIndex((t: FeedItem) => t?.id === p?.id)
            );
    }, [data?.pages]); // Only recalculate when data.pages changes

    // Debug logging
    useEffect(() => {
        if (data) {
            console.log('📊 Publications data:', {
                pagesCount: data.pages?.length,
                firstPage: data.pages?.[0],
                publicationsCount: publications.length
            });
        }
    }, [data, publications.length]);

    // Handle deep linking to specific post
    useEffect(() => {
        if (targetPostSlug && publications.length > 0) {
            console.log('🔍 Looking for post with slug:', targetPostSlug);
            console.log('🔍 Available publications:', publications.map((p: FeedItem) => ({ slug: p.slug, id: p.id, type: p.type })));
            
            const targetPost = publications.find((p: FeedItem) => p.slug === targetPostSlug);
            if (targetPost) {
                console.log('🎯 Found target post for deep link:', targetPostSlug, 'with id:', targetPost.id);
                setHighlightedPostId(targetPost.id);
                
                // Scroll to the post after a short delay to ensure it's rendered
                setTimeout(() => {
                    const postElement = document.getElementById(`post-${targetPost.id}`);
                    if (postElement) {
                        console.log('🎯 Scrolling to post element:', postElement);
                        postElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
                        // Remove highlight after 3 seconds
                        setTimeout(() => setHighlightedPostId(null), 3000);
                    } else {
                        console.log('❌ Post element not found with id:', `post-${targetPost.id}`);
                    }
                }, 500);
            } else {
                console.log('❌ Target post not found with slug:', targetPostSlug);
            }
        }
    }, [targetPostSlug, publications]);

    const error =
        (publications??[])?.[0]?.error || err
            ? true
            : publications.length > 0
            ? false
            : undefined;

    const { user, isLoading: userLoading, isAuthenticated } = useAuth();
    const { data: wallets = [], isLoading: walletsLoading } = useWallets();
    
    // Get wallet balance using standardized hook
    const { data: balance = 0 } = useWalletBalance(chatId);

    useEffect(() => {
        if (!userLoading && !isAuthenticated) {
            router.push("/meriter/login?returnTo=" + encodeURIComponent(document.location.pathname));
        }
    }, [isAuthenticated, userLoading, router]);


    const [findTransaction, setFindTransaction] = useState<string | undefined>(undefined);
    useEffect(() => {
        if (document.location.search)
            setFindTransaction(document.location.search?.replace("#", ""));
    }, []);

    const cooldown = useRef(false);
    useEffect(() => {
        const fn = () => {
            if (
                window.innerHeight + window.scrollY >=
                document.body.offsetHeight
            ) {
                if (!paginationEnd && !cooldown.current) {
                    fetchNextPage();

                    cooldown.current = true;
                    setTimeout(() => {
                        cooldown.current = false;
                    }, 500);
                }
            }
        };
        window.addEventListener("scroll", fn);
        return () => window.removeEventListener("scroll", fn);
    }, []);

    // Use community data for chat info (same as comms)
    const chatName = comms?.name;
    const chatUrl = comms?.description;
    const chatNameVerb = String(comms?.name ?? "");
    
    const queryClient = useQueryClient();
    
    // ALL HOOKS MUST BE CALLED BEFORE ANY CONDITIONAL RETURNS
    // Declare all state hooks unconditionally at the top level
    const activeCommentHook = useState<string | null>(null);
    const [activeSlider, setActiveSlider] = useState<string | null>(null);
    const [activeWithdrawPost, setActiveWithdrawPost] = useState<string | null>(null);

    // Early return AFTER all hooks have been called
    if (!isAuthenticated) return null;

    const tgAuthorId = user?.id;

    const onlyPublication =
        publications.filter((p: FeedItem) => (p.type === 'publication' ? p.content : true) || p.type === 'poll')?.length == 1;
    
    const sortItems = (items: FeedItem[]): FeedItem[] => {
        if (!items) return [];
        return [...items].sort((a, b) => {
            if (sortBy === "recent") {
                return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
            } else {
                // Handle score sorting - publications have score, polls have totalAmount
                const aScore = a.type === 'publication' 
                    ? (a.metrics?.score || 0)
                    : (a.metrics?.totalAmount || 0);
                const bScore = b.type === 'publication'
                    ? (b.metrics?.score || 0)
                    : (b.metrics?.totalAmount || 0);
                return bScore - aScore;
            }
        });
    };

    // Filter publications by tag if selected
    const filteredPublications = selectedTag
        ? publications.filter((p: FeedItem) => {
            if (p.type === 'publication') {
                const tags = p.hashtags as string[] | undefined;
                return tags && Array.isArray(tags) && tags.includes(selectedTag);
            } else {
                // Polls don't have hashtags in the schema, skip filtering
                return true;
            }
        })
        : publications;

    const handlePostSelect = (postSlug: string) => {
        const params = new URLSearchParams(searchParams.toString());
        params.set('post', postSlug);
        router.push(`?${params.toString()}`);
    };

    return (
        <AdaptiveLayout
            className="feed"
            communityId={chatId}
            balance={balance}
            wallets={Array.isArray(wallets) ? wallets : []}
            myId={user?.id}
            activeCommentHook={activeCommentHook}
            activeSlider={activeSlider}
            setActiveSlider={setActiveSlider}
            activeWithdrawPost={activeWithdrawPost}
            setActiveWithdrawPost={setActiveWithdrawPost}
        >
            {error === false && (
                <>
                    <div>
                        {chatUrl && (
                            <div className="tip">
                                {t('communities.toAddPublication')}{" "}
                                <a href={chatUrl}>
                                    {" "}
                                    {t('communities.writeMessageInChat')}
                                </a>{" "}
                                <br />
                                <br />
                            </div>
                        )}
                    </div>
                </>
            )}
            {error === true && <div>{t('communities.noAccess')}</div>}

            {/* Setup banner */}
            {comms?.needsSetup && (
                <div 
                    className={comms?.isAdmin ? "alert alert-warning cursor-pointer" : "alert alert-info"}
                    onClick={comms?.isAdmin ? () => router.push(routes.communitySettings(chatId)) : undefined}
                    role={comms?.isAdmin ? "button" : undefined}
                    tabIndex={comms?.isAdmin ? 0 : undefined}
                    onKeyDown={comms?.isAdmin ? (e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                            e.preventDefault();
                            router.push(routes.communitySettings(chatId));
                        }
                    } : undefined}
                >
                    <span>
                        {comms?.isAdmin 
                            ? tCommunities('unconfigured.banner.admin')
                            : tCommunities('unconfigured.banner.user')
                        }
                    </span>
                </div>
            )}

            <div className="space-y-4">
                {isAuthenticated &&
                    filteredPublications
                        .filter((p: FeedItem) => {
                            if (p.type === 'publication') {
                                return !!p.content;
                            } else {
                                return p.type === 'poll';
                            }
                        })
                        .map((p) => {
                            // Console logging for debugging
                            console.log('📄 Rendering publication card:', {
                                id: p.id,
                                type: 'PublicationCardComponent',
                                hasBeneficiary: !!p.meta?.beneficiary,
                                beneficiary: p.meta?.beneficiary,
                                meta: p.meta,
                                fullPublication: p
                            });
                            
                            // Check if this post is selected (for comments)
                            const isSelected = !!(targetPostSlug && (p.slug === targetPostSlug || p.id === targetPostSlug));
                            
                            return (
                                <div
                                    key={p.id}
                                    id={`post-${p.id}`}
                                    className={
                                        highlightedPostId === p.id 
                                            ? 'ring-2 ring-primary ring-opacity-50 rounded-lg p-2 bg-primary bg-opacity-10' 
                                            : isSelected
                                            ? 'ring-2 ring-secondary ring-opacity-70 rounded-lg p-2 bg-secondary bg-opacity-10 transition-all duration-300'
                                            : ''
                                    }
                                >
                                    <PublicationCard
                                        publication={p}
                                        wallets={Array.isArray(wallets) ? wallets : []}
                                        showCommunityAvatar={false}
                                        isSelected={isSelected}
                                    />
                                </div>
                            );
                        })}
                {!paginationEnd && filteredPublications.length > 1 && (
                    <button onClick={() => fetchNextPage()} className="btn btn-primary btn-wide mx-auto block">
                        {t('communities.loadMore')}
                    </button>
                )}
            </div>
            {showPollCreate && (
                <BottomPortal>
                    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[9999] p-5 overflow-y-auto pointer-events-auto">
                        <div className="pointer-events-auto">
                            <FormPollCreate
                                communityId={chatId}
                                onSuccess={(pollId) => {
                                    handlePollClose();
                                    // Invalidate feed query to refresh data
                                    queryClient.invalidateQueries({ 
                                        queryKey: queryKeys.communities.feed(chatId, {
                                            pageSize: 5,
                                            sort: sortBy === 'recent' ? 'recent' : 'score',
                                            tag: selectedTag || undefined,
                                        })
                                    });
                                }}
                                onCancel={handlePollClose}
                            />
                        </div>
                    </div>
                </BottomPortal>
            )}
        </AdaptiveLayout>
    );
};

export default CommunityPage;

