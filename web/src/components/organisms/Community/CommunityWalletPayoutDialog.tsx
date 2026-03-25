'use client';

import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/shadcn/dialog';
import { Button } from '@/components/ui/shadcn/button';
import { Icon } from '@/components/atoms';
import {
  useCommunityWalletPayoutExecute,
  useCommunityWalletPayoutPreview,
} from '@/hooks/api/useCommunities';
import { resolveApiErrorToastMessage } from '@/lib/i18n/api-error-toast';
import { useToastStore } from '@/shared/stores/toast.store';
import { WalletPayoutPreviewLines } from '@/components/molecules/WalletPayoutPreviewLines';

export interface CommunityWalletPayoutDialogProps {
  communityId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  maxAmount: number;
}

export function CommunityWalletPayoutDialog({
  communityId,
  open,
  onOpenChange,
  maxAmount,
}: CommunityWalletPayoutDialogProps) {
  const t = useTranslations('projects');
  const tCommon = useTranslations('common');
  const addToast = useToastStore((s) => s.addToast);
  const [amount, setAmount] = useState(1);
  const safeMax = Math.max(0, Math.floor(maxAmount));
  const clamped = Math.min(safeMax, Math.max(1, amount));
  const previewEnabled = open && safeMax >= 1 && clamped >= 1 && clamped <= safeMax;
  const { data: preview, error: previewError } = useCommunityWalletPayoutPreview(
    communityId,
    clamped,
    previewEnabled,
  );
  const payout = useCommunityWalletPayoutExecute();

  useEffect(() => {
    if (open) {
      setAmount(1);
    }
  }, [open]);

  const submit = () => {
    if (clamped < 1 || clamped > safeMax) return;
    payout.mutate(
      { communityId, amount: clamped },
      {
        onSuccess: () => {
          addToast(t('payoutSuccess'), 'success');
          onOpenChange(false);
        },
        onError: (err) => {
          addToast(resolveApiErrorToastMessage(err.message), 'error');
        },
      },
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{t('payoutDialogTitleCommunity')}</DialogTitle>
          <DialogDescription>{t('payoutDialogDescriptionCommunity')}</DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-4 py-2">
          <div className="flex items-center justify-center gap-2">
            <Button
              type="button"
              variant="secondary"
              size="sm"
              className="h-9 w-9 p-0"
              disabled={clamped <= 1 || payout.isPending}
              onClick={() => setAmount((a) => Math.max(1, a - 1))}
              aria-label={t('payoutDecrease')}
            >
              <Icon name="remove" size={20} />
            </Button>
            <input
              type="number"
              className="input input-bordered input-sm h-9 w-24 text-center tabular-nums"
              min={1}
              max={safeMax}
              value={clamped}
              disabled={payout.isPending || safeMax < 1}
              onChange={(e) => {
                const v = parseInt(e.target.value, 10);
                if (Number.isNaN(v)) {
                  setAmount(1);
                  return;
                }
                setAmount(Math.min(safeMax, Math.max(1, v)));
              }}
            />
            <Button
              type="button"
              variant="secondary"
              size="sm"
              className="h-9 w-9 p-0"
              disabled={clamped >= safeMax || payout.isPending || safeMax < 1}
              onClick={() => setAmount((a) => Math.min(safeMax, a + 1))}
              aria-label={t('payoutIncrease')}
            >
              <Icon name="add" size={20} />
            </Button>
          </div>
          <p className="text-xs text-base-content/60">
            {t('payoutMaxAvailable', { max: safeMax })}
          </p>
          {previewError && (
            <p className="text-sm text-destructive">
              {resolveApiErrorToastMessage((previewError as Error).message)}
            </p>
          )}
          {preview?.lines && preview.lines.length > 0 && (
            <WalletPayoutPreviewLines
              lines={preview.lines}
              className="max-h-40 space-y-1 overflow-y-auto rounded-md border border-base-300 p-2 text-xs dark:border-white/10"
            />
          )}
        </div>
        <DialogFooter className="gap-2 sm:gap-0">
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={payout.isPending}>
            {tCommon('cancel')}
          </Button>
          <Button type="button" onClick={submit} disabled={payout.isPending || safeMax < 1 || clamped < 1}>
            {payout.isPending ? t('payoutExecuting') : t('payoutConfirm')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
