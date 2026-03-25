'use client';

import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { Loader2 } from 'lucide-react';
import { trpc } from '@/lib/trpc/client';
import { AdaptiveLayout } from '@/components/templates/AdaptiveLayout';
import { SimpleStickyHeader } from '@/components/organisms/ContextTopBar/ContextTopBar';
import { PublicationCreateForm } from '@/features/publications/components/PublicationCreateForm';
import { useProject } from '@/hooks/api/useProjects';

interface ProjectBirzhaPublishPageClientProps {
  projectId: string;
}

export function ProjectBirzhaPublishPageClient({ projectId }: ProjectBirzhaPublishPageClientProps) {
  const router = useRouter();
  const t = useTranslations('birzhaSource');
  const { data: birzha, isLoading } = trpc.communities.getBirzhaCommunity.useQuery(undefined, {
    staleTime: 120_000,
  });
  const { data: projectData, isLoading: projectLoading } = useProject(projectId);
  const projectName = projectData?.project?.name ?? '';

  const backPath = `/meriter/projects/${projectId}`;

  if (isLoading || projectLoading) {
    return (
      <AdaptiveLayout communityId={projectId}>
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
      <AdaptiveLayout communityId={projectId}>
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
    <AdaptiveLayout communityId={projectId}>
      <SimpleStickyHeader
        title={
          <span className="block">
            <span className="block">{t('publishTitle')}</span>
            {projectName ? (
              <span className="mt-1 block text-xs font-normal text-muted-foreground">
                {t('publishDescriptionNamed', { name: projectName })}
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
          birzhaSourceEntity={{ type: 'project', id: projectId }}
          defaultPostType="basic"
          isProjectCommunity={false}
          onSuccess={() => router.push(`/meriter/communities/${birzha.id}`)}
          onCancel={() => router.push(backPath)}
        />
      </div>
    </AdaptiveLayout>
  );
}
