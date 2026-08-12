'use client';

import { AppShell } from '@/components/app-shell';
import { config } from '@/config';
import { trpc } from '@/lib/trpc/client';

export default function WalletPage() {
  const communityId = config.defaultCommunityId;
  const enabled = Boolean(communityId);

  const balance = trpc.wallet.getBalance.useQuery(
    { communityId },
    { enabled, retry: false },
  );

  return (
    <AppShell>
      <div className="space-y-6">
        <header className="space-y-2">
          <h1 className="text-2xl font-extrabold tracking-tight">Кошелёк</h1>
          <p className="text-sm text-stitch-muted">Баланс заслуг в контексте площадки.</p>
        </header>

        <section className="rounded-xl border border-stitch-border bg-stitch-surface p-5">
          <p className="text-xs uppercase tracking-wide text-stitch-muted">Баланс</p>
          {balance.isLoading ? (
            <p className="mt-1 text-sm text-stitch-muted">Загрузка…</p>
          ) : balance.isError ? (
            <p className="mt-1 text-sm text-stitch-muted">Нужна сессия.</p>
          ) : (
            <p className="mt-1 text-3xl font-extrabold text-stitch-accent">
              {balance.data?.balance ?? 0}
            </p>
          )}
          <p className="mt-1 text-sm text-stitch-muted">Заслуги</p>
        </section>

        <section className="space-y-3">
          <h2 className="font-extrabold">История</h2>
          <div className="rounded-xl border border-dashed border-stitch-border bg-stitch-surface/60 p-6 text-sm text-stitch-muted">
            Личный журнал операций в API пока недоступен — показан только баланс.
          </div>
        </section>
      </div>
    </AppShell>
  );
}
