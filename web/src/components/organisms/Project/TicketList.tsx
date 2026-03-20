'use client';

import { useTranslations } from 'next-intl';
import { CheckCircle2 } from 'lucide-react';
import { useTickets } from '@/hooks/api/useTickets';
import { TicketCard } from './TicketCard';
import { Button } from '@/components/ui/shadcn/button';
import type { TicketStatus } from '@meriter/shared-types';

interface TicketListProps {
  projectId: string;
  currentUserId: string;
  canModerateTickets: boolean;
  statusFilter: TicketStatus | 'all';
  onOpenCreateTask?: () => void;
  onOpenCreateOpenTask?: () => void;
}

export function TicketList({
  projectId,
  currentUserId,
  canModerateTickets,
  statusFilter,
  onOpenCreateTask,
  onOpenCreateOpenTask,
}: TicketListProps) {
  const t = useTranslations('projects');
  const tCommon = useTranslations('common');

  const { data: tickets, isLoading } = useTickets(projectId, {
    postType: 'ticket',
    ticketStatus: statusFilter === 'all' ? undefined : statusFilter,
  });

  if (isLoading) {
    return <p className="text-sm text-base-content/60">{tCommon('loading')}</p>;
  }

  const list = tickets ?? [];
  const showLeadCtas = canModerateTickets && (onOpenCreateTask || onOpenCreateOpenTask);

  if (list.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center gap-4 rounded-xl border border-dashed border-white/20 bg-white/[0.02] px-6 py-12 text-center">
        <CheckCircle2 className="h-12 w-12 text-base-content/30" aria-hidden />
        <p className="max-w-md text-sm text-base-content/70">{t('emptyTasksHint')}</p>
        {showLeadCtas && (
          <div className="flex w-full max-w-sm flex-col gap-2 sm:flex-row sm:justify-center">
            {onOpenCreateOpenTask && (
              <Button type="button" variant="outline" className="w-full sm:w-auto" onClick={onOpenCreateOpenTask}>
                {t('createOpenTask')}
              </Button>
            )}
            {onOpenCreateTask && (
              <Button type="button" className="w-full sm:w-auto" onClick={onOpenCreateTask}>
                {t('createTicket')}
              </Button>
            )}
          </div>
        )}
      </div>
    );
  }

  return (
    <ul className="space-y-3">
      {list.map(
        (ticket: {
          id: string;
          title?: string;
          content: string;
          ticketStatus?: string;
          beneficiaryId?: string;
          authorId: string;
          isNeutralTicket?: boolean;
          metrics?: { score?: number };
        }) => (
          <li key={ticket.id}>
            <TicketCard
              ticket={ticket}
              currentUserId={currentUserId}
              canModerateTickets={canModerateTickets}
            />
          </li>
        ),
      )}
    </ul>
  );
}
