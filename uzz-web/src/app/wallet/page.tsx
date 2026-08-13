'use client';
import { AppShell } from '@/components/app-shell';
import { Card, EmptyState, PageHeader, QueryFailed, Skeleton } from '@/components/ui';
import { trpc } from '@/lib/trpc/client';
import { useUzzCommunityId } from '@/lib/use-uzz-community';
import { formatWhen, ledgerTypeLabel, meritsWord } from '@/lib/utils';

export default function WalletPage() {
  const { communityId, loggedIn } = useUzzCommunityId(); const enabled = Boolean(communityId) && loggedIn;
  const balance = trpc.wallet.getBalance.useQuery({ communityId }, { enabled, retry: false }); const ledger = trpc.ledger.listMine.useQuery({ communityId, limit: 50 }, { enabled, retry: false });
  return <AppShell><div className="space-y-8"><PageHeader eyebrow="Заслуги для комиссии" title="Кошелёк">Это не номинал права на обмен. При создании сделки 1 заслуга резервируется сначала здесь, в сообществе, и только затем — в общем кошельке.</PageHeader>
    {balance.isError ? <QueryFailed onRetry={() => void balance.refetch()} /> : balance.isLoading || !balance.data ? <Skeleton className="h-40" /> : <div className="grid gap-4 sm:grid-cols-2"><BalanceCard label="В этом сообществе" value={balance.data.localBalance} priority="Списывается первым" /><BalanceCard label="Общий кошелёк" value={balance.data.globalBalance} priority="Резервный источник" /></div>}
    <section className="space-y-4"><h2 className="text-xl font-black">История</h2>{ledger.isError ? <QueryFailed onRetry={() => void ledger.refetch()} /> : ledger.isLoading ? <div className="space-y-2"><Skeleton className="h-20" /><Skeleton className="h-20" /></div> : !ledger.data?.length ? <EmptyState title="Операций пока нет">Здесь появятся резерв и возврат комиссии, таяние номинала, передача права и благодарности.</EmptyState> : <ul className="divide-y divide-stitch-border overflow-hidden rounded-2xl border border-stitch-border bg-stitch-surface">{ledger.data.map((row) => <li key={row.id} className="flex items-start justify-between gap-4 p-4"><div><p className="font-semibold">{ledgerTypeLabel(row.type)}</p><p className="mt-1 text-xs text-stitch-muted">{formatWhen(row.createdAt)}</p>{typeof row.metadata?.reason === 'string' ? <p className="mt-1 text-xs text-stitch-muted">{row.metadata.reason}</p> : null}</div>{row.amount !== 0 ? <strong className={row.amount > 0 ? 'text-emerald-300' : 'text-stitch-text'}>{row.amount > 0 ? '+' : ''}{row.amount}</strong> : null}</li>)}</ul>}</section>
  </div></AppShell>;
}
function BalanceCard({ label, value, priority }: { label: string; value: number; priority: string }) { return <Card><p className="text-sm text-stitch-muted">{label}</p><p className="mt-2 text-4xl font-black text-stitch-accent">{value.toLocaleString('ru-RU')}</p><p className="mt-1 text-sm text-stitch-muted">{meritsWord(value)} · {priority}</p></Card>; }
