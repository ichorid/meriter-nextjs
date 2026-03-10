'use client';

import { useTranslations } from 'next-intl';
import { useProjectShares } from '@/hooks/api/useTickets';
import { useUserProfile } from '@/hooks/api/useUsers';
import { Skeleton } from '@/components/ui/shadcn/skeleton';

interface ProjectSharesDisplayProps {
  projectId: string;
}

export function ProjectSharesDisplay({ projectId }: ProjectSharesDisplayProps) {
  const t = useTranslations('projects');
  const { data: shares, isLoading } = useProjectShares(projectId);

  if (isLoading) {
    return (
      <div className="space-y-2">
        <h3 className="text-sm font-medium">{t('internalShares')}</h3>
        <Skeleton className="h-16 w-full" />
      </div>
    );
  }

  if (!shares || shares.length === 0) {
    return (
      <div className="space-y-2">
        <h3 className="text-sm font-medium">{t('internalShares')}</h3>
        <p className="text-sm text-muted-foreground">—</p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <h3 className="text-sm font-medium">{t('internalShares')}</h3>
      <ul className="space-y-1 text-sm">
        {shares.map((row) => (
          <ShareRow key={row.userId} userId={row.userId} internalMerits={row.internalMerits} sharePercent={row.sharePercent} />
        ))}
      </ul>
    </div>
  );
}

function ShareRow({
  userId,
  internalMerits,
  sharePercent,
}: {
  userId: string;
  internalMerits: number;
  sharePercent: number;
}) {
  const { data: user } = useUserProfile(userId);
  const displayName = user?.displayName ?? user?.username ?? userId.slice(0, 8);

  return (
    <li className="flex items-center justify-between gap-2">
      <span className="truncate">{displayName}</span>
      <span className="text-muted-foreground shrink-0">
        {internalMerits} · {sharePercent.toFixed(1)}%
      </span>
    </li>
  );
}
