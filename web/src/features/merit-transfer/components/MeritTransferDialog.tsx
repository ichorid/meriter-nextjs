'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { useTranslations } from 'next-intl';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/shadcn/dialog';
import { Button } from '@/components/ui/shadcn/button';
import { Label } from '@/components/ui/shadcn/label';
import { Textarea } from '@/components/ui/shadcn/textarea';
import { AmountStepper } from '@/components/ui/shadcn/amount-stepper';
import { Loader2 } from 'lucide-react';
import { resolveApiErrorToastMessage } from '@/lib/i18n/api-error-toast';
import { useToastStore } from '@/shared/stores/toast.store';
import { trpc } from '@/lib/trpc/client';
import { useCommunity } from '@/hooks/api/useCommunities';
import { useWallet } from '@/hooks/api/useWallet';
import { GLOBAL_COMMUNITY_ID } from '@/lib/constants/app';
import { isPriorityCommunity } from '@/lib/community/is-priority-community';
import { cn } from '@/lib/utils';
import type { MeritTransferWalletType } from '@meriter/shared-types';

export interface MeritTransferDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  receiverId: string;
  receiverDisplayName: string;
  communityContextId: string;
  onSuccess?: () => void;
}

type SourceChoice = 'global' | 'context';
type TargetChoice = 'global' | 'context';

function walletBalance(wallet: { balance?: number } | null | undefined): number {
  const b = wallet?.balance;
  if (typeof b !== 'number' || Number.isNaN(b)) return 0;
  return Math.max(0, Math.floor(b));
}

