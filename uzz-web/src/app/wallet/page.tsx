'use client';

import { AppShell } from '@/components/app-shell';
import { trpc } from '@/lib/trpc/client';
import { useUzzCommunityId } from '@/lib/use-uzz-community';
import { ledgerTypeLabel } from '@/lib/utils';

export default function WalletPage() {
  const { communityId, loggedIn } = useUzzCommunityId();
  const enabled = Boolean(communityId) && loggedIn;

  const balance = trpc.wallet.getBalance.useQuery({ communityId }, { enabled, retry: false });
  const ledger = trpc.ledger.listMine.useQuery(
    { communityId, limit: 50 },
    { enabled, retry: false },
  );

  return (
    <AppShell>
      <div className="space-y-6">
        <header className="space-y-2">
          <h1 className="text-2xl font-extrabold tracking-tight">Кошелёк</h1>
          <p className="text-sm text-stitch-muted">
            Заслуги для комиссии сделки и благодарностей. Права на обмен — не баланс, они на вкладке
            «Моё».
          </p>
        </header>

        <section className="rounded-xl border border-stitch-border bg-stitch-surface p-5">
          <p className="text-xs uppercase tracking-wide text-stitch-muted">Баланс</p>
          {balance.isLoading ? (
            <p className="mt-1 text-sm text-stitch-muted">Загрузка…</p>
          ) : (
            <p className="mt-1 text-3xl font-extrabold text-stitch-accent">
              {balance.data?.balance ?? 0}
            </p>
          )}
          <p className="mt-1 text-sm text-stitch-muted">Заслуги</p>
        </section>

        <section className="space-y-3">
          <h2 className="font-extrabold">История</h2>
          {!ledger.data?.length ? (
            <div className="rounded-xl border border-dashed border-stitch-border bg-stitch-surface/60 p-6 text-sm text-stitch-muted">
              Пока нет операций.
            </div>
          ) : (
            <ul className="space-y-2">
              {ledger.data.map((row) => (
                <li
                  key={row.id}
                  className="rounded-xl border border-stitch-border bg-stitch-surface px-4 py-3 text-sm"
                >
                  <p className="font-medium">{ledgerTypeLabel(row.type)}</p>
                  {typeof row.payload?.from === 'number' && typeof row.payload?.to === 'number' ? (
                    <p className="text-stitch-muted">
                      {row.payload.from} ₽ → {row.payload.to} ₽
                    </p>
                  ) : null}
                  {typeof row.payload?.amount === 'number' ? (
                    <p className="text-stitch-muted">{row.payload.amount} заслуг</p>
                  ) : null}
                  {typeof row.payload?.dealAmountRub === 'number' ? (
                    <p className="text-stitch-muted">сделка на {row.payload.dealAmountRub} ₽</p>
                  ) : null}
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </AppShell>
  );
}
