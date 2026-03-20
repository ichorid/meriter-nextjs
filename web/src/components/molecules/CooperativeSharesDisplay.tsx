'use client';

import { useTranslations } from 'next-intl';

export interface CooperativeSharesDisplayProps {
  founderSharePercent: number;
  investorSharePercent: number;
}

export function CooperativeSharesDisplay({
  founderSharePercent,
  investorSharePercent,
}: CooperativeSharesDisplayProps) {
  const t = useTranslations('projects');
  const other = Math.max(0, 100 - founderSharePercent - investorSharePercent);

  if (founderSharePercent === 0 && investorSharePercent === 0) {
    return null;
  }

  return (
    <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
      {founderSharePercent > 0 && (
        <span>
          {t('founderShare')}: {founderSharePercent}%
        </span>
      )}
      {investorSharePercent > 0 && (
        <span>
          {t('investorShare')}: {investorSharePercent}%
        </span>
      )}
      {other > 0 && (
        <span>
          {t('otherShare')}: {other}%
        </span>
      )}
    </div>
  );
}
