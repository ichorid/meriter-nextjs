'use client';

import { useState } from 'react';
import { AmountStepper } from '@/components/amount-stepper';
import { trpc } from '@/lib/trpc/client';
import { hapticError, hapticSuccess } from '@/lib/telegram-env';

type MemberTransferInlineProps = {
  communityId: string;
  receiverId: string;
  receiverLabel: string;
  walletBalance: number;
  onSuccess?: () => void;
};

export function MemberTransferInline({
  communityId,
  receiverId,
  receiverLabel,
  walletBalance,
  onSuccess,
}: MemberTransferInlineProps) {
  const [open, setOpen] = useState(false);
  const [amount, setAmount] = useState(1);
  const [comment, setComment] = useState('');
  const [error, setError] = useState<string | null>(null);
  const utils = trpc.useUtils();

  const transferMutation = trpc.meritTransfer.create.useMutation({
    onSuccess: async () => {
      hapticSuccess();
      setError(null);
      setOpen(false);
      setAmount(1);
      setComment('');
      await utils.wallets.getByCommunity.invalidate({ userId: 'me', communityId });
      await utils.communities.getMembers.invalidate({ id: communityId });
      await utils.wallets.getTransactions.invalidate();
      onSuccess?.();
    },
    onError: (err) => {
      hapticError();
      const msg =
        err.message.includes('Insufficient') || err.message.includes('insufficient')
          ? 'Не хватает заслуг'
          : err.message || 'Не удалось перевести';
      setError(msg);
    },
  });

  const submit = () => {
    if (amount <= 0) {
      hapticError();
      setError('Укажите положительную сумму');
      return;
    }
    if (amount > walletBalance) {
      hapticError();
      setError('Не хватает заслуг');
      return;
    }
    transferMutation.mutate({
      receiverId,
      communityContextId: communityId,
      amount,
      comment: comment.trim() || undefined,
      sourceWalletType: 'community',
      sourceContextId: communityId,
      targetWalletType: 'community',
      targetContextId: communityId,
    });
  };

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="mt-3 min-h-[40px] w-full rounded-lg border border-primary/40 bg-primary/10 px-3 py-2 text-sm font-medium text-primary"
      >
        Передать заслуги
      </button>
    );
  }

  return (
    <div className="mt-3 space-y-3 rounded-lg border border-stitch-border bg-stitch-canvas p-3">
      <p className="text-sm font-medium">Перевод → {receiverLabel}</p>
      <p className="text-xs text-stitch-muted">Доступно: {walletBalance} заслуг</p>
      <AmountStepper
        value={amount}
        min={1}
        max={Math.max(1, walletBalance)}
        onChange={setAmount}
      />
      <label className="block space-y-1">
        <span className="text-xs text-stitch-muted">За что (необязательно)</span>
        <input
          type="text"
          value={comment}
          onChange={(e) => setComment(e.target.value)}
          maxLength={500}
          placeholder="Например: за помощь с проектом"
          className="w-full rounded-lg border border-stitch-border bg-stitch-surface px-3 py-2 text-sm"
        />
      </label>
      {error ? <p className="text-xs text-red-400">{error}</p> : null}
      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => {
            setOpen(false);
            setError(null);
          }}
          className="min-h-[40px] flex-1 rounded-lg border border-stitch-border px-3 py-2 text-sm"
        >
          Отмена
        </button>
        <button
          type="button"
          onClick={submit}
          disabled={transferMutation.isPending || walletBalance <= 0}
          className="min-h-[40px] flex-1 rounded-lg bg-primary px-3 py-2 text-sm font-medium text-white disabled:opacity-50"
        >
          {transferMutation.isPending ? '…' : `Передать ${amount}`}
        </button>
      </div>
    </div>
  );
}
