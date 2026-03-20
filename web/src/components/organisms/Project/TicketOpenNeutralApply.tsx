'use client';

import { useTranslations } from 'next-intl';
import { useApplyForTicket, useTakeOpenNeutralAsModerator } from '@/hooks/api/useTickets';
import { Button } from '@/components/ui/shadcn/button';
import { cn } from '@/lib/utils';

export interface TicketOpenNeutralApplyProps {
  ticketId: string;
  currentUserId: string | undefined;
  /** Project lead or superadmin: take task without applying. */
  canModerateTickets?: boolean;
  isNeutralTicket: boolean;
  ticketStatus: string;
  applicants: string[];
  className?: string;
}

export function TicketOpenNeutralApply({
  ticketId,
  currentUserId,
  canModerateTickets = false,
  isNeutralTicket,
  ticketStatus,
  applicants,
  className,
}: TicketOpenNeutralApplyProps) {
  const t = useTranslations('projects');
  const apply = useApplyForTicket();
  const takeAsModerator = useTakeOpenNeutralAsModerator();

  const isOpenNeutral = ticketStatus === 'open' && isNeutralTicket;
  if (!isOpenNeutral || !currentUserId) {
    return null;
  }

  const canTakeAsModerator = canModerateTickets;
  const canTakeAsMember = !canModerateTickets && !applicants.includes(currentUserId);
  const hasApplied = !canModerateTickets && applicants.includes(currentUserId);

  if (!canTakeAsModerator && !canTakeAsMember && !hasApplied) {
    return null;
  }

  return (
    <div className={cn('mb-4 flex flex-wrap items-center gap-2', className)}>
      {canTakeAsModerator && (
        <Button
          type="button"
          size="sm"
          variant="default"
          className="h-9 rounded-lg"
          onClick={() => takeAsModerator.mutate({ ticketId })}
          disabled={takeAsModerator.isPending}
        >
          {takeAsModerator.isPending ? '…' : t('takeTask')}
        </Button>
      )}
      {canTakeAsMember && (
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
