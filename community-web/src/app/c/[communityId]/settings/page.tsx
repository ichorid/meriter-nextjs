'use client';

import { useEffect, useState } from 'react';
import { AuthGate, Shell } from '@/components/shell';
import { trpc } from '@/lib/trpc/client';

function SettingsInner({ communityId }: { communityId: string }) {
  const meQuery = trpc.users.getMe.useQuery();
  const communityQuery = trpc.communities.getById.useQuery({ id: communityId });
  const updateMutation = trpc.communities.update.useMutation({
    onSuccess: () => communityQuery.refetch(),
  });

  const settings = communityQuery.data?.settings;
  const isLead =
    communityQuery.data?.isAdmin === true ||
    (meQuery.data?.id != null &&
      (communityQuery.data?.adminIds ?? []).includes(meQuery.data.id));

  const [postCost, setPostCost] = useState('');
  const [pollCost, setPollCost] = useState('');
  const [dailyEmission, setDailyEmission] = useState('');
  const [telegramModeration, setTelegramModeration] = useState(false);
  const [initialized, setInitialized] = useState(false);

  useEffect(() => {
    if (settings && !initialized) {
      setPostCost(String(settings.postCost ?? 0));
      setPollCost(String(settings.pollCost ?? 1));
      setDailyEmission(String(settings.dailyEmission ?? 0));
      setTelegramModeration(settings.telegramModerationEnabled ?? false);
      setInitialized(true);
    }
  }, [settings, initialized]);

  return (
    <Shell communityId={communityId} active="settings">
      <div className="space-y-6">
        <h1 className="text-xl font-extrabold tracking-tight">Настройки сообщества</h1>

        {communityQuery.isLoading && (
          <p className="text-sm text-stitch-muted">Загрузка…</p>
        )}

        {communityQuery.data && !isLead && (
          <p className="text-sm text-stitch-muted">
            Настройки доступны только лиду сообщества.
          </p>
        )}

        {communityQuery.data && isLead && (
          <form
            className="space-y-4 rounded-xl border border-stitch-border bg-stitch-surface p-4"
            onSubmit={(e) => {
              e.preventDefault();
              updateMutation.mutate({
                id: communityId,
                data: {
                  settings: {
                    postCost: Number(postCost) || 0,
                    pollCost: Number(pollCost) || 0,
                    dailyEmission: Number(dailyEmission) || 0,
                    telegramModerationEnabled: telegramModeration,
                  },
                },
              });
            }}
          >
            <p className="text-sm text-stitch-muted">
              Изменения применяются ко всем участникам сообщества.
            </p>

            <label className="block space-y-1 text-sm">
              <span>Стоимость поста (заслуги)</span>
              <input
                type="number"
                min={0}
                className="w-full rounded-lg border border-stitch-border bg-stitch-canvas px-3 py-2"
                value={postCost}
                onChange={(e) => setPostCost(e.target.value)}
              />
            </label>

            <label className="block space-y-1 text-sm">
              <span>Стоимость опроса (заслуги)</span>
              <input
                type="number"
                min={0}
                className="w-full rounded-lg border border-stitch-border bg-stitch-canvas px-3 py-2"
                value={pollCost}
                onChange={(e) => setPollCost(e.target.value)}
              />
            </label>

            <label className="block space-y-1 text-sm">
              <span>Ежедневная квота (заслуги)</span>
              <input
                type="number"
                min={0}
                className="w-full rounded-lg border border-stitch-border bg-stitch-canvas px-3 py-2"
                value={dailyEmission}
                onChange={(e) => setDailyEmission(e.target.value)}
              />
            </label>

            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={telegramModeration}
                onChange={(e) => setTelegramModeration(e.target.checked)}
                className="rounded border-stitch-border"
              />
              <span>Модерация публикаций из Telegram (pending до approve)</span>
            </label>

            <button
              type="submit"
              disabled={updateMutation.isPending}
              className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
            >
              Сохранить
            </button>

            {updateMutation.isSuccess && (
              <p className="text-sm text-green-400">Сохранено</p>
            )}
            {updateMutation.isError && (
              <p className="text-sm text-red-400">Ошибка сохранения</p>
            )}
          </form>
        )}
      </div>
    </Shell>
  );
}

export default function SettingsPage({
  params,
}: {
  params: { communityId: string };
}) {
  return (
    <AuthGate>
      <SettingsInner communityId={params.communityId} />
    </AuthGate>
  );
}
