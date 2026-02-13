'use client';

import React, { useState } from 'react';
import { useTranslations } from 'next-intl';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/shadcn/dialog';
import { Button } from '@/components/ui/shadcn/button';
import { Label } from '@/components/ui/shadcn/label';
import { AmountStepper } from '@/components/ui/shadcn/amount-stepper';
import { Loader2 } from 'lucide-react';
import { useToastStore } from '@/shared/stores/toast.store';
import { trpc } from '@/lib/trpc/client';

interface AddMeritsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  userId: string;
  userName: string;
  communityId: string;
  onSuccess?: () => void;
}

export function AddMeritsDialog({
  open,
  onOpenChange,
  userId,
  userName,
  communityId,
  onSuccess,
}: AddMeritsDialogProps) {
  const t = useTranslations('pages.communities.members');
  const addToast = useToastStore((state) => state.addToast);
  const [amount, setAmount] = useState<number>(100);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const addMeritsMutation = trpc.wallets.addMeritsToUser.useMutation();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (amount <= 0) {
      addToast(t('addMeritsDialog.invalidAmount'), 'error');
      return;
    }

    setIsSubmitting(true);
    try {
      await addMeritsMutation.mutateAsync({
        userId,
        communityId,
        amount,
      });

      addToast(t('addMeritsDialog.success', { amount, name: userName }), 'success');
      setAmount(100);
      onOpenChange(false);
      onSuccess?.();
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : t('addMeritsDialog.error');
      addToast(message, 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t('addMeritsDialog.title', { name: userName })}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit}>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="amount">{t('addMeritsDialog.amountLabel')}</Label>
              <AmountStepper
                id="amount"
                value={amount}
                onChange={setAmount}
                min={1}
                placeholder="100"
                disabled={isSubmitting}
              />
              <p className="text-xs text-base-content/60">
                {t('addMeritsDialog.amountHelp')}
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={isSubmitting}
            >
              {t('addMeritsDialog.cancel')}
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  {t('addMeritsDialog.submitting')}
                </>
              ) : (
                t('addMeritsDialog.confirm')
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

