'use client';

import { useTranslations } from 'next-intl';
import { Badge } from '@/components/ui/shadcn/badge';
import { cn } from '@/lib/utils';

export function BirzhaSourcePostBadge({
  sourceEntityType,
  variant = 'short',
  className,
}: {
  sourceEntityType: 'project' | 'community';
  /** Short (feed title row) vs full label on publication cards */
  variant?: 'short' | 'card';
  className?: string;
}) {
  const t = useTranslations('birzhaSource');
  const label =
    variant === 'card'
      ? sourceEntityType === 'community'
        ? t('cardPostFromCommunity')
        : t('cardPostFromProject')
      : sourceEntityType === 'community'
        ? t('badgeCommunity')
        : t('badgeProject');
  return (
    <Badge
      variant="outline"
      className={cn(
        'shrink-0 border-base-300/70 bg-base-200/50 px-2 py-0.5 text-xs font-medium text-base-content/85 dark:border-base-content/20 dark:bg-base-300/35',
        variant === 'card' && 'mb-2',
        className,
      )}
    >
      {label}
    </Badge>
  );
}

export function ProjectPostBadge() {
  return <BirzhaSourcePostBadge sourceEntityType="project" />;
}
