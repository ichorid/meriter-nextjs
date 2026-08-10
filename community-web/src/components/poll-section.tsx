'use client';

import { useState } from 'react';
import { trpc } from '@/lib/trpc/client';
import { hapticError, hapticSuccess } from '@/lib/telegram-env';

type PollOption = {
  id?: string;
  text: string;
  votes?: number;
  casterCount?: number;
};

type PollItem = {
  id: string;
  question: string;
  description?: string | null;
  options: PollOption[];
  expiresAt: string;
  isActive?: boolean;
  permissions?: {
    canEdit?: boolean;
    canDelete?: boolean;
    canCast?: boolean;
  };
};

function newOptionId(): string {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return `opt-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

function isPollExpired(expiresAt: string): boolean {
  return new Date(expiresAt).getTime() <= Date.now();
}

function PollCreateForm({ communityId }: { communityId: string }) {
  const [open, setOpen] = useState(false);
  const [question, setQuestion] = useState('');
  const [description, setDescription] = useState('');
  const [hours, setHours] = useState('24');
  const [options, setOptions] = useState([
    { id: newOptionId(), text: '' },
    { id: newOptionId(), text: '' },
  ]);
  const utils = trpc.useUtils();

  const createMutation = trpc.polls.create.useMutation({
    onSuccess: async () => {
      hapticSuccess();
      setQuestion('');
      setDescription('');
      setHours('24');
      setOptions([
        { id: newOptionId(), text: '' },
        { id: newOptionId(), text: '' },
      ]);
      setOpen(false);
      await utils.polls.getByCommunity.invalidate({ communityId });
    },
    onError: () => hapticError(),
  });

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="text-sm text-primary hover:underline"
      >
        Создать опрос
      </button>
    );
  }

  return (
    <div className="rounded-xl border border-stitch-border bg-stitch-surface p-4 space-y-3">
      <h3 className="font-semibold">Новый опрос</h3>
      <input
        className="w-full rounded-lg border border-stitch-border bg-stitch-canvas px-3 py-2 text-sm"
        placeholder="Вопрос"
        value={question}
        onChange={(e) => setQuestion(e.target.value)}
      />
      <textarea
        className="w-full min-h-[60px] rounded-lg border border-stitch-border bg-stitch-canvas px-3 py-2 text-sm"
        placeholder="Описание (необязательно)"
        value={description}
        onChange={(e) => setDescription(e.target.value)}
      />
      <div className="space-y-2">
        {options.map((opt, index) => (
          <div key={opt.id} className="flex gap-2">
            <input
              className="flex-1 rounded-lg border border-stitch-border bg-stitch-canvas px-3 py-2 text-sm"
              placeholder={`Вариант ${index + 1}`}
              value={opt.text}
              onChange={(e) =>
                setOptions((prev) =>
                  prev.map((o) =>
                    o.id === opt.id ? { ...o, text: e.target.value } : o,
                  ),
                )
              }
            />
            {options.length > 2 && (
              <button
                type="button"
                className="text-xs text-stitch-muted hover:text-red-400"
                onClick={() =>
                  setOptions((prev) => prev.filter((o) => o.id !== opt.id))
                }
              >
                ✕
              </button>
            )}
          </div>
        ))}
        {options.length < 8 && (
          <button
            type="button"
            className="text-sm text-primary hover:underline"
            onClick={() =>
              setOptions((prev) => [...prev, { id: newOptionId(), text: '' }])
            }
          >
            + Вариант
          </button>
        )}
      </div>
      <label className="flex items-center gap-2 text-sm text-stitch-muted">
        Длительность (часы)
        <input
          type="number"
          min={1}
          max={720}
          className="w-20 rounded-lg border border-stitch-border bg-stitch-canvas px-2 py-1"
          value={hours}
          onChange={(e) => setHours(e.target.value)}
        />
      </label>
      <div className="flex flex-col gap-2 sm:flex-row">
        <button
          type="button"
          disabled={createMutation.isPending}
          onClick={() => {
            const filled = options.filter((o) => o.text.trim());
            const durationHours = Math.max(1, parseInt(hours, 10) || 24);
            const expiresAt = new Date(
              Date.now() + durationHours * 60 * 60 * 1000,
            ).toISOString();
            createMutation.mutate({
              communityId,
              question: question.trim(),
              description: description.trim() || undefined,
              options: filled.map((o) => ({ id: o.id, text: o.text.trim() })),
              expiresAt,
            });
          }}
          className="min-h-[44px] rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white disabled:opacity-50 sm:flex-1"
        >
          Опубликовать опрос
        </button>
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="min-h-[44px] rounded-lg px-4 py-2 text-sm text-stitch-muted hover:bg-stitch-canvas sm:flex-1"
        >
          Отмена
        </button>
      </div>
      {createMutation.isError && (
        <p className="text-sm text-red-400">Не удалось создать опрос.</p>
      )}
    </div>
  );
}

function PollCard({
  poll,
  communityId,
}: {
  poll: PollItem;
  communityId: string;
}) {
  const [selectedOptionId, setSelectedOptionId] = useState<string | null>(null);
  const [amount, setAmount] = useState(1);
  const [editing, setEditing] = useState(false);
  const [editQuestion, setEditQuestion] = useState(poll.question);
  const utils = trpc.useUtils();

  const expired = isPollExpired(poll.expiresAt);
  const canCast = poll.permissions?.canCast !== false && !expired;

  const quotaQuery = trpc.wallets.getQuota.useQuery({
    userId: 'me',
    communityId,
  });
  const balanceQuery = trpc.wallets.getBalance.useQuery({ communityId });

  const castMutation = trpc.polls.cast.useMutation({
    onSuccess: async () => {
      hapticSuccess();
      setSelectedOptionId(null);
      await utils.polls.getByCommunity.invalidate({ communityId });
    },
    onError: () => hapticError(),
  });

  const updateMutation = trpc.polls.update.useMutation({
    onSuccess: async () => {
      setEditing(false);
      await utils.polls.getByCommunity.invalidate({ communityId });
    },
  });

  const deleteMutation = trpc.polls.delete.useMutation({
    onSuccess: async () => {
      await utils.polls.getByCommunity.invalidate({ communityId });
    },
  });

  const totalVotes = poll.options.reduce((sum, o) => sum + (o.votes ?? 0), 0);

  const handleCast = () => {
    if (!selectedOptionId) return;
    const quotaRemaining = quotaQuery.data?.remaining ?? 0;
    const walletBalance = balanceQuery.data?.balance ?? 0;
    const castAmount = Math.max(1, amount);

    let quotaAmount = 0;
    let walletAmount = 0;
    if (quotaRemaining >= castAmount) {
      quotaAmount = castAmount;
    } else if (quotaRemaining > 0) {
      quotaAmount = quotaRemaining;
      walletAmount = castAmount - quotaRemaining;
    } else {
      walletAmount = castAmount;
    }

    if (walletAmount > walletBalance) {
      return;
    }

    castMutation.mutate({
      pollId: poll.id,
      data: { optionId: selectedOptionId, quotaAmount, walletAmount },
    });
  };

  return (
    <article className="rounded-xl border border-stitch-border bg-stitch-surface p-4 space-y-3">
      {editing ? (
        <div className="space-y-2">
          <input
            className="w-full rounded-lg border border-stitch-border bg-stitch-canvas px-3 py-2 text-sm"
            value={editQuestion}
            onChange={(e) => setEditQuestion(e.target.value)}
          />
          <div className="flex gap-2">
            <button
              type="button"
              className="text-sm text-primary"
              disabled={updateMutation.isPending}
              onClick={() =>
                updateMutation.mutate({
                  id: poll.id,
                  data: { question: editQuestion.trim() },
                })
              }
            >
              Сохранить
            </button>
            <button
              type="button"
              className="text-sm text-stitch-muted"
              onClick={() => setEditing(false)}
            >
              Отмена
            </button>
          </div>
        </div>
      ) : (
        <>
          <div className="flex items-start justify-between gap-2">
            <p className="font-medium">{poll.question}</p>
            <div className="flex shrink-0 gap-2">
              {poll.permissions?.canEdit && (
                <button
                  type="button"
                  className="text-xs text-stitch-muted hover:text-primary"
                  onClick={() => setEditing(true)}
                >
                  Изменить
                </button>
              )}
              {poll.permissions?.canDelete && (
                <button
                  type="button"
                  className="text-xs text-stitch-muted hover:text-red-400"
                  disabled={deleteMutation.isPending}
                  onClick={() => deleteMutation.mutate({ id: poll.id })}
                >
                  Удалить
                </button>
              )}
            </div>
          </div>
          {poll.description && (
            <p className="text-sm text-stitch-muted">{poll.description}</p>
          )}
        </>
      )}

      <ul className="space-y-2">
        {poll.options.map((opt) => {
          const votes = opt.votes ?? 0;
          const pct = totalVotes > 0 ? Math.round((votes / totalVotes) * 100) : 0;
          const optionId = opt.id ?? opt.text;
          return (
            <li key={optionId}>
              <button
                type="button"
                disabled={!canCast || castMutation.isPending}
                onClick={() => setSelectedOptionId(opt.id ?? null)}
                className={`w-full rounded-lg border px-3 py-2 text-left text-sm transition-colors ${
                  selectedOptionId === opt.id
                    ? 'border-primary bg-primary/10'
                    : 'border-stitch-border hover:border-primary/50'
                } ${!canCast ? 'cursor-default opacity-80' : ''}`}
              >
                <div className="flex justify-between gap-2">
                  <span>{opt.text}</span>
                  <span className="text-stitch-muted shrink-0">
                    {votes} ({pct}%)
                  </span>
                </div>
                {totalVotes > 0 && (
                  <div className="mt-1 h-1 rounded-full bg-stitch-canvas overflow-hidden">
                    <div
                      className="h-full bg-primary/60"
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                )}
              </button>
            </li>
          );
        })}
      </ul>

      {canCast && selectedOptionId && (
        <div className="flex flex-col gap-2 pt-1 sm:flex-row sm:flex-wrap sm:items-center">
          <label className="text-sm text-stitch-muted">
            Заслуг
            <input
              type="number"
              min={1}
              className="ml-2 w-16 rounded-lg border border-stitch-border bg-stitch-canvas px-2 py-1 text-sm"
              value={amount}
              onChange={(e) => setAmount(Math.max(1, parseInt(e.target.value, 10) || 1))}
            />
          </label>
          <button
            type="button"
            disabled={castMutation.isPending}
            onClick={handleCast}
            className="min-h-[44px] rounded-lg bg-primary px-3 py-2 text-sm text-white disabled:opacity-50 sm:w-auto w-full"
          >
            Проголосовать
          </button>
        </div>
      )}

      <p className="text-xs text-stitch-muted">
        {expired
          ? 'Опрос завершён'
          : `До ${new Date(poll.expiresAt).toLocaleString('ru-RU')}`}
      </p>
      {castMutation.isError && (
        <p className="text-sm text-red-400">Не удалось проголосовать.</p>
      )}
    </article>
  );
}

export function PollSection({ communityId }: { communityId: string }) {
  const pollsQuery = trpc.polls.getByCommunity.useQuery({
    communityId,
    pageSize: 20,
  });

  const polls = (pollsQuery.data?.data ?? []) as PollItem[];

  return (
    <section className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="font-semibold">Опросы</h2>
        <PollCreateForm communityId={communityId} />
      </div>
      {pollsQuery.isLoading && (
        <p className="text-sm text-stitch-muted">Загрузка…</p>
      )}
      {polls.map((poll) => (
        <PollCard key={poll.id} poll={poll} communityId={communityId} />
      ))}
      {!pollsQuery.isLoading && polls.length === 0 && (
        <p className="text-sm text-stitch-muted">Пока нет опросов.</p>
      )}
    </section>
  );
}
