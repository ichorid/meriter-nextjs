'use client';

import { useTranslations } from 'next-intl';
import { Badge } from '@/components/ui/shadcn/badge';

export function BirzhaSourcePostBadge({
  sourceEntityType,
}: {
  sourceEntityType: 'project' | 'community';
}) {
  const t = useTranslations('birzhaSource');
  const label =
    sourceEntityType === 'community' ? t('badgeCommunity') : t('badgeProject');
  return (
    <Badge variant="secondary" className="text-xs">
      {label}
    </Badge>
  );
}

export function ProjectPostBadge() {
  return <BirzhaSourcePostBadge sourceEntityType="project" />;
}
