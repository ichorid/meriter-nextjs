'use client';

import { useEffect, useRef } from 'react';
import { useTranslations } from 'next-intl';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
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
  /** Publication id of the ticket to scroll to / highlight (from ?highlight=). */
  highlightTicketId?: string | null;
  onOpenCreateTask?: () => void;
  /** Pilot: do not link task cards to full Meriter post URLs. */
  blockMeriterNavigation?: boolean;
}

export function TicketList({
  projectId,
  currentUserId,
  canModerateTickets,
  statusFilter,
  highlightTicketId,
  onOpenCreateTask,
  blockMeriterNavigation = false,
}: TicketListProps) {
  const t = useTranslations('projects');
  const tCommon = useTranslations('common');
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const clearedHighlightRef = useRef(false);

  useEffect(() => {
    clearedHighlightRef.current = false;
  }, [highlightTicketId]);

  const { data: tickets, isLoading } = useTickets(projectId, {
    postType: 'ticket',
    ticketStatus: statusFilter === 'all' ? undefined : statusFilter,
  });

  const list = tickets ?? [];
  const showLeadCtas = canModerateTickets && onOpenCreateTask;

  useEffect(() => {
    if (!highlightTicketId || isLoading || list.length === 0) {
      return;
    }
    const el = document.getElementById(`project-ticket-${highlightTicketId}`);
    if (!el) {
      return;
    }
    el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    const timer = window.setTimeout(() => {
      if (clearedHighlightRef.current) return;
      clearedHighlightRef.current = true;
      const params = new URLSearchParams(searchParams.toString());
      params.delete('highlight');
      const q = params.toString();
      router.replace(`${pathname}${q ? `?${q}` : ''}`, { scroll: false });
    }, 2500);
    return () => window.clearTimeout(timer);
  }, [highlightTicketId, isLoading, list.length, pathname, router, searchParams, tickets]);

  if (isLoading) {
    return <p className="text-sm text-base-content/60">{tCommon('loading')}</p>;
  }

  if (list.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center gap-4 rounded-xl border border-dashed border-white/20 bg-white/[0.02] px-6 py-12 text-center">
        <CheckCircle2 className="h-12 w-12 text-base-content/30" aria-hidden />
        <p className="max-w-md text-sm text-base-content/70">{t('emptyTasksHint')}</p>
        {showLeadCtas && (
          <div className="flex w-full max-w-sm flex-col gap-2 sm:flex-row sm:justify-center">
            <Button type="button" className="w-full sm:w-auto" onClick={onOpenCreateTask}>
              {t('createTicket')}
            </Button>
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
          applicants?: string[];
          metrics?: { score?: number; upvotes?: number };
        }) => (
          <li key={ticket.id} id={`project-ticket-${ticket.id}`}>
            <TicketCard
              projectId={projectId}
              ticket={ticket}
              currentUserId={currentUserId}
              canModerateTickets={canModerateTickets}
              highlighted={Boolean(highlightTicketId && ticket.id === highlightTicketId)}
              blockMeriterNavigation={blockMeriterNavigation}
            />
          </li>
        ),
      )}
    </ul>
  );
}
