'use client';

import { TrendingUp } from 'lucide-react';
import { formatMerits } from '@/lib/utils/currency';
import { cn } from '@/lib/utils';

export type DocumentProposalVariantRatingProps = {
  score: number;
  className?: string;
};

/** Same score styling as feed posts (PostMetrics). */
export function DocumentProposalVariantRating({
  score,
  className,
}: DocumentProposalVariantRatingProps) {
  return (
    <span
      className={cn('inline-flex items-center gap-1 tabular-nums', className)}
      aria-hidden
    >
      <TrendingUp className="h-3.5 w-3.5 shrink-0 text-base-content/50" />
      <span
        className={cn(
          'text-xs font-medium',
          score > 0 ? 'text-success' : score < 0 ? 'text-error' : 'text-base-content/60',
        )}
      >
        {score > 0 ? '+' : ''}
        {formatMerits(score)}
      </span>
    </span>
  );
}
