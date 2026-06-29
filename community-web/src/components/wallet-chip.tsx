'use client';

import Link from 'next/link';

type WalletChipProps = {
  communityId: string;
  wallet: number;
  quotaRemaining: number;
  quotaMax: number;
};

export function WalletChip({
  communityId,
  wallet,
  quotaRemaining,
  quotaMax,
}: WalletChipProps) {
  return (
    <Link
      href={`/c/${communityId}/me`}
      className="rounded-lg bg-stitch-surface px-2.5 py-1 text-xs font-medium text-stitch-muted hover:text-primary"
    >
      {wallet} засл. · квота {quotaRemaining}/{quotaMax}
    </Link>
  );
}
