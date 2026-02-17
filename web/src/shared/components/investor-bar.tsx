'use client';

import React, { useState } from 'react';
import { useTranslations } from 'next-intl';

export interface InvestorSegment {
  investorId: string;
  amount: number;
  sharePercent: number;
}

interface InvestorBarProps {
  investments: InvestorSegment[];
  investmentPool: number;
  investmentPoolTotal: number;
  investorSharePercent: number;
  /** Optional map of investorId -> display name for tooltips */
  investorNames?: Record<string, string>;
  /** When false, only the bar is shown (caption with total and pool is hidden). Default true. */
  showCaption?: boolean;
}

const SEGMENT_COLORS = [
  'bg-primary/80',
  'bg-secondary/80',
  'bg-accent/80',
  'bg-info/80',
  'bg-warning/80',
];

export const InvestorBar: React.FC<InvestorBarProps> = ({
  investments,
  investmentPool,
  investmentPoolTotal,
  investorSharePercent,
  investorNames = {},
  showCaption = true,
}) => {
  const t = useTranslations('investing');
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);

  const authorSharePercent = 100 - investorSharePercent;
  const totalInvested = investments.reduce((sum, i) => sum + i.amount, 0);

  if (investments.length === 0) {
    return (
      <div className="space-y-2">
        <div className="h-2 w-full rounded-full bg-base-content/10 overflow-hidden" />
        <p className="text-xs text-base-content/50">
          {t('noInvestorsYet', { defaultValue: 'No investors yet' })}
        </p>
        {investmentPoolTotal > 0 && (
          <p className="text-xs text-base-content/60">
            {t('poolTotal', {
              defaultValue: '{amount} merits in pool',
              amount: investmentPool,
            })}
          </p>
        )}
      </div>
    );
  }

  // Bar segments: author (left) + investors (right)
  const segments: Array<{ percent: number; label: string; color: string }> = [
    {
      percent: authorSharePercent,
      label: t('authorShare', { defaultValue: 'Author', percent: authorSharePercent }),
      color: 'bg-success/70',
    },
    ...investments.map((inv, idx) => ({
      percent: (inv.sharePercent / 100) * investorSharePercent,
      label: investorNames[inv.investorId] || `${t('investor', { defaultValue: 'Investor' })} ${idx + 1}: ${inv.sharePercent.toFixed(0)}%`,
      color: SEGMENT_COLORS[idx % SEGMENT_COLORS.length],
    })),
  ].filter((s) => s.percent > 0);

  return (
    <div className="space-y-2">
      <div
        className="h-2 w-full rounded-full overflow-hidden flex cursor-default"
        role="progressbar"
        aria-valuenow={100}
        aria-valuemin={0}
        aria-valuemax={100}
      >
        {segments.map((seg, idx) => (
          <div
            key={idx}
            className={`transition-opacity ${seg.color} ${
              hoveredIndex === idx ? 'opacity-100' : 'opacity-90'
            }`}
            style={{ width: `${seg.percent}%` }}
            title={seg.label}
            onMouseEnter={() => setHoveredIndex(idx)}
            onMouseLeave={() => setHoveredIndex(null)}
          >
            {seg.percent >= 8 && (
              <span className="sr-only">{seg.label}</span>
            )}
          </div>
        ))}
      </div>
      {showCaption && (
        <div className="flex justify-between items-center text-xs text-base-content/60">
          <span>
            {t('investedBy', {
              defaultValue: '{amount} merits from {count} investor(s)',
              amount: investmentPoolTotal,
              count: investments.length,
            })}
          </span>
          {investmentPool > 0 && (
            <span>
              {t('pool', { defaultValue: 'Pool: {amount}', amount: investmentPool })}
            </span>
          )}
        </div>
      )}
    </div>
  );
};
