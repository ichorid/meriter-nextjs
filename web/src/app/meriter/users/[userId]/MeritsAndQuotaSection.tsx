'use client';

import React, { useMemo } from 'react';
import { useCanViewUserMerits } from '@/hooks/useCanViewUserMerits';
import { UserCommunityMerits } from './UserCommunityMerits';
import { useTranslations } from 'next-intl';
import { ChevronDown, ChevronUp } from 'lucide-react';

interface MeritsAndQuotaSectionProps {
    userId: string;
    communityIds: string[];
    userRoles: Array<{ id: string; communityId: string; communityName?: string; role: string }>;
    expanded: boolean;
    onToggleExpanded: () => void;
}

export function MeritsAndQuotaSection({ userId, communityIds, userRoles, expanded, onToggleExpanded }: MeritsAndQuotaSectionProps) {
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
        <div className="bg-base-100 py-4 space-y-3">
            <button
                onClick={onToggleExpanded}
                className="flex items-center justify-between w-full hover:opacity-80 transition-opacity"
            >
                <p className="text-xs font-medium text-base-content/40 uppercase tracking-wide">
                    {tCommon('meritsAndQuota') || 'Merits & Quota'}
                </p>
                {expanded ? (
                    <ChevronUp className="w-4 h-4 text-base-content/40" />
                ) : (
                    <ChevronDown className="w-4 h-4 text-base-content/40" />
                )}
            </button>
            {expanded && (
                <div className="animate-in fade-in duration-200 space-y-3">
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
            )}
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

