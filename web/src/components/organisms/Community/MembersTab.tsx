'use client';

import React, { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { useCommunityMembers } from '@/hooks/api/useCommunityMembers';
import { InfoCard } from '@/components/ui/InfoCard';
import { BrandAvatar } from '@/components/ui/BrandAvatar';
import { CardSkeleton } from '@/components/ui/LoadingSkeleton';
import { SearchInput } from '@/components/molecules/SearchInput';
import { Loader2, Users } from 'lucide-react';
import { routes } from '@/lib/constants/routes';

interface MembersTabProps {
    communityId: string;
}

export const MembersTab: React.FC<MembersTabProps> = ({ communityId }) => {
    const router = useRouter();
    const t = useTranslations('pages.communities');
    const tCommon = useTranslations('common');
    const tSearch = useTranslations('search');
    const { data: membersData, isLoading: membersLoading } = useCommunityMembers(communityId);
    const [searchQuery, setSearchQuery] = useState('');

    const members = useMemo(() => {
        return membersData?.data || [];
    }, [membersData]);

    // Filter members based on search query
    const filteredMembers = useMemo(() => {
        if (!searchQuery.trim()) {
            return members;
        }
        
        const query = searchQuery.toLowerCase();
        return members.filter((member) => {
            const displayName = (member.displayName || '').toLowerCase();
            const username = (member.username || '').toLowerCase();
            
            return displayName.includes(query) || username.includes(query);
        });
    }, [members, searchQuery]);

    if (membersLoading) {
        return (
            <div className="space-y-3 mt-4">
                <CardSkeleton />
                <CardSkeleton />
                <CardSkeleton />
            </div>
        );
    }

    if (!members || members.length === 0) {
        return (
            <div className="text-center py-12 text-base-content/60 mt-4">
                <Users className="w-12 h-12 mx-auto mb-3 text-base-content/40" />
                <p className="font-medium">
                    {t('members.empty')}
                </p>
            </div>
        );
    }

    return (
        <div className="space-y-3 mt-4">
            {members.length > 0 && (
                <div className="mb-4">
                    <SearchInput
                        placeholder={tSearch('results.searchMembersPlaceholder')}
                        value={searchQuery}
                        onSearch={setSearchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="w-full"
                    />
                </div>
            )}

            {filteredMembers.length > 0 ? (
                filteredMembers.map((member) => {
                    // Determine display role: superadmin from globalRole, otherwise community role
                    const displayRole = member.globalRole === 'superadmin' 
                        ? 'superadmin' 
                        : member.role;
                    
                    // Get translated role label if role exists
                    const roleBadge = displayRole 
                        ? tCommon(displayRole as 'superadmin' | 'lead' | 'participant' | 'viewer')
                        : undefined;
                    
                    return (
                        <InfoCard
                            key={member.id}
                            title={member.displayName || member.username || tCommon('unknownUser')}
                            subtitle={member.username ? `@${member.username}` : undefined}
                            icon={
                                <BrandAvatar
                                    src={member.avatarUrl}
                                    fallback={member.displayName || member.username || tCommon('user')}
                                    size="sm"
                                    className="bg-transparent"
                                />
                            }
                            badges={roleBadge ? [roleBadge] : undefined}
                            onClick={() => router.push(routes.userProfile(member.id))}
                        />
                    );
                })
            ) : searchQuery ? (
                <div className="text-center py-12 text-base-content/60">
                    <Users className="w-12 h-12 mx-auto mb-3 text-base-content/40" />
                    <p className="font-medium">
                        No members found matching your search
                    </p>
                    <p className="text-sm mt-1">
                        Try a different search term
                    </p>
                </div>
            ) : null}
        </div>
    );
};
