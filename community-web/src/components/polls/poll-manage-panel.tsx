'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { trpc } from '@/lib/trpc/client';
import { hapticError, hapticSuccess } from '@/lib/telegram-env';
import { fromDatetimeLocalValue, toDatetimeLocalValue } from '@/lib/format-dates';
import type { PollView } from '@/components/polls/poll-types';

const MAX_OPTIONS = 8;

function newOptionId(): string {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return `opt-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

type EditOption = { id: string; text: string };

export function PollManagePanel({
  poll,
  communityId,
  onEditingChange,
}: {
  poll: PollView;
  communityId: string;
  onEditingChange?: (editing: boolean) => void;
}) {
  const router = useRouter();
  const utils = trpc.useUtils();
  const [editing, setEditing] = useState(false);

  const setEditingMode = (next: boolean) => {
    setEditing(next);
    onEditingChange?.(next);
  };
  const [question, setQuestion] = useState(poll.question);
  const [description, setDescription] = useState(poll.description ?? '');
  const [options, setOptions] = useState<EditOption[]>(
    poll.options.map((o) => ({ id: o.id, text: o.text })),
  );
  const [deadline, setDeadline] = useState(toDatetimeLocalValue(poll.expiresAt));

  const hasCasts = (poll.metrics?.totalCasts ?? 0) > 0;
  const canEdit = Boolean(poll.permissions?.canEdit) && !hasCasts;
  const canDelete = Boolean(poll.permissions?.canDelete);

  useEffect(() => {
    if (!editing) {
      setQuestion(poll.question);
      setDescription(poll.description ?? '');
      setOptions(poll.options.map((o) => ({ id: o.id, text: o.text })));
      setDeadline(toDatetimeLocalValue(poll.expiresAt));
    }
  }, [poll, editing]);

  const updateMutation = trpc.polls.update.useMutation({
    onSuccess: async () => {
      hapticSuccess();
      setEditingMode(false);
      await Promise.all([
        utils.polls.getById.invalidate({ id: poll.id }),
        utils.polls.listByCommunity.invalidate({ communityId }),
      ]);
    },
    onError: () => hapticError(),
  });

  const deleteMutation = trpc.polls.delete.useMutation({
    onSuccess: async () => {
      hapticSuccess();
      await utils.polls.listByCommunity.invalidate({ communityId });
      router.push(`/c/${communityId}/polls`);
    },
    onError: () => hapticError(),
  });

  if (!canEdit && !canDelete) {
    return null;
  }

  const filledOptions = options.filter((opt) => opt.text.trim());
  const deadlineValid = Boolean(deadline) && new Date(deadline).getTime() > Date.now();
  const canSave =
    Boolean(question.trim()) &&
    filledOptions.length >= 2 &&
    deadlineValid &&
    !updateMutation.isPending;

  const startEdit = () => {
    setQuestion(poll.question);
    setDescription(poll.description ?? '');
    setOptions(poll.options.map((o) => ({ id: o.id, text: o.text })));
    setDeadline(toDatetimeLocalValue(poll.expiresAt));
    setEditingMode(true);
  };

  const save = () => {
    if (!canSave) return;
    updateMutation.mutate({
      id: poll.id,
      data: {
        question: question.trim(),
        description: description.trim() || undefined,
        options: filledOptions.map((opt) => ({
          id: opt.id,
          text: opt.text.trim(),
        })),
        expiresAt: fromDatetimeLocalValue(deadline),
      },
    });
  };

  const remove = () => {
    if (deleteMutation.isPending) return;
    const ok =
      typeof window !== 'undefined' &&
      window.confirm('Удалить голосование? Это действие нельзя отменить.');
    if (!ok) return;
    deleteMutation.mutate({ id: poll.id });
  };

  if (editing && canEdit) {
    return (
      <div className="rounded-xl border border-stitch-border bg-stitch-surface p-4 space-y-4">
        <p className="text-sm font-semibold">Редактирование</p>
        <input
          className="w-full rounded-lg border border-stitch-border bg-stitch-canvas px-3 py-2 text-sm"
          placeholder="Вопрос"
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
        />
        <textarea
          className="w-full min-h-[80px] rounded-lg border border-stitch-border bg-stitch-canvas px-3 py-2 text-sm"
          placeholder="Описание (необязательно)"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
        />

        <div className="space-y-2">
          <p className="text-sm font-semibold">Варианты</p>
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
                  aria-label="Удалить вариант"
                  onClick={() =>
                    setOptions((prev) => prev.filter((o) => o.id !== opt.id))
                  }
                >
                  ✕
                </button>
              )}
            </div>
          ))}
          {options.length < MAX_OPTIONS && (
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

        <label className="block space-y-1 text-sm">
          <span className="font-semibold">Дедлайн</span>
          <input
            type="datetime-local"
            className="w-full rounded-lg border border-stitch-border bg-stitch-canvas px-3 py-2"
            value={deadline}
            onChange={(e) => setDeadline(e.target.value)}
          />
        </label>
        {Boolean(deadline) && !deadlineValid && (
          <p className="text-sm text-red-400">Дедлайн должен быть в будущем.</p>
        )}

        <div className="flex flex-col gap-2 sm:flex-row">
          <button
            type="button"
            disabled={!canSave}
            onClick={save}
            className="min-h-[44px] rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white disabled:opacity-50 sm:flex-1"
          >
            Сохранить
          </button>
          <button
            type="button"
            onClick={() => setEditingMode(false)}
            className="min-h-[44px] rounded-lg px-4 py-2 text-sm text-stitch-muted hover:bg-stitch-canvas sm:flex-1"
          >
            Отмена
          </button>
        </div>

        {updateMutation.isError && (
          <p className="text-sm text-red-400">
            {updateMutation.error.message?.trim() ||
              'Не удалось сохранить голосование.'}
          </p>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-3">
        {canEdit && (
          <button
            type="button"
            onClick={startEdit}
            className="text-sm text-primary hover:underline"
          >
            Редактировать
          </button>
        )}
        {poll.permissions?.canEdit && hasCasts && (
          <span className="text-xs text-stitch-muted">
            Редактирование недоступно: уже есть голоса
          </span>
        )}
        {canDelete && (
          <button
            type="button"
            disabled={deleteMutation.isPending}
            onClick={remove}
            className="text-sm text-red-400 hover:underline disabled:opacity-50"
          >
            Удалить
          </button>
        )}
      </div>
      {deleteMutation.isError && (
        <p className="text-sm text-red-400">
          {deleteMutation.error.message?.trim() ||
            'Не удалось удалить голосование.'}
        </p>
      )}
    </div>
  );
}
