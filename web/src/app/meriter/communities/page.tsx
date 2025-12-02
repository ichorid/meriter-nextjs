'use client';

import React, { useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { Users, Info } from 'lucide-react';
import { AdaptiveLayout } from '@/components/templates/AdaptiveLayout';
import { useCommunitiesBatch } from '@/hooks/api/useCommunities';
import { useAuth } from '@/contexts/AuthContext';
import { AdvancedSearch, SearchParams } from '@/components/organisms/AdvancedSearch';
import { InfoCard } from '@/components/ui/InfoCard';
import { PageHeader } from '@/components/ui/PageHeader';
import { BrandAvatar } from '@/components/ui/BrandAvatar';
import { CardSkeleton } from '@/components/ui/LoadingSkeleton';

export default function CommunitiesPage() {
    const router = useRouter();
    const t = useTranslations('communities');
    const { user, isLoading: userLoading } = useAuth();
    
    // Extract unique community IDs from user's community memberships
    const communityIds = useMemo(() => {
        if (!user?.communityMemberships) return [];
        return Array.from(new Set(
            user.communityMemberships
                .filter((id): id is string => !!id)
        ));
    }, [user?.communityMemberships]);
    
    // Batch fetch communities
    const { communities, isLoading: communitiesLoading } = useCommunitiesBatch(communityIds);
    
    const [searchQuery, setSearchQuery] = useState('');

    // Combined loading state
    const isLoading = userLoading || communitiesLoading;

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

    return (
        <AdaptiveLayout>
            <div className="flex flex-col min-h-screen bg-base-100">
                <PageHeader
                    title="Communities"
                    showBack={false}
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
                            {!searchQuery && communityIds.length === 0 && (
                                <p className="text-sm mt-1">You are not a member of any communities yet</p>
                            )}
                        </div>
                    )}
                </div>
            </div>
        </AdaptiveLayout>
    );
}
