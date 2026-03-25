'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useLocale, useTranslations } from 'next-intl';
import { TicketStatusBadge } from '@/components/molecules/TicketStatusBadge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/shadcn/avatar';
import { useUserProfile } from '@/hooks/api/useUsers';
import {
  useApplyForTicket,
  useTakeOpenNeutralAsModerator,
  useUpdateTicketStatus,
  useAcceptWork,
  useReturnWorkForRevision,
  useDeclineAsAssignee,
} from '@/hooks/api/useTickets';
import { Button } from '@/components/ui/shadcn/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/shadcn/dialog';
import { Label } from '@/components/ui/shadcn/label';
import { Textarea } from '@/components/ui/shadcn/textarea';
import { ApplicantsPanel } from './ApplicantsPanel';
import { routes } from '@/lib/constants/routes';
import { plainTextExcerpt } from '@/lib/utils/plain-text-excerpt';
import { ticketHasWorkAccepted } from '@/lib/utils/project-ticket';
import { cn } from '@/lib/utils';
import type { TicketStatus } from '@meriter/shared-types';

interface TicketCardProps {
  projectId: string;
  /** Lead or superadmin: accept work, reopen closed, manage neutral applicants. */
  canModerateTickets: boolean;
  /** Deep-link focus (e.g. from notification URL ?highlight=). */
  highlighted?: boolean;
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
    ticketActivityLog?: Array<{ action?: string }>;
  };
  currentUserId: string;
}

export function TicketCard({
  projectId,
  ticket,
  currentUserId,
  canModerateTickets,
  highlighted = false,
}: TicketCardProps) {
  const t = useTranslations('projects');
  const tComments = useTranslations('comments');
  const locale = useLocale();
  const updateStatus = useUpdateTicketStatus();
  const acceptWork = useAcceptWork();
  const returnWorkForRevision = useReturnWorkForRevision();
  const applyForTicket = useApplyForTicket();
  const takeOpenNeutralAsModerator = useTakeOpenNeutralAsModerator();
  const declineAsAssignee = useDeclineAsAssignee();
  const [declineOpen, setDeclineOpen] = useState(false);
  const [declineReason, setDeclineReason] = useState('');
  const [returnRevisionOpen, setReturnRevisionOpen] = useState(false);
  const [returnRevisionReason, setReturnRevisionReason] = useState('');

  const status = (ticket.ticketStatus ?? 'in_progress') as TicketStatus;
  const beneficiaryId = ticket.beneficiaryId ?? ticket.authorId;
  const isBeneficiary = currentUserId === beneficiaryId;
  const isOpenNeutral = status === 'open' && Boolean(ticket.isNeutralTicket);
  const applicants = ticket.applicants ?? [];
  const canTakeOpenNeutralAsModerator = isOpenNeutral && canModerateTickets;
  const canTakeOpenNeutralAsMember =
    isOpenNeutral && !canModerateTickets && !applicants.includes(currentUserId);
  const hasAppliedForOpenNeutral =
    isOpenNeutral && !canModerateTickets && applicants.includes(currentUserId);

  const canMarkDone = isBeneficiary && status === 'in_progress';
  const canDeclineAssignee =
    status === 'in_progress' && Boolean(ticket.beneficiaryId) && ticket.beneficiaryId === currentUserId;
  const canAccept = canModerateTickets && status === 'done';
  const canReopen = canModerateTickets && status === 'closed';
  const showAppreciationVote =
    status === 'closed' && ticketHasWorkAccepted(ticket) && Boolean(currentUserId);

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

  const submitReturnForRevision = () => {
    const r = returnRevisionReason.trim();
    if (!r) return;
    returnWorkForRevision.mutate(
      { ticketId: ticket.id, reason: r, locale },
      {
        onSuccess: () => {
          setReturnRevisionOpen(false);
          setReturnRevisionReason('');
        },
      },
    );
  };

  return (
    <div
      className={cn(
        'rounded-xl border border-white/10 bg-white/5 text-card-foreground shadow-none',
        'transition-colors duration-200 hover:bg-white/[0.07]',
        highlighted && 'ring-2 ring-blue-500/80 ring-offset-2 ring-offset-background',
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
          {canTakeOpenNeutralAsModerator && (
            <Button
              type="button"
              size="sm"
              variant="secondary"
              onClick={() => takeOpenNeutralAsModerator.mutate({ ticketId: ticket.id })}
              disabled={takeOpenNeutralAsModerator.isPending}
            >
              {takeOpenNeutralAsModerator.isPending ? '…' : t('takeTask')}
            </Button>
          )}
          {canTakeOpenNeutralAsMember && (
            <Button
              type="button"
              size="sm"
              variant="secondary"
              onClick={() => applyForTicket.mutate({ ticketId: ticket.id })}
              disabled={applyForTicket.isPending}
            >
              {applyForTicket.isPending ? '…' : t('takeTask')}
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
            <>
              <Button
                type="button"
                size="sm"
                variant="destructive"
                onClick={() => setReturnRevisionOpen(true)}
                disabled={returnWorkForRevision.isPending || acceptWork.isPending}
              >
                {t('returnForRevision')}
              </Button>
              <Button
                type="button"
                size="sm"
                onClick={() => acceptWork.mutate({ ticketId: ticket.id })}
                disabled={acceptWork.isPending || returnWorkForRevision.isPending}
              >
                {t('acceptWork')}
              </Button>
            </>
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
          {showAppreciationVote && (
            <Button size="sm" variant="default" className="h-8 px-2 sm:px-4 text-xs" asChild>
              <Link href={routes.communityPost(projectId, ticket.id)}>{tComments('voteTitle')}</Link>
            </Button>
          )}
      </div>
      {canModerateTickets && isOpenNeutral && (
        <div className="border-t border-white/10 px-4 pb-4 pt-3">
          <ApplicantsPanel ticketId={ticket.id} />
        </div>
      )}

      <Dialog
        open={returnRevisionOpen}
        onOpenChange={setReturnRevisionOpen}
      >
        <DialogContent
          className="sm:max-w-md"
          onCloseAutoFocus={() => setReturnRevisionReason('')}
        >
          <DialogHeader>
            <DialogTitle>{t('returnForRevisionTitle')}</DialogTitle>
            <DialogDescription className="sr-only">
              {t('returnForRevisionReasonLabel')}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2 py-1">
            <Label htmlFor={`return-revision-${ticket.id}`}>{t('returnForRevisionReasonLabel')}</Label>
            <Textarea
              id={`return-revision-${ticket.id}`}
              value={returnRevisionReason}
              onChange={(e) => setReturnRevisionReason(e.target.value)}
              placeholder={t('returnForRevisionReasonPlaceholder')}
              className="min-h-[100px] resize-y"
              maxLength={2000}
            />
          </div>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button type="button" variant="outline" onClick={() => setReturnRevisionOpen(false)}>
              {t('cancel')}
            </Button>
            <Button
              type="button"
              variant="destructive"
              disabled={
                returnRevisionReason.trim().length === 0 || returnWorkForRevision.isPending
              }
              onClick={submitReturnForRevision}
            >
              {returnWorkForRevision.isPending ? '…' : t('returnForRevisionConfirm')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

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
