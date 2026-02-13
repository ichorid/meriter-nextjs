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
  onSuccess?: () => void;
}

function roundToHundredths(x: number): number {
  return Math.round(x * 100) / 100;
}

/** D-9: Preview of distribution (same logic as PostClosingService). */
function getClosePreview(
  currentScore: number,
  investmentPool: number,
  investorSharePercent: number,
  investments: Array<{ investorId: string; amount: number }>,
): {
  poolReturned: number;
  distributedToInvestors: number;
  authorReceived: number;
  totalEarned: number;
} {
  const totalEarned = currentScore + investmentPool;
  const poolReturned = investmentPool;

  if (investments.length === 0 || currentScore <= 0) {
    return {
      poolReturned,
      distributedToInvestors: 0,
      authorReceived: currentScore,
      totalEarned,
    };
  }

  const investorTotal = roundToHundredths(
    currentScore * (investorSharePercent / 100),
  );
  const authorReceived = currentScore - investorTotal;

  return {
    poolReturned,
    distributedToInvestors: investorTotal,
    authorReceived,
    totalEarned,
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
                <div className="rounded-lg bg-base-200/50 p-3 text-sm space-y-1">
                  <p className="font-medium text-base-content">
                    {tClose('distributionPreview', {
                      defaultValue: 'Distribution preview',
                    })}
                  </p>
                  <p>
                    {tClose('poolReturned', { defaultValue: 'Pool returned' })}:{' '}
                    {formatMerits(preview.poolReturned)}
                  </p>
                  <p>
                    {tClose('toInvestorsFromRating', {
                      defaultValue: 'To investors (from rating)',
                    })}{' '}
                    — {formatMerits(preview.distributedToInvestors)}
                  </p>
                  <p>
                    {tClose('toYou', { defaultValue: 'To you' })} —{' '}
                    {formatMerits(preview.authorReceived)}
                  </p>
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
