'use client';

import type { ReactNode } from 'react';
import Link from 'next/link';
import { ChevronRight, TrendingUp } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useBirzhaPostsBySource } from '@/hooks/api/useBirzhaSource';
import { cn } from '@/lib/utils';

const linkClassCommunity =
  'flex min-h-[52px] flex-1 items-center justify-between gap-3 rounded-xl border border-base-300 bg-base-200/60 p-4 transition-colors hover:bg-base-300/60';

const linkClassProject =
  'flex min-h-[52px] flex-1 items-center justify-between gap-3 rounded-xl border border-white/10 bg-white/5 p-4 transition-colors hover:bg-white/10';

/**
 * Members-style row linking to full Birzha posts list + optional publish slot (button) beside it.
 */
export function BirzhaSourcePostsEntryRow({
  variant,
  sourceEntityType,
  sourceEntityId,
  listHref,
  publishSlot,
  className,
}: {
  variant: 'community' | 'project';
  sourceEntityType: 'project' | 'community';
  sourceEntityId: string;
  listHref: string;
  /** Optional CTA beside the list link (e.g. publish). Omit when entry exists on the list page. */
  publishSlot?: ReactNode;
  /** Merges with root row wrapper (default includes mb-6). */
  className?: string;
}) {
  const t = useTranslations('birzhaSource');
  const tCommunities = useTranslations('communities');
  const { data, isLoading } = useBirzhaPostsBySource(
    sourceEntityType,
    sourceEntityId,
    { limit: 1 },
  );

  const total = data?.total ?? 0;
  const countLabel = isLoading ? '…' : total;

  const linkClass = variant === 'project' ? linkClassProject : linkClassCommunity;

  return (
    <div
      className={cn('mb-6 flex flex-col gap-3 sm:flex-row sm:items-stretch', className)}
    >
      <Link href={listHref} className={linkClass}>
        <div className="flex min-w-0 items-center gap-3">
          <TrendingUp className="h-5 w-5 shrink-0 opacity-70" aria-hidden />
          <div className="flex min-w-0 items-baseline gap-2">
            <span className="truncate font-medium">{t('sectionTitle')}</span>
            <span className="shrink-0 tabular-nums text-sm opacity-60">{countLabel}</span>
          </div>
        </div>
        <span className="flex shrink-0 items-center gap-1 text-sm font-medium text-primary">
          {tCommunities('all')}
          <ChevronRight size={14} aria-hidden />
        </span>
      </Link>
      {publishSlot ? (
        <div className="flex shrink-0 flex-col justify-stretch sm:justify-center">{publishSlot}</div>
      ) : null}
    </div>
  );
}
