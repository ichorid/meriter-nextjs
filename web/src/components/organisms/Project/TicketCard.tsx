'use client';

import { useTranslations } from 'next-intl';
import { TicketStatusBadge } from '@/components/molecules/TicketStatusBadge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/shadcn/avatar';
import { useUserProfile } from '@/hooks/api/useUsers';
import { useUpdateTicketStatus, useAcceptWork } from '@/hooks/api/useTickets';
import { Button } from '@/components/ui/shadcn/button';
import { ApplicantsPanel } from './ApplicantsPanel';
import { cn } from '@/lib/utils';
import type { TicketStatus } from '@meriter/shared-types';

interface TicketCardProps {
  ticket: {
    id: string;
    title?: string;
    content: string;
    ticketStatus?: TicketStatus | string;
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
  const isOpenNeutral = status === 'open' && Boolean(ticket.isNeutralTicket);

  const canMarkDone = isBeneficiary && status === 'in_progress';
  const canAccept = isLead && status === 'done';

  return (
    <div
      className={cn(
        'rounded-xl border border-white/10 bg-white/5 p-4 text-card-foreground shadow-none',
        'transition-colors duration-200 hover:bg-white/[0.07]',
      )}
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 flex-1 space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <TicketStatusBadge status={status} className="border-white/10 bg-white/10" />
            {ticket.title && <span className="font-medium text-base-content">{ticket.title}</span>}
          </div>
          <p className="text-sm text-base-content/70 line-clamp-2">{ticket.content}</p>
          {!isOpenNeutral && <BeneficiaryLabel userId={beneficiaryId} />}
        </div>
        <BeneficiaryAvatar userId={beneficiaryId} isOpenNeutral={isOpenNeutral} />
      </div>
      <div className="mt-3 flex flex-wrap justify-end gap-2">
        <div className="flex flex-wrap gap-2">
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
        <div className="mt-3 pt-3 border-t border-white/10">
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
    <span className="text-xs text-base-content/60">
      {t('beneficiary')}: {label}
    </span>
  );
}

function BeneficiaryAvatar({ userId, isOpenNeutral }: { userId: string; isOpenNeutral: boolean }) {
  const { data: user } = useUserProfile(userId);
  if (isOpenNeutral) {
    return (
      <div
        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-white/10 bg-white/10 text-sm font-medium text-base-content/60"
        aria-hidden
      >
        ?
      </div>
    );
  }
  const label = (user?.displayName ?? user?.username ?? userId).slice(0, 2).toUpperCase();
  const src = user?.avatarUrl?.trim() || undefined;
  return (
    <Avatar className="h-9 w-9 shrink-0 border border-white/10">
      {src ? <AvatarImage src={src} alt="" /> : null}
      <AvatarFallback className="text-xs font-medium">{label || '?'}</AvatarFallback>
    </Avatar>
  );
}
