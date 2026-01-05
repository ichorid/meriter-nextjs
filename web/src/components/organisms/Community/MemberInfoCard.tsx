'use client';

import React from 'react';
import { InfoCard } from '@/components/ui/InfoCard';
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
    walletBalance?: number; // New: permanent merits balance
    quota?: { // New: daily quota information
        dailyQuota: number;
        usedToday: number;
        remainingToday: number;
    };
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
    walletBalance,
    quota,
    onClick,
}: MemberInfoCardProps) {
    const tCommon = useTranslations('common');

    // Build footer content if user can view merits and data exists
    const footer = canViewMerits && (walletBalance !== undefined || (quota && quota.dailyQuota > 0)) ? (
        <div className="flex items-center gap-3 pt-2 border-t border-brand-secondary/10">
            {quota && quota.dailyQuota > 0 && (
                <div className="flex items-center gap-1">
                    <DailyQuotaRing
                        remaining={quota.remainingToday}
                        max={quota.dailyQuota}
                        className="w-4 h-4"
                        asDiv={true}
                    />
                    <span className="text-xs text-brand-text-secondary">
                        {quota.remainingToday}/{quota.dailyQuota}
                    </span>
                </div>
            )}
            {walletBalance !== undefined && (
                <div className="flex items-center gap-1 text-xs text-brand-text-secondary">
                    <span className="font-semibold text-brand-text-primary">
                        {walletBalance.toLocaleString()}
                    </span>
                    <span>{tCommon('permanentMerits')}</span>
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

