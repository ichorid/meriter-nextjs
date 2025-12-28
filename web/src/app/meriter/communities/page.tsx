'use client';

import React, { useMemo, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { ChevronDown, ChevronUp, Users } from 'lucide-react';
import { AdaptiveLayout } from '@/components/templates/AdaptiveLayout';
import { SimpleStickyHeader } from '@/components/organisms/ContextTopBar/ContextTopBar';
import { useAuth } from '@/contexts/AuthContext';
import { useUserCommunities } from '@/hooks/useUserCommunities';
import { CommunityCard } from '@/components/organisms/CommunityCard';
import { CardSkeleton } from '@/components/ui/LoadingSkeleton';
import { JoinTeam } from '@/components/organisms/Profile/JoinTeam';
import { useAllLeads } from '@/hooks/api/useUsers';
import { SearchInput } from '@/components/molecules/SearchInput';
import { LeadCard } from '@/components/molecules/LeadCard/LeadCard';
import { routes } from '@/lib/constants/routes';
import type { EnrichedLead } from '@/types/lead';
import { useTranslations } from 'next-intl';

export default function CommunitiesPage() {
    const pathname = usePathname();
    const router = useRouter();
    const { user, isLoading: userLoading } = useAuth();
    const t = useTranslations('common');
    const tSearch = useTranslations('search');
    const tAbout = useTranslations('about');
    
    const [leadsExpanded, setLeadsExpanded] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');

    // Get user's communities with wallets and quotas (handles both regular users and superadmin)
    const { communities: allCommunities, walletsMap, quotasMap, isLoading: communitiesLoading } = useUserCommunities();

    // Fetch leads only when the leads section is expanded
    const { data: leadsData, isLoading: leadsLoading } = useAllLeads(
        { pageSize: 100 },
        { enabled: leadsExpanded }
    );
    const leads = (leadsData?.data || []) as EnrichedLead[];

    // Filter leads based on search query
    const filteredLeads = useMemo(() => {
        if (!searchQuery.trim()) {
            return leads;
        }

        const query = searchQuery.toLowerCase();
        return leads.filter((lead) => {
            const displayName = (lead.displayName || '').toLowerCase();
            const username = (lead.username || '').toLowerCase();
            const bio = (lead.profile?.bio || '').toLowerCase();

            return displayName.includes(query) ||
                username.includes(query) ||
                bio.includes(query);
        });
    }, [leads, searchQuery]);

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
            stickyHeader={<SimpleStickyHeader title="Communities" showBack={false} asStickyHeader={true} showScrollToTop={true} />}
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
                    <div className="mb-10">
                        <JoinTeam showLocalGroupsNote={true} />
                    </div>
                )}

                {/* Section 2: User's Communities */}
                {userCommunities.length > 0 && (
                    <section className="mb-10">
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


                {/* Section 4: Leads (Collapsible) */}
                <section className="pt-6 border-t border-base-300">
                    <button
                        onClick={() => setLeadsExpanded(!leadsExpanded)}
                        className="flex items-center justify-between w-full mb-4 hover:opacity-80 transition-opacity"
                    >
                        <h2 className="text-sm font-medium text-base-content/60 uppercase tracking-wide">
                            Leads
                        </h2>
                        {leadsExpanded ? (
                            <ChevronUp className="w-5 h-5 text-base-content/60" />
                        ) : (
                            <ChevronDown className="w-5 h-5 text-base-content/60" />
                        )}
                    </button>

                    {leadsExpanded && (
                        <div className="space-y-4">
                            {leads.length > 0 && (
                                <div>
                                    <SearchInput
                                        placeholder={tSearch('results.searchLeadsPlaceholder')}
                                        value={searchQuery}
                                        onSearch={setSearchQuery}
                                        onChange={(e) => setSearchQuery(e.target.value)}
                                        className="w-full"
                                    />
                                </div>
                            )}

                            {leadsLoading ? (
                                <div className="space-y-3">
                                    <CardSkeleton />
                                    <CardSkeleton />
                                    <CardSkeleton />
                                </div>
                            ) : filteredLeads.length > 0 ? (
                                <div className="bg-base-100 rounded-lg border border-base-300 overflow-hidden">
                                    {filteredLeads.map((lead) => (
                                        <LeadCard
                                            key={lead.id}
                                            id={lead.id}
                                            displayName={lead.displayName || lead.username || t('unknownUser')}
                                            username={lead.username}
                                            avatarUrl={lead.avatarUrl}
                                            totalMerits={lead.totalMerits}
                                            leadCommunities={lead.leadCommunities}
                                            showRoleChip={false}
                                            onClick={() => router.push(routes.userProfile(lead.id))}
                                        />
                                    ))}
                                </div>
                            ) : (
                                <div className="text-center py-12 text-base-content/60">
                                    <Users className="w-12 h-12 mx-auto mb-3 text-base-content/40" />
                                    <p className="font-medium">
                                        {searchQuery ? tAbout('noLeadsMatchingSearch') : tAbout('noLeadsFound')}
                                    </p>
                                    <p className="text-sm mt-1">
                                        {searchQuery ? tAbout('tryDifferentSearchTerm') : tAbout('noLeadsAvailable')}
                                    </p>
                                </div>
                            )}
                        </div>
                    )}
                </section>
            </div>
        </AdaptiveLayout>
    );
}
