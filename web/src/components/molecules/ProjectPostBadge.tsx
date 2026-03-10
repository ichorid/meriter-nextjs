'use client';

import { useTranslations } from 'next-intl';
import { Badge } from '@/components/ui/shadcn/badge';

export function ProjectPostBadge() {
  const t = useTranslations('projects');
  return (
    <Badge variant="secondary" className="text-xs">
      {t('projectPostBadge', { defaultValue: 'Project' })}
    </Badge>
  );
}
