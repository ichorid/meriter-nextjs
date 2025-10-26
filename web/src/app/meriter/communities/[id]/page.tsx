'use client';

import { useEffect, useRef, useState, use } from "react";
import { useQuery, useInfiniteQuery } from '@tanstack/react-query';
import { apiClient } from '@/lib/api/client';
import { PageLayout } from '@/components/templates/PageLayout';
import { useRouter, useSearchParams } from "next/navigation";
import { AvatarBalanceWidget } from '@/components/organisms/AvatarBalanceWidget';
import { Breadcrumbs } from '@/components/molecules/Breadcrumbs';
import { CardWithAvatar } from '@/components/molecules/CardWithAvatar';
import { PublicationCardComponent as PublicationCard } from "@/components/organisms/Publication";
import { telegramGetAvatarLink, telegramGetAvatarLinkUpd } from '@lib/telegram';
import { FormPollCreate } from "@features/polls";
import { BottomPortal } from "@shared/components/bottom-portal";
import { useTranslations } from 'next-intl';
import { CommunityAvatar } from "@shared/components/community-avatar";
import { useWallets, useUserProfile, useCommunity } from '@/hooks/api';
import { usersApiV1 } from '@/lib/api/v1';
import { useAuth } from '@/contexts/AuthContext';
import { classList } from "@lib/classList";
import type { Wallet } from '@/types/api-v1';

interface Publication {
  id: string;
  slug: string;
  title: string;
  content: string;
  authorId: string;
  communityId: string;
  type: 'text' | 'image' | 'video' | 'poll';
  createdAt: string;
  updatedAt: string;
  metrics?: {
    score: number;
    commentCount: number;
  };
  [key: string]: unknown;
}

interface PageData {
  data: Publication[];
  [key: string]: unknown;
}

