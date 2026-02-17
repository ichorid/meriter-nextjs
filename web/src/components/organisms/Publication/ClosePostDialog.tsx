'use client';

import React from 'react';
import { useTranslations } from 'next-intl';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/shadcn/dialog';
import { Button } from '@/components/ui/shadcn/button';
import { AlertTriangle, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { trpc } from '@/lib/trpc/client';
import { formatMerits } from '@/lib/utils/currency';

interface ClosePostDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  publicationId: string;
  /** Current post rating (metrics.score) */
  currentScore: number;
  /** Has investments (investments?.length > 0) */
  hasInvestments: boolean;
  investmentPool: number;
  investorSharePercent: number;
  /** Total invested per investor for share calculation */
  investments: Array<{ investorId: string; amount: number }>;
  /** If true (default): pool + rating distributed by contract. If false: pool returned to investors, only rating split by contract. */
  distributeAllByContractOnClose?: boolean;
  onSuccess?: () => void;
}

function roundToHundredths(x: number): number {
  return Math.round(x * 100) / 100;
}

export type ClosePreviewMode = 'returnPool' | 'distributeAllByContract';

/** D-9: Preview of distribution (aligned with investment.service handlePostClose). */
function getClosePreview(
  currentScore: number,
  investmentPool: number,
  investorSharePercent: number,
  investments: Array<{ investorId: string; amount: number }>,
  distributeAllByContractOnClose: boolean,
): {
  mode: ClosePreviewMode;
  poolReturned: number;
  distributedToInvestors: number;
  authorReceived: number;
  totalDistributed: number;
} {
  const hasInvestors = investments.length > 0;

  if (!hasInvestors || (currentScore <= 0 && investmentPool <= 0)) {
    return {
      mode: 'returnPool',
      poolReturned: investmentPool,
      distributedToInvestors: 0,
      authorReceived: currentScore,
      totalDistributed: currentScore,
    };
  }

  if (distributeAllByContractOnClose) {
    const total = roundToHundredths(investmentPool + currentScore);
    const toInvestors = roundToHundredths(total * (investorSharePercent / 100));
    const toAuthor = total - toInvestors;
    return {
      mode: 'distributeAllByContract',
      poolReturned: 0,
      distributedToInvestors: toInvestors,
      authorReceived: toAuthor,
      totalDistributed: total,
    };
  }

  const poolReturned = investmentPool;
  const investorFromRating = roundToHundredths(
    currentScore * (investorSharePercent / 100),
  );
  const authorReceived = currentScore - investorFromRating;
  return {
    mode: 'returnPool',
    poolReturned,
    distributedToInvestors: investorFromRating,
    authorReceived,
    totalDistributed: currentScore,
  };
}

