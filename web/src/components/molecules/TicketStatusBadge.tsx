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

export interface TicketStatusBadgeProps {
  status: TicketStatus;
  className?: string;
}

export function TicketStatusBadge({ status, className }: TicketStatusBadgeProps) {
  const t = useTranslations('projects');
  const emoji = STATUS_EMOJI[status] ?? '•';
  const label = t(statusKeys[status] ?? 'statusOpen');

  return (
    <Badge variant="secondary" className={cn('font-normal', className)}>
      <span className="mr-1">{emoji}</span>
      {label}
    </Badge>
  );
}
