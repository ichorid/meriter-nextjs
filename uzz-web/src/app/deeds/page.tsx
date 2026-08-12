'use client';

import { AppShell } from '@/components/app-shell';
import { config } from '@/config';
import { trpc } from '@/lib/trpc/client';
import { bankStatusLabel } from '@/lib/utils';

export default function DeedsPage() {
  const communityId = config.defaultCommunityId;
  const enabled = Boolean(communityId);

  const deeds = trpc.deeds.list.useQuery({ communityId }, { enabled, retry: false });

  return (
    <AppShell>
      <div className="space-y-6">
        <header className="space-y-2">
          <h1 className="text-2xl font-extrabold tracking-tight">Добрые дела</h1>
          <p className="text-sm text-stitch-muted">
            Прогресс до порога эмиссии банка (по умолчанию 10 заслуг на деле).
          </p>
        </header>

        {deeds.isLoading ? (
          <p className="text-sm text-stitch-muted">Загрузка…</p>
        ) : deeds.isError ? (
          <p className="text-sm text-stitch-muted">Нужна сессия.</p>
        ) : !deeds.data?.length ? (
          <section className="rounded-xl border border-stitch-border bg-stitch-surface p-5">
            <p className="text-sm text-stitch-muted">
              Публикуйте добрые дела в Telegram — здесь появится прогресс и статус банка.
            </p>
          </section>
        ) : (
          <ul className="space-y-3">
            {deeds.data.map((deed) => {
              const pct = Math.min(100, Math.round((deed.progress || 0) * 100));
              return (
                <li
                  key={deed.publicationId}
                  className="rounded-xl border border-stitch-border bg-stitch-surface p-5"
                >
                  <div className="flex items-center justify-between gap-3 text-sm">
                    <span className="font-extrabold">
                      {deed.title?.trim() || `Дело ${deed.publicationId.slice(0, 8)}`}
                    </span>
                    <span className="font-medium">
                      {deed.score} / {deed.emissionThreshold} заслуг
                    </span>
                  </div>
                  <div className="mt-3 h-2 overflow-hidden rounded-full bg-stitch-canvas">
                    <div
                      className="h-full rounded-full bg-stitch-accent"
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                  {deed.bankStatus ? (
                    <p className="mt-2 text-xs text-stitch-muted">
                      банк: {bankStatusLabel(deed.bankStatus)}
                    </p>
                  ) : null}
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </AppShell>
  );
}
