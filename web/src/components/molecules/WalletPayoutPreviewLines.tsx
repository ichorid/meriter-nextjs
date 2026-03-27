'use client';

import { useMemo } from 'react';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { routes } from '@/lib/constants/routes';

export type WalletPayoutPreviewLine = {
  userId: string;
  amount: number;
  bucket: 'founder' | 'investor' | 'team';
  displayName?: string;
  percentOfPayout: number;
};

function floor2(n: number): number {
  return Math.floor(n * 100) / 100;
}

function formatMeritAmount(n: number): string {
  return new Intl.NumberFormat(undefined, {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(n);
}

function formatPercent(n: number): string {
  return new Intl.NumberFormat(undefined, {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(n);
}

export function WalletPayoutPreviewLines({
  lines,
  payoutAmount,
  className,
}: {
  lines: WalletPayoutPreviewLine[];
  /** Gross payout amount (same as the debit); used for total % per recipient. */
  payoutAmount: number;
  className?: string;
}) {
  const t = useTranslations('projects');

  const grouped = useMemo(() => {
    const order: string[] = [];
    const byUser = new Map<string, WalletPayoutPreviewLine[]>();
    for (const line of lines) {
      if (!byUser.has(line.userId)) {
        order.push(line.userId);
        byUser.set(line.userId, []);
      }
      byUser.get(line.userId)!.push(line);
    }
    return { order, byUser };
  }, [lines]);

  if (!lines.length) {
    return null;
  }

  const listClassName =
    className ??
    'max-h-[min(70vh,28rem)] min-h-[2.5rem] space-y-3 overflow-y-auto rounded-md border border-white/10 p-2 text-xs dark:border-white/10';

  return (
    <div className="flex flex-col gap-2">
      <p className="text-xs text-base-content/70">{t('payoutBreakdownHint')}</p>
      <ul className={listClassName}>
        {grouped.order.map((userId) => {
          const segments = grouped.byUser.get(userId)!;
          const displayName =
            segments[0]?.displayName?.trim() ||
            (userId.length > 8 ? `${userId.slice(0, 8)}…` : userId);
          const totalAmt = floor2(segments.reduce((s, x) => s + x.amount, 0));
          const totalPct =
            payoutAmount > 0 ? floor2((totalAmt / payoutAmount) * 100) : 0;
          const multi = segments.length > 1;

          const bucketLabel = (line: WalletPayoutPreviewLine) =>
            line.bucket === 'founder'
              ? t('payoutBucketFounder')
              : line.bucket === 'investor'
                ? t('payoutBucketInvestor')
                : t('payoutBucketTeam');

          if (!multi) {
            const line = segments[0]!;
            return (
              <li key={userId} className="rounded-md bg-base-200/40 p-2 dark:bg-base-100/10">
                <div className="flex flex-col gap-1 sm:flex-row sm:items-baseline sm:justify-between sm:gap-3">
                  <div className="min-w-0">
                    <Link
                      href={routes.userProfile(userId)}
                      className="font-medium text-primary underline-offset-2 hover:underline"
                    >
                      {displayName}
                    </Link>
                    <span className="text-base-content/75">
                      {' '}
                      — {bucketLabel(line)}
                    </span>
                  </div>
                  <div className="shrink-0 text-right tabular-nums">
                    <span className="font-medium text-base-content">+{formatMeritAmount(line.amount)}</span>
                    <span className="text-base-content/80"> · {formatPercent(line.percentOfPayout)}%</span>
                  </div>
                </div>
              </li>
            );
          }

          return (
            <li key={userId} className="rounded-md bg-base-200/40 p-2 dark:bg-base-100/10">
              <div className="flex items-start justify-between gap-3">
                <Link
                  href={routes.userProfile(userId)}
                  className="min-w-0 shrink font-medium text-primary underline-offset-2 hover:underline"
                >
                  {displayName}
                </Link>
                <div className="shrink-0 text-right tabular-nums">
                  <span className="font-medium text-base-content">
                    +{formatMeritAmount(totalAmt)}
                  </span>
                  <span className="text-base-content/80"> · {formatPercent(totalPct)}%</span>
                </div>
              </div>
              <ul className="mt-2 space-y-1 border-l border-base-content/15 pl-3 text-base-content/80">
                {segments.map((line) => (
                  <li
                    key={`${line.userId}-${line.bucket}`}
                    className="flex justify-between gap-3 tabular-nums"
                  >
                    <span className="min-w-0">{bucketLabel(line)}</span>
                    <span className="shrink-0 text-right">
                      +{formatMeritAmount(line.amount)} · {formatPercent(line.percentOfPayout)}%
                    </span>
                  </li>
                ))}
              </ul>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
