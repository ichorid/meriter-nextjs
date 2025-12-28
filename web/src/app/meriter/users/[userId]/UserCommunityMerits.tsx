'use client';

import React from 'react';
import { useOtherUserQuota } from '@/hooks/api/useQuota';
import { useOtherUserWallet } from '@/hooks/api/useWallet';
import { DailyQuotaRing } from '@/components/molecules/DailyQuotaRing';
import { useTranslations } from 'next-intl';

interface UserCommunityMeritsProps {
    userId: string;
    communityId: string;
    communityName?: string;
    canView: boolean;
}

export function UserCommunityMerits({ userId, communityId, communityName, canView }: UserCommunityMeritsProps) {
    const tCommon = useTranslations('common');
    const { data: quota } = useOtherUserQuota(userId, communityId);
    const { data: wallet } = useOtherUserWallet(userId, communityId);

    if (!canView || (!quota && !wallet)) {
        return null;
    }

    const hasData = (wallet?.balance !== undefined) || (quota && quota.dailyQuota > 0);
    if (!hasData) {
        return null;
    }

    return (
        <div className="border border-brand-secondary/10 rounded-lg p-4">
            <h3 className="text-sm font-semibold text-brand-text-primary mb-3">
                {communityName || communityId}
            </h3>
            <div className="flex items-center gap-4 flex-wrap">
                {quota && quota.dailyQuota > 0 && (
                    <div className="flex items-center gap-2">
                        <DailyQuotaRing
                            remaining={quota.remainingToday}
                            max={quota.dailyQuota}
                            className="w-5 h-5"
                            asDiv={true}
                        />
                        <span className="text-sm text-brand-text-secondary">
                            <span className="font-semibold text-brand-text-primary">{quota.remainingToday}</span>
                            {' / '}
                            <span className="text-brand-text-secondary">{quota.dailyQuota}</span>
                        </span>
                    </div>
                )}
                {wallet?.balance !== undefined && (
                    <div className="flex items-center gap-1 text-sm">
                        <span className="font-semibold text-brand-text-primary">
                            {wallet.balance.toLocaleString()}
                        </span>
                        <span className="text-brand-text-secondary">permanent</span>
                    </div>
                )}
            </div>
        </div>
    );
}

