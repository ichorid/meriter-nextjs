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
import { usePublication } from '@/hooks/api/usePublications';

interface BirzhaPublishPageClientProps {
  sourceCommunityId: string;
}

export function BirzhaPublishPageClient({ sourceCommunityId }: BirzhaPublishPageClientProps) {
  const router = useRouter();
  const t = useTranslations('birzhaSource');
  const { data: birzha, isLoading } = trpc.communities.getBirzhaCommunity.useQuery(undefined, {
    staleTime: 120_000,
  });
  const { data: comm } = useCommunity(sourceCommunityId);
  const obPostId = comm?.futureVisionPublicationId;
  const { data: obPub } = usePublication(obPostId ?? '');
  const seedValueTags = useMemo(() => {
    const tags = (obPub as { valueTags?: string[] } | undefined)?.valueTags;
    return tags?.filter(Boolean);
  }, [obPub]);

  const backPath = `/meriter/communities/${sourceCommunityId}`;
  const communityName = comm?.name ?? '';

  if (isLoading) {
    return (
      <AdaptiveLayout communityId={sourceCommunityId}>
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
      <AdaptiveLayout communityId={sourceCommunityId}>
        <SimpleStickyHeader
          title={t('publishTitle')}
          showBack
          onBack={() => router.push(backPath)}
          asStickyHeader
        />
        <p className="px-4 py-8 text-center text-sm text-muted-foreground">{t('birzhaCommunityMissing')}</p>
      </AdaptiveLayout>
    );
  }

  return (
    <AdaptiveLayout communityId={sourceCommunityId}>
      <SimpleStickyHeader
        title={
          <span className="block">
            <span className="block">{t('publishTitle')}</span>
            {communityName ? (
              <span className="mt-1 block text-xs font-normal text-muted-foreground">
                {t('publishDescriptionNamed', { name: communityName })}
              </span>
            ) : (
              <span className="mt-1 block text-xs font-normal text-muted-foreground">
                {t('publishDescription')}
              </span>
            )}
          </span>
        }
        showBack
        onBack={() => router.push(backPath)}
        asStickyHeader
      />
      <div className="space-y-6">
        <PublicationCreateForm
          communityId={birzha.id}
          birzhaSourceEntity={{ type: 'community', id: sourceCommunityId }}
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
