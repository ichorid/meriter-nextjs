'use client';

import React, { useState, useMemo } from 'react';
import { useTranslations } from 'next-intl';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/shadcn/dialog';
import { Button } from '@/components/ui/shadcn/button';
import { Label } from '@/components/ui/shadcn/label';
import { AmountStepper } from '@/components/ui/shadcn/amount-stepper';
import { Loader2, AlertTriangle, Info } from 'lucide-react';
import { useToastStore } from '@/shared/stores/toast.store';
import { useAuth } from '@/contexts/AuthContext';
import { useInvest } from '@/hooks/api/useInvestments';
import { useWallet } from '@/hooks/api/useWallet';
import { trpc } from '@/lib/trpc/client';
import { formatMerits } from '@/lib/utils/currency';

interface InvestDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  postId: string;
  communityId: string;
  /** Fallback when breakdown not yet loaded */
  investorSharePercent?: number;
  investmentPool?: number;
  investmentPoolTotal?: number;
  investorCount?: number;
  onSuccess?: () => void;
}

export function InvestDialog({
  open,
  onOpenChange,
  postId,
  communityId,
  investorSharePercent = 0,
  investmentPool = 0,
  investmentPoolTotal = 0,
  investorCount = 0,
  onSuccess,
}: InvestDialogProps) {
  const t = useTranslations('investing');
  const tCommon = useTranslations('common');
  const tShared = useTranslations('shared');
  const addToast = useToastStore((state) => state.addToast);
  const { user } = useAuth();
  const myId = user?.id ?? null;

  const [amount, setAmount] = useState(0);
  const investMutation = useInvest();
  const { data: wallet } = useWallet(communityId);
  const walletBalance = wallet?.balance ?? 0;

  const { data: breakdown, isLoading: breakdownLoading } = trpc.investments.getInvestmentBreakdown.useQuery(
    { postId },
    { enabled: open && !!postId }
  );

  const contractPercent = breakdown?.contractPercent ?? investorSharePercent;
  const poolBalance = breakdown?.poolBalance ?? investmentPool;
  const poolTotal = breakdown?.poolTotal ?? investmentPoolTotal;
  const investorCountDisplay = breakdown?.investorCount ?? investorCount;
  const ttlDays = breakdown?.ttlDays ?? null;
  const ttlExpiresAt = breakdown?.ttlExpiresAt ?? null;
  const stopLoss = breakdown?.stopLoss ?? 0;

  const myExistingAmount = useMemo(() => {
    if (!myId || !breakdown?.investors) return 0;
    const me = breakdown.investors.find((inv) => inv.userId === myId);
    return me?.amount ?? 0;
  }, [myId, breakdown?.investors]);

  const newPoolTotal = poolTotal + amount;
  const myNewTotal = myExistingAmount + amount;
  const mySharePercentAmongInvestors = useMemo(() => {
    if (newPoolTotal <= 0) return 0;
    return (myNewTotal / newPoolTotal) * 100;
  }, [myNewTotal, newPoolTotal]);

  const myCurrentSharePercent = useMemo(() => {
    if (poolTotal <= 0) return 0;
    return (myExistingAmount / poolTotal) * 100;
  }, [myExistingAmount, poolTotal]);

  const ttlClosesInDays = useMemo(() => {
    if (!ttlExpiresAt) return null;
    const exp = typeof ttlExpiresAt === 'string' ? new Date(ttlExpiresAt) : ttlExpiresAt;
    const now = new Date();
    const diffMs = exp.getTime() - now.getTime();
    const days = Math.ceil(diffMs / (24 * 60 * 60 * 1000));
    return days > 0 ? days : 0;
  }, [ttlExpiresAt]);

  const isValid = amount > 0 && amount <= walletBalance;
  const isSubmitting = investMutation.isPending;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isValid) return;

    try {
      await investMutation.mutateAsync({ postId, amount });
      addToast(
        t('investSuccess', { amount, defaultValue: 'Successfully invested {amount} merits' }),
        'success'
      );
      setAmount(0);
      onOpenChange(false);
      onSuccess?.();
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : t('investError', { defaultValue: 'Investment failed' });
      addToast(message, 'error');
    }
  };

  const handleOpenChange = (next: boolean) => {
    if (!next) setAmount(0);
    onOpenChange(next);
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{t('dialogTitle', { defaultValue: 'Invest in this post' })}</DialogTitle>
        </DialogHeader>
        {breakdownLoading && !breakdown ? (
          <div className="py-8 flex items-center justify-center text-base-content/60">
            <Loader2 className="w-8 h-8 animate-spin" />
          </div>
        ) : (
          <form onSubmit={handleSubmit}>
            <div className="space-y-4 py-4">
              {/* Contract */}
              <p className="text-sm font-medium text-base-content/90">
                {t('contractTerms', {
                  percent: contractPercent,
                  defaultValue: 'Contract: {percent}% to investors',
                })}
              </p>

              {/* Pool with tooltip (same as investment breakdown on post) */}
              <div className="text-sm text-base-content/70">
                <span
                  className="inline-flex items-center gap-1.5 text-base-content/60"
                  title={t('poolTooltip')}
                >
                  {t('poolLabel', { defaultValue: 'Pool' })}
                  <span className="inline-flex" title={t('poolTooltip')} aria-label={t('poolTooltip')}>
                    <Info className="w-4 h-4 text-base-content/50" />
                  </span>
                </span>
                {' '}
                {t('poolValueFromInvestors', {
                  amount: formatMerits(poolBalance),
                  count: investorCountDisplay,
                  defaultValue: '{amount} merits from {count} investor(s)',
                })}
              </div>

              {/* Post settings: TTL, stop-loss, author wallet flag */}
              <div className="text-sm text-base-content/60 space-y-1">
                {ttlClosesInDays !== null && (
                  <p>
                    {t('ttlClosesIn', {
                      days: ttlClosesInDays,
                      defaultValue: 'Closes in {days} days',
                    })}
                  </p>
                )}
                {ttlDays != null && ttlExpiresAt == null && (
                  <p>{t('ttlDays', { days: ttlDays, defaultValue: 'TTL: {days} days' })}</p>
                )}
                {stopLoss > 0 && (
                  <p>
                    {t('stopLossLabel', {
                      value: stopLoss,
                      defaultValue: 'Stop-loss: {value}',
                    })}
                  </p>
                )}
              </div>

              {/* Amount input */}
              <div className="space-y-2">
                <Label htmlFor="invest-amount">{t('amountLabel', { defaultValue: 'Amount (merits)' })}</Label>
                {/* Progress bar above input: blue fill by amount / walletBalance (same as VotingPanel) */}
                <div className="relative h-12 bg-base-300 dark:bg-base-200 rounded-lg border-2 border-base-300 dark:border-base-400 overflow-hidden">
                  {walletBalance > 0 && amount > 0 && (
                    <div
                      className="absolute left-0 top-0 bottom-0 transition-all bg-[#153ED0] dark:bg-[#153ED0] opacity-60 dark:opacity-100"
                      style={{
                        width: `${Math.min(100, (amount / walletBalance) * 100)}%`,
                      }}
                    />
                  )}
                  <div className="absolute inset-0 flex items-center justify-center">
                    <span className="text-xs font-medium z-10 text-base-content dark:text-base-content">
                      {tShared('available', { defaultValue: 'Available' })} {walletBalance}
                    </span>
                  </div>
                </div>
                <AmountStepper
                  id="invest-amount"
                  value={amount}
                  onChange={setAmount}
                  min={1}
                  max={walletBalance}
                  placeholder="0"
                  disabled={isSubmitting}
                />
              </div>

              {/* Dynamic share: Y% of each withdrawal (to investors) */}
              {amount > 0 && (
                <div className="space-y-1">
                  <p className="text-sm font-medium text-primary">
                    {t('yourShare', {
                      percent: mySharePercentAmongInvestors.toFixed(1),
                      defaultValue: 'Your share will be ~{percent}% of each withdrawal (to investors)',
                    })}
                  </p>
                  <p className="text-xs text-base-content/60 italic">
                    {t('yourShareFootnote', {
                      defaultValue:
                        'The percentage may change when other investors put funds into the post – income is always shared proportionally to total investments. You can always invest again to increase your share.',
                    })}
                  </p>
                </div>
              )}

              {/* Repeat investment: current state + after this investment */}
              {myExistingAmount > 0 && (
                <div className="text-sm text-base-content/80 space-y-0.5">
                  <p>
                    {t('repeatInvestmentCurrent', {
                      existing: myExistingAmount,
                      currentPercent: myCurrentSharePercent.toFixed(1),
                      defaultValue: 'You already invested: {existing} merits, share {currentPercent}%.',
                    })}
                  </p>
                  <p>
                    {t('repeatInvestmentAfter', {
                      total: myNewTotal,
                      percent: mySharePercentAmongInvestors.toFixed(1),
                      defaultValue: 'After this: {total} merits, share {percent}%.',
                    })}
                  </p>
                </div>
              )}

              {/* Warning box */}
              <div className="flex items-start gap-2 p-3 rounded-lg bg-warning/10 border border-warning/30">
                <AlertTriangle className="w-5 h-5 text-warning flex-shrink-0 mt-0.5" />
                <p className="text-sm text-base-content/80">
                  {t('irrevocableWarningFull', {
                    defaultValue:
                      'Investment is irrevocable. Merits are spent on tappalka shows. Returns only happen when the author withdraws merits or when the post closes.',
                  })}
                </p>
              </div>
            </div>
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => handleOpenChange(false)}
                disabled={isSubmitting}
              >
                {tCommon('cancel', { defaultValue: 'Cancel' })}
              </Button>
              <Button type="submit" disabled={!isValid || isSubmitting}>
                {isSubmitting ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    {t('investing', { defaultValue: 'Investing...' })}
                  </>
                ) : (
                  t('invest', { defaultValue: 'Invest' })
                )}
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
