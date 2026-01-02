'use client';

import React from 'react';
import { DailyQuotaRing } from '@/components/molecules/DailyQuotaRing';
import { useTranslations } from 'next-intl';

interface QuotaDisplayProps {
  balance?: number;
  quotaRemaining?: number;
  quotaMax?: number;
  currencyIconUrl?: string;
  isMarathonOfGood?: boolean;
  showPermanent?: boolean;
  showDaily?: boolean;
  compact?: boolean;
  className?: string;
}

export function QuotaDisplay({
  balance,
  quotaRemaining = 0,
  quotaMax = 0,
  currencyIconUrl,
  isMarathonOfGood = false,
  showPermanent = true,
  showDaily = true,
  compact = false,
  className = '',
}: QuotaDisplayProps) {
  const tCommon = useTranslations('common');
  const tCommunities = useTranslations('pages.communities');

  const hasPermanent = showPermanent && balance !== undefined;
  const hasDaily = showDaily && quotaMax > 0;

  if (!hasPermanent && !hasDaily) {
    return null;
  }

  if (compact) {
    return (
      <div className={`flex items-center gap-3 text-xs ${className}`}>
        {hasDaily && (
          <div className="flex items-center gap-1">
            <DailyQuotaRing
              remaining={quotaRemaining}
              max={quotaMax}
              className="w-4 h-4 flex-shrink-0"
              asDiv={true}
              variant={isMarathonOfGood ? 'golden' : 'default'}
            />
          </div>
        )}
        {hasPermanent && (
          <div className="flex items-center gap-1">
            <span className="text-base-content/60">{tCommon('yourMerits')}:</span>
            <span className="font-semibold text-base-content">{balance}</span>
            {currencyIconUrl && (
              <img
                src={currencyIconUrl}
                alt={tCommunities('currency')}
                className="w-3 h-3 flex-shrink-0"
              />
            )}
          </div>
        )}
      </div>
    );
  }

  return (
    <div className={`flex items-center gap-4 ${className}`}>
      {hasDaily && (
        <div className="flex items-center gap-1.5 text-sm">
          <DailyQuotaRing
            remaining={quotaRemaining}
            max={quotaMax}
            className="w-6 h-6 flex-shrink-0"
            asDiv={true}
            variant={isMarathonOfGood ? 'golden' : 'default'}
          />
        </div>
      )}
      {hasPermanent && (
        <div className="flex items-center gap-1.5 text-sm">
          <span className="text-base-content/60">{tCommon('yourMerits')}:</span>
          <span className="font-semibold text-base-content">{balance}</span>
          {currencyIconUrl && (
            <img
              src={currencyIconUrl}
              alt={tCommunities('currency')}
              className="w-4 h-4 flex-shrink-0"
            />
          )}
        </div>
      )}
    </div>
  );
}