export const ClosePostDialog: React.FC<ClosePostDialogProps> = ({
  open,
  onOpenChange,
  publicationId,
  currentScore,
  hasInvestments,
  investmentPool,
  investorSharePercent,
  investments,
  distributeAllByContractOnClose = true,
  onSuccess,
}) => {
  const t = useTranslations('shared');
  const tClose = useTranslations('postClosing');
  const utils = trpc.useUtils();

  const closeMutation = trpc.publications.close.useMutation({
    onSuccess: () => {
      utils.publications.getById.invalidate({ id: publicationId });
      utils.publications.getAll.invalidate();
      onOpenChange(false);
      onSuccess?.();
    },
  });

  const preview =
    hasInvestments &&
    getClosePreview(
      currentScore,
      investmentPool,
      investorSharePercent,
      investments,
      distributeAllByContractOnClose,
    );

  const handleConfirm = () => {
    closeMutation.mutate({ id: publicationId });
  };

  const isLoading = closeMutation.isPending;

  return (
    <Dialog open={open} onOpenChange={(open) => !open && onOpenChange(false)}>
      <DialogContent className={cn('max-w-lg')}>
        <DialogHeader>
          <DialogTitle>
            {tClose('closePostTitle', { defaultValue: 'Close post' })}
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="flex items-start gap-3">
            <div className="flex-shrink-0">
              <AlertTriangle className="w-6 h-6 text-error" />
            </div>
            <div className="space-y-2 text-base-content/80">
              <p>
                {tClose('closePostWarning', {
                  defaultValue:
                    'This action is permanent. The post will remain visible but frozen.',
                })}
              </p>
              {hasInvestments && preview ? (
                <div className="rounded-xl bg-base-200/60 dark:bg-base-300/40 p-4 text-sm space-y-3 border border-base-content/5">
                  <p className="text-xs text-base-content/60">
                    {preview.mode === 'distributeAllByContract'
                      ? tClose('modeCaptionDistributeAll', {
                          defaultValue:
                            'According to community settings, all merits are distributed by contract.',
                        })
                      : tClose('modeCaptionReturnPool', {
                          defaultValue:
                            'According to community settings, pool is returned to investors; only rating is split by contract.',
                        })}
                  </p>
                  <p className="font-semibold text-base-content">
                    {tClose('distributionPreview', {
                      defaultValue: 'Distribution preview',
                    })}
                  </p>
                  {preview.mode === 'distributeAllByContract' ? (
                    <>
                      <p className="text-base-content/70">
                        {tClose('totalDistributedByContract', {
                          defaultValue:
                            'All merits (pool + rating) distributed by contract.',
                        })}
                      </p>
                      <ul className="space-y-1.5 list-none">
                        <li className="flex justify-between gap-4">
                          <span className="text-base-content/80">
                            {tClose('toYou', { defaultValue: 'To you' })}
                          </span>
                          <span className="font-medium tabular-nums">
                            {formatMerits(preview.authorReceived)}
                          </span>
                        </li>
                        <li className="flex justify-between gap-4">
                          <span className="text-base-content/80">
                            {tClose('toInvestors', {
                              defaultValue: 'To investors',
                            })}
                          </span>
                          <span className="font-medium tabular-nums">
                            {formatMerits(preview.distributedToInvestors)}
                          </span>
                        </li>
                      </ul>
                      <p className="text-base-content/60 text-xs pt-0.5">
                        {tClose('totalDistributed', {
                          defaultValue: 'Total',
                        })}{' '}
                        {formatMerits(preview.totalDistributed)}
                      </p>
                    </>
                  ) : (
                    <>
                      <ul className="space-y-1.5 list-none">
                        <li className="flex justify-between gap-4">
                          <span className="text-base-content/80">
                            {tClose('poolReturned', {
                              defaultValue: 'Pool returned',
                            })}
                          </span>
                          <span className="font-medium tabular-nums">
                            {formatMerits(preview.poolReturned)}
                          </span>
                        </li>
                        <li className="flex justify-between gap-4">
                          <span className="text-base-content/80">
                            {tClose('toInvestorsFromRating', {
                              defaultValue: 'To investors (from rating)',
                            })}
                          </span>
                          <span className="font-medium tabular-nums">
                            {formatMerits(preview.distributedToInvestors)}
                          </span>
                        </li>
                        <li className="flex justify-between gap-4">
                          <span className="text-base-content/80">
                            {tClose('toYou', { defaultValue: 'To you' })}
                          </span>
                          <span className="font-medium tabular-nums">
                            {formatMerits(preview.authorReceived)}
                          </span>
                        </li>
                      </ul>
                    </>
                  )}
                </div>
              ) : (
                <p>
                  {tClose('allMeritsToWallet', {
                    defaultValue: 'All {count} merits will be withdrawn to your wallet.',
                    count: formatMerits(currentScore),
                  })}
                </p>
              )}
            </div>
          </div>
        </div>
        <DialogFooter className="flex justify-end gap-3 pt-4 border-t border-base-content/10">
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isLoading}
            className="rounded-xl active:scale-[0.98]"
          >
            {t('cancel', { defaultValue: 'Cancel' })}
          </Button>
          <Button
            variant="destructive"
            onClick={handleConfirm}
            disabled={isLoading}
            className="rounded-xl active:scale-[0.98] bg-error hover:bg-error/90 text-error-content"
          >
            {isLoading && <Loader2 className="h-4 w-4 animate-spin" />}
            {tClose('closePostButton', { defaultValue: 'Close post' })}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
