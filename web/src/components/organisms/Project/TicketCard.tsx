'use client';

import { useTranslations } from 'next-intl';
import { TicketStatusBadge } from '@/components/molecules/TicketStatusBadge';
import { useUserProfile } from '@/hooks/api/useUsers';
import { useUpdateTicketStatus, useAcceptWork } from '@/hooks/api/useTickets';
import { Button } from '@/components/ui/shadcn/button';
import { ApplicantsPanel } from './ApplicantsPanel';
import type { TicketStatus } from '@meriter/shared-types';

interface TicketCardProps {
  ticket: {
    id: string;
    title?: string;
    content: string;
    ticketStatus?: TicketStatus;
    beneficiaryId?: string;
    authorId: string;
    isNeutralTicket?: boolean;
    metrics?: { score?: number };
  };
  currentUserId: string;
  isLead: boolean;
}

export function TicketCard({ ticket, currentUserId, isLead }: TicketCardProps) {
  const t = useTranslations('projects');
  const updateStatus = useUpdateTicketStatus();
  const acceptWork = useAcceptWork();

  const status = (ticket.ticketStatus ?? 'in_progress') as TicketStatus;
  const beneficiaryId = ticket.beneficiaryId ?? ticket.authorId;
  const isBeneficiary = currentUserId === beneficiaryId;
  const isOpenNeutral = status === 'open' && ticket.isNeutralTicket;

  const canMarkDone = isBeneficiary && status === 'in_progress';
  const canAccept = isLead && status === 'done';

  return (
    <div className="rounded-lg border bg-card p-4 text-card-foreground shadow-sm">
      <div className="flex flex-wrap items-center gap-2">
        <TicketStatusBadge status={status} />
        {ticket.title && (
          <span className="font-medium">{ticket.title}</span>
        )}
      </div>
      <p className="mt-2 text-sm text-muted-foreground line-clamp-2">
        {ticket.content}
      </p>
      <div className="mt-2 flex items-center justify-between gap-2">
        {!isOpenNeutral && <BeneficiaryLabel userId={beneficiaryId} />}
        <div className="flex gap-2">
          {canMarkDone && (
            <Button
              size="sm"
              variant="secondary"
              onClick={() => updateStatus.mutate({ ticketId: ticket.id, newStatus: 'done' })}
              disabled={updateStatus.isPending}
            >
              {t('markDone')}
            </Button>
          )}
          {canAccept && (
            <Button
              size="sm"
              onClick={() => acceptWork.mutate({ ticketId: ticket.id })}
              disabled={acceptWork.isPending}
            >
              {t('acceptWork')}
            </Button>
          )}
        </div>
      </div>
      {isLead && isOpenNeutral && (
        <div className="mt-3 pt-3 border-t">
          <ApplicantsPanel ticketId={ticket.id} />
        </div>
      )}
    </div>
  );
}

function BeneficiaryLabel({ userId }: { userId: string }) {
  const { data: user } = useUserProfile(userId);
  const label = user?.displayName ?? user?.username ?? userId.slice(0, 8);
  const t = useTranslations('projects');
  return (
    <span className="text-xs text-muted-foreground">
      {t('beneficiary')}: {label}
    </span>
  );
}
