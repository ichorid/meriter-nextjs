'use client';

import React from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { AdaptiveLayout } from '@/components/templates/AdaptiveLayout';
import { CommunityRulesEditor } from '@/features/communities/components/CommunityRulesEditor';
import { useCommunity, useUpdateCommunity } from '@/hooks/api/useCommunities';
import { BrandButton } from '@/components/ui/BrandButton';
import { ArrowLeft, Loader2 } from 'lucide-react';

export default function CommunityRulesPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const router = useRouter();
  const t = useTranslations('communities.rules');
  const [resolvedParams, setResolvedParams] = React.useState<{ id: string } | null>(null);

  React.useEffect(() => {
    params.then(setResolvedParams);
  }, [params]);

  const communityId = resolvedParams?.id;
  const { data: community, isLoading } = useCommunity(communityId || '');
  const updateCommunity = useUpdateCommunity();

  const handleSave = async (rules: {
    postingRules?: any;
    votingRules?: any;
    visibilityRules?: any;
    meritRules?: any;
    linkedCurrencies?: string[];
  }) => {
    if (!communityId) return;

    await updateCommunity.mutateAsync({
      id: communityId,
      data: rules,
    });
  };

  if (!communityId || isLoading) {
    return (
      <AdaptiveLayout>
        <div className="flex items-center justify-center min-h-[400px]">
          <Loader2 className="w-8 h-8 animate-spin text-brand-primary" />
        </div>
      </AdaptiveLayout>
    );
  }

  if (!community) {
    return (
      <AdaptiveLayout>
        <div className="p-4">
          <p className="text-brand-text-primary">{t('communityNotFound')}</p>
        </div>
      </AdaptiveLayout>
    );
  }

  return (
    <AdaptiveLayout communityId={communityId}>
      <div className="flex-1 p-4">
        <div className="flex items-center gap-4 mb-4">
          <BrandButton
            variant="ghost"
            size="sm"
            onClick={() => router.back()}
            className="p-0"
          >
            <ArrowLeft size={24} />
          </BrandButton>
          <h1 className="text-xl font-bold text-brand-text-primary">{t('title')}</h1>
        </div>

        <CommunityRulesEditor
          community={community}
          onSave={handleSave}
        />
      </div>
    </AdaptiveLayout>
  );
}
