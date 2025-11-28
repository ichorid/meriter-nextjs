'use client';

import React, { useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { Users } from 'lucide-react';
import { AdaptiveLayout } from '@/components/templates/AdaptiveLayout';
import { useInfiniteCommunities } from '@/hooks/api/useCommunities';
import { AdvancedSearch, SearchParams } from '@/components/organisms/AdvancedSearch';
import { InfoCard } from '@/components/ui/InfoCard';
import { PageHeader } from '@/components/ui/PageHeader';
import { BrandAvatar } from '@/components/ui/BrandAvatar';
import { CardSkeleton } from '@/components/ui/LoadingSkeleton';
import { useInfiniteScroll } from '@/hooks/useInfiniteScroll';
import { useMediaQuery } from '@/hooks/useMediaQuery';
import { Loader2 } from 'lucide-react';

export default function CommunitiesPage() {
    const router = useRouter();
    const t = useTranslations('communities');
    const isMobile = useMediaQuery('(max-width: 640px)');
    const pageSize = isMobile ? 10 : 20; // Меньше данных на mobile
    
    const {
        data: communitiesData,
        isLoading,
        fetchNextPage,
        hasNextPage,
        isFetchingNextPage,
    } = useInfiniteCommunities(pageSize);
    
    const [searchQuery, setSearchQuery] = useState('');

    // Flatten communities from all pages
    const allCommunities = useMemo(() => {
        return (communitiesData?.pages ?? [])
            .flatMap((page) => page.data || []);
    }, [communitiesData?.pages]);

    const filteredCommunities = useMemo(() => {
        if (!searchQuery.trim()) return allCommunities;
        return allCommunities.filter(community =>
            community.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
            community.description?.toLowerCase().includes(searchQuery.toLowerCase())
        );
    }, [allCommunities, searchQuery]);

    // Infinite scroll trigger
    const observerTarget = useInfiniteScroll({
        hasNextPage: hasNextPage ?? false,
        fetchNextPage,
        isFetchingNextPage,
        threshold: 200,
    });

    const handleSearch = (params: SearchParams) => {
        // Navigate to global search with filters
        router.push('/meriter/search');
    };

    return (
        <AdaptiveLayout>
            <div className="flex flex-col min-h-screen bg-white">
                <PageHeader
                    title="Communities"
                    showBack={false}
                />

                <div className="p-4 space-y-4">
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
                            
                            {/* Infinite scroll trigger */}
                            <div ref={observerTarget} className="h-4" />
                            
                            {/* Loading indicator */}
                            {isFetchingNextPage && (
                                <div className="flex justify-center py-4">
                                    <Loader2 className="w-6 h-6 animate-spin text-brand-primary" />
                                </div>
                            )}
                        </div>
                    ) : (
                        <div className="text-center py-12 text-gray-500">
                            <Users className="w-12 h-12 mx-auto mb-3 text-gray-300" />
                            <p className="font-medium">No communities found</p>
                            {searchQuery && <p className="text-sm mt-1">Try adjusting your search</p>}
                        </div>
                    )}
                </div>
            </div>
        </AdaptiveLayout>
    );
}
