'use client';
import { useEffect, useState } from 'react';
import { AppShell } from '@/components/app-shell';
import { Button, Card, EmptyState, PageHeader, QueryFailed, Skeleton } from '@/components/ui';
import { trpc } from '@/lib/trpc/client';
import { useUzzCommunityId } from '@/lib/use-uzz-community';
import { formatWhen, ledgerTypeLabel, meritsWord, walletSourceLabel } from '@/lib/utils';

type LedgerCursor = { createdAt: Date | string; id: string };
type LedgerRow = { id: string; type: string; amount: number; createdAt: Date | string; metadata?: Record<string, unknown> };

export default function WalletPage() {
  const { communityId, loggedIn } = useUzzCommunityId();
  const enabled = Boolean(communityId) && loggedIn;
  const [cursor, setCursor] = useState<LedgerCursor | undefined>(undefined);
  const [items, setItems] = useState<LedgerRow[]>([]);
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

  return <AppShell><div className="space-y-8"><PageHeader eyebrow="Заслуги для комиссии" title="Кошелёк">Это не номинал банка на обмен. При создании сделки 1 заслуга резервируется сначала здесь, в сообществе, и только затем — в общем кошельке.</PageHeader>
    {balance.isError ? <QueryFailed onRetry={() => void balance.refetch()} /> : balance.isLoading || !balance.data ? <Skeleton className="h-40" /> : shared ? <BalanceCard label="Баланс сообщества" value={balance.data.totalBalance} priority="Единый кошелёк сообщества" /> : <div className="grid gap-4 sm:grid-cols-2"><BalanceCard label="В этом сообществе" value={balance.data.localBalance} priority="Списывается первым" /><BalanceCard label="Общий кошелёк" value={balance.data.globalBalance} priority="Резервный источник" /></div>}
    <section className="space-y-4"><h2 className="text-xl font-black">История</h2>{ledger.isError ? <QueryFailed onRetry={() => void ledger.refetch()} /> : ledger.isLoading && !items.length ? <div className="space-y-2"><Skeleton className="h-20" /><Skeleton className="h-20" /></div> : !items.length ? <EmptyState title="Операций пока нет">Здесь появятся резерв и возврат комиссии, таяние номинала, передача банка и благодарности.</EmptyState> : <><p role="status" aria-live="polite">Показаны последние {items.length} операций</p><ul className="divide-y divide-stitch-border overflow-hidden rounded-2xl border border-stitch-border bg-stitch-surface">{items.map((row) => <li key={row.id} className="flex items-start justify-between gap-4 p-4"><div><p className="font-semibold">{ledgerTypeLabel(row.type)}</p><p className="mt-1 text-xs text-stitch-muted">{formatWhen(row.createdAt)}</p>{walletSourceLabel(row.metadata?.sourceCommunityId, communityId) ? <p className="mt-1 text-xs text-stitch-muted">Источник: {walletSourceLabel(row.metadata?.sourceCommunityId, communityId)}</p> : null}{typeof row.metadata?.reason === 'string' ? <p className="mt-1 text-xs text-stitch-muted">{row.metadata.reason}</p> : null}</div>{row.amount !== 0 ? <strong className={row.amount > 0 ? 'text-emerald-300' : 'text-stitch-text'}>{row.amount > 0 ? '+' : ''}{row.amount}</strong> : null}</li>)}</ul>{nextCursor ? <Button type="button" onClick={() => setCursor(nextCursor)}>Показать ещё</Button> : null}</>}</section>
  </div></AppShell>;
}
function BalanceCard({ label, value, priority }: { label: string; value: number; priority: string }) { return <Card><p className="text-sm text-stitch-muted">{label}</p><p className="mt-2 text-4xl font-black text-stitch-accent">{value.toLocaleString('ru-RU')}</p><p className="mt-1 text-sm text-stitch-muted">{meritsWord(value)} · {priority}</p></Card>; }
