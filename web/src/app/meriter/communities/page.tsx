'use client';

import React, { useMemo } from 'react';
import { usePathname } from 'next/navigation';
import { AdaptiveLayout } from '@/components/templates/AdaptiveLayout';
import { SimpleStickyHeader } from '@/components/organisms/ContextTopBar/ContextTopBar';
import { useAuth } from '@/contexts/AuthContext';
import { useUserCommunities } from '@/hooks/useUserCommunities';
import { CommunityCard } from '@/components/organisms/CommunityCard';
import { CardSkeleton } from '@/components/ui/LoadingSkeleton';
import { InviteInput } from '@/components/molecules/InviteInput/InviteInput';
import Link from 'next/link';

export default function CommunitiesPage() {
    const pathname = usePathname();
    const { user, isLoading: userLoading } = useAuth();

    // Get user's communities with wallets and quotas (handles both regular users and superadmin)
    const { communities: allCommunities, walletsMap, quotasMap, isLoading: communitiesLoading } = useUserCommunities();

    // Group communities into special and non-special
    const { specialCommunities, userCommunities } = useMemo(() => {
        const special: typeof allCommunities = [];
        const userComms: typeof allCommunities = [];

        allCommunities.forEach(community => {
            const isSpecial = community.typeTag === 'marathon-of-good' || community.typeTag === 'future-vision' || community.typeTag === 'support';
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

    // Combined loading state
    const isLoading = userLoading || communitiesLoading;

    return (
        <AdaptiveLayout
            stickyHeader={<SimpleStickyHeader title="Communities" showBack={false} asStickyHeader={true} />}
        >
            {/* Content */}
            <div>
                {/* Section 1: Special Communities */}
                {specialCommunities.length > 0 && (
                    <section className="mb-10">
                        <h2 className="text-sm font-medium text-base-content/60 uppercase tracking-wide mb-4">
                            Special Communities
                        </h2>
                        <div className="flex flex-col gap-4" style={{ gap: '1rem' }}>
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
                    </section>
                )}

                {/* Viewer Notification: Show when user has no non-special communities */}
                {userCommunities.length === 0 && (
                    <section className="bg-base-200/50 border border-base-content/5 rounded-2xl p-6 mb-10">
                        <div className="flex flex-col gap-4">
                            <div>
                                <h3 className="text-lg font-semibold text-base-content mb-2">
                                    Join a Team
                                </h3>
                                <p className="text-sm text-base-content/60">
                                    To join a team, contact one of the{' '}
                                    <Link
                                        href="/meriter/about#leads"
                                        className="text-base-content/80 hover:text-base-content underline font-medium"
                                    >
                                        leads
                                    </Link>
                                    {' '}for an invite.
                                </p>
                            </div>
                            <InviteInput />
                        </div>
                    </section>
                )}

                {/* Section 2: User's Communities */}
                {userCommunities.length > 0 && (
                    <section>
                        <h2 className="text-sm font-medium text-base-content/60 uppercase tracking-wide mb-4">
                            Your Communities
                        </h2>
                        {isLoading ? (
                            <div className="flex flex-col gap-4" style={{ gap: '1rem' }}>
                                <CardSkeleton />
                                <CardSkeleton />
                                <CardSkeleton />
                            </div>
                        ) : (
                            <div className="flex flex-col gap-4" style={{ gap: '1rem' }}>
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
                    </section>
                )}
            </div>
        </AdaptiveLayout>
    );
}
