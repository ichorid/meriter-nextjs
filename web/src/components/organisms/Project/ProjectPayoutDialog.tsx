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
import { useProjectPayoutExecute, useProjectPayoutPreview } from '@/hooks/api/useProjects';
import { resolveApiErrorToastMessage } from '@/lib/i18n/api-error-toast';
import { useToastStore } from '@/shared/stores/toast.store';
import { WalletPayoutPreviewLines } from '@/components/molecules/WalletPayoutPreviewLines';

export interface ProjectPayoutDialogProps {
  projectId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  maxAmount: number;
}

export function ProjectPayoutDialog({
  projectId,
  open,
  onOpenChange,
  maxAmount,
}: ProjectPayoutDialogProps) {
  const t = useTranslations('projects');
  const tCommon = useTranslations('common');
  const addToast = useToastStore((s) => s.addToast);
  const safeMax = Math.max(0, Math.floor(maxAmount));

  const [amount, setAmount] = useState(1);
  const [amountDraft, setAmountDraft] = useState('1');

  const clamp = (n: number) => Math.min(safeMax, Math.max(1, n));
  const clamped = clamp(amount);

  const setCommittedAmount = (n: number) => {
    const c = clamp(n);
    setAmount(c);
    setAmountDraft(String(c));
  };

  useEffect(() => {
    if (open) {
      setAmount(1);
      setAmountDraft('1');
    }
  }, [open]);

  const previewEnabled = open && safeMax >= 1 && clamped >= 1 && clamped <= safeMax;
  const { data: preview, error: previewError, isFetching } = useProjectPayoutPreview(
    projectId,
    clamped,
    previewEnabled,
  );
  const payout = useProjectPayoutExecute();

  const showPreviewError = Boolean(previewError) && !isFetching;

  const submit = () => {
    if (clamped < 1 || clamped > safeMax) return;
    payout.mutate(
      { projectId, amount: clamped },
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
          <DialogTitle>{t('payoutDialogTitleProject')}</DialogTitle>
          <DialogDescription>{t('payoutDialogDescriptionProject')}</DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-4 py-2">
          <div className="flex items-center justify-center gap-2">
            <Button
              type="button"
              variant="secondary"
              size="sm"
              className="h-9 w-9 p-0"
              disabled={clamped <= 1 || payout.isPending}
              onClick={() => setCommittedAmount(clamped - 1)}
              aria-label={t('payoutDecrease')}
            >
              <Icon name="remove" size={20} />
            </Button>
            <input
              type="text"
              inputMode="numeric"
              className="input input-bordered input-sm h-9 w-24 text-center tabular-nums"
              disabled={payout.isPending || safeMax < 1}
              value={amountDraft}
              onChange={(e) => {
                const raw = e.target.value;
                if (raw === '') {
                  setAmountDraft('');
                  return;
                }
                if (!/^\d+$/.test(raw)) {
                  return;
                }
                setAmountDraft(raw);
                const v = parseInt(raw, 10);
                if (!Number.isNaN(v) && v >= 1 && v <= safeMax) {
                  setAmount(v);
                }
              }}
              onBlur={() => {
                if (amountDraft.trim() === '') {
                  setCommittedAmount(1);
                  return;
                }
                const v = parseInt(amountDraft, 10);
                if (Number.isNaN(v)) {
                  setCommittedAmount(clamped);
                  return;
                }
                setCommittedAmount(v);
              }}
            />
            <Button
              type="button"
              variant="secondary"
              size="sm"
              className="h-9 w-9 p-0"
              disabled={clamped >= safeMax || payout.isPending || safeMax < 1}
              onClick={() => setCommittedAmount(clamped + 1)}
              aria-label={t('payoutIncrease')}
            >
              <Icon name="add" size={20} />
            </Button>
          </div>
          <p className="text-xs text-base-content/60">
            {t('payoutMaxAvailable', { max: safeMax })}
          </p>
          {showPreviewError && (
            <p className="text-sm text-destructive">
              {resolveApiErrorToastMessage((previewError as Error).message)}
            </p>
          )}
          {preview?.lines && preview.lines.length > 0 && (
            <WalletPayoutPreviewLines
              lines={preview.lines}
              className="max-h-40 min-h-[2.5rem] space-y-1 overflow-y-auto rounded-md border border-white/10 p-2 text-xs"
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
