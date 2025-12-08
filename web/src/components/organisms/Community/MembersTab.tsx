'use client';

import React, { useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { useCommunityMembers } from '@/hooks/api/useCommunityMembers';
import { InfoCard } from '@/components/ui/InfoCard';
import { BrandAvatar } from '@/components/ui/BrandAvatar';
import { CardSkeleton } from '@/components/ui/LoadingSkeleton';
import { Loader2, Users } from 'lucide-react';
import { routes } from '@/lib/constants/routes';

interface MembersTabProps {
    communityId: string;
}

export const MembersTab: React.FC<MembersTabProps> = ({ communityId }) => {
    const router = useRouter();
    const t = useTranslations('pages.communities');
    const tCommon = useTranslations('common');
    const { data: membersData, isLoading: membersLoading } = useCommunityMembers(communityId);

    const members = useMemo(() => {
        return membersData?.data || [];
    }, [membersData]);

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
            {members.map((member) => (
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
                    onClick={() => router.push(routes.userProfile(member.id))}
                />
            ))}
        </div>
    );
};