const CommunityPage = ({ params }: { params: Promise<{ id: string }> }) => {
    const router = useRouter();
    const searchParams = useSearchParams();
    const t = useTranslations('pages');
    const resolvedParams = use(params);
    const chatId = resolvedParams.id;
    const pathname = `/meriter/communities/${chatId}`;
    
    // Get the post parameter from URL for deep linking
    const targetPostSlug = searchParams.get('post');

    const [paginationEnd, setPaginationEnd] = useState(false);
    const [showPollCreate, setShowPollCreate] = useState(false);
    const [sortBy, setSortBy] = useState<"recent" | "voted">("recent");
    const [highlightedPostId, setHighlightedPostId] = useState<string | null>(null);

    // Use v1 API hook
    const { data: comms } = useCommunity(chatId);

    const {
        data,
        fetchNextPage,
        hasNextPage,
        isFetchingNextPage,
        error: err
    } = useInfiniteQuery({
        queryKey: ['publications', chatId],
        queryFn: async ({ pageParam = 1 }) => {
            const response = await apiClient.get(`/api/v1/communities/${chatId}/publications?page=${pageParam}&pageSize=5&sort=score&order=desc`);
            return response;
        },
        getNextPageParam: (lastPage, pages) => {
            if (!lastPage.meta?.pagination?.hasNext) {
                return undefined;
            }
            return pages.length + 1;
        },
        initialPageParam: 1,
    });

    // Derive paginationEnd from hasNextPage instead of setting it in getNextPageParam
    useEffect(() => {
        if (!hasNextPage) {
            setPaginationEnd(true);
        }
    }, [hasNextPage]);

    const publications = (data?.pages ?? [])
        .map((page: PageData) => page.data)
        .flat()
        .filter((p: Publication, index: number, self: Publication[]) => 
            index === self.findIndex((t: Publication) => t?.id === p?.id)
        );

    const setJwt = data?.pages?.[0]?.setJwt;
    useEffect(() => {
        if (setJwt) {
            document.location.href = "/auth/" + setJwt;
        }
    }, [setJwt]);

    // Handle deep linking to specific post
    useEffect(() => {
        if (targetPostSlug && publications.length > 0) {
            console.log('🔍 Looking for post with slug:', targetPostSlug);
            console.log('🔍 Available publications:', publications.map((p: Publication) => ({ slug: p.slug, id: p.id })));
            
            const targetPost = publications.find((p: Publication) => p.slug === targetPostSlug);
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
    const { data: userdata = 0 } = useUserProfile(user?.telegramId || '');
    
    // Get wallet balance for this community from user's wallets
    const { data: balance = 0 } = useQuery({
        queryKey: ['wallet-balance', user?.telegramId, chatId],
        queryFn: async () => {
            if (!user?.telegramId || !chatId) return 0;
            try {
                const wallets = await usersApiV1.getUserWallets(user.telegramId);
                const wallet = wallets.find((w: Wallet) => w.communityId === chatId);
                return wallet?.balance || 0;
            } catch (error: any) {
                // Handle 404 and other wallet errors gracefully
                if (error?.response?.status === 404 || error?.response?.statusCode === 404) {
                    console.debug('Wallet not found for user:', user.telegramId, 'community:', chatId, '- returning 0 balance');
                    return 0;
                }
                // Only log non-404 errors to avoid console noise
                if (error?.response?.status !== 404 && error?.response?.statusCode !== 404) {
                    console.error('Error fetching wallet balance:', error);
                }
                return 0;
            }
        },
        enabled: !!user?.id && !!chatId,
    });

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
    const activeCommentHook = useState(null);
    
    // State for withdrawal functionality
    const [activeWithdrawPost, setActiveWithdrawPost] = useState(null);
    const [activeSlider, setActiveSlider] = useState<string | null>(null);
    
    // Wallet update function for optimistic updates
    const updateWalletBalance = (currencyId: string, change: number) => {
        // This will be handled by React Query mutations
        // Optimistic updates are handled in the hooks
    };
    
    const updateAll = async () => {
        // Close the active withdraw slider after successful update
        setActiveWithdrawPost(null);
    };

    if (!isAuthenticated) return null;

    const tgAuthorId = user?.telegramId;

    const onlyPublication =
        publications.filter((p: Publication) => p?.content)?.length == 1;

    const sortItems = (items: Publication[]): Publication[] => {
        if (!items) return [];
        return [...items].sort((a, b) => {
            if (sortBy === "recent") {
                return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
            } else {
                return (b.metrics?.score || 0) - (a.metrics?.score || 0);
            }
        });
    };

    return (
        <PageLayout className="feed">
            <AvatarBalanceWidget
                balance1={undefined}
                balance2={undefined}
                avatarUrl={telegramGetAvatarLink(tgAuthorId || '')}
                onAvatarUrlNotFound={() => telegramGetAvatarLinkUpd(tgAuthorId || '')}
                onClick={() => {
                    router.push("/meriter/home");
                }}
                userName={user?.displayName || 'User'}
            />

            <Breadcrumbs
                pathname={pathname}
                chatId={chatId}
                chatNameVerb={chatNameVerb}
                chatIcon={comms?.avatarUrl}
            />
                
                {/* Community Header */}
                {comms?.name && (
                    <div className="py-3 border-b border-base-300 mb-4">
                        <div className="flex items-center justify-between mb-2">
                            <div className="flex items-center gap-3">
                                <CommunityAvatar
                                    avatarUrl={comms?.avatarUrl}
                                    communityName={comms?.name}
                                    size={48}
                                />
                                <h1 className="text-xl font-semibold">{comms?.name}</h1>
                            </div>
                            {/* Settings cog icon - visible only to admins */}
                            {comms?.isAdmin && (
                                <button
                                    onClick={() => router.push(`/meriter/communities/${chatId}/settings`)}
                                    className="btn btn-ghost btn-sm btn-circle"
                                    title="Community Settings"
                                >
                                    <svg 
                                        className="w-5 h-5" 
                                        fill="none" 
                                        stroke="currentColor" 
                                        viewBox="0 0 24 24"
                                    >
                                        <path 
                                            strokeLinecap="round" 
                                            strokeLinejoin="round" 
                                            strokeWidth={2} 
                                            d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" 
                                        />
                                        <path 
                                            strokeLinecap="round" 
                                            strokeLinejoin="round" 
                                            strokeWidth={2} 
                                            d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" 
                                        />
                                    </svg>
                                </button>
                            )}
                        </div>
                        <div className="flex items-center gap-3">
                            {comms?.settings?.iconUrl && (
                                <div className="flex items-center gap-2">
                                    <img className="w-5 h-5" src={comms.settings.iconUrl} alt="Currency" />
                                    <span className="text-lg font-semibold">{balance}</span>
                                </div>
                            )}
                            {comms?.hashtags && comms.hashtags.length > 0 && (
                                <div className="flex flex-wrap gap-1">
                                    {comms.hashtags.map((tag: string, i: number) => (
                                        <span key={i} className="badge badge-primary badge-sm">#{tag}</span>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>
                )}

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
                            {comms?.hashtags && (
                                <div
                                    style={{
                                        paddingBottom: "15px",
                                        opacity: ".5",
                                    }}
                                >
                                    {t('communities.filterByTags')}
                                </div>
                            )}
                            {comms?.hashtags &&
                                comms.hashtags.map((tag: string) => (
                                    <CardWithAvatar
                                        key={tag}
                                        avatarUrl=""
                                        userName={tag}
                                        onClick={() =>
                                            router.push(`/meriter/communities/${chatId}?tag=${tag}`)
                                        }
                                    >
                                        <div className="heading">
                                            #{tag}
                                        </div>
                                        <div className="description">
                                            Filter by {tag}
                                        </div>
                                    </CardWithAvatar>
                                ))}
                        </div>
                    </>
                )}
            {error === true && <div>{t('communities.noAccess')}</div>}

            <button
                className="create-poll-button"
                onClick={() => setShowPollCreate(true)}
                style={{
                    padding: "10px 20px",
                    background: "#4CAF50",
                    color: "white",
                    border: "none",
                    borderRadius: "4px",
                    cursor: "pointer",
                    fontWeight: "600",
                    marginBottom: "15px",
                    width: "100%"
                }}
            >
                {t('communities.createPoll')}
            </button>

            <div className="flex justify-end mb-4">
                <div className="join shadow-sm">
                    <button 
                        className={classList(
                            "join-item btn btn-sm font-medium transition-all duration-200",
                            sortBy === "recent" ? "btn-active btn-primary" : ""
                        )}
                        onClick={() => setSortBy("recent")}
                    >
                        {t('communities.byDate')}
                    </button>
                    <button 
                        className={classList(
                            "join-item btn btn-sm font-medium transition-all duration-200",
                            sortBy === "voted" ? "btn-active btn-primary" : ""
                        )}
                        onClick={() => setSortBy("voted")}
                    >
                        {t('communities.byRating')}
                    </button>
                </div>
            </div>

            <div className="space-y-4">
                {isAuthenticated &&
                    sortItems(publications)
                        .filter((p) => p?.content || p?.type === 'poll')
                        .map((p) => (
                            <div
                                key={p.id}
                                id={`post-${p.id}`}
                                className={highlightedPostId === p.id ? 'ring-2 ring-primary ring-opacity-50 rounded-lg p-2 bg-primary bg-opacity-10' : ''}
                            >
                                <PublicationCard
                                    publication={p}
                                    wallets={Array.isArray(wallets) ? wallets : []}
                                    updateWalletBalance={updateWalletBalance}
                                    updateAll={updateAll}
                                    showCommunityAvatar={false}
                                />
                            </div>
                        ))}
                {!paginationEnd && publications.length > 1 && (
                    <button onClick={() => fetchNextPage()} className="btn btn-primary btn-wide mx-auto block">
                        {t('communities.loadMore')}
                    </button>
                )}
            </div>
            {showPollCreate && (
                <BottomPortal>
                    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[9999] p-5 overflow-y-auto">
                        <FormPollCreate
                            communityId={chatId}
                            onSuccess={(pollId) => {
                                setShowPollCreate(false);
                                window.location.reload();
                            }}
                            onCancel={() => setShowPollCreate(false)}
                        />
                    </div>
                </BottomPortal>
            )}
        </PageLayout>
    );
};

export default CommunityPage;

