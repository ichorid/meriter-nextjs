'use client';

import React from 'react';
import { InfoCard } from '@/components/ui/InfoCard';
import { useOtherUserQuota } from '@/hooks/api/useQuota';
import { useOtherUserWallet } from '@/hooks/api/useWallet';
import { DailyQuotaRing } from '@/components/molecules/DailyQuotaRing';
import { useTranslations } from 'next-intl';

interface MemberInfoCardProps {
    memberId: string;
    title: string;
    subtitle?: string;
    icon?: React.ReactNode;
    badges?: string[];
    communityId: string;
    canViewMerits: boolean;
    onClick?: () => void;
}

export function MemberInfoCard({
    memberId,
    title,
    subtitle,
    icon,
    badges,
    communityId,
    canViewMerits,
    onClick,
}: MemberInfoCardProps) {
    const tCommon = useTranslations('common');
    
    // Fetch quota and wallet data if user has permission
    const { data: memberQuota } = useOtherUserQuota(memberId, communityId);
    const { data: memberWallet } = useOtherUserWallet(memberId, communityId);

    const permanentMerits = memberWallet?.balance;

    // Build footer content if user can view merits and data exists
    const footer = canViewMerits && (permanentMerits !== undefined || (memberQuota && memberQuota.dailyQuota > 0)) ? (
        <div className="flex items-center gap-3 pt-2 border-t border-brand-secondary/10">
            {memberWallet?.balance !== undefined && (
                <div className="text-xs text-brand-text-secondary">
                    <span>{tCommon('permanentMerits')}: </span>
                    <span className="font-semibold text-brand-text-primary">
                        {memberWallet.balance.toLocaleString()}
                    </span>
                </div>
            )}
            {memberQuota && memberQuota.dailyQuota > 0 && (
                <div className="flex items-center gap-1">
                    <DailyQuotaRing
                        remaining={memberQuota.remainingToday}
                        max={memberQuota.dailyQuota}
                        className="w-4 h-4"
                        asDiv={true}
                    />
                    <span className="text-xs text-brand-text-secondary">
                        {memberQuota.remainingToday}/{memberQuota.dailyQuota}
                    </span>
                </div>
            )}
        </div>
    ) : undefined;

    return (
        <InfoCard
            title={title}
            subtitle={subtitle}
            icon={icon}
            badges={badges}
            onClick={onClick}
            footer={footer}
        />
    );
}

