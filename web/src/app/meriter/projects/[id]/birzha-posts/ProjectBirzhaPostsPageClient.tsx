'use client';

import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui/shadcn/button';
import { SourceBirzhaPostsList } from '@/components/organisms/Birzha/SourceBirzhaPostsList';
import { routes } from '@/lib/constants/routes';

const PAGE_SIZE = 100;

export function ProjectBirzhaPostsPageClient({ projectId }: { projectId: string }) {
  const t = useTranslations('birzhaSource');

  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-6">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <Button variant="ghost" size="sm" asChild className="-ml-2 gap-2 rounded-xl text-base-content">
          <Link href={routes.project(projectId)}>
            <ArrowLeft className="h-4 w-4 shrink-0" aria-hidden />
            {t('backToProject')}
          </Link>
        </Button>
        <Button asChild className="rounded-xl bg-green-600 text-white hover:bg-green-600/90">
          <Link href={`/meriter/projects/${projectId}/birzha-publish`}>{t('publishCta')}</Link>
        </Button>
      </div>
      <h1 className="mb-6 text-xl font-semibold text-base-content">{t('postsPageTitle')}</h1>
      <SourceBirzhaPostsList
        sourceEntityType="project"
        sourceEntityId={projectId}
        variant="default"
        pageSize={PAGE_SIZE}
      />
    </div>
  );
}
