'use client';

import React, { useState } from 'react';
import { useTranslations } from 'next-intl';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/shadcn/dialog';
import { Button } from '@/components/ui/shadcn/button';
import { Input } from '@/components/ui/shadcn/input';
import { Label } from '@/components/ui/shadcn/label';
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
  const [amount, setAmount] = useState<string>('100');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const addMeritsMutation = trpc.wallets.addMeritsToUser.useMutation();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    const amountNum = parseInt(amount, 10);
    if (isNaN(amountNum) || amountNum <= 0) {
      addToast(t('addMerits.invalidAmount'), 'error');
      return;
    }

    setIsSubmitting(true);
    try {
      await addMeritsMutation.mutateAsync({
        userId,
        communityId,
        amount: amountNum,
      });
      
      addToast(t('addMerits.success', { amount: amountNum, name: userName }), 'success');
      setAmount('100');
      onOpenChange(false);
      onSuccess?.();
    } catch (error: any) {
      addToast(error?.message || t('addMerits.error'), 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t('addMerits.title', { name: userName })}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit}>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="amount">{t('addMerits.amountLabel')}</Label>
              <Input
                id="amount"
                type="number"
                min="1"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="100"
                disabled={isSubmitting}
                autoFocus
              />
              <p className="text-xs text-base-content/60">
                {t('addMerits.amountHelp')}
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
              {t('addMerits.cancel')}
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  {t('addMerits.submitting')}
                </>
              ) : (
                t('addMerits.confirm')
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

