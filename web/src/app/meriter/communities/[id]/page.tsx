'use client';

import { useEffect, useRef, useState, use, useMemo } from "react";
import { useQueryClient } from '@tanstack/react-query';
import { AdaptiveLayout } from '@/components/templates/AdaptiveLayout';
import { useRouter, useSearchParams } from "next/navigation";
import { PublicationCardComponent as PublicationCard } from "@/components/organisms/Publication";
import { FabMenu } from "@/components/molecules/FabMenu/FabMenu";
import { useTranslations } from 'next-intl';
import { useWallets, useCommunity } from '@/hooks/api';
import { useCommunityFeed } from '@/hooks/api/useCommunityFeed';
import { useWalletBalance } from '@/hooks/api/useWallet';
import { useAuth } from '@/contexts/AuthContext';
import { routes } from '@/lib/constants/routes';
import type { FeedItem } from '@meriter/shared-types';
import { PageHeader } from '@/components/ui/PageHeader';
import { BrandButton } from '@/components/ui/BrandButton';
import { CommunityHero } from '@/components/organisms/Community/CommunityHero';
import { Loader2 } from 'lucide-react';
import { useCanCreatePost } from '@/hooks/useCanCreatePost';
import { useUserRoles } from '@/hooks/api/useProfile';
import { useTeam } from '@/hooks/api/useTeams';

