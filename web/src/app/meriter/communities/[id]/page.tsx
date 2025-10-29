'use client';

import { useEffect, useRef, useState, use } from "react";
import { useQuery, useInfiniteQuery } from '@tanstack/react-query';
import { apiClient } from '@/lib/api/client';
import { PageLayout } from '@/components/templates/PageLayout';
import { useRouter, useSearchParams } from "next/navigation";
import { PublicationCardComponent as PublicationCard } from "@/components/organisms/Publication";
import { FormPollCreate } from "@features/polls";
import { BottomPortal } from "@shared/components/bottom-portal";
import { useTranslations } from 'next-intl';
import { useWallets, useUserProfile, useCommunity } from '@/hooks/api';
import { usersApiV1 } from '@/lib/api/v1';
import { useAuth } from '@/contexts/AuthContext';
import type { Wallet } from '@/types/api-v1';
import { routes } from '@/lib/constants/routes';

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
  meta?: {
    author?: {
      name?: string;
      photoUrl?: string;
      username?: string;
    };
    beneficiary?: {
      name?: string;
      photoUrl?: string;
      username?: string;
    };
    origin?: {
      telegramChatName?: string;
    };
    hashtagName?: string;
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
        .map((p: any) => ({
            ...p,
            beneficiaryId: p.beneficiaryId || p.meta?.beneficiary?.username,
            beneficiaryName: p.meta?.beneficiary?.name,
            beneficiaryPhotoUrl: p.meta?.beneficiary?.photoUrl,
            beneficiaryUsername: p.meta?.beneficiary?.username,
        }))
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
    const { data: userdata = 0 } = useUserProfile(user?.id || '');
    
    // Get wallet balance for this community from user's wallets
    const { data: balance = 0 } = useQuery({
        queryKey: ['wallet-balance', user?.id, chatId],
        queryFn: async () => {
            if (!user?.id || !chatId) return 0;
            try {
                const wallets = await usersApiV1.getUserWallets(user.id);
                const wallet = wallets.find((w: Wallet) => w.communityId === chatId);
                return wallet?.balance || 0;
            } catch (error: any) {
                // Handle 404 and other wallet errors gracefully
                if (error?.response?.status === 404 || error?.response?.statusCode === 404) {
                    console.debug('Wallet not found for user:', user.id, 'community:', chatId, '- returning 0 balance');
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

    const tgAuthorId = user?.id;

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

    // Filter publications by tag if selected
    const filteredPublications = selectedTag
        ? publications.filter((p: Publication) => {
            const tags = p.tags as string[] | undefined;
            return tags && Array.isArray(tags) && tags.includes(selectedTag);
        })
        : publications;

    return (
        <PageLayout className="feed">
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
                    sortItems(filteredPublications)
                        .filter((p) => p?.content || p?.type === 'poll')
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
                            
                            return (
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
                    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[9999] p-5 overflow-y-auto">
                        <FormPollCreate
                            communityId={chatId}
                            onSuccess={(pollId) => {
                                handlePollClose();
                                window.location.reload();
                            }}
                            onCancel={handlePollClose}
                        />
                    </div>
                </BottomPortal>
            )}
        </PageLayout>
    );
};

export default CommunityPage;

