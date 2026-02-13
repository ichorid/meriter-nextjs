'use client';

import React, { useState, useMemo } from 'react';
import { useTranslations } from 'next-intl';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/shadcn/dialog';
import { Button } from '@/components/ui/shadcn/button';
import { Label } from '@/components/ui/shadcn/label';
import { AmountStepper } from '@/components/ui/shadcn/amount-stepper';
import { Loader2, AlertTriangle } from 'lucide-react';
import { useToastStore } from '@/shared/stores/toast.store';
import { useInvest } from '@/hooks/api/useInvestments';
import { useWallet } from '@/hooks/api/useWallet';

interface InvestDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  postId: string;
  communityId: string;
  investorSharePercent: number;
  investmentPool: number;
  investmentPoolTotal: number;
  investorCount: number;
  onSuccess?: () => void;
}

export function InvestDialog({
  open,
  onOpenChange,
  postId,
  communityId,
  investorSharePercent,
  investmentPool,
  investmentPoolTotal,
  investorCount,
  onSuccess,
}: InvestDialogProps) {
  const t = useTranslations('investing');
  const tCommon = useTranslations('common');
  const addToast = useToastStore((state) => state.addToast);
  const [amount, setAmount] = useState(0);
  const investMutation = useInvest();
  const { data: wallet } = useWallet(communityId);
  const walletBalance = wallet?.balance ?? 0;

  const newPoolTotal = investmentPoolTotal + amount;
  const myShareOfInvestorPortion = useMemo(() => {
    if (amount <= 0 || newPoolTotal <= 0) return 0;
    return (amount / newPoolTotal) * investorSharePercent;
  }, [amount, newPoolTotal, investorSharePercent]);

  const isValid = amount > 0 && amount <= walletBalance;
  const isSubmitting = investMutation.isPending;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isValid) return;

    try {
      await investMutation.mutateAsync({ postId, amount });
      addToast(
        t('investSuccess', { defaultValue: 'Successfully invested {amount} merits', amount }),
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
        <form onSubmit={handleSubmit}>
          <div className="space-y-4 py-4">
            <p className="text-sm text-base-content/80">
              {t('contractTerms', {
                defaultValue: 'Author gives {percent}% to investors',
                percent: investorSharePercent,
              })}
            </p>

            <div className="flex justify-between text-sm">
              <span className="text-base-content/60">
                {t('poolTotal', { defaultValue: 'Pool total' })}: {investmentPool} merits
              </span>
              <span className="text-base-content/60">
                {t('investorCount', { defaultValue: '{count} investor(s)', count: investorCount })}
              </span>
            </div>

            <div className="space-y-2">
              <Label htmlFor="invest-amount">{t('amountLabel', { defaultValue: 'Amount (merits)' })}</Label>
              <AmountStepper
                id="invest-amount"
                value={amount}
                onChange={setAmount}
                min={1}
                max={walletBalance}
                placeholder="0"
                disabled={isSubmitting}
              />
              <p className="text-xs text-base-content/60">
                {t('balance', { defaultValue: 'Balance: {balance} merits', balance: walletBalance })}
              </p>
            </div>

            {amount > 0 && (
              <div className="space-y-1">
                <p className="text-sm font-medium text-primary">
                  {t('yourShare', {
                    defaultValue: 'You will receive ~{percent}%* of each withdrawal (to investors)',
                    percent: myShareOfInvestorPortion.toFixed(1),
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

            <div className="flex items-start gap-2 p-3 rounded-lg bg-warning/10 border border-warning/30">
              <AlertTriangle className="w-5 h-5 text-warning flex-shrink-0 mt-0.5" />
              <p className="text-sm text-base-content/80">
                {t('irrevocableWarning', { defaultValue: 'Investment is irrevocable. Merits cannot be withdrawn until the author withdraws from the post.' })}
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
      </DialogContent>
    </Dialog>
  );
}
