'use client';

import React, { useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { AdaptiveLayout } from '@/components/templates/AdaptiveLayout';
import { useCommunitiesBatch, useCommunities } from '@/hooks/api/useCommunities';
import { useAuth } from '@/contexts/AuthContext';
import { useUserRoles } from '@/hooks/api/useProfile';
import { useWallets } from '@/hooks/api';
import { useCommunityQuotas } from '@/hooks/api/useCommunityQuota';
import { InfoCard } from '@/components/ui/InfoCard';
import { PageHeader } from '@/components/ui/PageHeader';
import { BrandAvatar } from '@/components/ui/BrandAvatar';
import { CardSkeleton } from '@/components/ui/LoadingSkeleton';
import { InviteInput } from '@/components/molecules/InviteInput/InviteInput';
import Link from 'next/link';

export default function CommunitiesPage() {
    const router = useRouter();
    const t = useTranslations('communities');
    const { user, isLoading: userLoading } = useAuth();
    
    // Check if user is superadmin
    const isSuperadmin = user?.globalRole === 'superadmin';
    
    // Check if user has viewer role
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
    const { data: wallets = [], isLoading: walletsLoading } = useWallets();
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

    // Helper function to determine user role per community for badge display
    const getUserRoleBadge = (communityId: string): string | null => {
        // Check global superadmin role first
        if (user?.globalRole === 'superadmin') {
            return 'Superadmin';
        }
        
        // Find role in userRoles array matching the communityId
        const role = userRoles?.find(r => r.communityId === communityId);
        
        // Only show badge for lead, participant, and superadmin (not viewer)
        if (role?.role === 'lead') {
            return 'Lead';
        }
        if (role?.role === 'participant') {
            return 'Participant';
        }
        
        return null;
    };

    // Helper function to render merits/quota indicator
    const renderMeritsQuota = (community: typeof allCommunities[0]) => {
        const wallet = walletsMap.get(community.id);
        const quota = quotasMap.get(community.id);
        const balance = wallet?.balance || 0;
        const remainingQuota = quota?.remainingToday || 0;
        const currencyIconUrl = community.settings?.iconUrl;

        // Always show the indicator, even if both are 0 (for consistency)
        return (
            <div className="text-xs truncate flex items-center gap-1 text-brand-text-secondary">
                {currencyIconUrl && (
                    <img src={currencyIconUrl} alt="Currency" className="w-3 h-3 inline-block" />
                )}
                <span>{balance}+{remainingQuota}</span>
            </div>
        );
    };
    
    // Combined loading state
    const isLoading = userLoading || (isSuperadmin ? allCommunitiesLoading : memberCommunitiesLoading);

    return (
        <AdaptiveLayout>
            <div className="flex flex-col min-h-screen bg-base-100">
                <PageHeader
                    title="Communities"
                    showBack={false}
                />

                <div className="p-4 space-y-6">
                    {/* Section 1: Special Communities */}
                    {specialCommunities.length > 0 && (
                        <>
                            <div>
                                <h2 className="text-lg font-semibold text-brand-text-primary mb-3">
                                    Special Communities
                                </h2>
                                <div className="space-y-3">
                                    {specialCommunities.map((community) => {
                                        const badgeText = getUserRoleBadge(community.id);
                                        return (
                                            <InfoCard
                                                key={community.id}
                                                title={community.name}
                                                subtitle={community.description}
                                                icon={
                                                    <BrandAvatar
                                                        src={community.avatarUrl}
                                                        fallback={community.name}
                                                        size="sm"
                                                        className="bg-transparent"
                                                    />
                                                }
                                                rightElement={renderMeritsQuota(community)}
                                                badges={badgeText ? [badgeText] : undefined}
                                                onClick={() => router.push(`/meriter/communities/${community.id}`)}
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
                                            const badgeText = getUserRoleBadge(community.id);
                                            return (
                                                <InfoCard
                                                    key={community.id}
                                                    title={community.name}
                                                    subtitle={community.description}
                                                    icon={
                                                        <BrandAvatar
                                                            src={community.avatarUrl}
                                                            fallback={community.name}
                                                            size="sm"
                                                            className="bg-transparent"
                                                        />
                                                    }
                                                    rightElement={renderMeritsQuota(community)}
                                                    badges={badgeText ? [badgeText] : undefined}
                                                    onClick={() => router.push(`/meriter/communities/${community.id}`)}
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