export function MeritTransferDialog({
  open,
  onOpenChange,
  receiverId,
  receiverDisplayName,
  communityContextId,
  onSuccess,
}: MeritTransferDialogProps) {
  const t = useTranslations('meritTransfer');
  const addToast = useToastStore((s) => s.addToast);
  const utils = trpc.useUtils();

  const [amount, setAmount] = useState(1);
  const [comment, setComment] = useState('');
  const [sourceChoice, setSourceChoice] = useState<SourceChoice>('global');
  const [targetChoice, setTargetChoice] = useState<TargetChoice>('global');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const { data: community, isLoading: communityLoading } = useCommunity(communityContextId);
  const { data: globalWallet, isLoading: globalLoading } = useWallet(GLOBAL_COMMUNITY_ID);
  const { data: contextWallet, isLoading: contextLoading } = useWallet(communityContextId);

  const createMutation = trpc.meritTransfer.create.useMutation();

  const priorityContext = useMemo(
    () => isPriorityCommunity(community ?? null),
    [community],
  );

  const showContextWallet =
    !!community &&
    !priorityContext &&
    communityContextId !== GLOBAL_COMMUNITY_ID;

  const isProject = Boolean(community?.isProject);

  const globalBal = walletBalance(globalWallet);
  const contextBal = walletBalance(contextWallet);

  const contextWalletLabel = isProject ? t('sourceContextProject') : t('sourceContextCommunity');

  useEffect(() => {
    if (!open) return;
    setAmount(1);
    setComment('');
    setSourceChoice('global');
    setTargetChoice('global');
    setIsSubmitting(false);
  }, [open]);

  useEffect(() => {
    if (!open || !community) return;
    if (priorityContext || !showContextWallet) {
      setSourceChoice('global');
      setTargetChoice('global');
    }
  }, [open, community, priorityContext, showContextWallet]);

  const selectedSourceBalance =
    sourceChoice === 'global' || !showContextWallet ? globalBal : contextBal;

  const buildWalletTypes = (): {
    sourceWalletType: MeritTransferWalletType;
    targetWalletType: MeritTransferWalletType;
  } => {
    const contextType: MeritTransferWalletType = isProject ? 'project' : 'community';
    if (!showContextWallet || sourceChoice === 'global') {
      const sourceWalletType: MeritTransferWalletType = 'global';
      const targetWalletType: MeritTransferWalletType =
        showContextWallet && targetChoice === 'context' ? contextType : 'global';
      return { sourceWalletType, targetWalletType };
    }
    return {
      sourceWalletType: contextType,
      targetWalletType: contextType,
    };
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = comment.trim();
    if (!trimmed) {
      addToast(t('commentRequired'), 'error');
      return;
    }
    const n = Math.floor(amount);
    if (n < 1) {
      addToast(t('invalidAmount'), 'error');
      return;
    }
    if (n > selectedSourceBalance) {
      addToast(t('insufficientBalance'), 'error');
      return;
    }

    const { sourceWalletType, targetWalletType } = buildWalletTypes();

    setIsSubmitting(true);
    try {
      await createMutation.mutateAsync({
        receiverId,
        amount: n,
        comment: trimmed,
        sourceWalletType,
        sourceContextId: sourceWalletType === 'global' ? undefined : communityContextId,
        targetWalletType,
        targetContextId: targetWalletType === 'global' ? undefined : communityContextId,
        communityContextId,
      });

      addToast(t('success', { amount: n }), 'success');
      onOpenChange(false);
      onSuccess?.();

      await Promise.all([
        utils.wallets.getAll.invalidate(),
        utils.wallets.getByCommunity.invalidate({ userId: 'me', communityId: GLOBAL_COMMUNITY_ID }),
        utils.wallets.getByCommunity.invalidate({ userId: 'me', communityId: communityContextId }),
        utils.meritTransfer.getByCommunity.invalidate({ communityId: communityContextId }),
        utils.meritTransfer.getByUser.invalidate(),
      ]);
    } catch (error: unknown) {
      const raw = error instanceof Error ? error.message : undefined;
      addToast(resolveApiErrorToastMessage(raw), 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  const walletsLoading = globalLoading || contextLoading;
  const formDisabled = isSubmitting || communityLoading || walletsLoading;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{t('dialogTitle', { name: receiverDisplayName })}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit}>
          <div className="space-y-4 py-2">
            <div className="space-y-1">
              <Label>{t('receiver')}</Label>
              <p className="text-sm text-base-content/80">{receiverDisplayName}</p>
            </div>

            {showContextWallet ? (
              <fieldset className="space-y-2" disabled={formDisabled}>
                <legend className="text-sm font-medium">{t('sourceLabel')}</legend>
                <label
                  className={cn(
                    'flex cursor-pointer items-start gap-2 rounded-md border p-3 text-sm',
                    sourceChoice === 'global' && 'border-primary bg-primary/5',
                  )}
                >
                  <input
                    type="radio"
                    name="merit-transfer-source"
                    className="mt-1"
                    checked={sourceChoice === 'global'}
                    onChange={() => {
                      setSourceChoice('global');
                      setTargetChoice('global');
                    }}
                  />
                  <span>
                    <span className="font-medium">{t('sourceGlobal')}</span>
                    <span className="ml-2 text-base-content/60">({globalBal})</span>
                  </span>
                </label>
                <label
                  className={cn(
                    'flex cursor-pointer items-start gap-2 rounded-md border p-3 text-sm',
                    sourceChoice === 'context' && 'border-primary bg-primary/5',
                  )}
                >
                  <input
                    type="radio"
                    name="merit-transfer-source"
                    className="mt-1"
                    checked={sourceChoice === 'context'}
                    onChange={() => setSourceChoice('context')}
                  />
                  <span>
                    <span className="font-medium">{contextWalletLabel}</span>
                    <span className="ml-2 text-base-content/60">({contextBal})</span>
                  </span>
                </label>
              </fieldset>
            ) : null}

            {showContextWallet && sourceChoice === 'global' ? (
              <fieldset className="space-y-2" disabled={formDisabled}>
                <legend className="text-sm font-medium">{t('targetLabel')}</legend>
                <label
                  className={cn(
                    'flex cursor-pointer items-start gap-2 rounded-md border p-3 text-sm',
                    targetChoice === 'global' && 'border-primary bg-primary/5',
                  )}
                >
                  <input
                    type="radio"
                    name="merit-transfer-target"
                    className="mt-1"
                    checked={targetChoice === 'global'}
                    onChange={() => setTargetChoice('global')}
                  />
                  <span className="font-medium">{t('targetGlobal')}</span>
                </label>
                <label
                  className={cn(
                    'flex cursor-pointer items-start gap-2 rounded-md border p-3 text-sm',
                    targetChoice === 'context' && 'border-primary bg-primary/5',
                  )}
                >
                  <input
                    type="radio"
                    name="merit-transfer-target"
                    className="mt-1"
                    checked={targetChoice === 'context'}
                    onChange={() => setTargetChoice('context')}
                  />
                  <span className="font-medium">
                    {isProject ? t('targetContextProject') : t('targetContextCommunity')}
                  </span>
                </label>
              </fieldset>
            ) : null}

            <div className="space-y-2">
              <Label htmlFor="merit-transfer-amount">{t('amountLabel')}</Label>
              <AmountStepper
                id="merit-transfer-amount"
                value={amount}
                onChange={setAmount}
                min={1}
                max={Math.max(1, selectedSourceBalance)}
                placeholder="1"
                disabled={formDisabled || selectedSourceBalance < 1}
              />
              <p className="text-xs text-base-content/60">
                {t('availableBalance', { balance: selectedSourceBalance })}
              </p>
              {selectedSourceBalance < 1 ? (
                <p className="text-xs text-destructive">{t('insufficientBalance')}</p>
              ) : null}
            </div>

            <div className="space-y-2">
              <Label htmlFor="merit-transfer-comment">{t('commentLabel')}</Label>
              <Textarea
                id="merit-transfer-comment"
                value={comment}
                onChange={(ev) => setComment(ev.target.value)}
                placeholder={t('commentPlaceholder')}
                disabled={formDisabled}
                rows={4}
                className="resize-y min-h-[88px]"
              />
            </div>
          </div>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={isSubmitting}
            >
              {t('cancel')}
            </Button>
            <Button type="submit" disabled={formDisabled || selectedSourceBalance < 1}>
              {isSubmitting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  {t('submitting')}
                </>
              ) : (
                t('confirm')
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
