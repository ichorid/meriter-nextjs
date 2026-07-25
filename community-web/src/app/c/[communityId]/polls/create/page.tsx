'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { AuthGate } from '@/components/shell';
import { CommunityShell } from '@/components/community-shell';
import { useCommunityId } from '@/lib/use-route-params';
import { trpc } from '@/lib/trpc/client';
import { hapticError, hapticSuccess } from '@/lib/telegram-env';
import { fromDatetimeLocalValue, toDatetimeLocalValue } from '@/lib/format-dates';
import { useTelegramBackButton } from '@/lib/use-telegram-chrome';

const MAX_OPTIONS = 8;

function newOptionId(): string {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return `opt-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

function defaultDeadline(): string {
  return toDatetimeLocalValue(new Date(Date.now() + 24 * 60 * 60 * 1000));
}

function PollCreateInner({ communityId }: { communityId: string }) {
  const router = useRouter();
  const utils = trpc.useUtils();
  const communityQuery = trpc.communities.getById.useQuery({ id: communityId });

  const [question, setQuestion] = useState('');
  const [description, setDescription] = useState('');
  const [options, setOptions] = useState([
    { id: newOptionId(), text: '' },
    { id: newOptionId(), text: '' },
  ]);
  const [deadline, setDeadline] = useState(defaultDeadline);
  const [quotaAllowed, setQuotaAllowed] = useState(false);

  const backButtonActive = useTelegramBackButton({
    visible: true,
    onClick: () => router.push(`/c/${communityId}/polls`),
  });

  const createMutation = trpc.polls.create.useMutation({
    onSuccess: async (poll) => {
      hapticSuccess();
      await utils.polls.listByCommunity.invalidate({ communityId });
      router.push(`/c/${communityId}/polls/${poll.id}`);
    },
    onError: () => hapticError(),
  });

  const isLead = communityQuery.data?.isAdmin === true;
  const pollCreation = communityQuery.data?.settings?.pollCreation ?? 'members';
  const canCreate = pollCreation === 'members' || isLead;

  const filledOptions = options.filter((opt) => opt.text.trim());
  const deadlineValid = Boolean(deadline) && new Date(deadline).getTime() > Date.now();
  const canSubmit =
    Boolean(question.trim()) &&
    filledOptions.length >= 2 &&
    deadlineValid &&
    !createMutation.isPending;

  const submit = () => {
    if (!canSubmit) return;
    createMutation.mutate({
      communityId,
      question: question.trim(),
      description: description.trim() || undefined,
      options: filledOptions.map((opt) => ({ id: opt.id, text: opt.text.trim() })),
      expiresAt: fromDatetimeLocalValue(deadline),
      settings: { quotaAllowed },
    });
  };

  return (
    <CommunityShell communityId={communityId} active="polls" tgActive="polls">
      <div className="space-y-6">
        {!backButtonActive && (
          <Link
            href={`/c/${communityId}/polls`}
            className="text-sm text-primary hover:underline"
          >
            ← Голосования
          </Link>
        )}

        <h1 className="text-xl font-extrabold tracking-tight">Новое голосование</h1>

        {communityQuery.isLoading && (
          <p className="text-sm text-stitch-muted">Загрузка…</p>
        )}

        {!communityQuery.isLoading && !canCreate && (
          <p className="rounded-xl border border-stitch-border bg-stitch-surface px-4 py-3 text-sm text-stitch-muted">
            Создавать голосования в этом сообществе может только лид.
          </p>
        )}

        {!communityQuery.isLoading && canCreate && (
          <div className="rounded-xl border border-stitch-border bg-stitch-surface p-4 space-y-4">
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

            <label className="flex items-start gap-3 text-sm">
              <input
                type="checkbox"
                className="mt-0.5"
                checked={quotaAllowed}
                onChange={(e) => setQuotaAllowed(e.target.checked)}
              />
              <span>
                Разрешить ежедневные заслуги
                <span className="block text-xs text-stitch-muted">
                  Голоса «за» смогут тратить дневную квоту. Иначе — только кошелёк.
                </span>
              </span>
            </label>

            <div className="flex flex-col gap-2 sm:flex-row">
              <button
                type="button"
                disabled={!canSubmit}
                onClick={submit}
                className="min-h-[44px] rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white disabled:opacity-50 sm:flex-1"
              >
                Опубликовать голосование
              </button>
              <button
                type="button"
                onClick={() => router.push(`/c/${communityId}/polls`)}
                className="min-h-[44px] rounded-lg px-4 py-2 text-sm text-stitch-muted hover:bg-stitch-canvas sm:flex-1"
              >
                Отмена
              </button>
            </div>

            {createMutation.isError && (
              <p className="text-sm text-red-400">Не удалось создать голосование.</p>
            )}
          </div>
        )}
      </div>
    </CommunityShell>
  );
}

export default function PollCreatePage() {
  const communityId = useCommunityId();
  return (
    <AuthGate>
      <PollCreateInner communityId={communityId} />
    </AuthGate>
  );
}
