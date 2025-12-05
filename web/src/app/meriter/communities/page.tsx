'use client';

import React, { useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { Users } from 'lucide-react';
import { AdaptiveLayout } from '@/components/templates/AdaptiveLayout';
import { useCommunitiesBatch, useCommunities } from '@/hooks/api/useCommunities';
import { useAllLeads } from '@/hooks/api/useUsers';
import { useAuth } from '@/contexts/AuthContext';
import { useUserRoles } from '@/hooks/api/useProfile';
import { AdvancedSearch, SearchParams } from '@/components/organisms/AdvancedSearch';
import { InfoCard } from '@/components/ui/InfoCard';
import { PageHeader } from '@/components/ui/PageHeader';
import { BrandAvatar } from '@/components/ui/BrandAvatar';
import { CardSkeleton } from '@/components/ui/LoadingSkeleton';
import { routes } from '@/lib/constants/routes';

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
    
    // Fetch leads
    const { data: leadsData, isLoading: leadsLoading } = useAllLeads({ pageSize: 100 });
    const leads = leadsData?.data || [];
    
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
    
    // Search state for leads
    const [searchQuery, setSearchQuery] = useState('');
    
    // Filter leads based on search query
    const filteredLeads = useMemo(() => {
        if (!searchQuery.trim()) return leads;
        const query = searchQuery.toLowerCase();
        return leads.filter(lead =>
            lead.displayName?.toLowerCase().includes(query) ||
            lead.username?.toLowerCase().includes(query) ||
            lead.profile?.bio?.toLowerCase().includes(query)
        );
    }, [leads, searchQuery]);
    
    // Combined loading state
    const isLoading = userLoading || (isSuperadmin ? allCommunitiesLoading : memberCommunitiesLoading);
    
    const handleSearch = (params: SearchParams) => {
        setSearchQuery(params.query || '');
    };

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
                                    {specialCommunities.map((community) => (
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
                                            onClick={() => router.push(`/meriter/communities/${community.id}`)}
                                        />
                                    ))}
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
                                        {userCommunities.map((community) => (
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
                                                onClick={() => router.push(`/meriter/communities/${community.id}`)}
                                            />
                                        ))}
                                    </div>
                                )}
                            </div>
                            <div className="border-t border-base-300" />
                        </>
                    )}

                    {/* Section 3: Leads */}
                    <div>
                        <div className="flex items-center justify-between mb-3">
                            <h2 className="text-lg font-semibold text-brand-text-primary">
                                Leads
                            </h2>
                        </div>
                        
                        {/* Search component - only for leads section */}
                        <div className="mb-4">
                            <AdvancedSearch
                                onSearch={handleSearch}
                                initialQuery={searchQuery}
                            />
                        </div>

                        {leadsLoading ? (
                            <div className="space-y-3">
                                <CardSkeleton />
                                <CardSkeleton />
                                <CardSkeleton />
                            </div>
                        ) : filteredLeads.length > 0 ? (
                            <div className="space-y-3">
                                {filteredLeads.map((lead) => (
                                    <InfoCard
                                        key={lead.id}
                                        title={lead.displayName || lead.username || 'Unknown User'}
                                        subtitle={lead.profile?.bio || lead.username ? `@${lead.username}` : undefined}
                                        icon={
                                            <BrandAvatar
                                                src={lead.avatarUrl}
                                                fallback={lead.displayName || lead.username || 'User'}
                                                size="sm"
                                                className="bg-transparent"
                                            />
                                        }
                                        onClick={() => router.push(routes.userProfile(lead.id))}
                                    />
                                ))}
                            </div>
                        ) : (
                            <div className="text-center py-12 text-base-content/60">
                                <Users className="w-12 h-12 mx-auto mb-3 text-base-content/40" />
                                <p className="font-medium">No leads found</p>
                                {searchQuery && <p className="text-sm mt-1">Try adjusting your search</p>}
                                {!searchQuery && <p className="text-sm mt-1">No leads available</p>}
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </AdaptiveLayout>
    );
}
