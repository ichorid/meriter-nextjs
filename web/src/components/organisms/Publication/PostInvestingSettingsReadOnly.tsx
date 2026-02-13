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
    defaultValue: 'Minimum rating for tappalka (0 = disabled)',
  });

  const noAuthorWalletSpendLabel = noAuthorWalletSpend
    ? tInvesting('noAuthorWalletSpendYes', { defaultValue: "Author won't spend from wallet on shows" })
    : tInvesting('noAuthorWalletSpendNo', { defaultValue: 'Author can spend from wallet on shows' });

  return (
    <dl className="space-y-3 text-sm">
      <div>
        <dt className="text-xs text-base-content/50 uppercase tracking-wide mb-0.5">
          {investorShareLabelKey}
        </dt>
        <dd className="text-base-content/80">{investorSharePercent}%</dd>
      </div>
      <div>
        <dt className="text-xs text-base-content/50 uppercase tracking-wide mb-0.5">
          {tAdvanced('ttlLabel', { defaultValue: 'Time to live (TTL)' })}
        </dt>
        <dd className="text-base-content/80">{ttlLabel}</dd>
      </div>
      <div>
        <dt className="text-xs text-base-content/50 uppercase tracking-wide mb-0.5">
          {stopLossLabelKey}
        </dt>
        <dd className="text-base-content/80">{stopLoss}</dd>
      </div>
      <div>
        <dt className="text-xs text-base-content/50 uppercase tracking-wide mb-0.5">
          {tAdvanced('noAuthorWalletSpendLabel', {
            defaultValue: "Don't spend from my wallet on tappalka shows",
          })}
        </dt>
        <dd className="text-base-content/80">{noAuthorWalletSpendLabel}</dd>
      </div>
    </dl>
  );
}
