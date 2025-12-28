'use client';

import { useEffect, useRef, useState, useMemo } from "react";
import { AdaptiveLayout } from '@/components/templates/AdaptiveLayout';
import { CommunityTopBar } from '@/components/organisms/ContextTopBar';
import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { PublicationCardComponent as PublicationCard } from "@/components/organisms/Publication";
import { MembersTab } from "@/components/organisms/Community/MembersTab";
import { Tabs } from "@/components/ui/Tabs";
import { useTranslations } from 'next-intl';
import { useWallets, useCommunity, useCommunities } from '@/hooks/api';
import { useCommunityFeed } from '@/hooks/api/useCommunityFeed';
import { useWalletBalance } from '@/hooks/api/useWallet';
import { useAuth } from '@/contexts/AuthContext';
import type { FeedItem, PublicationFeedItem, PollFeedItem } from '@meriter/shared-types';
import { Button } from '@/components/ui/shadcn/button';
import { CommunityHeroCard } from '@/components/organisms/Community/CommunityHeroCard';
import { Loader2, FileText, Users, Eye, Filter, X, ChevronDown, Trash2 } from 'lucide-react';
import {
  IMPACT_AREAS,
  BENEFICIARIES,
  METHODS,
  STAGES,
  HELP_NEEDED,
  type ImpactArea,
  type Beneficiary,
  type Method,
  type Stage,
  type HelpNeeded,
} from '@/lib/constants/taxonomy';
import { Checklist, CollapsibleSection } from '@/components/ui/taxonomy';
import { Badge } from '@/components/ui/shadcn/badge';
import { Separator } from '@/components/ui/shadcn/separator';
import { useTaxonomyTranslations } from '@/hooks/useTaxonomyTranslations';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/shadcn/select';
import { Input } from '@/components/ui/shadcn/input';
import { Label } from '@/components/ui/shadcn/label';
import { useCanCreatePost } from '@/hooks/useCanCreatePost';
import { useUserRoles } from '@/hooks/api/useProfile';
import { DailyQuotaRing } from '@/components/molecules/DailyQuotaRing';
import { QuotaDisplay } from '@/components/molecules/QuotaDisplay/QuotaDisplay';
import { useUserQuota } from '@/hooks/api/useQuota';
import { routes } from '@/lib/constants/routes';
import { useTranslations as useCommonTranslations } from 'next-intl';
import { useInfiniteDeletedPublications } from '@/hooks/api/usePublications';

interface CommunityPageClientProps {
    communityId: string;
}

