'use client';

import React, { useMemo } from 'react';
import { usePathname } from 'next/navigation';
import { AdaptiveLayout } from '@/components/templates/AdaptiveLayout';
import { useCommunitiesBatch, useCommunities } from '@/hooks/api/useCommunities';
import { useAuth } from '@/contexts/AuthContext';
import { useUserRoles } from '@/hooks/api/useProfile';
import { useWallets } from '@/hooks/api';
import { useCommunityQuotas } from '@/hooks/api/useCommunityQuota';
import { CommunityCard } from '@/components/organisms/CommunityCard';
import { PageHeader } from '@/components/ui/PageHeader';
import { CardSkeleton } from '@/components/ui/LoadingSkeleton';
import { InviteInput } from '@/components/molecules/InviteInput/InviteInput';
import Link from 'next/link';

export default function CommunitiesPage() {
    const pathname = usePathname();
    const { user, isLoading: userLoading } = useAuth();
    
    // Check if user is superadmin
    const isSuperadmin = user?.globalRole === 'superadmin';
    
    // Check if user has viewer role (CommunityCard handles badge display internally)
    const { data: userRoles } = useUserRoles(user?.id || '');
    const hasViewerRole = useMemo(() => {
        return userRoles?.some(role => role.role === 'viewer') ?? false;
    }, [userRoles]);
    
    // For superadmin: fetch all communities
    // For regular users: fetch only communities they're members of
    const { data: allCommunitiesData, isLoading: allCommunitiesLoading } = useCommunities();
    const communityIds = useMemo(() => {
        if (isSuperadmin) return []; // Not needed for superadmin
        if (!user?.communityMemberships) return [];
        return Array.from(new Set(
            user.communityMemberships
                .filter((id): id is string => !!id)
        ));
    }, [isSuperadmin, user?.communityMemberships]);
    
    // Batch fetch communities for regular users
    const { communities: memberCommunities, isLoading: memberCommunitiesLoading } = useCommunitiesBatch(communityIds);
    
    // Determine which communities to use
    const allCommunities = useMemo(() => {
        if (isSuperadmin) {
            return allCommunitiesData?.data || [];
        }
        return memberCommunities;
    }, [isSuperadmin, allCommunitiesData, memberCommunities]);
    
    // Group communities into special and non-special
    const { specialCommunities, userCommunities } = useMemo(() => {
        const special: typeof allCommunities = [];
        const userComms: typeof allCommunities = [];
        
        allCommunities.forEach(community => {
            const isSpecial = community.typeTag === 'marathon-of-good' || community.typeTag === 'future-vision';
            if (isSpecial) {
                special.push(community);
            } else {
                userComms.push(community);
            }
        });
        
        return {
            specialCommunities: special,
            userCommunities: userComms,
        };
    }, [allCommunities]);

    // Get all community IDs for fetching wallets and quotas
    const allCommunityIds = useMemo(() => {
        return Array.from(new Set([
            ...specialCommunities.map(c => c.id),
            ...userCommunities.map(c => c.id),
        ]));
    }, [specialCommunities, userCommunities]);

    // Fetch wallets and quotas
    const { data: wallets = [] } = useWallets();
    const { quotasMap } = useCommunityQuotas(allCommunityIds);

    // Create a map of communityId -> wallet for quick lookup
    const walletsMap = useMemo(() => {
        const map = new Map<string, typeof wallets[0]>();
        wallets.forEach((wallet: any) => {
            if (wallet?.communityId) {
                map.set(wallet.communityId, wallet);
            }
        });
        return map;
    }, [wallets]);

    // Combined loading state
    const isLoading = userLoading || (isSuperadmin ? allCommunitiesLoading : memberCommunitiesLoading);

    return (
        <AdaptiveLayout>
            <div className="flex flex-col min-h-screen bg-base-100 overflow-x-hidden max-w-full">
                <PageHeader
                    title="Communities"
                    showBack={false}
                />

                <div className="p-4 space-y-6 max-w-full overflow-x-hidden">
                    {/* Section 1: Special Communities */}
                    {specialCommunities.length > 0 && (
                        <>
                            <div>
                                <h2 className="text-lg font-semibold text-brand-text-primary mb-3">
                                    Special Communities
                                </h2>
                                <div className="space-y-3">
                                    {specialCommunities.map((community) => {
                                        const wallet = walletsMap.get(community.id);
                                        const quota = quotasMap.get(community.id);
                                        return (
                                            <CommunityCard
                                                key={community.id}
                                                communityId={community.id}
                                                pathname={pathname}
                                                isExpanded={true}
                                                wallet={wallet ? { balance: wallet.balance || 0, communityId: community.id } : undefined}
                                                quota={quota && typeof quota.remainingToday === 'number' ? { 
                                                    remainingToday: quota.remainingToday,
                                                    dailyQuota: quota.dailyQuota ?? 0
                                                } : undefined}
                                            />
                                        );
                                    })}
                                </div>
                            </div>
                            <div className="border-t border-base-300" />
                        </>
                    )}

                    {/* Viewer Notification: Show when user has no non-special communities */}
                    {userCommunities.length === 0 && (
                        <>
                            <div className="bg-info/10 border border-info/20 rounded-xl p-6">
                                <div className="space-y-4">
                                    <div>
                                        <h3 className="text-lg font-semibold text-brand-text-primary mb-2">
                                            Join a Team
                                        </h3>
                                        <p className="text-sm text-brand-text-secondary">
                                            To join a team, contact one of the{' '}
                                            <Link 
                                                href="/meriter/about#leads" 
                                                className="text-info hover:text-info/80 underline font-medium"
                                            >
                                                leads
                                            </Link>
                                            {' '}for an invite.
                                        </p>
                                    </div>
                                    <InviteInput />
                                </div>
                            </div>
                            <div className="border-t border-base-300" />
                        </>
                    )}

                    {/* Section 2: User's Communities (hidden for viewers) */}
                    {!hasViewerRole && userCommunities.length > 0 && (
                        <>
                            <div>
                                <h2 className="text-lg font-semibold text-brand-text-primary mb-3">
                                    Your Communities
                                </h2>
                                {isLoading ? (
                                    <div className="space-y-3">
                                        <CardSkeleton />
                                        <CardSkeleton />
                                        <CardSkeleton />
                                    </div>
                                ) : (
                                    <div className="space-y-3">
                                        {userCommunities.map((community) => {
                                            const wallet = walletsMap.get(community.id);
                                            const quota = quotasMap.get(community.id);
                                            return (
                                                <CommunityCard
                                                    key={community.id}
                                                    communityId={community.id}
                                                    pathname={pathname}
                                                    isExpanded={true}
                                                    wallet={wallet ? { balance: wallet.balance || 0, communityId: community.id } : undefined}
                                                    quota={quota && typeof quota.remainingToday === 'number' ? { 
                                                        remainingToday: quota.remainingToday,
                                                        dailyQuota: quota.dailyQuota ?? 0
                                                    } : undefined}
                                                />
                                            );
                                        })}
                                    </div>
                                )}
                            </div>
                            <div className="border-t border-base-300" />
                        </>
                    )}
                </div>
            </div>
        </AdaptiveLayout>
    );
}
