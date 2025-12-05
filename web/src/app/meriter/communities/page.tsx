'use client';

import React, { useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { Users, Info, Plus } from 'lucide-react';
import { AdaptiveLayout } from '@/components/templates/AdaptiveLayout';
import { useCommunitiesBatch, useCommunities } from '@/hooks/api/useCommunities';
import { useAuth } from '@/contexts/AuthContext';
import { AdvancedSearch, SearchParams } from '@/components/organisms/AdvancedSearch';
import { InfoCard } from '@/components/ui/InfoCard';
import { PageHeader } from '@/components/ui/PageHeader';
import { BrandAvatar } from '@/components/ui/BrandAvatar';
import { CardSkeleton } from '@/components/ui/LoadingSkeleton';
import { BrandButton } from '@/components/ui/BrandButton';
import { BottomActionSheet } from '@/components/ui/BottomActionSheet';
import { InviteInput } from '@/components/molecules/InviteInput/InviteInput';
import { useUserRoles, useLeadCommunities } from '@/hooks/api/useProfile';

export default function CommunitiesPage() {
    const router = useRouter();
    const t = useTranslations('communities');
    const tCommon = useTranslations('common');
    const { user, isLoading: userLoading } = useAuth();
    
    // Check if user is superadmin
    const isSuperadmin = user?.globalRole === 'superadmin';
    
    // Check user roles and lead communities for permission checking
    const { data: userRoles = [] } = useUserRoles(user?.id || '');
    const { data: leadCommunities = [] } = useLeadCommunities(user?.id || '');
    
    // Check if user is a lead
    const isLead = useMemo(() => {
        return userRoles.some(r => r.role === 'lead') || leadCommunities.length > 0;
    }, [userRoles, leadCommunities]);
    
    // Check if user can create communities
    const canCreateCommunity = isSuperadmin || isLead;
    
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
    const communities = useMemo(() => {
        if (isSuperadmin) {
            return allCommunitiesData?.data || [];
        }
        return memberCommunities;
    }, [isSuperadmin, allCommunitiesData, memberCommunities]);
    
    const [searchQuery, setSearchQuery] = useState('');
    const [showPopup, setShowPopup] = useState(false);

    // Combined loading state
    const isLoading = userLoading || (isSuperadmin ? allCommunitiesLoading : memberCommunitiesLoading);

    // Filter communities based on search query
    const filteredCommunities = useMemo(() => {
        if (!searchQuery.trim()) return communities;
        return communities.filter(community =>
            community.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
            community.description?.toLowerCase().includes(searchQuery.toLowerCase())
        );
    }, [communities, searchQuery]);

    const handleSearch = (params: SearchParams) => {
        // Navigate to global search with filters
        router.push('/meriter/search');
    };

    const handleCreateCommunity = () => {
        router.push('/meriter/communities/create');
        setShowPopup(false);
    };

    return (
        <AdaptiveLayout>
            <div className="flex flex-col min-h-screen bg-base-100">
                <PageHeader
                    title="Communities"
                    showBack={false}
                    rightAction={
                        <BrandButton
                            variant="ghost"
                            size="sm"
                            onClick={() => setShowPopup(true)}
                            aria-label="Add community"
                        >
                            <Plus size={20} />
                        </BrandButton>
                    }
                />

                <div className="p-4 space-y-4">
                    {/* Design-specified hint */}
                    <div className="bg-info/10 border border-info/20 rounded-lg p-3 flex items-start gap-3">
                        <Info className="w-5 h-5 text-info flex-shrink-0 mt-0.5" />
                        <p className="text-sm text-base-content/80">
                            Хотите создать команду → пишите оргу, хотите вступить в команду → пишите её лидеру
                        </p>
                    </div>

                    <AdvancedSearch
                        onSearch={handleSearch}
                        initialQuery={searchQuery}
                    />

                    {isLoading ? (
                        <div className="space-y-3">
                            <CardSkeleton />
                            <CardSkeleton />
                            <CardSkeleton />
                        </div>
                    ) : filteredCommunities.length > 0 ? (
                        <div className="space-y-3">
                            {filteredCommunities.map((community) => (
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
                    ) : (
                        <div className="text-center py-12 text-base-content/60">
                            <Users className="w-12 h-12 mx-auto mb-3 text-base-content/40" />
                            <p className="font-medium">No communities found</p>
                            {searchQuery && <p className="text-sm mt-1">Try adjusting your search</p>}
                            {!searchQuery && !isSuperadmin && communityIds.length === 0 && (
                                <p className="text-sm mt-1">You are not a member of any communities yet</p>
                            )}
                            {!searchQuery && isSuperadmin && communities.length === 0 && (
                                <p className="text-sm mt-1">No communities found in the system</p>
                            )}
                        </div>
                    )}
                </div>
            </div>

            {/* Add Community Popup */}
            <BottomActionSheet
                isOpen={showPopup}
                onClose={() => setShowPopup(false)}
                title={tCommon('add') || 'Add Community'}
            >
                <div className="space-y-6">
                    {/* Create Community Section */}
                    <div className="space-y-3">
                        <h3 className="text-base font-semibold text-brand-text-primary">
                            {tCommon('createCommunity') || 'Create Community'}
                        </h3>
                        
                        {canCreateCommunity ? (
                            <BrandButton
                                variant="primary"
                                size="lg"
                                onClick={handleCreateCommunity}
                                fullWidth
                            >
                                {tCommon('createCommunity') || 'Create Community'}
                            </BrandButton>
                        ) : (
                            <div className="bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300 p-4 rounded-lg text-sm border border-blue-200 dark:border-blue-800/50">
                                {t('toAddPublication')}{" "}
                                <span className="font-medium">
                                    {t('writeToLeaderInTeamChat')}
                                </span>
                            </div>
                        )}
                    </div>

                    {/* Divider */}
                    <div className="border-t border-brand-secondary/10" />

                    {/* Join by Invite Section */}
                    <div className="space-y-3">
                        <h3 className="text-base font-semibold text-brand-text-primary">
                            {t('joinByInvite') || 'Or join by invite'}
                        </h3>
                        <InviteInput />
                    </div>
                </div>
            </BottomActionSheet>
        </AdaptiveLayout>
    );
}
