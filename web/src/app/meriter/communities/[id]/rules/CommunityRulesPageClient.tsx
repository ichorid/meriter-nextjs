'use client';

import React from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { AdaptiveLayout } from '@/components/templates/AdaptiveLayout';
import { SimpleStickyHeader } from '@/components/organisms/ContextTopBar/ContextTopBar';
import { CommunityRulesEditor } from '@/features/communities/components/CommunityRulesEditor';
import { useCommunity, useUpdateCommunity } from '@/hooks/api/useCommunities';
import { Loader2 } from 'lucide-react';

interface CommunityRulesPageClientProps {
  communityId: string;
}

export function CommunityRulesPageClient({ communityId }: CommunityRulesPageClientProps) {
  const router = useRouter();
  const t = useTranslations('communities.rules');
  const { data: community, isLoading } = useCommunity(communityId);
  const updateCommunity = useUpdateCommunity();

  const handleSave = async (rules: {
    postingRules?: any;
    votingRules?: any;
    visibilityRules?: any;
    meritRules?: any;
    linkedCurrencies?: string[];
  }) => {
    await updateCommunity.mutateAsync({
      id: communityId,
      data: rules,
    });
  };

  const pageHeader = (
    <SimpleStickyHeader
      title={t('title')}
      showBack={true}
      onBack={() => router.push(`/meriter/communities/${communityId}`)}
      asStickyHeader={true}
    />
  );

  if (isLoading) {
    return (
      <AdaptiveLayout stickyHeader={pageHeader}>
        <div className="flex items-center justify-center min-h-[400px]">
          <Loader2 className="w-8 h-8 animate-spin text-brand-primary" />
        </div>
      </AdaptiveLayout>
    );
  }

  if (!community) {
    return (
      <AdaptiveLayout stickyHeader={pageHeader}>
        <div className="text-brand-text-primary">{t('communityNotFound')}</div>
      </AdaptiveLayout>
    );
  }

  return (
    <AdaptiveLayout communityId={communityId} stickyHeader={pageHeader}>
      <div className="space-y-6">
        <CommunityRulesEditor
          community={community}
          onSave={handleSave}
        />
      </div>
    </AdaptiveLayout>
  );
}

