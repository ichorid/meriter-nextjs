'use client';

import React, { useEffect, useMemo } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { AdaptiveLayout } from '@/components/templates/AdaptiveLayout';
import { useAuth } from '@/contexts/AuthContext';
import { useUserCommunities } from '@/hooks/useUserCommunities';
import { useUserRoles } from '@/hooks/api/useProfile';
import { CommunityCard } from '@/components/organisms/CommunityCard';
import { CardSkeleton } from '@/components/ui/LoadingSkeleton';
import { Button } from '@/components/ui/shadcn/button';
import { useTranslations } from 'next-intl';
import { Separator } from '@/components/ui/shadcn/separator';
import { LeadsSection } from '@/features/communities/components';
import { Plus } from 'lucide-react';
import { routes } from '@/lib/constants/routes';

/** Leads section is hidden in current UI; set to true to show again. */
const SHOW_LEADS_SECTION = false;

export default function CommunitiesPage() {
    const pathname = usePathname();
    const router = useRouter();
    const searchParams = useSearchParams();
    const { user, isLoading: userLoading } = useAuth();
    const t = useTranslations('common');
    const tCommunities = useTranslations('communities');

    // Redirect /meriter/communities (list) to profile; create and [id] routes stay
    useEffect(() => {
        if (pathname === routes.communities) {
            router.replace(routes.profile);
        }
    }, [pathname, router]);

    // Handle scroll to leads section from URL param (when leads section is enabled)
    useEffect(() => {
        if (!SHOW_LEADS_SECTION) return;
        const scrollToLeads = searchParams?.get('scrollToLeads');
        if (scrollToLeads === 'true') {
            setTimeout(() => {
                const leadsSection = document.getElementById('leads-section');
                if (leadsSection) {
                    leadsSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
                    const params = new URLSearchParams(searchParams?.toString() || '');
                    params.delete('scrollToLeads');
                    const newUrl = params.toString() ? `${pathname}?${params.toString()}` : pathname;
                    router.replace(newUrl);
                }
            }, 300);
        }
    }, [searchParams, pathname, router]);

    const { communities: allCommunities, walletsMap, quotasMap, isLoading: communitiesLoading } = useUserCommunities();
    const { data: userRoles = [] } = useUserRoles(user?.id || '');

    // Private communities only (no special: future-vision, marathon-of-good, team-projects, support)
    const userCommunities = useMemo(() => {
        return allCommunities.filter(
            (c) =>
                c.typeTag !== 'future-vision' &&
                c.typeTag !== 'marathon-of-good' &&
                c.typeTag !== 'team-projects' &&
                c.typeTag !== 'support'
        );
    }, [allCommunities]);

    const leadCommunityIds = useMemo(
        () => new Set(userRoles.filter((r) => r.role === 'lead').map((r) => r.communityId)),
        [userRoles]
    );

    const administeredCommunities = useMemo(
        () => userCommunities.filter((c) => leadCommunityIds.has(c.id)),
        [userCommunities, leadCommunityIds]
    );
    const memberCommunities = useMemo(
        () => userCommunities.filter((c) => !leadCommunityIds.has(c.id)),
        [userCommunities, leadCommunityIds]
    );

    const isLoading = userLoading || communitiesLoading;

    const renderCommunityList = (list: typeof userCommunities) => (
        <div className="flex flex-col gap-1">
            {list.map((community) => {
                const wallet = walletsMap.get(community.id);
                const quota = quotasMap.get(community.id);
                return (
                    <CommunityCard
                        key={community.id}
                        communityId={community.id}
                        pathname={pathname}
                        isExpanded={true}
                        wallet={wallet ? { balance: wallet.balance || 0, communityId: community.id } : undefined}
                        quota={
                            quota && typeof quota.remainingToday === 'number'
                                ? {
                                      remainingToday: quota.remainingToday,
                                      dailyQuota: quota.dailyQuota ?? 0,
                                  }
                                : undefined
                        }
                    />
                );
            })}
        </div>
    );

    return (
        <AdaptiveLayout>
            <div className="space-y-0">
                {/* Administered communities (user is lead) */}
                <div className="bg-base-100 py-4 space-y-3">
                    <p className="text-xs font-medium text-base-content/40 uppercase tracking-wide">
                        {tCommunities('administeredCommunities')}
                    </p>
                    {isLoading ? (
                        <div className="flex flex-col gap-1">
                            <CardSkeleton />
                            <CardSkeleton />
                        </div>
                    ) : administeredCommunities.length > 0 ? (
                        renderCommunityList(administeredCommunities)
                    ) : (
                        <p className="text-sm text-base-content/50">{tCommunities('noAdministeredCommunities')}</p>
                    )}
                </div>

                {/* Create community */}
                <div className="bg-base-100 py-2">
                    <Button
                        variant="outline"
                        className="w-full gap-2"
                        onClick={() => router.push('/meriter/communities/create')}
                    >
                        <Plus className="w-4 h-4" />
                        {t('createCommunity')}
                    </Button>
                </div>

                {/* Member-of communities (participant, not lead) */}
                <div className="bg-base-100 py-4 space-y-3">
                    <p className="text-xs font-medium text-base-content/40 uppercase tracking-wide">
                        {tCommunities('communitiesIMemberOf')}
                    </p>
                    {isLoading ? (
                        <div className="flex flex-col gap-1">
                            <CardSkeleton />
                            <CardSkeleton />
                        </div>
                    ) : memberCommunities.length > 0 ? (
                        renderCommunityList(memberCommunities)
                    ) : (
                        <p className="text-sm text-base-content/50">{tCommunities('noMemberCommunities')}</p>
                    )}
                </div>

                {/* Leads (hidden by default; pluggable module) */}
                {SHOW_LEADS_SECTION && (
                    <>
                        <Separator className="bg-base-300 my-0" />
                        <LeadsSection visible={true} />
                    </>
                )}
            </div>
        </AdaptiveLayout>
    );
}
