'use client';

import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { useGlobalProjectsList } from '@/hooks/api/useProjects';
import { ProjectCard } from '@/components/organisms/Project/ProjectCard';
import { Button } from '@/components/ui/shadcn/button';
import { AdaptiveLayout } from '@/components/templates/AdaptiveLayout/AdaptiveLayout';
import { Plus, FolderKanban } from 'lucide-react';

const createButtonClass =
  'inline-flex items-center justify-center whitespace-nowrap text-sm font-medium transition-colors focus-visible:outline-none active:scale-[0.98] disabled:pointer-events-none disabled:opacity-50 border border-input bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 hover:text-base-content text-base-content dark:text-base-content/70 h-9 rounded-xl px-3 gap-2';

export default function ProjectsPageClient() {
  const router = useRouter();
  const t = useTranslations('projects');
  const tCommon = useTranslations('common');
  const { data, isLoading } = useGlobalProjectsList({ page: 1, pageSize: 50 });

  const items = data?.data ?? [];

  return (
    <AdaptiveLayout>
      <div className="flex flex-col gap-4 p-4">
        <div className="rounded-xl bg-gray-100 dark:bg-gray-800/50 p-5 shadow-[0_2px_8px_rgba(0,0,0,0.08)] space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h1 className="text-xl font-semibold text-base-content">{t('title')}</h1>
            <Button
              variant="outline"
              size="sm"
              className={createButtonClass}
              onClick={() => router.push('/meriter/projects/create')}
              aria-label={t('create')}
            >
              <Plus size={16} />
              {t('create')}
            </Button>
          </div>
        </div>

        {isLoading ? (
          <div className="rounded-xl bg-base-100 py-8 text-center">
            <p className="text-sm text-base-content/60">{tCommon('loading')}</p>
          </div>
        ) : items.length === 0 ? (
          <div className="rounded-xl bg-base-100 py-12 px-4 text-center">
            <FolderKanban className="mx-auto h-12 w-12 text-base-content/30" />
            <p className="mt-3 text-sm font-medium text-base-content/70">{t('noProjects')}</p>
          </div>
        ) : (
          <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {items.map(({ project, parentCommunityName }) => (
              <li key={project.id} className="min-w-0">
                {parentCommunityName && (
                  <p className="mb-1.5 text-xs font-medium uppercase tracking-wide text-base-content/50">
                    {parentCommunityName}
                  </p>
                )}
                <ProjectCard project={project} />
              </li>
            ))}
          </ul>
        )}
      </div>
    </AdaptiveLayout>
  );
}
