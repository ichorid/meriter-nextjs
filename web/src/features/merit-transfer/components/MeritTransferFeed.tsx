'use client';

import React, { useMemo } from 'react';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { Avatar, AvatarFallback } from '@/components/ui/shadcn/avatar';
import { routes } from '@/lib/constants/routes';
import { cn } from '@/lib/utils';
import type { MeritTransferListItem, MeritTransferFeedMode } from '../types';
import type { MeritTransferWalletType } from '@meriter/shared-types';

export interface MeritTransferFeedProps {
  items: MeritTransferListItem[];
  /** Reserved for layout/labels when parent differentiates community vs profile tabs. */
  mode: MeritTransferFeedMode;
  isLoading?: boolean;
  className?: string;
}

function formatWhen(iso: string): string {
  try {
    return new Intl.DateTimeFormat(undefined, {
      dateStyle: 'medium',
      timeStyle: 'short',
    }).format(new Date(iso));
  } catch {
    return iso;
  }
}

function UserAvatarLink({ userId }: { userId: string }) {
  return (
    <Link
      href={routes.userProfile(userId)}
      className="shrink-0 rounded-full ring-offset-background transition-opacity hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
    >
      <Avatar className="h-9 w-9">
        <AvatarFallback userId={userId} className="text-xs font-medium uppercase" />
      </Avatar>
    </Link>
  );
}

export function MeritTransferFeed({
  items,
  mode,
  isLoading = false,
  className,
}: MeritTransferFeedProps) {
  const t = useTranslations('meritTransfer');

  const walletLabel = useMemo(
    () =>
      (type: MeritTransferWalletType): string => {
        if (type === 'global') return t('walletBadgeGlobal');
        if (type === 'project') return t('walletBadgeProject');
        return t('walletBadgeCommunity');
      },
    [t],
  );

  if (isLoading) {
    return (
      <p className={cn('text-sm text-base-content/60', className)}>{t('feedLoading')}</p>
    );
  }

  if (!items.length) {
    return <p className={cn('text-sm text-base-content/60', className)}>{t('feedEmpty')}</p>;
  }

  return (
    <ul className={cn('flex flex-col gap-3', className)} role="list" data-merit-transfer-mode={mode}>
      {items.map((row) => (
        <li
          key={row.id}
          className="rounded-lg border border-base-content/10 bg-base-100 p-3 shadow-sm"
        >
          <div className="flex flex-wrap items-center gap-2">
            <UserAvatarLink userId={row.senderId} />
            <span className="text-base-content/50" aria-hidden>
              →
            </span>
            <UserAvatarLink userId={row.receiverId} />
            <span className="ml-auto text-lg font-semibold tabular-nums">
              {t('feedAmount', { amount: row.amount })}
            </span>
          </div>
          <p className="mt-2 text-xs text-base-content/60">
            {walletLabel(row.sourceWalletType)} → {walletLabel(row.targetWalletType)}
          </p>
          {row.comment ? (
            <p className="mt-2 whitespace-pre-wrap text-sm text-base-content/90">{row.comment}</p>
          ) : null}
          <p className="mt-2 text-xs text-base-content/50">{formatWhen(row.createdAt)}</p>
        </li>
      ))}
    </ul>
  );
}