export function CommunityPageClient({ communityId: chatId }: CommunityPageClientProps) {
    const router = useRouter();
    const searchParams = useSearchParams();
    const pathname = usePathname();
    const t = useTranslations('pages');
    const tCommunities = useTranslations('pages.communities');
    const {
      translateImpactArea,
      translateStage,
      translateBeneficiary,
      translateMethod,
      translateHelpNeeded,
    } = useTaxonomyTranslations();

    // Get the post parameter from URL for deep linking
    const targetPostSlug = searchParams?.get('post');
    const targetPollId = searchParams?.get('poll');
    const highlightPostSlug = searchParams?.get('highlight');

    // Get sort state from URL params
    const sortBy = searchParams?.get('sort') || 'voted';
    const selectedTag = searchParams?.get('tag');
    const searchQuery = searchParams?.get('q') || '';

    // Get active tab from URL params, default to 'publications'
    const activeTab = searchParams?.get('tab') || 'publications';

    const [paginationEnd, setPaginationEnd] = useState(false);
    const [highlightedPostId, setHighlightedPostId] = useState<string | null>(null);
    const [activeCommentHook, setActiveCommentHook] = useState<string | null>(null);
    const [activeWithdrawPost, setActiveWithdrawPost] = useState<string | null>(null);
    // Taxonomy filter state
    const [fImpactArea, setFImpactArea] = useState<ImpactArea | 'any'>('any');
    const [fStage, setFStage] = useState<Stage | 'any'>('any');
    const [fBeneficiaries, setFBeneficiaries] = useState<Beneficiary[]>([]);
    const [fMethods, setFMethods] = useState<Method[]>([]);
    const [fHelpNeeded, setFHelpNeeded] = useState<HelpNeeded[]>([]);
    const [bOpenFilters, setBOpenFilters] = useState(false);
    const [bOpenBeneficiaries, setBOpenBeneficiaries] = useState(false);
    const [bOpenMethods, setBOpenMethods] = useState(false);
    const [bOpenHelp, setBOpenHelp] = useState(false);
    const [showQuotaInHeader, setShowQuotaInHeader] = useState(false);
    const quotaIndicatorRef = useRef<HTMLDivElement>(null);

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

    const { user, isLoading: userLoading, isAuthenticated } = useAuth();
    const { data: userRoles = [] } = useUserRoles(user?.id || '');

    // Only leads/superadmins can view deleted publications.
    // Gate the query so non-leads don't spam 403s + console errors.
    const canViewDeletedPublications =
        user?.globalRole === 'superadmin' ||
        !!userRoles.find((r) => r.communityId === chatId && r.role === 'lead');

    // Use v1 API hook
    const { data: comms, error: communityError, isLoading: communityLoading, isFetched: communityFetched } = useCommunity(chatId);

    // Fetch all communities to find the future-vision community when on marathon-of-good
    // This must be called before calculating futureVisionCommunityId
    const { data: communitiesData } = useCommunities();

    // Check if community is special (marathon-of-good or future-vision)
    const isSpecialCommunity = comms?.typeTag === 'marathon-of-good' || comms?.typeTag === 'future-vision';
    const isMarathonOfGood = comms?.typeTag === 'marathon-of-good';

    // Find the future-vision community ID when on marathon-of-good
    // This must be calculated before useCommunityFeed that uses it
    const futureVisionCommunityId =
        isMarathonOfGood && communitiesData?.data
            ? (communitiesData.data.find((c: any) => c.typeTag === 'future-vision')?.id ?? null)
            : null;

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
        error: _visionErr
    } = useCommunityFeed(futureVisionCommunityId || '', {
        pageSize: 5,
        sort: sortBy === 'recent' ? 'recent' : 'score',
        tag: selectedTag || undefined,
    });

    // Fetch deleted publications (will only return data if user is lead)
    // Hook is called here so it's available for useEffect/useMemo below
    const {
        data: deletedData,
        fetchNextPage: fetchNextDeletedPage,
        hasNextPage: hasNextDeletedPage,
        isFetchingNextPage: isFetchingNextDeletedPage,
        error: _deletedErr
    } = useInfiniteDeletedPublications(chatId, 20, {
        enabled: activeTab === 'deleted' && canViewDeletedPublications,
    });

    // Derive paginationEnd from hasNextPage instead of setting it in getNextPageParam
    useEffect(() => {
        if (activeTab === 'vision') {
            if (!hasNextVisionPage) {
                setPaginationEnd(true);
            } else {
                setPaginationEnd(false);
            }
        } else if (activeTab === 'deleted') {
            if (!hasNextDeletedPage) {
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
    }, [hasNextPage, hasNextVisionPage, hasNextDeletedPage, activeTab]);

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

    // Memoize deleted publications array
    const deletedPublications = useMemo(() => {
        return (deletedData?.pages ?? [])
            .flatMap((page: any) => {
                if (page?.data && Array.isArray(page.data)) {
                    return page.data;
                }
                return [];
            })
            .map((p: any) => ({
                ...p,
                slug: p.slug || p.id,
                beneficiaryId: p.beneficiaryId || p.meta?.beneficiary?.username,
                beneficiaryName: p.meta?.beneficiary?.name,
                beneficiaryPhotoUrl: p.meta?.beneficiary?.photoUrl,
                beneficiaryUsername: p.meta?.beneficiary?.username,
                type: p.type || (p.content ? 'publication' : 'poll'),
            }))
            .filter((p: FeedItem, index: number, self: FeedItem[]) =>
                index === self.findIndex((t: FeedItem) => t?.id === p?.id)
            );
    }, [deletedData?.pages]);

    // Handle deep linking to specific post or poll
    useEffect(() => {
        const postsToSearch = activeTab === 'vision' ? visionPublications : publications;
        if ((targetPostSlug || targetPollId || highlightPostSlug) && postsToSearch.length > 0) {
            let targetPost: FeedItem | undefined;

            if (targetPollId) {
                targetPost = postsToSearch.find((p: FeedItem) => p.id === targetPollId && p.type === 'poll');
            } else if (targetPostSlug) {
                targetPost = postsToSearch.find((p: FeedItem) => p.slug === targetPostSlug);
            } else if (highlightPostSlug) {
                targetPost = postsToSearch.find((p: FeedItem) => p.slug === highlightPostSlug);
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
                        // Remove highlight parameter from URL after scrolling
                        if (highlightPostSlug && pathname) {
                            const params = new URLSearchParams(searchParams?.toString() || '');
                            params.delete('highlight');
                            const newUrl = params.toString() ? `${pathname}?${params.toString()}` : pathname;
                            router.replace(newUrl);
                        }
                    }
                }, 500);
            }
        }
    }, [targetPostSlug, targetPollId, highlightPostSlug, publications, visionPublications, activeTab, searchParams, pathname, router]);

    const error =
        (publications ?? [])?.[0]?.error || err
            ? true
            : publications.length > 0
                ? false
                : undefined;

    const { data: wallets = [], isLoading: _walletsLoading } = useWallets();

    // Get wallet balance using standardized hook
    const { data: balance = 0 } = useWalletBalance(chatId);

    // Get quota data for this community
    const { data: quotaData } = useUserQuota(chatId);

    // Get user roles and check if can create posts
    const canCreatePost = useCanCreatePost(chatId);

    const tCommon = useCommonTranslations('common');

    // Get user's role in current community
    const userRoleInCommunity =
        user?.globalRole === 'superadmin'
            ? 'superadmin'
            : (userRoles.find((r) => r.communityId === chatId)?.role ?? null);

    // Check if user is a lead (for deleted tab visibility)
    const isLead = userRoleInCommunity === 'lead' || user?.globalRole === 'superadmin';

    // Determine eligibility for permanent merits and quota
    const canEarnPermanentMerits =
        comms?.meritSettings?.canEarn === true && balance !== undefined;

    const hasQuota =
        !!comms?.meritSettings &&
        !!userRoleInCommunity &&
        comms.meritSettings.dailyQuota > 0 &&
        comms.meritSettings.quotaRecipients.includes(userRoleInCommunity);

    const quotaRemaining = quotaData?.remainingToday ?? 0;
    const quotaMax = quotaData?.dailyQuota ?? 0;
    const currencyIconUrl = comms?.settings?.iconUrl;

    // Intersection observer to detect when quota indicator scrolls out of view
    useEffect(() => {
        if (!quotaIndicatorRef.current || (!canEarnPermanentMerits && !hasQuota)) {
            setShowQuotaInHeader(false);
            return;
        }

        const observer = new IntersectionObserver(
            (entries) => {
                const entry = entries[0];
                if (entry) {
                    // Show in header when quota indicator is not visible (scrolled past)
                    setShowQuotaInHeader(!entry.isIntersecting);
                }
            },
            {
                threshold: 0,
                rootMargin: '-60px 0px 0px 0px', // Account for header height
            }
        );

        observer.observe(quotaIndicatorRef.current);

        return () => {
            observer.disconnect();
        };
    }, [canEarnPermanentMerits, hasQuota]);

    // Get user's team community (community with typeTag: 'team' where user has a role)
    const _userTeamCommunityId = null;

    // For now, teamChatUrl is not available without additional API calls
    // This functionality can be restored if needed by fetching user's communities and filtering for typeTag: 'team'
    const teamChatUrl = null;

    useEffect(() => {
        if (!userLoading && !isAuthenticated) {
            router.push("/meriter/login?returnTo=" + encodeURIComponent(document.location.pathname));
        }
    }, [isAuthenticated, userLoading, router]);

    // Handle 404 - redirect to not-found if community doesn't exist
    useEffect(() => {
        // Only check after query has completed and we're authenticated
        if (communityFetched && !communityLoading && isAuthenticated) {
            // Check if community doesn't exist (error with NOT_FOUND code)
            const isNotFound =
                communityError &&
                ((communityError as any)?.data?.code === 'NOT_FOUND' ||
                    (communityError as any)?.message?.includes('not found'));

            if (isNotFound) {
                // Redirect to not-found page
                router.replace('/meriter/not-found');
            }
        }
    }, [communityFetched, communityLoading, communityError, isAuthenticated, router]);

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
    const _chatUrl = comms?.description;

    // Helper function to toggle items in array
    const toggleInArray = <T,>(arr: T[], value: T): T[] => {
      return arr.includes(value) ? arr.filter((x) => x !== value) : [...arr, value];
    };

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
                    const pub = p as PublicationFeedItem;
                    const content = (pub.content || '').toLowerCase();
                    const authorName = (pub.meta?.author?.name || '').toLowerCase();
                    const hashtags = (pub.hashtags || []).join(' ').toLowerCase();

                    return content.includes(query) ||
                        authorName.includes(query) ||
                        hashtags.includes(query);
                } else if (p.type === 'poll') {
                    const poll = p as PollFeedItem;
                    const question = (poll.question || '').toLowerCase();
                    const authorName = (poll.meta?.author?.name || '').toLowerCase();

                    return question.includes(query) || authorName.includes(query);
                }
                return false;
            });
        }

        // Filter by taxonomy fields (OR semantics for array fields)
        filtered = filtered.filter((p: FeedItem) => {
            if (p.type !== 'publication') return true; // Only filter publications
            
            const pub = p as PublicationFeedItem & { impactArea?: string; stage?: string; beneficiaries?: string[]; methods?: string[]; helpNeeded?: string[] };
            
            if (fImpactArea !== 'any' && pub.impactArea !== fImpactArea) return false;
            if (fStage !== 'any' && pub.stage !== fStage) return false;
            
            // OR semantics across selected facets - item matches if it has ANY of the selected tags
            if (fBeneficiaries.length > 0) {
                const pubBeneficiaries = pub.beneficiaries || [];
                const hasAnyBeneficiary = fBeneficiaries.some(b => pubBeneficiaries.includes(b));
                if (!hasAnyBeneficiary) return false;
            }
            if (fMethods.length > 0) {
                const pubMethods = pub.methods || [];
                const hasAnyMethod = fMethods.some(m => pubMethods.includes(m));
                if (!hasAnyMethod) return false;
            }
            if (fHelpNeeded.length > 0) {
                const pubHelpNeeded = pub.helpNeeded || [];
                const hasAnyHelpNeeded = fHelpNeeded.some(h => pubHelpNeeded.includes(h));
                if (!hasAnyHelpNeeded) return false;
            }
            
            return true;
        });

        return filtered;
    }, [publications, selectedTag, searchQuery, fImpactArea, fStage, fBeneficiaries, fMethods, fHelpNeeded]);

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
                    const pub = p as PublicationFeedItem;
                    const content = (pub.content || '').toLowerCase();
                    const authorName = (pub.meta?.author?.name || '').toLowerCase();
                    const hashtags = (pub.hashtags || []).join(' ').toLowerCase();

                    return content.includes(query) ||
                        authorName.includes(query) ||
                        hashtags.includes(query);
                } else if (p.type === 'poll') {
                    const poll = p as PollFeedItem;
                    const question = (poll.question || '').toLowerCase();
                    const authorName = (poll.meta?.author?.name || '').toLowerCase();

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
            stickyHeader={
                <CommunityTopBar 
                    communityId={chatId} 
                    asStickyHeader={true} 
                    activeTab={activeTab} 
                    futureVisionCommunityId={futureVisionCommunityId}
                    showQuotaInHeader={showQuotaInHeader}
                    quotaData={showQuotaInHeader ? {
                        balance: canEarnPermanentMerits ? balance : undefined,
                        quotaRemaining: hasQuota ? quotaRemaining : undefined,
                        quotaMax: hasQuota ? quotaMax : undefined,
                        currencyIconUrl,
                        isMarathonOfGood,
                        showPermanent: canEarnPermanentMerits,
                        showDaily: hasQuota,
                    } : undefined}
                />
            }
        >
            {/* Community Hero Card - Twitter-style with cover */}
            {comms && (
                <div className="mb-6">
                    <CommunityHeroCard
                        community={{
                            ...comms,
                            id: comms.id || chatId,
                        }}
                    />
                    {/* Quota and Permanent Merits Indicators */}
                    {(canEarnPermanentMerits || hasQuota) && (
                        <div 
                            ref={quotaIndicatorRef}
                            id="quota-indicator"
                            className="flex items-center gap-4 mt-3 px-4 py-2 bg-base-200/50 rounded-lg"
                        >
                            <QuotaDisplay
                                balance={canEarnPermanentMerits ? balance : undefined}
                                quotaRemaining={hasQuota ? quotaRemaining : undefined}
                                quotaMax={hasQuota ? quotaMax : undefined}
                                currencyIconUrl={currencyIconUrl}
                                isMarathonOfGood={isMarathonOfGood}
                                showPermanent={canEarnPermanentMerits}
                                showDaily={hasQuota}
                            />
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
                        label: tCommunities('members.title') || 'Members',
                        icon: <Users size={16} />,
                    },
                    ...(isLead ? [{
                        id: 'deleted',
                        label: tCommunities('deleted') || 'Deleted',
                        icon: <Trash2 size={16} />,
                    }] : []),
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
                    {/* Taxonomy Filters */}
                    <div className="rounded-2xl border bg-base-100 p-4 space-y-4">
                        <div className="flex items-center justify-between gap-2">
                            <div className="flex items-center gap-2">
                                <Filter className="h-4 w-4" />
                                <span className="text-sm font-medium">Filters</span>
                            </div>
                            <div className="flex items-center gap-2">
                                {(fImpactArea !== 'any' || fStage !== 'any' || fBeneficiaries.length > 0 || fMethods.length > 0 || fHelpNeeded.length > 0) && (
                                    <Button
                                        variant="ghost"
                                        size="sm"
                                        onClick={() => {
                                            setFImpactArea('any');
                                            setFStage('any');
                                            setFBeneficiaries([]);
                                            setFMethods([]);
                                            setFHelpNeeded([]);
                                            setBOpenFilters(false);
                                            setBOpenBeneficiaries(false);
                                            setBOpenMethods(false);
                                            setBOpenHelp(false);
                                        }}
                                        className="gap-2"
                                    >
                                        <X className="h-4 w-4" /> Reset
                                    </Button>
                                )}
                                <Button
                                    variant={bOpenFilters ? 'secondary' : 'outline'}
                                    size="sm"
                                    onClick={() => setBOpenFilters((s) => !s)}
                                >
                                    {bOpenFilters ? 'Hide' : 'Show'}
                                </Button>
                            </div>
                        </div>

                        {/* Compact active filters summary when collapsed */}
                        {!bOpenFilters && (fImpactArea !== 'any' || fStage !== 'any' || fBeneficiaries.length > 0 || fMethods.length > 0 || fHelpNeeded.length > 0) && (
                            <div className="flex flex-wrap gap-2 pt-1">
                                {fImpactArea !== 'any' && <Badge variant="secondary">{fImpactArea}</Badge>}
                                {fStage !== 'any' && <Badge variant="secondary">{fStage}</Badge>}
                                {fBeneficiaries.slice(0, 2).map((x) => (
                                    <Badge key={x} variant="secondary">{x}</Badge>
                                ))}
                                {fMethods.slice(0, 2).map((x) => (
                                    <Badge key={x} variant="secondary">{x}</Badge>
                                ))}
                                {fHelpNeeded.slice(0, 2).map((x) => (
                                    <Badge key={x} variant="secondary">{x}</Badge>
                                ))}
                                {(fBeneficiaries.length > 2 || fMethods.length > 2 || fHelpNeeded.length > 2) && (
                                    <Badge variant="outline" className="font-normal">+more</Badge>
                                )}
                            </div>
                        )}

                        {bOpenFilters && (
                            <>
                                <div className="grid gap-3 sm:grid-cols-2">
                                    <div className="space-y-2">
                                        <Label>Impact Area</Label>
                                        <Select
                                            value={fImpactArea}
                                            onValueChange={(v) => setFImpactArea(v as ImpactArea | 'any')}
                                        >
                                            <SelectTrigger>
                                                <SelectValue />
                                            </SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="any">Any</SelectItem>
                                                {(IMPACT_AREAS || []).map((x) => (
                                                    <SelectItem key={x} value={x}>{translateImpactArea(x)}</SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                    </div>
                                    <div className="space-y-2">
                                        <Label>Stage</Label>
                                        <Select
                                            value={fStage}
                                            onValueChange={(v) => setFStage(v as Stage | 'any')}
                                        >
                                            <SelectTrigger>
                                                <SelectValue />
                                            </SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="any">Any</SelectItem>
                                                {(STAGES || []).map((x) => (
                                                    <SelectItem key={x} value={x}>{translateStage(x)}</SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                    </div>
                                </div>

                                <Separator />

                                <CollapsibleSection
                                    title={`Beneficiaries (${fBeneficiaries.length})`}
                                    open={bOpenBeneficiaries}
                                    setOpen={setBOpenBeneficiaries}
                                    summary={fBeneficiaries.length ? fBeneficiaries.map(translateBeneficiary).join(', ') : 'Who benefits?'}
                                    right={
                                        <Button
                                            variant="ghost"
                                            size="sm"
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                setFBeneficiaries([]);
                                            }}
                                            disabled={!fBeneficiaries.length}
                                        >
                                            Clear
                                        </Button>
                                    }
                                >
                                    <div className="pt-1">
                                        <Checklist
                                            options={Array.isArray(BENEFICIARIES) ? [...BENEFICIARIES] : []}
                                            selected={fBeneficiaries}
                                            translateValue={translateBeneficiary}
                                            onToggle={(v) => setFBeneficiaries((s) => toggleInArray(s, v))}
                                        />
                                    </div>
                                </CollapsibleSection>

                                <CollapsibleSection
                                    title={`Methods (${fMethods.length})`}
                                    open={bOpenMethods}
                                    setOpen={setBOpenMethods}
                                    summary={fMethods.length ? fMethods.map(translateMethod).join(', ') : 'How do they act?'}
                                    right={
                                        <Button
                                            variant="ghost"
                                            size="sm"
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                setFMethods([]);
                                            }}
                                            disabled={!fMethods.length}
                                        >
                                            Clear
                                        </Button>
                                    }
                                >
                                    <div className="pt-1">
                                        <Checklist
                                            options={Array.isArray(METHODS) ? [...METHODS] : []}
                                            selected={fMethods}
                                            translateValue={translateMethod}
                                            onToggle={(v) => setFMethods((s) => toggleInArray(s, v))}
                                        />
                                    </div>
                                </CollapsibleSection>

                                <CollapsibleSection
                                    title={`Help needed (${fHelpNeeded.length})`}
                                    open={bOpenHelp}
                                    setOpen={setBOpenHelp}
                                    summary={fHelpNeeded.length ? fHelpNeeded.map(translateHelpNeeded).join(', ') : 'What do they need?'}
                                    right={
                                        <Button
                                            variant="ghost"
                                            size="sm"
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                setFHelpNeeded([]);
                                            }}
                                            disabled={!fHelpNeeded.length}
                                        >
                                            Clear
                                        </Button>
                                    }
                                >
                                    <div className="pt-1">
                                        <Checklist
                                            options={Array.isArray(HELP_NEEDED) ? [...HELP_NEEDED] : []}
                                            selected={fHelpNeeded}
                                            translateValue={translateHelpNeeded}
                                            onToggle={(v) => setFHelpNeeded((s) => toggleInArray(s, v))}
                                        />
                                    </div>
                                </CollapsibleSection>
                            </>
                        )}
                    </div>

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
                                                ? 'rounded-lg scale-[1.02] bg-brand-primary/10 shadow-lg transition-all duration-300 p-2'
                                                : isSelected
                                                    ? 'rounded-lg scale-[1.02] bg-brand-secondary/10 shadow-lg transition-all duration-300 p-2'
                                                    : 'hover:shadow-md transition-all duration-200 rounded-lg'
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
                        <Button
                            variant="default"
                            onClick={() => fetchNextPage()}
                            className="rounded-xl active:scale-[0.98] w-full sm:w-auto mx-auto block"
                        >
                            {t('communities.loadMore')}
                        </Button>
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
                                                        ? 'rounded-lg scale-[1.02] bg-brand-primary/10 shadow-lg transition-all duration-300 p-2'
                                                        : isSelected
                                                            ? 'rounded-lg scale-[1.02] bg-brand-secondary/10 shadow-lg transition-all duration-300 p-2'
                                                            : 'hover:shadow-md transition-all duration-200 rounded-lg'
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
                                <Button
                                    variant="default"
                                    onClick={() => fetchNextVisionPage()}
                                    className="rounded-xl active:scale-[0.98] w-full sm:w-auto mx-auto block"
                                >
                                    {t('communities.loadMore')}
                                </Button>
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
            ) : activeTab === 'deleted' ? (
                <div className="space-y-4">
                    {isLead ? (
                        <>
                            {deletedPublications.map((p) => {
                                const isSelected = !!(targetPostSlug && (p.slug === targetPostSlug || p.id === targetPostSlug))
                                    || !!(targetPollId && p.id === targetPollId);

                                return (
                                    <div
                                        key={p.id}
                                        id={`post-${p.id}`}
                                        className={
                                            highlightedPostId === p.id
                                                ? 'rounded-lg scale-[1.02] bg-brand-primary/10 shadow-lg transition-all duration-300 p-2'
                                                : isSelected
                                                    ? 'rounded-lg scale-[1.02] bg-brand-secondary/10 shadow-lg transition-all duration-300 p-2'
                                                    : 'hover:shadow-md transition-all duration-200 rounded-lg opacity-75'
                                        }
                                    >
                                        <div className="relative">
                                            {/* Deleted indicator badge */}
                                            <div className="absolute -top-2 -right-2 z-10 bg-error text-error-content rounded-full px-2 py-1 text-xs font-semibold shadow-lg">
                                                Deleted
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

                            {isFetchingNextDeletedPage && (
                                <div className="flex justify-center py-4">
                                    <Loader2 className="w-6 h-6 animate-spin text-brand-primary" />
                                </div>
                            )}

                            {!paginationEnd && deletedPublications.length > 0 && !isFetchingNextDeletedPage && (
                                <Button
                                    variant="default"
                                    onClick={() => fetchNextDeletedPage()}
                                    className="rounded-xl active:scale-[0.98] w-full sm:w-auto mx-auto block"
                                >
                                    {t('communities.loadMore')}
                                </Button>
                            )}

                            {deletedPublications.length === 0 && !isFetchingNextDeletedPage && (
                                <div className="text-center py-8 text-base-content/60">
                                    <p>{tCommunities('noDeletedPublications') || 'No deleted publications'}</p>
                                </div>
                            )}
                        </>
                    ) : (
                        <div className="text-center py-8 text-base-content/60">
                            <p>{tCommunities('accessDenied') || 'Access denied'}</p>
                        </div>
                    )}
                </div>
            ) : (
                <MembersTab communityId={chatId} />
            )}

        </AdaptiveLayout>
    );
}

