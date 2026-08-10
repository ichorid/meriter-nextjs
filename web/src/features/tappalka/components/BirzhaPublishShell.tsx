'use client';

import { useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { Loader2 } from 'lucide-react';
import { trpc } from '@/lib/trpc/client';
import { AdaptiveLayout } from '@/components/templates/AdaptiveLayout';
import { SimpleStickyHeader } from '@/components/organisms/ContextTopBar/ContextTopBar';
import { PublicationCreateForm } from '@/features/publications/components/PublicationCreateForm';
import { useCommunity } from '@/hooks/api/useCommunities';
import { useProject } from '@/hooks/api/useProjects';
import { usePublication } from '@/hooks/api/usePublications';
import { useScrollMeriterMainToTop } from '@/hooks/useScrollMeriterMainToTop';
import type { BirzhaSourceEntityType } from './BirzhaSourcePostsShell';

export interface BirzhaPublishShellProps {
  sourceEntityType: BirzhaSourceEntityType;
  sourceEntityId: string;
  backPath: string;
}

export function BirzhaPublishShell({
  sourceEntityType,
  sourceEntityId,
  backPath,
}: BirzhaPublishShellProps) {
  useScrollMeriterMainToTop();
  const router = useRouter();
  const t = useTranslations('birzhaSource');
  const { data: birzha, isLoading: birzhaLoading } = trpc.communities.getBirzhaCommunity.useQuery(
    undefined,
    { staleTime: 120_000 },
  );

  const { data: community, isLoading: communityLoading } = useCommunity(
    sourceEntityType === 'community' ? sourceEntityId : '',
  );
  const { data: projectData, isLoading: projectLoading } = useProject(
    sourceEntityType === 'project' ? sourceEntityId : '',
  );

  const sourceLoading =
    sourceEntityType === 'community' ? communityLoading : projectLoading;

  const sourceName =
    sourceEntityType === 'community'
      ? (community?.name ?? '')
      : (projectData?.project?.name ?? '');

  const obPostId =
    sourceEntityType === 'community' ? community?.futureVisionPublicationId : undefined;
  const { data: obPub } = usePublication(obPostId ?? '');
  const seedValueTags = useMemo(() => {
    if (sourceEntityType !== 'community') return undefined;
    const tags = (obPub as { valueTags?: string[] } | undefined)?.valueTags;
    return tags?.filter(Boolean);
  }, [obPub, sourceEntityType]);

  const isLoading = birzhaLoading || sourceLoading;

  const publishHeader = (
    <span className="block">
      <span className="block">{t('publishTitle')}</span>
      {sourceName ? (
        <span className="mt-1 block text-xs font-normal text-muted-foreground">
          {t('publishDescriptionNamed', { name: sourceName })}
        </span>
      ) : (
        <span className="mt-1 block text-xs font-normal text-muted-foreground">
          {t('publishDescription')}
        </span>
      )}
    </span>
  );

  if (isLoading) {
    return (
      <AdaptiveLayout communityId={sourceEntityId}>
        <SimpleStickyHeader
          title={t('publishTitle')}
          showBack
          onBack={() => router.push(backPath)}
          asStickyHeader
        />
        <div className="flex justify-center py-16">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" aria-hidden />
        </div>
      </AdaptiveLayout>
    );
  }

  if (!birzha) {
    return (
      <AdaptiveLayout communityId={sourceEntityId}>
        <SimpleStickyHeader
          title={t('publishTitle')}
          showBack
          onBack={() => router.push(backPath)}
          asStickyHeader
        />
        <p className="px-4 py-8 text-center text-sm text-muted-foreground">
          {t('birzhaCommunityMissing')}
        </p>
      </AdaptiveLayout>
    );
  }

  return (
    <AdaptiveLayout communityId={sourceEntityId}>
      <SimpleStickyHeader
        title={publishHeader}
        showBack
        onBack={() => router.push(backPath)}
        asStickyHeader
      />
      <div className="space-y-6">
        <PublicationCreateForm
          communityId={birzha.id}
          birzhaSourceEntity={{ type: sourceEntityType, id: sourceEntityId }}
          seedValueTags={seedValueTags}
          defaultPostType="basic"
          isProjectCommunity={false}
          onSuccess={() => router.push(`/meriter/communities/${birzha.id}`)}
          onCancel={() => router.push(backPath)}
        />
      </div>
    </AdaptiveLayout>
  );
}
