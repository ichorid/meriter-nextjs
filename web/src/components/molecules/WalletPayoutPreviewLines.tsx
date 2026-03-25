'use client';

import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { routes } from '@/lib/constants/routes';

export type WalletPayoutPreviewLine = {
  userId: string;
  amount: number;
  bucket: 'founder' | 'investor' | 'team';
  displayName?: string;
};

export function WalletPayoutPreviewLines({
  lines,
  className,
}: {
  lines: WalletPayoutPreviewLine[];
  className: string;
}) {
  const t = useTranslations('projects');

  if (!lines.length) {
    return null;
  }

  return (
    <ul className={className}>
      {lines.map((line) => {
        const label =
          line.displayName?.trim() ||
          (line.userId.length > 8 ? `${line.userId.slice(0, 8)}…` : line.userId);
        const bucket =
          line.bucket === 'founder'
            ? t('payoutBucketFounder')
            : line.bucket === 'investor'
              ? t('payoutBucketInvestor')
              : t('payoutBucketTeam');
        return (
          <li key={`${line.userId}-${line.bucket}`} className="flex justify-between gap-2">
            <Link
              href={routes.userProfile(line.userId)}
              className="min-w-0 truncate text-left text-primary underline-offset-2 hover:underline"
            >
              {label}
            </Link>
            <span className="shrink-0 tabular-nums">
              +{line.amount} ({bucket})
            </span>
          </li>
        );
      })}
    </ul>
  );
}
