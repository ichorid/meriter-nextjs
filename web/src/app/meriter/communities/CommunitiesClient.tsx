'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { ChevronDown, ChevronUp, Users } from 'lucide-react';
import { AdaptiveLayout } from '@/components/templates/AdaptiveLayout';
import { useAuth } from '@/contexts/AuthContext';
import { useUserCommunities } from '@/hooks/useUserCommunities';
import { CommunityCard } from '@/components/organisms/CommunityCard';
import { CardSkeleton } from '@/components/ui/LoadingSkeleton';
import { useAllLeads } from '@/hooks/api/useUsers';
import { SearchInput } from '@/components/molecules/SearchInput';
import { LeadCard } from '@/components/molecules/LeadCard/LeadCard';
import { routes } from '@/lib/constants/routes';
import type { EnrichedLead } from '@/types/lead';
import { useTranslations } from 'next-intl';
import { useLocalStorage } from '@/hooks/useLocalStorage';
import { Separator } from '@/components/ui/shadcn/separator';
import { DismissibleHint } from '@/components/molecules/DismissibleHint/DismissibleHint';

export default function CommunitiesPage() {
    const pathname = usePathname();
    const router = useRouter();
    const searchParams = useSearchParams();
    const { user, isLoading: userLoading } = useAuth();
    const t = useTranslations('common');
    const tSearch = useTranslations('search');
    const tAbout = useTranslations('about');
    const tCommunities = useTranslations('communities');

    const [leadsExpanded, setLeadsExpanded] = useLocalStorage<boolean>('communities.leadsExpanded', true);
    const [searchQuery, setSearchQuery] = useState('');
    const [joinTeamExpanded, setJoinTeamExpanded] = useLocalStorage<boolean>('communities.joinTeamExpanded', true);

    // Handle scroll to leads section from URL param
    useEffect(() => {
        const scrollToLeads = searchParams?.get('scrollToLeads');
        if (scrollToLeads === 'true') {
            setLeadsExpanded(true);
            setTimeout(() => {
                const leadsSection = document.getElementById('leads-section');
                if (leadsSection) {
                    leadsSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
                    // Remove query param after scrolling
                    const params = new URLSearchParams(searchParams?.toString() || '');
                    params.delete('scrollToLeads');
                    const newUrl = params.toString() ? `${pathname}?${params.toString()}` : pathname;
                    router.replace(newUrl);
                }
            }, 300);
        }
    }, [searchParams, pathname, router]);

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
            
            // Search in team names (leadCommunities array)
            const teamNames = (lead.leadCommunities || []).map(team => team.toLowerCase());
            const matchesTeamName = teamNames.some(teamName => teamName.includes(query));

            return displayName.includes(query) ||
                username.includes(query) ||
                bio.includes(query) ||
                matchesTeamName;
        });
    }, [leads, searchQuery]);

    // Group communities into special and non-special
    const { specialCommunities, userCommunities } = useMemo(() => {
        const special: typeof allCommunities = [];
        const userComms: typeof allCommunities = [];

        allCommunities.forEach(community => {
            const isSpecial = community.typeTag === 'marathon-of-good' || community.typeTag === 'future-vision' || community.typeTag === 'team-projects' || community.typeTag === 'support';
            if (isSpecial) {
                special.push(community);
            } else {
                userComms.push(community);
            }
        });

        // Sort special communities: marathon-of-good, future-vision, team-projects, support
        special.sort((a, b) => {
            const order: Record<string, number> = {
                'marathon-of-good': 1,
                'future-vision': 2,
                'team-projects': 3,
                'support': 4,
            };
            return (order[a.typeTag || ''] || 999) - (order[b.typeTag || ''] || 999);
        });

        return {
            specialCommunities: special,
            userCommunities: userComms,
        };
    }, [allCommunities]);

    // Combined loading state
    const isLoading = userLoading || communitiesLoading;

    return (
        <AdaptiveLayout>
            {/* Content */}
            <div className="space-y-0">
                {/* Section 1: Special Communities */}
                {specialCommunities.length > 0 && (
                    <div className="bg-base-100 py-4 space-y-3">
                        <p className="text-xs font-medium text-base-content/40 uppercase tracking-wide">
                            {tCommunities('publicCommunities')}
                        </p>
                        <div className="flex flex-col gap-1">
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
                )}

                {/* Viewer Notification: Show when user has no non-special communities */}
                {userCommunities.length === 0 && (
                    <section className="bg-base-100/50 backdrop-blur-sm shadow-none rounded-xl p-6 mb-10">
                        <button
                            onClick={() => setJoinTeamExpanded(!joinTeamExpanded)}
                            className="flex items-center justify-between w-full mb-4 hover:opacity-80 transition-opacity"
                        >
                            <h3 className="text-lg font-semibold text-base-content">
                                {tCommunities('joinTeam.title')}
                            </h3>
                            {joinTeamExpanded ? (
                                <ChevronUp className="w-5 h-5 text-base-content/60" />
                            ) : (
                                <ChevronDown className="w-5 h-5 text-base-content/60" />
                            )}
                        </button>
                        {joinTeamExpanded && (
                            <div className="flex flex-col gap-4">
                                <div className="flex flex-col items-center w-full py-5 gap-3">
                                    <div className="flex flex-row justify-center items-center w-full">
                                        <p className="text-[15px] leading-[130%] text-center tracking-[0.374px] text-base-content/60">
                                            {tCommunities('localGroups.noTeamNote')}
                                        </p>
                                    </div>
                                </div>
                            </div>
                        )}
                    </section>
                )}

                {/* Section 2: User's Communities */}
                {userCommunities.length > 0 && (
                    <>
                        {specialCommunities.length > 0 && <Separator className="bg-base-300 my-0" />}
                        <div className="bg-base-100 py-4 space-y-3">
                            <p className="text-xs font-medium text-base-content/40 uppercase tracking-wide">
                                {tCommunities('privateCommunities')}
                            </p>
                            {isLoading ? (
                                <div className="flex flex-col gap-1">
                                    <CardSkeleton />
                                    <CardSkeleton />
                                    <CardSkeleton />
                                </div>
                            ) : (
                                <div className="flex flex-col gap-1">
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
                    </>
                )}


                {/* Section 4: Leads (Collapsible) */}
                <div id="leads-section">
                    {(specialCommunities.length > 0 || userCommunities.length > 0) && <Separator className="bg-base-300 my-0" />}
                    <div className="bg-base-100 py-4 space-y-3">
                        <button
                            onClick={() => setLeadsExpanded(!leadsExpanded)}
                            className="flex items-center justify-between w-full hover:opacity-80 transition-opacity"
                        >
                            <p className="text-xs font-medium text-base-content/40 uppercase tracking-wide">
                                {tCommunities('leads')}
                            </p>
                            {leadsExpanded ? (
                                <ChevronUp className="w-4 h-4 text-base-content/40" />
                            ) : (
                                <ChevronDown className="w-4 h-4 text-base-content/40" />
                            )}
                        </button>

                        {leadsExpanded && (
                            <div className="animate-in fade-in duration-200 space-y-4">
                                {/* Helper text */}
                                <DismissibleHint storageKey="communities.leadsHelper">
                                    {tCommunities('leadsHelper')}
                                </DismissibleHint>

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
                                    <div className="bg-base-100 rounded-lg shadow-none overflow-hidden">
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
                    </div>
                </div>
            </div>
        </AdaptiveLayout>
    );
}
