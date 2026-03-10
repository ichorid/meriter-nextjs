'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { useTickets } from '@/hooks/api/useTickets';
import { TicketCard } from './TicketCard';
import type { TicketStatus } from '@meriter/shared-types';

interface TicketListProps {
  projectId: string;
  currentUserId: string;
  isLead: boolean;
}

const STATUS_FILTER_OPTIONS: { value: TicketStatus | 'all'; labelKey: string }[] = [
  { value: 'all', labelKey: 'filterAll' },
  { value: 'in_progress', labelKey: 'statusInProgress' },
  { value: 'done', labelKey: 'statusDone' },
  { value: 'closed', labelKey: 'statusClosed' },
  { value: 'open', labelKey: 'statusOpen' },
];

export function TicketList({ projectId, currentUserId, isLead }: TicketListProps) {
  const t = useTranslations('projects');
  const [statusFilter, setStatusFilter] = useState<TicketStatus | 'all'>('all');

  const { data: tickets, isLoading } = useTickets(projectId, {
    postType: 'ticket',
    ticketStatus: statusFilter === 'all' ? undefined : statusFilter,
  });

  if (isLoading) {
    return <p className="text-sm text-muted-foreground">Loading tasks…</p>;
  }

  const list = tickets ?? [];

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-sm font-medium">{t('ticket')}</span>
        <select
          className="rounded border bg-background px-2 py-1 text-sm"
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value as TicketStatus | 'all')}
        >
          {STATUS_FILTER_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {t(opt.labelKey)}
            </option>
          ))}
        </select>
      </div>
      {list.length === 0 ? (
        <p className="text-sm text-muted-foreground">{t('noTickets')}</p>
      ) : (
        <ul className="space-y-3">
          {list.map((ticket: { id: string; title?: string; content: string; ticketStatus?: string; beneficiaryId?: string; authorId: string; metrics?: { score?: number } }) => (
            <li key={ticket.id}>
              <TicketCard
                ticket={ticket}
                currentUserId={currentUserId}
                isLead={isLead}
              />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
