'use client';

import React, { useMemo } from 'react';
import { useTranslations } from 'next-intl';

interface PostInvestingSettingsReadOnlyProps {
  /** Investor share % from contract */
  investorSharePercent?: number;
  /** TTL expiration date */
  ttlExpiresAt?: Date | string | null;
  /** Minimum rating for tappalka (stop-loss) */
  stopLoss?: number;
  /** Author won't spend from wallet on tappalka shows */
  noAuthorWalletSpend?: boolean;
}

export function PostInvestingSettingsReadOnly({
  investorSharePercent = 0,
  ttlExpiresAt = null,
  stopLoss = 0,
  noAuthorWalletSpend = false,
}: PostInvestingSettingsReadOnlyProps) {
  const tInvesting = useTranslations('investing');
  const tAdvanced = useTranslations('publications.create.advanced');

  const ttlLabel = useMemo(() => {
    if (!ttlExpiresAt) return tAdvanced('ttlIndefinite', { defaultValue: 'Indefinite' });
    const exp = typeof ttlExpiresAt === 'string' ? new Date(ttlExpiresAt) : ttlExpiresAt;
    const now = new Date();
    const diffMs = exp.getTime() - now.getTime();
    const days = Math.ceil(diffMs / (24 * 60 * 60 * 1000));
    return days > 0
      ? tInvesting('ttlClosesIn', { days, defaultValue: 'Closes in {days} days' })
      : tAdvanced('ttlIndefinite', { defaultValue: 'Indefinite' });
  }, [ttlExpiresAt, tInvesting, tAdvanced]);

  const tInvestingCreate = useTranslations('publications.create.investing');
  const investorShareLabelKey = tInvestingCreate('shareLabel', {
    defaultValue: 'Investor share (%)',
  });

  const stopLossLabelKey = tAdvanced('stopLossLabel', {
    defaultValue: 'Minimum rating for post carousel (0 = disabled)',
  });

  const authorPaysFromWalletLabel = tAdvanced('authorPaysShowsFromWalletQuestion', {
    defaultValue: 'Author pays for shows from wallet?',
  });
  const authorPaysFromWalletValue = noAuthorWalletSpend
    ? tAdvanced('answerNo', { defaultValue: 'No' })
    : tAdvanced('answerYes', { defaultValue: 'Yes' });

  const rows = [
    { label: investorShareLabelKey, value: `${investorSharePercent}%` },
    { label: tAdvanced('ttlLabel', { defaultValue: 'Time to live (TTL)' }), value: ttlLabel },
    { label: stopLossLabelKey, value: String(stopLoss) },
    { label: authorPaysFromWalletLabel, value: authorPaysFromWalletValue },
  ];

  return (
    <div className="rounded-lg bg-base-200/80 dark:bg-base-300/50 border border-base-300 dark:border-base-700 overflow-hidden">
      <div className="divide-y divide-base-300 dark:divide-base-700">
        {rows.map(({ label, value }) => (
          <div
            key={label}
            className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1 sm:gap-4 px-4 py-3 text-sm"
          >
            <span className="text-base-content/60 shrink-0">{label}</span>
            <span className="font-medium text-base-content tabular-nums sm:text-right break-words">
              {value}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
