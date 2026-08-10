'use client';

import type { ReactNode } from 'react';
import { useTranslations } from 'next-intl';
import { cn } from '@/lib/utils';
import { projectPanelSurfaceClass } from './project-surface';

export interface ProjectActionsProps {
  joinBlock?: ReactNode;
  managementSlot?: ReactNode;
  closeProjectSlot?: ReactNode;
}

export function ProjectActions({
  joinBlock,
  managementSlot,
  closeProjectSlot,
}: ProjectActionsProps) {
  const t = useTranslations('projects');

  return (
    <section className="space-y-4" aria-label={t('actionsSection')}>
      {joinBlock}
      {managementSlot && (
        <div className={cn(projectPanelSurfaceClass, 'space-y-3 p-4')}>
          <h3 className="text-xs font-semibold uppercase tracking-wide text-base-content/50">
            {t('managementHeading')}
          </h3>
          <div className="flex flex-wrap gap-2">{managementSlot}</div>
        </div>
      )}
      {closeProjectSlot && <div className="mt-3">{closeProjectSlot}</div>}
    </section>
  );
}
