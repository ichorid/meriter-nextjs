'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useLocale, useTranslations } from 'next-intl';
import { TicketStatusBadge } from '@/components/molecules/TicketStatusBadge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/shadcn/avatar';
import { useUserProfile } from '@/hooks/api/useUsers';
import {
  useApplyForTicket,
  useUpdateTicketStatus,
  useAcceptWork,
  useDeclineAsAssignee,
} from '@/hooks/api/useTickets';
import { Button } from '@/components/ui/shadcn/button';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/shadcn/dialog';
import { Label } from '@/components/ui/shadcn/label';
import { Textarea } from '@/components/ui/shadcn/textarea';
import { ApplicantsPanel } from './ApplicantsPanel';
import { routes } from '@/lib/constants/routes';
import { plainTextExcerpt } from '@/lib/utils/plain-text-excerpt';
import { cn } from '@/lib/utils';
import type { TicketStatus } from '@meriter/shared-types';

interface TicketCardProps {
  projectId: string;
  /** Lead or superadmin: accept work, reopen closed, manage neutral applicants. */
  canModerateTickets: boolean;
  ticket: {
    id: string;
    title?: string;
    content: string;
    ticketStatus?: TicketStatus | string;
    beneficiaryId?: string;
    authorId: string;
    isNeutralTicket?: boolean;
    applicants?: string[];
    metrics?: { score?: number };
  };
  currentUserId: string;
}

export function TicketCard({
  projectId,
  ticket,
  currentUserId,
  canModerateTickets,
}: TicketCardProps) {
  const t = useTranslations('projects');
  const locale = useLocale();
  const updateStatus = useUpdateTicketStatus();
  const acceptWork = useAcceptWork();
  const applyForTicket = useApplyForTicket();
  const declineAsAssignee = useDeclineAsAssignee();
  const [declineOpen, setDeclineOpen] = useState(false);
  const [declineReason, setDeclineReason] = useState('');

  const status = (ticket.ticketStatus ?? 'in_progress') as TicketStatus;
  const beneficiaryId = ticket.beneficiaryId ?? ticket.authorId;
  const isBeneficiary = currentUserId === beneficiaryId;
  const isOpenNeutral = status === 'open' && Boolean(ticket.isNeutralTicket);
  const applicants = ticket.applicants ?? [];
  const canTakeOpenNeutral =
    isOpenNeutral &&
    currentUserId !== ticket.authorId &&
    !applicants.includes(currentUserId);
  const hasAppliedForOpenNeutral =
    isOpenNeutral && currentUserId !== ticket.authorId && applicants.includes(currentUserId);

  const canMarkDone = isBeneficiary && status === 'in_progress';
  const canDeclineAssignee =
    status === 'in_progress' && Boolean(ticket.beneficiaryId) && ticket.beneficiaryId === currentUserId;
  const canAccept = canModerateTickets && status === 'done';
  const canReopen = canModerateTickets && status === 'closed';

  const submitDecline = () => {
    const r = declineReason.trim();
    if (!r) return;
    declineAsAssignee.mutate(
      { ticketId: ticket.id, reason: r, locale },
      {
        onSuccess: () => {
          setDeclineOpen(false);
          setDeclineReason('');
        },
      },
    );
  };

  return (
    <div
      className={cn(
        'rounded-xl border border-white/10 bg-white/5 text-card-foreground shadow-none',
        'transition-colors duration-200 hover:bg-white/[0.07]',
      )}
    >
      <Link
        href={routes.communityPost(projectId, ticket.id)}
        className="block p-4 pb-3 outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
      >
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0 flex-1 space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              <TicketStatusBadge status={status} className="border-white/10 bg-white/10" />
              {ticket.title && <span className="font-medium text-base-content">{ticket.title}</span>}
            </div>
            <p className="text-sm text-base-content/70 line-clamp-2">
              {plainTextExcerpt(ticket.content)}
            </p>
            {!isOpenNeutral && <BeneficiaryLabel userId={beneficiaryId} />}
          </div>
          <BeneficiaryAvatar userId={beneficiaryId} isOpenNeutral={isOpenNeutral} />
        </div>
      </Link>
      <div className="flex flex-wrap items-center justify-end gap-2 px-4 pb-4">
          {canTakeOpenNeutral && (
            <Button
              type="button"
              size="sm"
              variant="secondary"
              onClick={() => applyForTicket.mutate({ ticketId: ticket.id })}
              disabled={applyForTicket.isPending}
            >
              {applyForTicket.isPending ? '…' : t('iWillTake')}
            </Button>
          )}
          {hasAppliedForOpenNeutral && (
            <span className="text-xs text-base-content/60">{t('alreadyApplied')}</span>
          )}
          {canDeclineAssignee && (
            <Button
              type="button"
              size="sm"
              variant="destructive"
              onClick={() => setDeclineOpen(true)}
              disabled={declineAsAssignee.isPending}
            >
              {t('declineAssignee')}
            </Button>
          )}
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
          {canReopen && (
            <Button
              size="sm"
              variant="outline"
              onClick={() =>
                updateStatus.mutate({ ticketId: ticket.id, newStatus: 'in_progress' })
              }
              disabled={updateStatus.isPending}
            >
              {t('reopenTask')}
            </Button>
          )}
      </div>
      {canModerateTickets && isOpenNeutral && (
        <div className="border-t border-white/10 px-4 pb-4 pt-3">
          <ApplicantsPanel ticketId={ticket.id} />
        </div>
      )}

      <Dialog open={declineOpen} onOpenChange={setDeclineOpen}>
        <DialogContent className="sm:max-w-md" onCloseAutoFocus={() => setDeclineReason('')}>
          <DialogHeader>
            <DialogTitle>{t('declineAssigneeTitle')}</DialogTitle>
          </DialogHeader>
          <div className="space-y-2 py-1">
            <Label htmlFor={`decline-reason-${ticket.id}`}>{t('declineAssigneeReasonLabel')}</Label>
            <Textarea
              id={`decline-reason-${ticket.id}`}
              value={declineReason}
              onChange={(e) => setDeclineReason(e.target.value)}
              placeholder={t('declineAssigneeReasonPlaceholder')}
              className="min-h-[100px] resize-y"
              maxLength={2000}
            />
          </div>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button type="button" variant="outline" onClick={() => setDeclineOpen(false)}>
              {t('cancel')}
            </Button>
            <Button
              type="button"
              variant="destructive"
              disabled={declineReason.trim().length === 0 || declineAsAssignee.isPending}
              onClick={submitDecline}
            >
              {declineAsAssignee.isPending ? '…' : t('declineAssigneeConfirm')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
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
