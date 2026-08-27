'use client';
import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { AppShell } from '@/components/app-shell';
import { Button, Card, EmptyState, PageHeader, QueryFailed, Skeleton, userContentClass } from '@/components/ui';
import { ledgerRowView, visibleLedgerRows, type LedgerRowContext } from '@/lib/ledger-view';
import { trpc } from '@/lib/trpc/client';
import { useUzzCommunityId } from '@/lib/use-uzz-community';
import { cn, formatWhen, meritsWord, walletSourceLabel } from '@/lib/utils';

type LedgerCursor = { createdAt: Date | string; id: string };
type LedgerRow = {
  id: string;
  type: string;
  amount: number;
  createdAt: Date | string;
  metadata?: Record<string, unknown>;
  context?: LedgerRowContext;
};

export default function WalletPage() {
  const { communityId, loggedIn } = useUzzCommunityId();
  const enabled = Boolean(communityId) && loggedIn;
  const [cursor, setCursor] = useState<LedgerCursor | undefined>(undefined);
  const [items, setItems] = useState<LedgerRow[]>([]);
  const [showAllEvents, setShowAllEvents] = useState(false);
  const balance = trpc.wallet.getBalance.useQuery({ communityId }, { enabled, retry: false });
  const ledger = trpc.ledger.listMine.useQuery({ communityId, limit: 30, cursor }, { enabled, retry: false });

  useEffect(() => {
    if (!ledger.data) return;
    setItems((current) => {
      const incoming = ledger.data.items;
      if (!cursor) return incoming;
      const seen = new Set(current.map((row) => row.id));
      return [...current, ...incoming.filter((row) => !seen.has(row.id))];
    });
  }, [cursor, ledger.data]);

  const nextCursor = ledger.data?.nextCursor ?? null;
  const shared = balance.data?.mode === 'shared';
  const visible = useMemo(() => visibleLedgerRows(items, showAllEvents), [items, showAllEvents]);

  return <AppShell><div className="space-y-8"><PageHeader eyebrow="Заслуги для комиссии" title="Кошелёк">Это не номинал банка на обмен. При создании сделки 1 заслуга резервируется сначала здесь, в сообществе, и только затем — в общем кошельке.</PageHeader>
    {balance.isError ? <QueryFailed onRetry={() => void balance.refetch()} error={balance.error} /> : balance.isLoading || !balance.data ? <Skeleton className="h-40" /> : shared ? <BalanceCard label="Баланс сообщества" value={balance.data.totalBalance} priority="Единый кошелёк сообщества" /> : <div className="grid gap-4 sm:grid-cols-2"><BalanceCard label="В этом сообществе" value={balance.data.localBalance} priority="Списывается первым" /><BalanceCard label="Общий кошелёк" value={balance.data.globalBalance} priority="Резервный источник" /></div>}
    <section className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-xl font-black">История</h2>
        {items.length ? <label className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-stitch-border px-4 text-sm text-stitch-muted"><input type="checkbox" checked={showAllEvents} onChange={(event) => setShowAllEvents(event.target.checked)} />Показать все события</label> : null}
      </div>
      {ledger.isError ? <QueryFailed onRetry={() => void ledger.refetch()} error={ledger.error} /> : ledger.isLoading && !items.length ? <div className="space-y-2"><Skeleton className="h-20" /><Skeleton className="h-20" /></div> : !items.length ? <EmptyState title="Операций пока нет">Здесь появятся резерв и возврат комиссии, таяние номинала, передача банка и благодарности.</EmptyState> : !visible.length ? <EmptyState title="Статусные события скрыты"><button type="button" className="text-stitch-accent-text underline" onClick={() => setShowAllEvents(true)}>Показать все события</button></EmptyState> : <>
        <p role="status" aria-live="polite">Показаны последние {visible.length} операций</p>
        <ul className="divide-y divide-stitch-border overflow-hidden rounded-2xl border border-stitch-border bg-stitch-surface">
          {visible.map((row) => <LedgerItem key={row.id} row={row} communityId={communityId} />)}
        </ul>
        {nextCursor ? <Button type="button" disabled={ledger.isFetching} onClick={() => setCursor(nextCursor)}>{ledger.isFetching ? 'Загружаем…' : 'Показать ещё'}</Button> : null}
      </>}
    </section>
  </div></AppShell>;
}

function LedgerItem({ row, communityId }: { row: LedgerRow; communityId: string }) {
  const view = ledgerRowView(row);
  const source = walletSourceLabel(row.metadata?.sourceCommunityId, communityId);
  return (
    <li className="flex items-start justify-between gap-4 p-4">
      <div className="min-w-0 space-y-1">
        <p className="font-semibold">{view.title}</p>
        {view.subtitle ? <p className={cn('text-sm leading-5 text-stitch-text/90', userContentClass)}>{view.subtitle}</p> : null}
        {view.comment ? <p className={cn('text-sm italic leading-5 text-stitch-muted', userContentClass)}>{view.comment}</p> : null}
        <p className="text-xs text-stitch-muted">{formatWhen(row.createdAt)}</p>
        {source ? <p className="text-xs text-stitch-muted">Источник: {source}</p> : null}
        {view.dealId ? <Link href={`/deals?deal=${encodeURIComponent(view.dealId)}`} className="inline-block pt-1 text-sm font-semibold text-stitch-accent-text hover:underline">К сделке →</Link> : null}
      </div>
      {view.amountText ? (
        <div className="shrink-0 text-right">
          <strong className={row.amount > 0 ? 'text-emerald-300' : 'text-stitch-text'}>{view.amountText}</strong>
          {view.unitText ? <p className="mt-0.5 text-xs text-stitch-muted">{view.unitText}</p> : null}
        </div>
      ) : null}
    </li>
  );
}

function BalanceCard({ label, value, priority }: { label: string; value: number; priority: string }) {
  return <Card><p className="text-sm text-stitch-muted">{label}</p><p className="mt-2 text-4xl font-black text-stitch-accent">{value.toLocaleString('ru-RU')}</p><p className="mt-1 text-sm text-stitch-muted">{meritsWord(value)} · {priority}</p></Card>;
}
