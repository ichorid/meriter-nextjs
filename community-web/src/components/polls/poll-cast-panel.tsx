'use client';

import { useMemo, useState } from 'react';
import { trpc } from '@/lib/trpc/client';
import { hapticError, hapticSuccess } from '@/lib/telegram-env';
import { PollAmountPicker } from './poll-amount-picker';
import { PollOptionBars } from './poll-option-bars';
import {
  isPollFinished,
  optionDown,
  optionNet,
  optionUp,
  type PollView,
} from './poll-types';

type MyCastTotals = {
  up: number;
  down: number;
};

export function PollCastPanel({
  poll,
  communityId,
}: {
  poll: PollView;
  communityId: string;
}) {
  const [selectedOptionId, setSelectedOptionId] = useState<string | null>(null);
  const [amount, setAmount] = useState(1);
  const [error, setError] = useState<string | null>(null);
  const utils = trpc.useUtils();

  const finished = isPollFinished(poll);
  const quotaAllowed = poll.settings?.quotaAllowed === true;
  const canCast = poll.permissions?.canCast !== false && !finished;

  const walletQuery = trpc.wallets.getByCommunity.useQuery({
    userId: 'me',
    communityId,
  });
  const quotaQuery = trpc.wallets.getQuota.useQuery(
    { userId: 'me', communityId },
    { enabled: quotaAllowed },
  );
  const myCastsQuery = trpc.polls.getMyCasts.useQuery({ id: poll.id });

  const walletBalance = walletQuery.data?.balance ?? 0;
  const quotaRemaining = quotaAllowed ? (quotaQuery.data?.remaining ?? 0) : 0;

  const myTotalsByOption = useMemo(() => {
    const totals = new Map<string, MyCastTotals>();
    for (const cast of myCastsQuery.data ?? []) {
      const entry = totals.get(cast.optionId) ?? { up: 0, down: 0 };
      const castAmount = (cast.amountQuota ?? 0) + (cast.amountWallet ?? 0);
      if ((cast.direction ?? 'up') === 'down') {
        entry.down += castAmount;
      } else {
        entry.up += castAmount;
      }
      totals.set(cast.optionId, entry);
    }
    return totals;
  }, [myCastsQuery.data]);

  const castMutation = trpc.polls.cast.useMutation({
    onSuccess: async () => {
      hapticSuccess();
      setError(null);
      await Promise.all([
        utils.polls.getById.invalidate({ id: poll.id }),
        utils.polls.getMyCasts.invalidate({ id: poll.id }),
        utils.polls.getCasts.invalidate(),
        utils.polls.listByCommunity.invalidate({ communityId }),
        utils.wallets.getByCommunity.invalidate({ userId: 'me', communityId }),
        utils.wallets.getQuota.invalidate({ userId: 'me', communityId }),
      ]);
    },
    onError: (err) => {
      hapticError();
      setError(err.message || 'Не удалось проголосовать.');
    },
  });

  const submit = (direction: 'up' | 'down') => {
    if (!selectedOptionId) return;
    setError(null);

    if (direction === 'down' && amount > walletBalance) {
      hapticError();
      setError('Голос «против» — только с кошелька, заслуг не хватает.');
      return;
    }
    const availableForUp = quotaAllowed ? quotaRemaining + walletBalance : walletBalance;
    if (direction === 'up' && amount > availableForUp) {
      hapticError();
      setError('Не хватает заслуг.');
      return;
    }

    let quotaAmount = 0;
    let walletAmount = amount;
    if (direction === 'up' && quotaAllowed) {
      quotaAmount = Math.min(amount, quotaRemaining);
      walletAmount = amount - quotaAmount;
    }

    castMutation.mutate({
      pollId: poll.id,
      data: { optionId: selectedOptionId, quotaAmount, walletAmount, direction },
    });
  };

  const maxAbsValue = Math.max(
    1,
    ...poll.options.flatMap((opt) => [
      optionUp(opt),
      optionDown(opt),
      Math.abs(optionNet(opt)),
    ]),
  );

  return (
    <section className="rounded-xl border border-stitch-border bg-stitch-surface p-4 space-y-4">
      <ul className="space-y-3">
        {poll.options.map((opt) => {
          const selected = selectedOptionId === opt.id;
          const mine = myTotalsByOption.get(opt.id);
          return (
            <li key={opt.id}>
              <button
                type="button"
                disabled={!canCast || castMutation.isPending}
                onClick={() => setSelectedOptionId(selected ? null : opt.id)}
                className={`w-full rounded-lg border px-3 py-3 text-left transition-colors ${
                  selected
                    ? 'border-primary bg-primary/10'
                    : 'border-stitch-border hover:border-primary/50'
                } ${!canCast ? 'cursor-default opacity-80' : ''}`}
              >
                <div className="mb-2 flex items-start justify-between gap-2 text-sm">
                  <span className="font-medium">{opt.text}</span>
                  {mine && (mine.up > 0 || mine.down > 0) && (
                    <span className="shrink-0 text-xs text-stitch-muted">
                      Вы:{' '}
                      {mine.up > 0 && <span className="text-green-400">+{mine.up}</span>}
                      {mine.up > 0 && mine.down > 0 && ' / '}
                      {mine.down > 0 && <span className="text-red-400">−{mine.down}</span>}
                    </span>
                  )}
                </div>
                <PollOptionBars option={opt} maxAbsValue={maxAbsValue} />
              </button>
            </li>
          );
        })}
      </ul>

      {finished && (
        <p className="text-sm text-stitch-muted">
          Голосование завершено — новые голоса не принимаются.
        </p>
      )}

      {canCast && (
        <div className="space-y-3 border-t border-stitch-border pt-3">
          <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
            <span className="font-semibold">Сколько заслуг отдать</span>
            <span className="text-xs text-stitch-muted">
              Кошелёк: {walletBalance}
              {quotaAllowed && ` · Ежедневные: ${quotaRemaining}`}
            </span>
          </div>

          <PollAmountPicker
            value={amount}
            onChange={setAmount}
            disabled={castMutation.isPending}
          />

          {quotaAllowed ? (
            <p className="text-xs text-stitch-muted">
              «За» — сначала ежедневные заслуги, затем кошелёк. «Против» — только кошелёк,
              заслуги сгорают.
            </p>
          ) : (
            <p className="text-xs text-stitch-muted">
              Голос оплачивается с кошелька. «Против» — заслуги сгорают.
            </p>
          )}

          {error && <p className="text-sm text-red-400">{error}</p>}

          <div className="flex flex-col gap-2 sm:flex-row">
            <button
              type="button"
              disabled={!selectedOptionId || castMutation.isPending}
              onClick={() => submit('up')}
              className="min-h-[44px] flex-1 rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-50"
            >
              За
            </button>
            <button
              type="button"
              disabled={!selectedOptionId || castMutation.isPending}
              onClick={() => submit('down')}
              className="min-h-[44px] flex-1 rounded-lg border border-stitch-border bg-stitch-canvas px-4 py-2.5 text-sm font-semibold text-red-400 disabled:opacity-50"
            >
              Против
            </button>
          </div>

          {!selectedOptionId && (
            <p className="text-xs text-stitch-muted">Выберите вариант, чтобы проголосовать.</p>
          )}
        </div>
      )}
    </section>
  );
}
