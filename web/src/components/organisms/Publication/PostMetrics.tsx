// PostMetrics: context-aware metrics block (E-2)
// For ACTIVE: rating, investment info (if enabled), TTL badge (if set)
// For CLOSED: ClosingSummaryBlock only
'use client';

import React, { useMemo } from 'react';
import { useTranslations } from 'next-intl';
import { TrendingUp } from 'lucide-react';
import { InvestmentBreakdownPopup } from '@/components/organisms/InvestmentBreakdownPopup';
import { ClosingSummaryBlock } from './ClosingSummaryBlock';
import { formatMerits } from '@/lib/utils/currency';

export interface ClosingSummary {
  totalEarned: number;
  distributedToInvestors: number;
  authorReceived: number;
  spentOnShows: number;
}

interface PostMetricsProps {
  /** Active vs closed */
  isClosed: boolean;
  /** Hide rating (e.g. for polls) */
  hideVoteAndScore?: boolean;

  /** Rating */
  currentScore?: number;
  totalVotes?: number;
  totalVotesTooltip?: string;
  onRatingClick?: (e: React.MouseEvent) => void;

  /** Investment block */
  investingEnabled: boolean;
  investmentPool: number;
  investorCount: number;
  publicationId: string | undefined;
  breakdownPostId: string | null;
  onBreakdownClick: (e: React.MouseEvent) => void;
  onBreakdownOpenChange: (open: boolean) => void;
  investorsLabel: string;
  viewBreakdownTitle: string;

  /** TTL */
  ttlExpiresAt?: Date | string | null;
  ttlClosesInLabel?: string;

  /** Closed: summary */
  closingSummary?: ClosingSummary;
}

export const PostMetrics: React.FC<PostMetricsProps> = ({
  isClosed,
  hideVoteAndScore = false,
  currentScore = 0,
  totalVotes,
  totalVotesTooltip,
  onRatingClick,
  investingEnabled,
  investmentPool,
  investorCount,
  publicationId,
  breakdownPostId,
  onBreakdownClick,
  onBreakdownOpenChange,
  investorsLabel,
  viewBreakdownTitle,
  ttlExpiresAt,
  ttlClosesInLabel,
  closingSummary,
}) => {
  const tInvesting = useTranslations('investing');

  const ttlClosesInDays = useMemo(() => {
    if (!ttlExpiresAt || isClosed) return null;
    const exp = typeof ttlExpiresAt === 'string' ? new Date(ttlExpiresAt) : ttlExpiresAt;
    const now = new Date();
    const diffMs = exp.getTime() - now.getTime();
    const days = Math.ceil(diffMs / (24 * 60 * 60 * 1000));
    return days > 0 ? days : 0;
  }, [ttlExpiresAt, isClosed]);

  const effectiveTtlLabel =
    ttlClosesInLabel ?? (ttlClosesInDays != null ? tInvesting('ttlClosesIn', { days: ttlClosesInDays }) : null);

  // CLOSED: show ClosingSummaryBlock only
  if (isClosed) {
    return (
      <div className="mb-3">
        {closingSummary ? (
          <ClosingSummaryBlock summary={closingSummary} />
        ) : (
          <span className="text-sm text-base-content/50">Closed</span>
        )}
      </div>
    );
  }

  // ACTIVE: rating + investment + TTL
  const showRating = !hideVoteAndScore;
  const showInvestment = investingEnabled;
  const showTtl = effectiveTtlLabel != null && effectiveTtlLabel !== '';

  const hasAny = showRating || showInvestment || showTtl;
  if (!hasAny) return null;

  return (
    <div className="mb-3 flex flex-col sm:flex-row sm:flex-wrap items-start sm:items-center gap-y-2 sm:gap-x-4 sm:gap-y-2">
      {/* Rating: icon + value, click → vote history (navigate to post) */}
      {showRating && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onRatingClick?.(e);
          }}
          className="flex items-center gap-1.5 text-sm hover:bg-base-200 rounded-lg px-2 py-1.5 transition-colors group"
          title={totalVotesTooltip}
        >
          <TrendingUp className="w-4 h-4 text-base-content/50 group-hover:text-base-content/70" />
          <span
            className={`font-medium tabular-nums ${
              currentScore > 0
                ? 'text-success'
                : currentScore < 0
                  ? 'text-error'
                  : 'text-base-content/60'
            }`}
          >
            {currentScore > 0 ? '+' : ''}
            {formatMerits(currentScore)}
          </span>
          {totalVotes != null &&
            typeof totalVotes === 'number' &&
            !Number.isNaN(totalVotes) &&
            !Number.isNaN(currentScore) &&
            totalVotes > currentScore && (
              <span className="text-base-content/40 text-xs tabular-nums" title={totalVotesTooltip}>
                ({totalVotes > 0 ? '+' : ''}
                {formatMerits(totalVotes)})
              </span>
            )}
        </button>
      )}

      {/* Investment: compact, click → breakdown popup */}
      {showInvestment && (
        <>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onBreakdownClick(e);
            }}
            className="flex items-center gap-2 text-sm text-base-content/70 hover:text-base-content/90 hover:bg-base-200 rounded-lg px-2 py-1.5 transition-colors"
            title={viewBreakdownTitle}
          >
            <span>💰</span>
            <span className="font-medium tabular-nums">
              {tInvesting('meritsAmount', { amount: formatMerits(investmentPool) })}
            </span>
            <span className="text-base-content/50">·</span>
            <span>
              {investorCount} {investorsLabel}
            </span>
          </button>
          <InvestmentBreakdownPopup
            postId={breakdownPostId}
            open={!!breakdownPostId && breakdownPostId === publicationId}
            onOpenChange={(open) => !open && onBreakdownOpenChange(false)}
          />
        </>
      )}

      {/* TTL badge: small, muted */}
      {showTtl && (
        <span className="text-xs text-base-content/50" title={effectiveTtlLabel ?? undefined}>
          📅 {effectiveTtlLabel}
        </span>
      )}
    </div>
  );
};
