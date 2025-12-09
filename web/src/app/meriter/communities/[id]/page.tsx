'use client';

import { useEffect, useRef, useState, use, useMemo } from "react";
import { useQueryClient } from '@tanstack/react-query';
import { AdaptiveLayout } from '@/components/templates/AdaptiveLayout';
import { useRouter, useSearchParams } from "next/navigation";
import { PublicationCardComponent as PublicationCard } from "@/components/organisms/Publication";
import { FabMenu } from "@/components/molecules/FabMenu/FabMenu";
import { CommunityMembersFab } from "@/components/molecules/FabMenu/CommunityMembersFab";
import { MembersTab } from "@/components/organisms/Community/MembersTab";
import { Tabs } from "@/components/ui/Tabs";
import { useTranslations } from 'next-intl';
import { useWallets, useCommunity } from '@/hooks/api';
import { useCommunityFeed } from '@/hooks/api/useCommunityFeed';
import { useWalletBalance } from '@/hooks/api/useWallet';
import { useAuth } from '@/contexts/AuthContext';
import { routes } from '@/lib/constants/routes';
import type { FeedItem } from '@meriter/shared-types';
import { BrandButton } from '@/components/ui/BrandButton';
import { BrandAvatar } from '@/components/ui/BrandAvatar';
import { Loader2, FileText, Users } from 'lucide-react';
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
    const sortBy = searchParams?.get('sort') || 'recent';
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


    // Check if community is special (marathon-of-good or future-vision)
    const isSpecialCommunity = comms?.typeTag === 'marathon-of-good' || comms?.typeTag === 'future-vision';

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
    const [activeCommentHook, setActiveCommentHook] = useState<string | null>(null);
    const [activeSlider, setActiveSlider] = useState<string | null>(null);
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
            activeSlider={activeSlider}
            setActiveSlider={setActiveSlider}
            activeWithdrawPost={activeWithdrawPost}
            setActiveWithdrawPost={setActiveWithdrawPost}
        >
            {/* Community Info - Compact */}
            {comms && (
                <div className="flex items-start gap-4 mb-6">
                    <BrandAvatar
                        src={comms.avatarUrl}
                        fallback={comms.name}
                        size="lg"
                        className="shrink-0"
                    />
                    <div className="flex-1 min-w-0">
                        {comms.description && (
                            <p className="text-sm text-base-content/70 leading-relaxed mb-3">
                                {comms.description}
                            </p>
                        )}
                        {/* Quota and Permanent Merits Indicators */}
                        {(canEarnPermanentMerits || hasQuota) && (
                            <div className="flex items-center gap-3 mb-3">
                                {canEarnPermanentMerits && (
                                    <div className="flex items-center gap-1.5 text-sm">
                                        {currencyIconUrl && (
                                            <img 
                                                src={currencyIconUrl} 
                                                alt="Currency" 
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
                                        />
                                    </div>
                                )}
                            </div>
                        )}
                        {activeTab === 'publications' && (
                            <div className="flex items-center gap-4 text-sm">
                                <div className="flex items-center gap-1.5 text-base-content/60">
                                    <FileText size={14} />
                                    <span className="font-medium text-base-content">{filteredPublications.length}</span>
                                    <span>publications</span>
                                </div>
                            </div>
                        )}
                    </div>
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
            ) : (
                <MembersTab communityId={chatId} />
            )}

            {/* Conditional FABs */}
            {activeTab === 'publications' && <FabMenu communityId={chatId} />}
            {activeTab === 'members' && <CommunityMembersFab communityId={chatId} />}
        </AdaptiveLayout>
    );
};

export default CommunityPage;

