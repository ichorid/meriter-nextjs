'use client';

import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { Badge } from '@/components/ui/shadcn/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/shadcn/avatar';
import { TicketStatusBadge } from '@/components/molecules/TicketStatusBadge';
import { routes } from '@/lib/constants/routes';
import { cn } from '@/lib/utils';
import type { TicketStatus } from '@meriter/shared-types';

export type TicketPostUserPreview = {
  id?: string;
  name: string;
  photoUrl?: string;
  username?: string;
};

export interface TicketPostPageHeaderBlockProps {
  title?: string;
  publicationId: string;
  ticketStatus: TicketStatus;
  author: TicketPostUserPreview;
  assignee: TicketPostUserPreview | null;
  assigneeUnset?: boolean;
}

function ParticipantCard({
  label,
  user,
  placeholder,
}: {
  label: string;
  user: TicketPostUserPreview | null;
  placeholder?: string;
}) {
  const hasProfile = Boolean(user?.id);
  const displayName = user?.name?.trim() || placeholder || '—';

  const inner = hasProfile ? (
    <Link
      href={routes.userProfile(user!.id!)}
      className="flex min-w-0 items-center gap-3 rounded-lg outline-none transition-colors hover:bg-black/[0.04] focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background dark:hover:bg-white/[0.06]"
    >
      <Avatar className="h-10 w-10 shrink-0 border border-white/10">
        {user?.photoUrl ? <AvatarImage src={user.photoUrl} alt="" /> : null}
        <AvatarFallback userId={user!.id} className="text-sm font-medium">
          {displayName.slice(0, 1).toUpperCase()}
        </AvatarFallback>
      </Avatar>
      <div className="min-w-0 flex-1 text-left">
        <p className="truncate text-sm font-medium text-base-content">{displayName}</p>
        {user?.username ? (
          <p className="truncate text-xs text-base-content/50">@{user.username}</p>
        ) : null}
      </div>
    </Link>
  ) : (
    <div className="flex min-w-0 items-center gap-3">
      <Avatar className="h-10 w-10 shrink-0 border border-dashed border-white/20 bg-white/[0.06]">
        <AvatarFallback className="bg-transparent text-sm text-base-content/40">?</AvatarFallback>
      </Avatar>
      <p className="text-sm text-base-content/60">{displayName}</p>
    </div>
  );

  return (
    <div
      className={cn(
        'rounded-xl border border-white/10 bg-white/[0.04] p-3 sm:p-4',
        'shadow-none',
      )}
    >
      <p className="mb-3 text-[11px] font-semibold uppercase tracking-wide text-base-content/50">
        {label}
      </p>
      {inner}
    </div>
  );
}

export function TicketPostPageHeaderBlock({
  title,
  publicationId,
  ticketStatus,
  author,
  assignee,
  assigneeUnset,
}: TicketPostPageHeaderBlockProps) {
  const t = useTranslations('projects');

  return (
    <div className="mb-4 space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <Badge variant="default" className="rounded-full border-transparent font-semibold">
          {t('postTypeBadgeTicket')}
        </Badge>
        <TicketStatusBadge
          status={ticketStatus}
          className="border-emerald-500/35 bg-emerald-600/15 font-medium text-emerald-800 dark:border-emerald-400/30 dark:bg-emerald-500/15 dark:text-emerald-100"
        />
      </div>

      {title ? (
        <h1 className="text-xl font-bold leading-tight tracking-tight text-base-content sm:text-2xl">
          {title}
        </h1>
      ) : null}

      <p className="font-mono text-xs text-base-content/45 tabular-nums">{publicationId}</p>

      <div className="grid gap-3 sm:grid-cols-2">
        <ParticipantCard label={t('ticketAuthorLabel')} user={author} />
        <ParticipantCard
          label={t('beneficiary')}
          user={assignee}
          placeholder={assigneeUnset ? t('assigneeNotAssigned') : undefined}
        />
      </div>
    </div>
  );
}
