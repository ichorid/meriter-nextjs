'use client';

import { useEffect, useRef, useState, useMemo } from "react";
import { AdaptiveLayout } from '@/components/templates/AdaptiveLayout';
import { CommunityTopBar } from '@/components/organisms/ContextTopBar';
import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { PublicationCardComponent as PublicationCard } from "@/components/organisms/Publication";
import { useTranslations } from 'next-intl';
import { useWallets, useCommunity, useCommunities } from '@/hooks/api';
import { useCommunityFeed } from '@/hooks/api/useCommunityFeed';
import { useWalletBalance } from '@/hooks/api/useWallet';
import { useAuth } from '@/contexts/AuthContext';
import type { FeedItem, PublicationFeedItem, PollFeedItem } from '@meriter/shared-types';
import { Button } from '@/components/ui/shadcn/button';
import { CommunityHeroCard } from '@/components/organisms/Community/CommunityHeroCard';
import { Loader2, Filter, X, ArrowUp, Coins, Search } from 'lucide-react';
import { useDebounce } from '@/hooks/useDebounce';
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
import { BottomActionSheet } from '@/components/ui/BottomActionSheet';
import { useCanCreatePost } from '@/hooks/useCanCreatePost';
import { useUserRoles } from '@/hooks/api/useProfile';
import { DailyQuotaRing } from '@/components/molecules/DailyQuotaRing';
import { QuotaDisplay } from '@/components/molecules/QuotaDisplay/QuotaDisplay';
import { useUserQuota } from '@/hooks/api/useQuota';
import { routes } from '@/lib/constants/routes';
import { useTranslations as useCommonTranslations } from 'next-intl';
import { useInfiniteDeletedPublications } from '@/hooks/api/usePublications';
import { useCommunityPolling } from '@/hooks/useCommunityPolling';
import { SortToggle } from '@/components/ui/SortToggle';
import { isFakeDataMode } from '@/config';
import { trpc } from '@/lib/trpc/client';
import { useInfiniteScroll } from '@/hooks/useInfiniteScroll';

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
    const [localSearchQuery, setLocalSearchQuery] = useState(searchQuery);
    const [showSearchModal, setShowSearchModal] = useState(false);
    const debouncedSearchQuery = useDebounce(searchQuery, 500);

    // Handle search query change
    const handleSearchChange = (value: string) => {
        setLocalSearchQuery(value);
        const params = new URLSearchParams(searchParams?.toString() ?? '');
        if (value.trim()) {
            params.set('q', value.trim());
        } else {
            params.delete('q');
        }
        router.push(`?${params.toString()}`);
    };

    // Handle search clear
    const handleSearchClear = () => {
        setLocalSearchQuery('');
        const params = new URLSearchParams(searchParams?.toString() ?? '');
        params.delete('q');
        router.push(`?${params.toString()}`);
    };

    // Sync local search query with URL params
    useEffect(() => {
        setLocalSearchQuery(searchQuery);
    }, [searchQuery]);

    // Handle sort change
    const handleSortChange = (sort: 'recent' | 'voted') => {
        const params = new URLSearchParams(searchParams?.toString() ?? '');
        params.set('sort', sort);
        router.push(`?${params.toString()}`);
    };

    // Handle scroll to top
    const handleScrollToTop = () => {
        window.scrollTo({ top: 0, behavior: 'smooth' });
    };

    // Fake data generation state (dev mode only)
    const fakeDataMode = isFakeDataMode();
    const [generatingUserPosts, setGeneratingUserPosts] = useState(false);
    const [generatingBeneficiaryPosts, setGeneratingBeneficiaryPosts] = useState(false);
    const [addingMerits, setAddingMerits] = useState(false);
    const [fakeDataMessage, setFakeDataMessage] = useState('');

    // Handle fake data generation
    const generateFakeDataMutation = trpc.publications.generateFakeData.useMutation();
    const addMeritsMutation = trpc.wallets.addMerits.useMutation();
    const utils = trpc.useUtils();

    const handleGenerateUserPosts = async () => {
        setGeneratingUserPosts(true);
        setFakeDataMessage('');

        try {
            const result = await generateFakeDataMutation.mutateAsync({
                type: 'user',
                communityId: chatId,
            });
            setFakeDataMessage(`Created ${result.count} user post(s)`);
            setTimeout(() => setFakeDataMessage(''), 3000);
            router.refresh();
        } catch (error) {
            console.error('Generate user posts error:', error);
            setFakeDataMessage('Failed to generate user posts');
            setTimeout(() => setFakeDataMessage(''), 3000);
        } finally {
            setGeneratingUserPosts(false);
        }
    };

    const handleGenerateBeneficiaryPosts = async () => {
        setGeneratingBeneficiaryPosts(true);
        setFakeDataMessage('');

        try {
            const result = await generateFakeDataMutation.mutateAsync({
                type: 'beneficiary',
                communityId: chatId,
            });
            setFakeDataMessage(`Created ${result.count} post(s) with beneficiary`);
            setTimeout(() => setFakeDataMessage(''), 3000);
            router.refresh();
        } catch (error) {
            console.error('Generate beneficiary posts error:', error);
            setFakeDataMessage('Failed to generate posts with beneficiary');
            setTimeout(() => setFakeDataMessage(''), 3000);
        } finally {
            setGeneratingBeneficiaryPosts(false);
        }
    };

    const handleAddMerits = async () => {
        setAddingMerits(true);
        setFakeDataMessage('');

        try {
            const result = await addMeritsMutation.mutateAsync({
                communityId: chatId,
                amount: 100,
            });
            setFakeDataMessage(result.message);
            setTimeout(() => setFakeDataMessage(''), 3000);
            // Invalidate wallets to refresh the balance
            utils.wallets.getAll.invalidate();
            utils.wallets.getBalance.invalidate({ communityId: chatId });
        } catch (error) {
            console.error('Add merits error:', error);
            setFakeDataMessage('Failed to add merits');
            setTimeout(() => setFakeDataMessage(''), 3000);
        } finally {
            setAddingMerits(false);
        }
    };

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

    const { user, isLoading: userLoading, isAuthenticated } = useAuth();
    const { data: userRoles = [] } = useUserRoles(user?.id || '');

    // Use v1 API hook
    const { data: comms, error: communityError, isLoading: communityLoading, isFetched: communityFetched } = useCommunity(chatId);

    // Enable periodic polling for this community (refresh content and quota every 30s)
    useCommunityPolling(chatId);

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
        search: debouncedSearchQuery.trim() || undefined,
        impactArea: fImpactArea !== 'any' ? fImpactArea : undefined,
        stage: fStage !== 'any' ? fStage : undefined,
        beneficiaries: fBeneficiaries.length > 0 ? fBeneficiaries : undefined,
        methods: fMethods.length > 0 ? fMethods : undefined,
        helpNeeded: fHelpNeeded.length > 0 ? fHelpNeeded : undefined,
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
        search: debouncedSearchQuery.trim() || undefined,
        impactArea: fImpactArea !== 'any' ? fImpactArea : undefined,
        stage: fStage !== 'any' ? fStage : undefined,
        beneficiaries: fBeneficiaries.length > 0 ? fBeneficiaries : undefined,
        methods: fMethods.length > 0 ? fMethods : undefined,
        helpNeeded: fHelpNeeded.length > 0 ? fHelpNeeded : undefined,
    });

    // Fetch deleted publications (will only return data if user is lead)
    // Hook is called here so it's available for useEffect/useMemo below
    // 403 errors are suppressed by retry: false in the hook
    const {
        data: deletedData,
        fetchNextPage: fetchNextDeletedPage,
        hasNextPage: hasNextDeletedPage,
        isFetchingNextPage: isFetchingNextDeletedPage,
        error: _deletedErr
    } = useInfiniteDeletedPublications(chatId, 20);
    // Derive paginationEnd from hasNextPage instead of setting it in getNextPageParam
    useEffect(() => {
        if (!hasNextPage) {
            setPaginationEnd(true);
        } else {
            setPaginationEnd(false);
        }
    }, [hasNextPage]);

    // Infinite scroll trigger
    const observerTarget = useInfiniteScroll({
        hasNextPage,
        fetchNextPage,
        isFetchingNextPage,
        threshold: 200,
    });

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
        if ((targetPostSlug || targetPollId || highlightPostSlug) && publications.length > 0) {
            let targetPost: FeedItem | undefined;

            if (targetPollId) {
                targetPost = publications.find((p: FeedItem) => p.id === targetPollId && p.type === 'poll');
            } else if (targetPostSlug) {
                targetPost = publications.find((p: FeedItem) => p.slug === targetPostSlug);
            } else if (highlightPostSlug) {
                targetPost = publications.find((p: FeedItem) => p.slug === highlightPostSlug);
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
    }, [targetPostSlug, targetPollId, highlightPostSlug, publications, searchParams, pathname, router]);

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

    // Reset quota header state when pathname changes (e.g., navigating back)
    useEffect(() => {
        setShowQuotaInHeader(false);
    }, [pathname]);

    // Intersection observer to detect when quota indicator scrolls out of view
    useEffect(() => {
        if (!quotaIndicatorRef.current || (!canEarnPermanentMerits && !hasQuota)) {
            setShowQuotaInHeader(false);
            return;
        }

        // Reset state initially
        setShowQuotaInHeader(false);

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
    }, [canEarnPermanentMerits, hasQuota, pathname]);

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
    }, [paginationEnd, fetchNextPage]);

    // Use community data for chat info (same as comms)
    const _chatUrl = comms?.description;

    // Helper function to toggle items in array
    const toggleInArray = <T,>(arr: T[], value: T): T[] => {
        return arr.includes(value) ? arr.filter((x) => x !== value) : [...arr, value];
    };

    // Publications are already filtered server-side (tag, search, taxonomy filters)
    // This useMemo is kept for consistency but just returns the server-filtered data
    const filteredPublications = useMemo(() => {
        return publications;
    }, [publications]);

    // Vision publications are already filtered server-side (tag, search, taxonomy filters)
    // This useMemo is kept for consistency but just returns the server-filtered data
    const filteredVisionPublications = useMemo(() => {
        return visionPublications;
    }, [visionPublications]);

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

            {/* Dev Tools Bar - only visible in fake data mode */}
            {fakeDataMode && (
                <div className="mb-4 p-3 bg-base-200/50 rounded-xl border border-base-300">
                    <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-xs font-semibold text-base-content/70 mr-2">Dev Tools:</span>
                        <Button
                            variant="ghost"
                            size="sm"
                            onClick={handleGenerateUserPosts}
                            disabled={generatingUserPosts || generatingBeneficiaryPosts || addingMerits}
                            className="rounded-xl active:scale-[0.98] px-2"
                            title="Generate user post"
                        >
                            {generatingUserPosts ? <Loader2 className="animate-spin" size={16} /> : <span>+</span>}
                        </Button>
                        <Button
                            variant="ghost"
                            size="sm"
                            onClick={handleGenerateBeneficiaryPosts}
                            disabled={generatingUserPosts || generatingBeneficiaryPosts || addingMerits}
                            className="rounded-xl active:scale-[0.98] px-2"
                            title="Generate post with beneficiary"
                        >
                            {generatingBeneficiaryPosts ? <Loader2 className="animate-spin" size={16} /> : <span>++</span>}
                        </Button>
                        <Button
                            variant="ghost"
                            size="sm"
                            onClick={handleAddMerits}
                            disabled={generatingUserPosts || generatingBeneficiaryPosts || addingMerits}
                            className="rounded-xl active:scale-[0.98] px-2"
                            title="Add 100 wallet merits"
                        >
                            {addingMerits ? <Loader2 className="animate-spin" size={16} /> : <Coins size={16} className="text-base-content/70" />}
                        </Button>
                        {fakeDataMessage && (
                            <span className={`text-xs ${fakeDataMessage.includes('Failed') ? 'text-error' : 'text-success'}`}>
                                {fakeDataMessage}
                            </span>
                        )}
                    </div>
                </div>
            )}

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

            {/* Publications Content */}
            <div className="space-y-4 pb-24">
                {/* Taxonomy Filters */}
                <div className="rounded-2xl border bg-base-100 p-4 space-y-4">
                    <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2">
                            {/* Search Button */}
                            <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => setShowSearchModal(true)}
                                className="rounded-xl active:scale-[0.98] px-2"
                                aria-label="Search"
                                title="Search"
                            >
                                <Search size={18} className="text-base-content/70" />
                            </Button>

                            {/* Sort Toggle */}
                            <div className="flex gap-0.5 bg-base-200/50 p-0.5 rounded-lg">
                                <SortToggle
                                    value={sortBy as 'recent' | 'voted'}
                                    onChange={handleSortChange}
                                    compact={true}
                                />
                            </div>

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

                {/* Infinite scroll trigger */}
                <div ref={observerTarget} className="h-4" />

                {isFetchingNextPage && (
                    <div className="flex justify-center py-4">
                        <Loader2 className="w-6 h-6 animate-spin text-brand-primary" />
                    </div>
                )}
            </div>

            {/* Search Modal */}
            {showSearchModal && (
                <BottomActionSheet
                    isOpen={showSearchModal}
                    onClose={() => setShowSearchModal(false)}
                    title={tCommunities('searchPlaceholder') || 'Search'}
                >
                    <div className="relative w-full">
                        <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none z-10" />
                        <Input
                            type="text"
                            placeholder={tCommunities('searchPlaceholder') || 'Search'}
                            value={localSearchQuery}
                            onChange={(e) => handleSearchChange(e.target.value)}
                            className="h-11 rounded-xl pl-10 pr-10"
                            autoFocus
                        />
                        {localSearchQuery && (
                            <button
                                type="button"
                                onClick={handleSearchClear}
                                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors z-10"
                            >
                                <X size={18} />
                            </button>
                        )}
                    </div>
                </BottomActionSheet>
            )}

        </AdaptiveLayout>
    );
}

