'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { useTopUpCommunitySourceWallet } from '@/hooks/api/useCommunities';
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

interface TopUpCommunityWalletDialogProps {
  communityId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function TopUpCommunityWalletDialog({
  communityId,
  open,
  onOpenChange,
}: TopUpCommunityWalletDialogProps) {
  const t = useTranslations('projects');
  const tCommunities = useTranslations('pages.communities');
  const tCommon = useTranslations('common');
  const [amount, setAmount] = useState<string>('10');
  const topUp = useTopUpCommunitySourceWallet();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const num = parseInt(amount, 10);
    if (Number.isNaN(num) || num < 1) return;
    topUp.mutate(
      { communityId, amount: num },
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
          <DialogTitle>{tCommunities('topUpCommunityWalletTitle')}</DialogTitle>
          <DialogDescription>{t('topUpWarning')}</DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit}>
          <div className="grid gap-4 py-4">
            <div>
              <Label htmlFor="community-topup-amount">{tCommunities('topUpAmountMeritsLabel')}</Label>
              <Input
                id="community-topup-amount"
                type="number"
                min={1}
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              {tCommon('cancel')}
            </Button>
            <Button type="submit" disabled={topUp.isPending}>
              {topUp.isPending ? tCommunities('walletTopUpSubmitting') : t('topUp')}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
