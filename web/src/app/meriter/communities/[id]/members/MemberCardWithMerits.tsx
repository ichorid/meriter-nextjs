'use client';

import React from 'react';
import { LeadCard } from '@/components/molecules/LeadCard/LeadCard';
import { useOtherUserQuota } from '@/hooks/api/useQuota';
import { useOtherUserWallet } from '@/hooks/api/useWallet';

interface MemberCardWithMeritsProps {
    memberId: string;
    displayName: string;
    username?: string;
    avatarUrl?: string | null;
    role?: 'lead' | 'participant' | 'viewer' | 'superadmin';
    communityId: string;
    showRoleChip: boolean;
    hideTeamInfo: boolean;
    canViewMerits: boolean;
    onClick: () => void;
    onRemove?: () => void;
    showRemove?: boolean;
    hideChevron?: boolean;
}

export function MemberCardWithMerits({
    memberId,
    displayName,
    username,
    avatarUrl,
    role,
    communityId,
    showRoleChip,
    hideTeamInfo,
    canViewMerits,
    onClick,
    hideChevron = false,
}: MemberCardWithMeritsProps) {
    // Fetch quota and wallet data if user has permission
    const { data: memberQuota } = useOtherUserQuota(memberId, communityId);
    const { data: memberWallet } = useOtherUserWallet(memberId, communityId);

    return (
        <LeadCard
            id={memberId}
            displayName={displayName}
            username={username}
            avatarUrl={avatarUrl}
            role={role}
            showRoleChip={showRoleChip}
            hideTeamInfo={hideTeamInfo}
            onClick={onClick}
            permanentMerits={canViewMerits ? memberWallet?.balance : undefined}
            quota={canViewMerits && memberQuota ? {
                dailyQuota: memberQuota.dailyQuota,
                remainingToday: memberQuota.remainingToday,
                usedToday: memberQuota.usedToday,
            } : undefined}
            hideChevron={hideChevron}
        />
    );
}

