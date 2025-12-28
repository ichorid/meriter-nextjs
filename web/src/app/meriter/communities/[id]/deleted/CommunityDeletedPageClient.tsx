'use client';

import { useEffect, useState, useMemo } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { useAuth } from '@/contexts/AuthContext';
import { routes } from '@/lib/constants/routes';
import { AdaptiveLayout } from '@/components/templates/AdaptiveLayout';
import { SimpleStickyHeader } from '@/components/organisms/ContextTopBar/ContextTopBar';
import { useCommunity, useWallets } from '@/hooks/api';
import { useUserRoles } from '@/hooks/api/useProfile';
import { useInfiniteDeletedPublications, useRestorePublication } from '@/hooks/api/usePublications';
import { PublicationCardComponent as PublicationCard } from "@/components/organisms/Publication";
import { Loader2, RotateCcw } from 'lucide-react';
import { Button } from '@/components/ui/shadcn/button';
import type { FeedItem } from '@meriter/shared-types';
import { useInfiniteScroll } from '@/hooks/useInfiniteScroll';

interface CommunityDeletedPageClientProps {
  communityId: string;
}

export function CommunityDeletedPageClient({ communityId }: CommunityDeletedPageClientProps) {
    const router = useRouter();
    const searchParams = useSearchParams();
    const t = useTranslations('pages');
    const tCommunities = useTranslations('pages.communities');
    const { user } = useAuth();

    const { data: community, isLoading: communityLoading } = useCommunity(communityId);
    const { data: userRoles = [] } = useUserRoles(user?.id || '');
    const { data: wallets = [] } = useWallets();

    // Get the post parameter from URL for deep linking
    const targetPostSlug = searchParams?.get('post');
    const targetPollId = searchParams?.get('poll');

    // Check if user is a lead (for deleted publications access)
    const isLead = user?.globalRole === 'superadmin' || 
        !!userRoles.find((r) => r.communityId === communityId && r.role === 'lead');

    // Fetch deleted publications (will only return data if user is lead)
    const {
        data: deletedData,
        fetchNextPage: fetchNextDeletedPage,
        hasNextPage: hasNextDeletedPage,
        isFetchingNextPage: isFetchingNextDeletedPage,
        error: deletedErr
    } = useInfiniteDeletedPublications(communityId, 20, {
        enabled: isLead,
    });

    const [paginationEnd, setPaginationEnd] = useState(false);
    const [highlightedPostId, setHighlightedPostId] = useState<string | null>(null);
    const [restoringIds, setRestoringIds] = useState<Set<string>>(new Set());

    const restorePublication = useRestorePublication();

    // Derive paginationEnd from hasNextPage
    useEffect(() => {
        if (!hasNextDeletedPage) {
            setPaginationEnd(true);
        } else {
            setPaginationEnd(false);
        }
    }, [hasNextDeletedPage]);

    // Infinite scroll trigger
    const observerTarget = useInfiniteScroll({
        hasNextPage: hasNextDeletedPage,
        fetchNextPage: fetchNextDeletedPage,
        isFetchingNextPage: isFetchingNextDeletedPage,
        threshold: 200,
    });

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
        if ((targetPostSlug || targetPollId) && deletedPublications.length > 0) {
            let targetPost: FeedItem | undefined;

            if (targetPollId) {
                targetPost = deletedPublications.find((p: FeedItem) => p.id === targetPollId && p.type === 'poll');
            } else if (targetPostSlug) {
                targetPost = deletedPublications.find((p: FeedItem) => p.slug === targetPostSlug);
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
    }, [targetPostSlug, targetPollId, deletedPublications]);

    const handleRestore = async (publicationId: string) => {
        setRestoringIds((prev) => new Set(prev).add(publicationId));
        try {
            await restorePublication.mutateAsync({ id: publicationId });
            // Remove from restoring set after a short delay to allow UI update
            setTimeout(() => {
                setRestoringIds((prev) => {
                    const next = new Set(prev);
                    next.delete(publicationId);
                    return next;
                });
            }, 500);
        } catch (error) {
            console.error('Failed to restore publication:', error);
            setRestoringIds((prev) => {
                const next = new Set(prev);
                next.delete(publicationId);
                return next;
            });
        }
    };

    const pageHeader = (
        <SimpleStickyHeader
            title={tCommunities('deleted') || 'Deleted'}
            showBack={true}
            onBack={() => router.push(routes.community(communityId))}
            asStickyHeader={true}
            showScrollToTop={true}
        />
    );

    if (communityLoading) {
        return (
            <AdaptiveLayout
                className="deleted"
                communityId={communityId}
                myId={user?.id}
                stickyHeader={pageHeader}
            >
                <div className="flex justify-center items-center min-h-[400px]">
                    <Loader2 className="w-8 h-8 animate-spin text-brand-primary" />
                </div>
            </AdaptiveLayout>
        );
    }

    // Check access permissions
    if (!isLead) {
        return (
            <AdaptiveLayout
                className="deleted"
                communityId={communityId}
                myId={user?.id}
                stickyHeader={pageHeader}
            >
                <div className="text-center py-12 text-base-content/60">
                    <p>{tCommunities('accessDenied') || 'Access denied'}</p>
                </div>
            </AdaptiveLayout>
        );
    }

    return (
        <AdaptiveLayout
            className="deleted"
            communityId={communityId}
            myId={user?.id}
            wallets={Array.isArray(wallets) ? wallets : []}
            stickyHeader={pageHeader}
        >
            <div className="space-y-4">
                {deletedErr ? (
                    <div className="text-center py-12 text-error">
                        <p>{tCommunities('errorLoadingDeleted') || 'Error loading deleted publications'}</p>
                    </div>
                ) : deletedPublications.length > 0 ? (
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
                                        {/* Restore button */}
                                        <div className="absolute -top-2 left-2 z-10">
                                            <Button
                                                variant="default"
                                                size="sm"
                                                onClick={() => handleRestore(p.id)}
                                                disabled={restoringIds.has(p.id) || restorePublication.isPending}
                                                className="rounded-xl active:scale-[0.98] text-xs"
                                                title="Restore publication"
                                            >
                                                {restoringIds.has(p.id) || restorePublication.isPending ? (
                                                    <Loader2 className="w-3 h-3 animate-spin" />
                                                ) : (
                                                    <>
                                                        <RotateCcw className="w-3 h-3 mr-1" />
                                                        Restore
                                                    </>
                                                )}
                                            </Button>
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

                        {/* Infinite scroll trigger */}
                        <div ref={observerTarget} className="h-4" />

                        {isFetchingNextDeletedPage && (
                            <div className="flex justify-center py-4">
                                <Loader2 className="w-6 h-6 animate-spin text-brand-primary" />
                            </div>
                        )}
                    </>
                ) : (
                    <div className="text-center py-12 text-base-content/60">
                        <p>{tCommunities('noDeletedPublications') || 'No deleted publications'}</p>
                    </div>
                )}
            </div>
        </AdaptiveLayout>
    );
}

