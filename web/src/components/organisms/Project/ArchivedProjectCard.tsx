'use client';

import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { Archive } from 'lucide-react';
import { cn } from '@/lib/utils';

interface ArchivedProjectCardProps {
  projectId: string;
  name: string;
  description?: string;
  className?: string;
}

export function ArchivedProjectCard({ projectId, name, description, className }: ArchivedProjectCardProps) {
  const t = useTranslations('projects');

  return (
    <Link
      href={`/meriter/projects/${projectId}`}
      className={cn(
        'block rounded-lg border bg-card p-4 text-card-foreground shadow-sm transition-colors hover:bg-muted/50',
        className,
      )}
    >
      <div className="flex items-start gap-3">
        <div className="rounded-md bg-muted p-2">
          <Archive className="h-5 w-5 text-muted-foreground" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="font-medium">{name}</span>
            <span className="rounded bg-muted px-1.5 py-0.5 text-xs">{t('archived')}</span>
          </div>
          {description && (
            <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">{description}</p>
          )}
          <p className="mt-2 text-xs text-muted-foreground">{t('viewArchive', { defaultValue: 'View archive' })}</p>
        </div>
      </div>
    </Link>
  );
}
