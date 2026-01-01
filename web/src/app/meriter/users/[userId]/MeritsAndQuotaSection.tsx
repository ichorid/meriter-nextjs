'use client';

import React, { useMemo } from 'react';
import { useCanViewUserMerits } from '@/hooks/useCanViewUserMerits';
import { UserCommunityMerits } from './UserCommunityMerits';
import { useTranslations } from 'next-intl';

interface MeritsAndQuotaSectionProps {
    userId: string;
    communityIds: string[];
    userRoles: Array<{ id: string; communityId: string; communityName?: string; role: string }>;
}

export function MeritsAndQuotaSection({ userId, communityIds, userRoles }: MeritsAndQuotaSectionProps) {
    const tCommon = useTranslations('common');
    
    // Create a map of communityId to communityName
    const communityNameMap = useMemo(() => {
        const map: Record<string, string> = {};
        userRoles.forEach(role => {
            if (role.communityName) {
                map[role.communityId] = role.communityName;
            }
        });
        return map;
    }, [userRoles]);

    // Filter communities where viewer has permission
    const communitiesWithPermission = useMemo(() => {
        return communityIds.filter(communityId => {
            // Check permission for this community - we'll do it in the component
            return true; // Will be checked per component
        });
    }, [communityIds]);

    // Only show section if there are communities
    if (communitiesWithPermission.length === 0) {
        return null;
    }

    return (
        <div className="bg-brand-surface shadow-none rounded-xl p-6">
            <h2 className="text-lg font-bold text-brand-text-primary mb-4">
                {tCommon('meritsAndQuota') || 'Merits & Quota'}
            </h2>
            <div className="space-y-3">
                {communitiesWithPermission.map((communityId) => {
                    const communityName = communityNameMap[communityId];
                    return (
                        <CommunityMeritsWrapper
                            key={communityId}
                            userId={userId}
                            communityId={communityId}
                            communityName={communityName}
                        />
                    );
                })}
            </div>
        </div>
    );
}

function CommunityMeritsWrapper({ userId, communityId, communityName }: { userId: string; communityId: string; communityName?: string }) {
    const { canView } = useCanViewUserMerits(communityId);
    
    if (!canView) {
        return null;
    }

    return (
        <UserCommunityMerits
            userId={userId}
            communityId={communityId}
            communityName={communityName}
            canView={canView}
        />
    );
}

