'use client';

import React, { useState } from 'react';
import { useTranslations } from 'next-intl';
import Link from 'next/link';
import { Loader2, Info } from 'lucide-react';
import { trpc } from '@/lib/trpc/client';
import { InvestorBar } from '@/shared/components/investor-bar';
import { routes } from '@/lib/constants/routes';
import { formatMerits } from '@/lib/utils/currency';

interface InvestmentBreakdownInlineProps {
  postId: string;
  /** When true, omit header and outer styling (for use inside CollapsibleSection) */
  compact?: boolean;
}

function formatDate(d: Date | string): string {
  const date = typeof d === 'string' ? new Date(d) : d;
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: 'short',
  }).format(date);
}

export function InvestmentBreakdownInline({ postId, compact = false }: InvestmentBreakdownInlineProps) {
  const t = useTranslations('investing');

  const { data: breakdown, isLoading } = trpc.investments.getInvestmentBreakdown.useQuery(
    { postId },
    { enabled: !!postId }
  );

  const segments = React.useMemo(() => {
    if (!breakdown?.investors) return [];
    return breakdown.investors.map((inv) => ({
      investorId: inv.userId,
      amount: inv.amount,
      sharePercent: inv.sharePercent,
    }));
  }, [breakdown?.investors]);

  const investorNames = React.useMemo(() => {
    if (!breakdown?.investors) return {};
    return Object.fromEntries(
      breakdown.investors.map((inv) => [inv.userId, inv.username])
    );
  }, [breakdown?.investors]);

  const [poolTooltipOpen, setPoolTooltipOpen] = useState(false);

  if (isLoading && !breakdown) {
    return (
      <div className="py-8 flex items-center justify-center text-base-content/60 rounded-lg bg-base-200/80 border border-base-300 dark:border-base-700">
        <Loader2 className="w-8 h-8 animate-spin" />
      </div>
    );
  }

  if (!breakdown) return null;

  const authorSharePercent = 100 - breakdown.contractPercent;
  const investorCount = breakdown.investors.length;
  const poolValue =
    investorCount === 0
      ? t('meritsInPool', { amount: formatMerits(breakdown.poolBalance) })
      : t('poolValueFromInvestors', {
          amount: formatMerits(breakdown.poolBalance),
          count: investorCount,
          defaultValue: '{amount} from {count} investor(s)',
        });
  const poolTooltipText = t('poolTooltip');

  const content = (
    <div className="rounded-lg bg-base-200/80 dark:bg-base-300/50 border border-base-300 dark:border-base-700 overflow-hidden">
      {/* Contract: single clear line */}
      <div className="divide-y divide-base-300 dark:divide-base-700">
        <div className="px-4 py-3 text-sm">
          <span className="text-base-content/80">
            {t('contractSplit', {
              author: authorSharePercent,
              investors: breakdown.contractPercent,
              defaultValue: 'Author {author}%, investors {investors}%',
            })}
          </span>
        </div>
        {/* Pool with tooltip (hover + tap on icon for mobile) */}
        <div className="px-4 py-3 text-sm">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1 sm:gap-4">
            <span
              className="inline-flex items-center gap-1.5 text-base-content/60"
              title={poolTooltipText}
            >
              {t('poolLabel', { defaultValue: 'Pool' })}
              <button
                type="button"
                className="p-0.5 rounded-full text-base-content/50 hover:text-base-content/80 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                aria-label={poolTooltipText}
                title={poolTooltipText}
                onClick={() => setPoolTooltipOpen((v) => !v)}
              >
                <Info className="w-4 h-4" />
              </button>
            </span>
            <span className="font-medium text-base-content tabular-nums sm:text-right">{poolValue}</span>
          </div>
          {poolTooltipOpen && (
            <p className="mt-2 text-xs text-base-content/60">{poolTooltipText}</p>
          )}
        </div>
      </div>

      {/* Investors: Total investments + bar + list */}
      {breakdown.investors.length > 0 && (
        <div className="border-t border-base-300 dark:border-base-700">
          <div className="px-4 py-2.5 bg-base-300/30 dark:bg-base-700/30">
            <span className="text-sm font-medium text-base-content/80">{t('investorList', { defaultValue: 'Investors' })}</span>
          </div>
          <div className="px-4 py-3 space-y-2">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1 text-sm">
              <span className="text-base-content/60">{t('totalInvestmentsLabel', { defaultValue: 'Total investments' })}</span>
              <span className="font-medium text-base-content tabular-nums sm:text-right">
                {t('investedBy', {
                  amount: formatMerits(breakdown.poolTotal),
                  count: investorCount,
                  defaultValue: '{amount} from {count} investor(s)',
                })}
              </span>
            </div>
            <InvestorBar
              investments={segments}
              investmentPool={breakdown.poolBalance}
              investmentPoolTotal={breakdown.poolTotal}
              investorSharePercent={breakdown.contractPercent}
              investorNames={investorNames}
              showCaption={false}
            />
          </div>
          <ul className="divide-y divide-base-300 dark:divide-base-700 border-t border-base-300 dark:border-base-700">
            {breakdown.investors.map((inv) => (
              <li key={inv.userId} className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1 sm:gap-4 px-4 py-3 text-sm">
                <div className="min-w-0">
                  <Link
                    href={routes.userProfile(inv.userId)}
                    className="font-medium text-primary hover:underline truncate block"
                  >
                    {inv.username}
                  </Link>
                  <span className="text-xs text-base-content/50">
                    {t('firstInvest', { defaultValue: 'First' })}: {formatDate(inv.firstInvestDate)}
                    {' · '}
                    {t('lastInvest', { defaultValue: 'Last' })}: {formatDate(inv.lastInvestDate)}
                  </span>
                </div>
                <div className="flex items-baseline gap-3 tabular-nums shrink-0">
                  <span className="font-medium text-base-content">{t('meritsAmount', { amount: formatMerits(inv.amount) })}</span>
                  <span className="text-base-content/60">{inv.sharePercent.toFixed(1)}%</span>
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );

  if (compact) {
    return content;
  }
  return (
    <div className="space-y-2">
      <h3 className="text-sm font-medium text-base-content/80">
        {t('breakdownTitle', { defaultValue: 'Investments' })}
        <span className="ml-2 font-normal text-base-content/60">
          {t('contractTerms', {
            percent: breakdown.contractPercent,
            defaultValue: 'Contract: {percent}% to investors',
          })}
        </span>
      </h3>
      {content}
    </div>
  );
}