const CommunityPage = ({ params }: { params: Promise<{ id: string }> }) => {
    const router = useRouter();
    const searchParams = useSearchParams();
    const t = useTranslations('pages');
    const tCommunities = useTranslations('pages.communities');
    const resolvedParams = use(params);
    const chatId = resolvedParams.id;

    // Get the post parameter from URL for deep linking
    const targetPostSlug = searchParams?.get('post');
    const targetPollId = searchParams?.get('poll');

    // Get sort state from URL params
    const sortBy = searchParams?.get('sort') || 'recent';
    const selectedTag = searchParams?.get('tag');
    const searchQuery = searchParams?.get('q') || '';

    const [paginationEnd, setPaginationEnd] = useState(false);
    const [highlightedPostId, setHighlightedPostId] = useState<string | null>(null);

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

    // Handle deep linking to specific post or poll
    useEffect(() => {
        if ((targetPostSlug || targetPollId) && publications.length > 0) {
            let targetPost: FeedItem | undefined;

            if (targetPollId) {
                targetPost = publications.find((p: FeedItem) => p.id === targetPollId && p.type === 'poll');
            } else if (targetPostSlug) {
                targetPost = publications.find((p: FeedItem) => p.slug === targetPostSlug);
            }

            if (targetPost) {
                setHighlightedPostId(targetPost.id);

                // Scroll to the post after a short delay to ensure it's rendered
                setTimeout(() => {
                    const postElement = document.getElementById(`post-${targetPost.id}`);
                    if (postElement) {
                        postElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
                        // Remove highlight after 3 seconds
                        setTimeout(() => setHighlightedPostId(null), 3000);
                    }
                }, 500);
            }
        }
    }, [targetPostSlug, targetPollId, publications]);

    const error =
        (publications ?? [])?.[0]?.error || err
            ? true
            : publications.length > 0
                ? false
                : undefined;

    const { user, isLoading: userLoading, isAuthenticated } = useAuth();
    const { data: wallets = [], isLoading: walletsLoading } = useWallets();

    // Get wallet balance using standardized hook
    const { data: balance = 0 } = useWalletBalance(chatId);

    // Get user roles and check if can create posts
    const { data: userRoles = [] } = useUserRoles(user?.id || '');
    const canCreatePost = useCanCreatePost(chatId);

    // Get user's role in current community
    const userRoleInCommunity = useMemo(() => {
        if (user?.globalRole === 'superadmin') return 'superadmin';
        const role = userRoles.find(r => r.communityId === chatId);
        return role?.role || null;
    }, [user?.globalRole, userRoles, chatId]);

    // Check if community is special (marathon-of-good or future-vision)
    const isSpecialCommunity = comms?.typeTag === 'marathon-of-good' || comms?.typeTag === 'future-vision';

    // Get team and team community link for participants
    const { data: team } = useTeam(user?.teamId || '');
    const { data: teamCommunity } = useCommunity(team?.communityId || '');
    const teamChatUrl = teamCommunity?.description;

    useEffect(() => {
        if (!userLoading && !isAuthenticated) {
            router.push("/meriter/login?returnTo=" + encodeURIComponent(document.location.pathname));
        }
    }, [isAuthenticated, userLoading, router]);


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
    const chatUrl = comms?.description;

    // ALL HOOKS MUST BE CALLED BEFORE ANY CONDITIONAL RETURNS
    // Declare all state hooks unconditionally at the top level
    const activeCommentHook = useState<string | null>(null);
    const [activeSlider, setActiveSlider] = useState<string | null>(null);
    const [activeWithdrawPost, setActiveWithdrawPost] = useState<string | null>(null);

    // Early return AFTER all hooks have been called
    if (!isAuthenticated) return null;

    // Filter publications by tag and search query
    const filteredPublications = useMemo(() => {
        let filtered = publications;

        // Filter by tag
        if (selectedTag) {
            filtered = filtered.filter((p: FeedItem) => {
                if (p.type === 'publication') {
                    const tags = p.hashtags as string[] | undefined;
                    return tags && Array.isArray(tags) && tags.includes(selectedTag);
                } else {
                    // Polls don't have hashtags in the schema, skip filtering
                    return true;
                }
            });
        }

        // Filter by search query
        if (searchQuery.trim()) {
            const query = searchQuery.toLowerCase().trim();
            filtered = filtered.filter((p: FeedItem) => {
                if (p.type === 'publication') {
                    const content = (p.content || '').toLowerCase();
                    const title = ((p as any).title || '').toLowerCase();
                    const authorName = (p.meta?.author?.name || '').toLowerCase();
                    const hashtags = (p.hashtags || []).join(' ').toLowerCase();
                    
                    return content.includes(query) ||
                           title.includes(query) ||
                           authorName.includes(query) ||
                           hashtags.includes(query);
                } else if (p.type === 'poll') {
                    const question = ((p as any).question || '').toLowerCase();
                    const authorName = (p.meta?.author?.name || '').toLowerCase();
                    
                    return question.includes(query) || authorName.includes(query);
                }
                return false;
            });
        }

        return filtered;
    }, [publications, selectedTag, searchQuery]);

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
            <div className="flex flex-col min-h-screen bg-base-100">
                <PageHeader
                    title={comms?.name || 'Community'}
                    showBack={true}
                />

                <div className="p-4 space-y-6">
                    {/* Community Hero Section */}
                    {comms && (
                        <CommunityHero
                            community={comms}
                            stats={{
                                publications: filteredPublications.length,
                                // members и activity можно добавить когда будет API
                            }}
                        />
                    )}

                    {/* Banner for participants in special communities who cannot create posts */}
                    {error === false && 
                     userRoleInCommunity === 'participant' && 
                     isSpecialCommunity && 
                     !canCreatePost.canCreate && 
                     teamChatUrl && (
                        <div className="bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300 p-4 rounded-lg text-sm border border-blue-200 dark:border-blue-800/50">
                            {t('communities.toAddPublication')}{" "}
                            <a href={teamChatUrl} className="underline font-medium hover:opacity-80 dark:text-blue-300">
                                {t('communities.writeToLeaderInTeamChat')}
                            </a>
                        </div>
                    )}
                    {error === true && (
                        <div className="bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-300 p-4 rounded-lg text-sm border border-red-200 dark:border-red-800/50 text-center">
                            {t('communities.noAccess')}
                        </div>
                    )}

                    {/* Setup banner */}
                    {comms?.needsSetup && (
                        <div className={`p-4 rounded-lg border ${comms?.isAdmin ? "bg-yellow-50 dark:bg-yellow-900/20 text-yellow-800 dark:text-yellow-300 border-yellow-200 dark:border-yellow-800/50" : "bg-blue-50 dark:bg-blue-900/20 text-blue-800 dark:text-blue-300 border-blue-200 dark:border-blue-800/50"}`}>
                            {comms?.isAdmin ? (
                                <span>
                                    {tCommunities('unconfigured.banner.adminPrefix')}{' '}
                                    <a
                                        href={routes.communitySettings(chatId)}
                                        className="underline font-semibold hover:opacity-80 dark:text-yellow-300"
                                        onClick={(e) => {
                                            e.preventDefault();
                                            router.push(routes.communitySettings(chatId));
                                        }}
                                    >
                                        {tCommunities('unconfigured.banner.adminLink')}
                                    </a>
                                    {' '}{tCommunities('unconfigured.banner.adminSuffix')}
                                </span>
                            ) : (
                                <span>{tCommunities('unconfigured.banner.user')}</span>
                            )}
                        </div>
                    )}

                    {/* Divider before feed */}
                    {(error === false || filteredPublications.length > 0) && (
                        <div className="border-t border-brand-secondary/10" />
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
                                    // Check if this post is selected (for comments or polls)
                                    const isSelected = !!(targetPostSlug && (p.slug === targetPostSlug || p.id === targetPostSlug))
                                        || !!(targetPollId && p.id === targetPollId);

                                    return (
                                        <div
                                            key={p.id}
                                            id={`post-${p.id}`}
                                            className={
                                                highlightedPostId === p.id
                                                    ? 'ring-2 ring-brand-primary ring-opacity-50 rounded-lg p-1 bg-brand-primary/5'
                                                    : isSelected
                                                        ? 'ring-2 ring-brand-secondary ring-opacity-70 rounded-lg p-1 bg-brand-secondary/5 transition-all duration-300'
                                                        : 'hover:shadow-md transition-shadow rounded-lg'
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

                        {isFetchingNextPage && (
                            <div className="flex justify-center py-4">
                                <Loader2 className="w-6 h-6 animate-spin text-brand-primary" />
                            </div>
                        )}

                        {!paginationEnd && filteredPublications.length > 1 && !isFetchingNextPage && (
                            <BrandButton
                                variant="primary"
                                onClick={() => fetchNextPage()}
                                className="w-full sm:w-auto mx-auto block"
                            >
                                {t('communities.loadMore')}
                            </BrandButton>
                        )}
                    </div>
                </div>
            </div>
            <FabMenu communityId={chatId} />
        </AdaptiveLayout>
    );
};

export default CommunityPage;

