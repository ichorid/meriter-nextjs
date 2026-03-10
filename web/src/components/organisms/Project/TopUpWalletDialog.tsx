'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { useTopUpWallet } from '@/hooks/api/useProjects';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/shadcn/dialog';
import { Button } from '@/components/ui/shadcn/button';
import { Input } from '@/components/ui/shadcn/input';
import { Label } from '@/components/ui/shadcn/label';

interface TopUpWalletDialogProps {
  projectId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function TopUpWalletDialog({ projectId, open, onOpenChange }: TopUpWalletDialogProps) {
  const t = useTranslations('projects');
  const [amount, setAmount] = useState<string>('10');
  const topUp = useTopUpWallet();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const num = parseInt(amount, 10);
    if (Number.isNaN(num) || num < 1) return;
    topUp.mutate(
      { projectId, amount: num },
      {
        onSuccess: () => {
          onOpenChange(false);
          setAmount('10');
        },
      },
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Top up project wallet</DialogTitle>
          <DialogDescription>{t('topUpWarning')}</DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit}>
          <div className="grid gap-4 py-4">
            <div>
              <Label htmlFor="amount">Amount (merits)</Label>
              <Input
                id="amount"
                type="number"
                min={1}
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={topUp.isPending}>
              {topUp.isPending ? 'Sending...' : 'Top up'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
