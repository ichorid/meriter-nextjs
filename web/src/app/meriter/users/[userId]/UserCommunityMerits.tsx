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
        <div className="rounded-xl border border-base-300 bg-base-100/50 p-3 transition-colors hover:bg-base-200/50">
            <h3 className="text-sm font-medium text-base-content mb-2">
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
                        <span className="text-sm text-base-content/70">
                            <span className="font-semibold text-base-content">{quota.remainingToday}</span>
                            {' / '}
                            <span className="text-base-content/60">{quota.dailyQuota}</span>
                        </span>
                    </div>
                )}
                {wallet?.balance !== undefined && (
                    <div className="flex items-center gap-1 text-sm">
                        <span className="font-semibold text-base-content">
                            {wallet.balance.toLocaleString()}
                        </span>
                        <span className="text-base-content/60">{tCommon('permanentMerits')}</span>
                    </div>
                )}
            </div>
        </div>
    );
}
