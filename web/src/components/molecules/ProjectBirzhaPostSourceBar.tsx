'use client';

import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { useCommunity } from '@/hooks/api/useCommunities';
import { routes } from '@/lib/constants/routes';

export function ProjectBirzhaPostSourceBar({ projectId }: { projectId: string }) {
  const t = useTranslations('projects');
  const { data: project, isPending } = useCommunity(projectId);
  const name =
    project?.name?.trim() || (isPending ? t('birzhaPostProjectNameLoading') : t('birzhaPostProjectNameUnknown'));

  return (
    <div className="mb-3 rounded-lg border border-base-300 bg-base-200/50 px-3 py-2 text-sm dark:bg-base-300/30">
      <span className="text-base-content/70">{t('birzhaPostFromProjectLead')}</span>{' '}
      <Link
        href={routes.project(projectId)}
        className="font-medium text-primary hover:underline"
        onClick={(e) => e.stopPropagation()}
      >
        {name}
      </Link>
    </div>
  );
}
