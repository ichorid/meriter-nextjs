'use client';

import { useCallback, useState } from 'react';
import { AmountStepper } from '@/components/amount-stepper';
import { trpc } from '@/lib/trpc/client';
import { hapticError, hapticSuccess } from '@/lib/telegram-env';
import { useTelegramMainButton } from '@/lib/use-telegram-chrome';

type VoteSheetProps = {
  communityId: string;
  publicationId: string;
  authorId: string;
  currentUserId: string;
  onSuccess?: () => void;
};

type Source = 'quota' | 'wallet';

export function VoteSheet({
  communityId,
  publicationId,
  authorId,
  currentUserId,
  onSuccess,
}: VoteSheetProps) {
  const [amount, setAmount] = useState(1);
  const [source, setSource] = useState<Source>('quota');
  const [comment, setComment] = useState('');
  const [error, setError] = useState<string | null>(null);

  const isSelf = authorId === currentUserId;
  const quotaQuery = trpc.wallets.getQuota.useQuery({ communityId });
  const walletQuery = trpc.wallets.getByCommunity.useQuery({ communityId });
  const utils = trpc.useUtils();

  const quotaRemaining = quotaQuery.data?.remainingToday ?? 0;
  const walletBalance = walletQuery.data?.balance ?? 0;

  const voteMutation = trpc.votes.createWithComment.useMutation({
    onSuccess: async () => {
      hapticSuccess();
      setError(null);
      await utils.communities.getFeed.invalidate({ communityId });
      await utils.publications.getById.invalidate({ id: publicationId });
      onSuccess?.();
    },
    onError: (err) => {
      hapticError();
      setError(err.message || 'Не удалось проголосовать');
    },
  });

  const submit = useCallback(
    (direction: 'up' | 'down') => {
      setError(null);
      if (direction === 'down' && amount > walletBalance) {
        hapticError();
        setError('Не хватает заслуг на кошельке');
        return;
      }
      if (direction === 'up' && !isSelf && source === 'quota' && amount > quotaRemaining) {
        if (amount > quotaRemaining + walletBalance) {
          hapticError();
          setError('Не хватает заслуг');
          return;
        }
      }
      if (direction === 'up' && isSelf && amount > walletBalance) {
        hapticError();
        setError('На свой пост — только с кошелька');
        return;
      }

      let quotaAmount = 0;
      let walletAmount = 0;
      if (direction === 'down') {
        walletAmount = amount;
      } else if (isSelf) {
        walletAmount = amount;
      } else if (source === 'quota') {
        quotaAmount = Math.min(amount, quotaRemaining);
        walletAmount = amount - quotaAmount;
      } else {
        walletAmount = amount;
      }

      voteMutation.mutate({
        targetType: 'publication',
        targetId: publicationId,
        direction,
        quotaAmount,
        walletAmount,
        comment: comment.trim() || undefined,
      });
    },
    [
      amount,
      comment,
      isSelf,
      publicationId,
      quotaRemaining,
      source,
      voteMutation,
      walletBalance,
    ],
  );

  const mainButtonActive = useTelegramMainButton({
    text: 'Начислить',
    visible: true,
    enabled: !voteMutation.isPending,
    loading: voteMutation.isPending,
    onClick: () => submit('up'),
  });

  return (
    <section className="rounded-xl border border-stitch-border bg-stitch-surface p-4 space-y-4">
      <h2 className="font-semibold">Заслуги автору</h2>

      {!isSelf && (
        <div className="space-y-2 text-sm">
          <label className="flex items-center gap-2">
            <input
              type="radio"
              name="vote-source"
              checked={source === 'quota'}
              onChange={() => setSource('quota')}
            />
            Ежедневные заслуги (осталось {quotaRemaining})
          </label>
          <label className="flex items-center gap-2">
            <input
              type="radio"
              name="vote-source"
              checked={source === 'wallet'}
              onChange={() => setSource('wallet')}
            />
            Кошелёк ({walletBalance} засл.)
          </label>
        </div>
      )}

      {isSelf && (
        <p className="text-xs text-stitch-muted">
          На свой пост — только с кошелька ({walletBalance}).
        </p>
      )}

      <AmountStepper
        value={amount}
        min={1}
        max={Math.max(1, isSelf ? walletBalance : quotaRemaining + walletBalance)}
        onChange={setAmount}
      />

      <textarea
        className="w-full min-h-[60px] rounded-lg border border-stitch-border bg-stitch-canvas px-3 py-2 text-sm"
        placeholder="Комментарий (необязательно)"
        value={comment}
        onChange={(e) => setComment(e.target.value)}
      />

      {error && <p className="text-sm text-red-400">{error}</p>}

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          disabled={voteMutation.isPending}
          onClick={() => submit('up')}
          className={`flex-1 rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-50${mainButtonActive ? ' hidden' : ''}`}
        >
          Начислить
        </button>
        <button
          type="button"
          disabled={voteMutation.isPending}
          onClick={() => submit('down')}
          className="flex-1 rounded-lg border border-stitch-border bg-stitch-canvas px-4 py-2.5 text-sm font-semibold disabled:opacity-50"
        >
          Списать
        </button>
      </div>
    </section>
  );
}
