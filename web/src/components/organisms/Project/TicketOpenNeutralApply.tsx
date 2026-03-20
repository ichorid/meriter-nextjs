'use client';

import { useTranslations } from 'next-intl';
import { useApplyForTicket } from '@/hooks/api/useTickets';
import { Button } from '@/components/ui/shadcn/button';
import { cn } from '@/lib/utils';

export interface TicketOpenNeutralApplyProps {
  ticketId: string;
  authorId: string;
  currentUserId: string | undefined;
  isNeutralTicket: boolean;
  ticketStatus: string;
  applicants: string[];
  className?: string;
}

export function TicketOpenNeutralApply({
  ticketId,
  authorId,
  currentUserId,
  isNeutralTicket,
  ticketStatus,
  applicants,
  className,
}: TicketOpenNeutralApplyProps) {
  const t = useTranslations('projects');
  const apply = useApplyForTicket();

  const isOpenNeutral = ticketStatus === 'open' && isNeutralTicket;
  if (!isOpenNeutral || !currentUserId) {
    return null;
  }

  const canTake = currentUserId !== authorId && !applicants.includes(currentUserId);
  const hasApplied = currentUserId !== authorId && applicants.includes(currentUserId);

  if (!canTake && !hasApplied) {
    return null;
  }

  return (
    <div className={cn('mb-4 flex flex-wrap items-center gap-2', className)}>
      {canTake && (
        <Button
          type="button"
          size="sm"
          variant="default"
          className="h-9 rounded-lg"
          onClick={() => apply.mutate({ ticketId })}
          disabled={apply.isPending}
        >
          {apply.isPending ? '…' : t('takeTask')}
        </Button>
      )}
      {hasApplied && (
        <span className="text-sm text-base-content/70">{t('alreadyApplied')}</span>
      )}
    </div>
  );
}
