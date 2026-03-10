'use client';

import Link from 'next/link';
import { useTranslations } from 'next-intl';
import type { Community } from '@meriter/shared-types';
import { CooperativeSharesDisplay } from '@/components/molecules/CooperativeSharesDisplay';
import { Card, CardContent, CardHeader } from '@/components/ui/shadcn/card';
import { Badge } from '@/components/ui/shadcn/badge';

export interface ProjectCardProps {
  project: Community;
}

export function ProjectCard({ project }: ProjectCardProps) {
  const t = useTranslations('projects');
  const status = project.projectStatus ?? 'active';
  const statusLabel = status === 'active' ? t('active') : status === 'closed' ? t('closed') : t('archived');

  return (
    <Card className="h-full transition-shadow hover:shadow-md">
      <Link href={`/meriter/projects/${project.id}`} className="block h-full">
        <CardHeader className="pb-2">
          <div className="flex items-start justify-between gap-2">
            <h3 className="font-semibold line-clamp-2">{project.name}</h3>
            <Badge variant={status === 'active' ? 'default' : 'secondary'}>{statusLabel}</Badge>
          </div>
          {project.description && (
            <p className="text-sm text-muted-foreground line-clamp-2">{project.description}</p>
          )}
        </CardHeader>
        <CardContent className="pt-0">
          <CooperativeSharesDisplay
            founderSharePercent={project.founderSharePercent ?? 0}
            investorSharePercent={project.investorSharePercent ?? 0}
          />
        </CardContent>
      </Link>
    </Card>
  );
}
