'use client';

import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { useProjects } from '@/hooks/api/useProjects';
import { ProjectCard } from '@/components/organisms/Project/ProjectCard';
import { Button } from '@/components/ui/shadcn/button';
import { AdaptiveLayout } from '@/components/templates/AdaptiveLayout';
import { Plus } from 'lucide-react';

export default function ProjectsPageClient() {
  const t = useTranslations('projects');
  const { data, isLoading } = useProjects({ page: 1, pageSize: 50 });

  const projects = data?.data ?? [];
  const total = data?.total ?? 0;

  return (
    <AdaptiveLayout>
      <div className="flex flex-col gap-4 p-4">
        <div className="flex flex-row items-center justify-between">
          <h1 className="text-2xl font-semibold">{t('title')}</h1>
          <Button asChild>
            <Link href="/meriter/projects/create">
              <Plus className="mr-2 h-4 w-4" />
              {t('create')}
            </Link>
          </Button>
        </div>
        {isLoading ? (
          <p className="text-muted-foreground">Loading...</p>
        ) : projects.length === 0 ? (
          <p className="text-muted-foreground">{t('noProjects')}</p>
        ) : (
          <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {projects.map((project) => (
              <li key={project.id}>
                <ProjectCard project={project} />
              </li>
            ))}
          </ul>
        )}
      </div>
    </AdaptiveLayout>
  );
}
