'use client';

import { useTranslations } from 'next-intl';
import { Badge } from '@/components/ui/shadcn/badge';
import { cn } from '@/lib/utils';
import type { TicketStatus } from '@meriter/shared-types';

const STATUS_EMOJI: Record<TicketStatus, string> = {
  open: '🟡',
  in_progress: '🔵',
  done: '✅',
  closed: '⬛',
};

const statusKeys: Record<TicketStatus, string> = {
  open: 'statusOpen',
  in_progress: 'statusInProgress',
  done: 'statusDone',
  closed: 'statusClosed',
};

const statusClass: Record<TicketStatus, string> = {
  open:
    'border-amber-300 bg-amber-100 text-amber-950 dark:border-amber-500/30 dark:bg-amber-500/20 dark:text-amber-100',
  in_progress:
    'border-sky-300 bg-sky-100 text-sky-950 dark:border-sky-500/30 dark:bg-sky-500/20 dark:text-sky-100',
  done: 'border-emerald-300 bg-emerald-100 text-emerald-950 dark:border-emerald-500/30 dark:bg-emerald-500/20 dark:text-emerald-100',
  closed:
    'border-slate-300 bg-slate-100 text-slate-800 dark:border-white/10 dark:bg-white/10 dark:text-slate-200',
};

export interface TicketStatusBadgeProps {
  status: TicketStatus;
  className?: string;
}

export function TicketStatusBadge({ status, className }: TicketStatusBadgeProps) {
  const t = useTranslations('projects');
  const emoji = STATUS_EMOJI[status] ?? '•';
  const label = t(statusKeys[status] ?? 'statusOpen');

  return (
    <Badge variant="secondary" className={cn('font-normal border', statusClass[status], className)}>
      <span className="mr-1">{emoji}</span>
      {label}
    </Badge>
  );
}
