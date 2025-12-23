'use client';

import React from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { CommunityForm } from '@/features/communities/components';
import { AdaptiveLayout } from '@/components/templates/AdaptiveLayout';
import { SimpleStickyHeader } from '@/components/organisms/ContextTopBar/ContextTopBar';
import { useCommunity } from '@/hooks/api/useCommunities';

interface CommunitySettingsPageClientProps {
  communityId: string;
}

export function CommunitySettingsPageClient({ communityId }: CommunitySettingsPageClientProps) {
    const router = useRouter();
    const t = useTranslations('pages.communitySettings');
    const { data: community } = useCommunity(communityId);

    const pageTitle = community?.name
        ? t('settingsTitle', { communityName: community.name })
        : t('settingsTitle', { communityName: '' });

    return (
        <AdaptiveLayout
            communityId={communityId}
            stickyHeader={
                <SimpleStickyHeader
                    title={pageTitle}
                    showBack={true}
                    onBack={() => router.push(`/meriter/communities/${communityId}`)}
                    asStickyHeader={true}
                />
            }
        >
            <div className="space-y-6">
                <CommunityForm communityId={communityId} />
            </div>
        </AdaptiveLayout>
    );
}

