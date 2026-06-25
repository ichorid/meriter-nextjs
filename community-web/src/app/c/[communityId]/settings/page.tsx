'use client';

import { useEffect, useState } from 'react';
import { AuthGate, Shell } from '@/components/shell';
import { trpc } from '@/lib/trpc/client';

function SettingsInner({ communityId }: { communityId: string }) {
  const communityQuery = trpc.communities.getById.useQuery({ id: communityId });
  const updateMutation = trpc.communities.update.useMutation({
    onSuccess: () => communityQuery.refetch(),
  });

  const settings = communityQuery.data?.settings;
  const [postCost, setPostCost] = useState('');
  const [dailyEmission, setDailyEmission] = useState('');

  useEffect(() => {
    if (settings && postCost === '' && dailyEmission === '') {
      setPostCost(String(settings.postCost ?? 0));
      setDailyEmission(String(settings.dailyEmission ?? 0));
    }
  }, [settings, postCost, dailyEmission]);

  return (
    <Shell communityId={communityId} active="settings">
      <div className="space-y-6">
        <h1 className="text-xl font-extrabold tracking-tight">Настройки сообщества</h1>
        {!communityQuery.data && (
          <p className="text-sm text-stitch-muted">Загрузка…</p>
        )}
        {communityQuery.data && (
          <form
            className="space-y-4 rounded-xl border border-stitch-border bg-stitch-surface p-4"
            onSubmit={(e) => {
              e.preventDefault();
              updateMutation.mutate({
                communityId,
                settings: {
                  postCost: Number(postCost) || 0,
                  dailyEmission: Number(dailyEmission) || 0,
                },
              });
            }}
          >
            <p className="text-sm text-stitch-muted">
              Доступно лиду сообщества. Изменения применяются ко всем участникам.
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
              <span>Ежедневная квота (заслуги)</span>
              <input
                type="number"
                min={0}
                className="w-full rounded-lg border border-stitch-border bg-stitch-canvas px-3 py-2"
                value={dailyEmission}
                onChange={(e) => setDailyEmission(e.target.value)}
              />
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
              <p className="text-sm text-red-400">
                Недостаточно прав или ошибка сохранения
              </p>
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
