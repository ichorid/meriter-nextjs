'use client';

import { AppShell } from '@/components/app-shell';
import { Card, EmptyState } from '@/components/ui';
import { trpc } from '@/lib/trpc/client';
import { useUzzCommunityId } from '@/lib/use-uzz-community';
import { formatWhen, ledgerTypeLabel } from '@/lib/utils';

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
            Заслуги для комиссии и благодарностей. Права на обмен — не баланс, они во вкладке «Моё».
          </p>
        </header>

        <Card>
          <p className="text-xs uppercase tracking-wide text-stitch-muted">Сейчас</p>
          <p className="mt-1 text-3xl font-extrabold text-stitch-accent">
            {balance.isLoading ? '…' : (balance.data?.balance ?? 0)}
          </p>
          <p className="mt-1 text-sm text-stitch-muted">заслуг</p>
        </Card>

        <section className="space-y-3">
          <h2 className="font-extrabold">История</h2>
          {!ledger.data?.length && !ledger.isLoading ? (
            <EmptyState title="Пока нет операций">
              Комиссия сделки, таяние номинала и переход права появятся здесь.
            </EmptyState>
          ) : ledger.isLoading ? (
            <p className="text-sm text-stitch-muted">Загрузка…</p>
          ) : (
            <ul className="space-y-2">
              {ledger.data.map((row) => (
                <li key={row.id}>
                  <Card className="py-3">
                    <p className="font-medium">{ledgerTypeLabel(row.type)}</p>
                    <p className="text-xs text-stitch-muted">{formatWhen(row.createdAt)}</p>
                    {typeof row.payload?.from === 'number' && typeof row.payload?.to === 'number' ? (
                      <p className="text-sm text-stitch-muted">
                        {row.payload.from} ₽ → {row.payload.to} ₽
                      </p>
                    ) : null}
                    {typeof row.payload?.amount === 'number' ? (
                      <p className="text-sm text-stitch-muted">{row.payload.amount} заслуг</p>
                    ) : null}
                    {typeof row.payload?.dealAmountRub === 'number' ? (
                      <p className="text-sm text-stitch-muted">
                        сделка на {row.payload.dealAmountRub} ₽
                      </p>
                    ) : null}
                  </Card>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </AppShell>
  );
}
