'use client';

import { useEffect, useRef, useState, use, useMemo } from "react";
import { useQueryClient } from '@tanstack/react-query';
import { AdaptiveLayout } from '@/components/templates/AdaptiveLayout';
import { CommunityTopBar } from '@/components/organisms/ContextTopBar';
import { useRouter, useSearchParams } from "next/navigation";
import { PublicationCardComponent as PublicationCard } from "@/components/organisms/Publication";
import { FabMenu } from "@/components/molecules/FabMenu/FabMenu";
import { CommunityMembersFab } from "@/components/molecules/FabMenu/CommunityMembersFab";
import { MembersTab } from "@/components/organisms/Community/MembersTab";
import { Tabs } from "@/components/ui/Tabs";
import { useTranslations } from 'next-intl';
import { useWallets, useCommunity, useCommunities } from '@/hooks/api';
import { useCommunityFeed } from '@/hooks/api/useCommunityFeed';
import { useWalletBalance } from '@/hooks/api/useWallet';
import { useAuth } from '@/contexts/AuthContext';
import { routes } from '@/lib/constants/routes';
import type { FeedItem } from '@meriter/shared-types';
import { BrandButton } from '@/components/ui/BrandButton';
import { BrandAvatar } from '@/components/ui/BrandAvatar';
import { CommunityHeroCard } from '@/components/organisms/Community/CommunityHeroCard';
import { Loader2, FileText, Users, Eye } from 'lucide-react';
import { useCanCreatePost } from '@/hooks/useCanCreatePost';
import { useUserRoles } from '@/hooks/api/useProfile';
import { DailyQuotaRing } from '@/components/molecules/DailyQuotaRing';
import { useUserQuota } from '@/hooks/api/useQuota';
import { useTranslations as useCommonTranslations } from 'next-intl';

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
    const sortBy = searchParams?.get('sort') || 'voted';
    const selectedTag = searchParams?.get('tag');
    const searchQuery = searchParams?.get('q') || '';
    
    // Get active tab from URL params, default to 'publications'
    const activeTab = searchParams?.get('tab') || 'publications';

    const [paginationEnd, setPaginationEnd] = useState(false);
    const [highlightedPostId, setHighlightedPostId] = useState<string | null>(null);

    // Handle tab change
    const handleTabChange = (tabId: string) => {
        const params = new URLSearchParams(searchParams?.toString() ?? '');
        if (tabId === 'publications') {
            params.delete('tab');
        } else {
            params.set('tab', tabId);
        }
        router.push(`?${params.toString()}`);
    };

    // Use v1 API hook
    const { data: comms } = useCommunity(chatId);

    // Fetch all communities to find the future-vision community when on marathon-of-good
    // This must be called before calculating futureVisionCommunityId
    const { data: communitiesData } = useCommunities();

    // Check if community is special (marathon-of-good or future-vision)
    const isSpecialCommunity = comms?.typeTag === 'marathon-of-good' || comms?.typeTag === 'future-vision';
    const isMarathonOfGood = comms?.typeTag === 'marathon-of-good';

    // Find the future-vision community ID when on marathon-of-good
    // This must be calculated before useCommunityFeed that uses it
    const futureVisionCommunityId = useMemo(() => {
        if (!isMarathonOfGood || !communitiesData?.data) return null;
        const futureVisionCommunity = communitiesData.data.find(
            (c: any) => c.typeTag === 'future-vision'
        );
        return futureVisionCommunity?.id || null;
    }, [isMarathonOfGood, communitiesData?.data]);

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

    // Fetch vision posts when vision tab is active and future-vision community exists
    const {
        data: visionData,
        fetchNextPage: fetchNextVisionPage,
        hasNextPage: hasNextVisionPage,
        isFetchingNextPage: isFetchingNextVisionPage,
        error: visionErr
    } = useCommunityFeed(futureVisionCommunityId || '', {
        pageSize: 5,
        sort: sortBy === 'recent' ? 'recent' : 'score',
        tag: selectedTag || undefined,
    });

    // Derive paginationEnd from hasNextPage instead of setting it in getNextPageParam
    useEffect(() => {
        if (activeTab === 'vision') {
            if (!hasNextVisionPage) {
                setPaginationEnd(true);
            } else {
                setPaginationEnd(false);
            }
        } else {
            if (!hasNextPage) {
                setPaginationEnd(true);
            } else {
                setPaginationEnd(false);
            }
        }
    }, [hasNextPage, hasNextVisionPage, activeTab]);

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

    // Memoize vision feed items array
    const visionPublications = useMemo(() => {
        return (visionData?.pages ?? [])
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
    }, [visionData?.pages]); // Only recalculate when visionData.pages changes

    // Handle deep linking to specific post or poll
    useEffect(() => {
        const postsToSearch = activeTab === 'vision' ? visionPublications : publications;
        if ((targetPostSlug || targetPollId) && postsToSearch.length > 0) {
            let targetPost: FeedItem | undefined;

            if (targetPollId) {
                targetPost = postsToSearch.find((p: FeedItem) => p.id === targetPollId && p.type === 'poll');
            } else if (targetPostSlug) {
                targetPost = postsToSearch.find((p: FeedItem) => p.slug === targetPostSlug);
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
    }, [targetPostSlug, targetPollId, publications, visionPublications, activeTab]);

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

    // Get quota data for this community
    const { data: quotaData } = useUserQuota(chatId);

    // Get user roles and check if can create posts
    const { data: userRoles = [] } = useUserRoles(user?.id || '');
    const canCreatePost = useCanCreatePost(chatId);
    
    const tCommon = useCommonTranslations('common');

    // Get user's role in current community
    const userRoleInCommunity = useMemo(() => {
        if (user?.globalRole === 'superadmin') return 'superadmin';
        const role = userRoles.find(r => r.communityId === chatId);
        return role?.role || null;
    }, [user?.globalRole, userRoles, chatId]);

    // Determine eligibility for permanent merits and quota
    const canEarnPermanentMerits = useMemo(() => {
        if (!comms?.meritRules) return false;
        return comms.meritRules.canEarn === true && balance !== undefined;
    }, [comms?.meritRules, balance]);

    const hasQuota = useMemo(() => {
        if (!comms?.meritRules || !userRoleInCommunity) return false;
        const { dailyQuota, quotaRecipients } = comms.meritRules;
        return dailyQuota > 0 && quotaRecipients?.includes(userRoleInCommunity as any);
    }, [comms?.meritRules, userRoleInCommunity]);

    const quotaRemaining = quotaData?.remainingToday ?? 0;
    const quotaMax = quotaData?.dailyQuota ?? 0;
    const currencyIconUrl = comms?.settings?.iconUrl;

    // Get user's team community (community with typeTag: 'team' where user has a role)
    const userTeamCommunityId = useMemo(() => {
        if (!userRoles || userRoles.length === 0) return null;
        // Find a role in a team-type community
        // Note: We'd need to fetch communities to check typeTag, but for now we'll use a simpler approach
        // The teamChatUrl will be set if user has a role in a team community
        return null; // Simplified - team community lookup would require additional API calls
    }, [userRoles]);
    
    // For now, teamChatUrl is not available without additional API calls
    // This functionality can be restored if needed by fetching user's communities and filtering for typeTag: 'team'
    const teamChatUrl = null;

    useEffect(() => {
        if (!userLoading && !isAuthenticated) {
            router.push("/meriter/login?returnTo=" + encodeURIComponent(document.location.pathname));
        }
    }, [isAuthenticated, userLoading, router]);

    // Redirect away from vision tab if it's active (tab is now hidden)
    useEffect(() => {
        if (activeTab === 'vision') {
            const params = new URLSearchParams(searchParams?.toString() ?? '');
            params.delete('tab');
            router.push(`?${params.toString()}`);
        }
    }, [activeTab, searchParams, router]);


    const cooldown = useRef(false);
    useEffect(() => {
        const fn = () => {
            if (
                window.innerHeight + window.scrollY >=
                document.body.offsetHeight
            ) {
                if (!paginationEnd && !cooldown.current) {
                    if (activeTab === 'vision' && futureVisionCommunityId) {
                        fetchNextVisionPage();
                    } else if (activeTab === 'publications') {
                        fetchNextPage();
                    }

                    cooldown.current = true;
                    setTimeout(() => {
                        cooldown.current = false;
                    }, 500);
                }
            }
        };
        window.addEventListener("scroll", fn);
        return () => window.removeEventListener("scroll", fn);
    }, [paginationEnd, activeTab, futureVisionCommunityId, fetchNextPage, fetchNextVisionPage]);

    // Use community data for chat info (same as comms)
    const chatUrl = comms?.description;

    // ALL HOOKS MUST BE CALLED BEFORE ANY CONDITIONAL RETURNS
    // Declare all state hooks unconditionally at the top level
    const [activeCommentHook, setActiveCommentHook] = useState<string | null>(null);
    const [activeWithdrawPost, setActiveWithdrawPost] = useState<string | null>(null);

    // Filter publications by tag and search query
    // This useMemo MUST be called before any conditional returns
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

    // Filter vision publications by tag and search query
    const filteredVisionPublications = useMemo(() => {
        let filtered = visionPublications;

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
    }, [visionPublications, selectedTag, searchQuery]);

    // Early return AFTER all hooks have been called
    if (!isAuthenticated) return null;

    return (
        <AdaptiveLayout
            className="feed"
            communityId={chatId}
            balance={balance}
            wallets={Array.isArray(wallets) ? wallets : []}
            myId={user?.id}
            activeCommentHook={[activeCommentHook, setActiveCommentHook]}
            activeWithdrawPost={activeWithdrawPost}
            setActiveWithdrawPost={setActiveWithdrawPost}
            stickyHeader={<CommunityTopBar communityId={chatId} asStickyHeader={true} />}
        >
            {/* Community Hero Card - Twitter-style with cover */}
            {comms && (
                <div className="mb-6">
                    <CommunityHeroCard
                        community={{
                            ...(comms as any),
                            id: comms.id || chatId,
                        }}
                    />
                    {/* Quota and Permanent Merits Indicators */}
                    {(canEarnPermanentMerits || hasQuota) && (
                        <div className="flex items-center gap-4 mt-3 px-4 py-2 bg-base-200/50 rounded-lg">
                            {canEarnPermanentMerits && (
                                <div className="flex items-center gap-1.5 text-sm">
                                    {currencyIconUrl && (
                                        <img 
                                            src={currencyIconUrl} 
                                            alt={tCommunities('currency')} 
                                            className="w-4 h-4 flex-shrink-0" 
                                        />
                                    )}
                                    <span className="text-base-content/60">{tCommon('permanentMerits')}:</span>
                                    <span className="font-semibold text-base-content">{balance}</span>
                                </div>
                            )}
                            {hasQuota && quotaMax > 0 && (
                                <div className="flex items-center gap-1.5 text-sm">
                                    <span className="text-base-content/60">{tCommon('dailyMerits')}:</span>
                                    <DailyQuotaRing
                                        remaining={quotaRemaining}
                                        max={quotaMax}
                                        className="w-6 h-6 flex-shrink-0"
                                        asDiv={true}
                                        variant={isMarathonOfGood ? 'golden' : 'default'}
                                    />
                                </div>
                            )}
                        </div>
                    )}
                </div>
            )}

            {/* Tab Selector */}
            <Tabs
                tabs={[
                    {
                        id: 'publications',
                        label: tCommunities('publications') || 'Publications',
                        icon: <FileText size={16} />,
                    },
                    {
                        id: 'members',
                        label: tCommunities('members') || 'Members',
                        icon: <Users size={16} />,
                    },
                ]}
                activeTab={activeTab}
                onChange={handleTabChange}
                className="mb-6"
            />

            {/* Banners */}
            {error === false && 
             userRoleInCommunity === 'participant' && 
             isSpecialCommunity && 
             !canCreatePost.canCreate && 
             teamChatUrl && (
                <div className="bg-info/10 text-base-content p-4 rounded-xl text-sm border border-info/20 mb-4">
                    {t('communities.toAddPublication')}{" "}
                    <a href={teamChatUrl} className="underline font-medium hover:opacity-80">
                        {t('communities.writeToLeaderInTeamChat')}
                    </a>
                </div>
            )}
            {error === true && (
                <div className="bg-error/10 text-error p-4 rounded-xl text-sm border border-error/20 text-center mb-4">
                    {t('communities.noAccess')}
                </div>
            )}

            {/* Setup banner */}
            {comms?.needsSetup && (
                <div className={`p-4 rounded-xl border mb-4 ${comms?.isAdmin ? "bg-warning/10 text-base-content border-warning/20" : "bg-info/10 text-base-content border-info/20"}`}>
                    {comms?.isAdmin ? (
                        <span>
                            {tCommunities('unconfigured.banner.adminPrefix')}{' '}
                            <a
                                href={routes.communitySettings(chatId)}
                                className="underline font-semibold hover:opacity-80"
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

            {/* Tab Content */}
            {activeTab === 'publications' ? (
                <div className="space-y-4">
                    {isAuthenticated &&
                        filteredPublications
                            .filter((p: FeedItem) => {
                                if (p.type === 'publication') {
                                    return !!p.content;
                                } else if (p.type === 'poll') {
                                    // Hide polls in future-vision communities
                                    return comms?.typeTag !== 'future-vision';
                                }
                                return false;
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
            ) : activeTab === 'vision' ? (
                <div className="space-y-4">
                    {futureVisionCommunityId ? (
                        <>
                            {isAuthenticated &&
                                filteredVisionPublications
                                    .filter((p: FeedItem) => {
                                        if (p.type === 'publication') {
                                            return !!p.content;
                                        }
                                        return false;
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
                                                <div className="relative">
                                                    {/* Future indicator icon */}
                                                    <div className="absolute -top-2 -right-2 z-10 bg-primary text-primary-content rounded-full p-1.5 shadow-lg">
                                                        <Eye size={16} />
                                                    </div>
                                                    <PublicationCard
                                                        publication={p}
                                                        wallets={Array.isArray(wallets) ? wallets : []}
                                                        showCommunityAvatar={false}
                                                        isSelected={isSelected}
                                                    />
                                                </div>
                                            </div>
                                        );
                                    })}

                            {isFetchingNextVisionPage && (
                                <div className="flex justify-center py-4">
                                    <Loader2 className="w-6 h-6 animate-spin text-brand-primary" />
                                </div>
                            )}

                            {!paginationEnd && filteredVisionPublications.length > 1 && !isFetchingNextVisionPage && (
                                <BrandButton
                                    variant="primary"
                                    onClick={() => fetchNextVisionPage()}
                                    className="w-full sm:w-auto mx-auto block"
                                >
                                    {t('communities.loadMore')}
                                </BrandButton>
                            )}

                            {filteredVisionPublications.length === 0 && !isFetchingNextVisionPage && (
                                <div className="text-center py-8 text-base-content/60">
                                    <p>{tCommunities('noVisionPosts')}</p>
                                </div>
                            )}
                        </>
                    ) : (
                        <div className="text-center py-8 text-base-content/60">
                            <p>{tCommunities('visionCommunityNotFound')}</p>
                        </div>
                    )}
                </div>
            ) : (
                <MembersTab communityId={chatId} />
            )}

            {/* Conditional FABs */}
            {activeTab === 'publications' && <FabMenu communityId={chatId} />}
            {activeTab === 'vision' && futureVisionCommunityId && <FabMenu communityId={futureVisionCommunityId} />}
            {activeTab === 'members' && <CommunityMembersFab communityId={chatId} />}
        </AdaptiveLayout>
    );
};

export default CommunityPage;

