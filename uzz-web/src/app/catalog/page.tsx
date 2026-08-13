'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { AppShell } from '@/components/app-shell';
import { DealRequestForm } from '@/components/deal-request-form';
import { ListingCard, type ListingView } from '@/components/listing-card';
import { Button, EmptyState, Notice, PageHeader, QueryFailed, Skeleton, inputClass } from '@/components/ui';
import { trpc } from '@/lib/trpc/client';
import { useUzzCommunityId } from '@/lib/use-uzz-community';
import { uzzErrorMessage } from '@/lib/utils';

export default function CatalogPage() {
  const router = useRouter(); const utils = trpc.useUtils();
  const { communityId, loggedIn, sessionLoading, userId } = useUzzCommunityId(); const enabled = Boolean(communityId);
  const listings = trpc.lots.list.useQuery({ communityId }, { enabled, retry: false });
  const rights = trpc.banks.listMine.useQuery({ communityId }, { enabled: enabled && loggedIn, retry: false });
  const gate = trpc.lots.canBuy.useQuery({ communityId }, { enabled: enabled && loggedIn, retry: false });
  const wallet = trpc.wallet.getBalance.useQuery({ communityId }, { enabled: enabled && loggedIn, retry: false });
  const [query, setQuery] = useState(''); const [onlineOnly, setOnlineOnly] = useState(false); const [selected, setSelected] = useState<ListingView | null>(null); const [error, setError] = useState<string | null>(null);

  const request = trpc.deals.request.useMutation({ onSuccess: () => { void Promise.all([utils.deals.list.invalidate(), utils.banks.listMine.invalidate(), utils.wallet.getBalance.invalidate()]); router.push('/deals?requested=1'); }, onError: (err) => setError(uzzErrorMessage(err)) });
  const visible = useMemo(() => { const needle = query.trim().toLocaleLowerCase('ru-RU'); return (listings.data ?? []).filter((item) => (!onlineOnly || item.deliveryMode !== 'offline') && (!needle || `${item.title} ${item.description} ${item.ownerName}`.toLocaleLowerCase('ru-RU').includes(needle))); }, [listings.data, onlineOnly, query]);
  const activeRights = rights.data?.filter((right) => right.status === 'active' && right.nominalRub != null) ?? [];
  const maxNominal = Math.max(0, ...activeRights.map((right) => right.nominalRub ?? 0));
  const canStart = loggedIn && gate.data?.allowed !== false && !gate.isError && wallet.data?.canPayFee === true;

  function choose(item: ListingView) {
    if (!loggedIn) { router.push(`/login?next=${encodeURIComponent('/catalog')}`); return; }
    setError(null); setSelected(item);
  }

  return <AppShell><div className="space-y-8">
    <PageHeader eyebrow="Внутри вашего сообщества" title="Найдите, кто может помочь">Цена показывает нужный текущий номинал права. Контакт исполнителя откроется только после того, как он примет заявку.</PageHeader>
    {!loggedIn && !sessionLoading ? <Notice>Каталог открыт без входа. Чтобы оставить заявку, войдите по одноразовой ссылке из письма.</Notice> : null}
    {gate.data?.nudge ? <Notice tone="info"><strong>Добавьте ещё {gate.data.missingListingCount} предлож.</strong> Это мягкая рекомендация: обмен уже доступен, но взаимность делает каталог полезнее. <Link href="/?tab=lots" className="underline">Добавить услугу</Link></Notice> : null}
    {gate.isError && loggedIn ? <Notice tone="warn">Администратор включил обязательный режим: прежде чем заказывать, добавьте нужное количество активных предложений. <Link href="/?tab=lots" className="underline">Перейти к своим услугам</Link></Notice> : null}
    {wallet.data && !wallet.data.canPayFee ? <Notice tone="warn">Для заявки нужна комиссия 1 заслуга. Сначала пополните кошелёк сообщества или общий кошелёк.</Notice> : null}
    <div className="grid gap-3 sm:grid-cols-[1fr_auto]">
      <label><span className="sr-only">Поиск по каталогу</span><input type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Поиск по названию, описанию или автору" className={inputClass} /></label>
      <label className="flex min-h-11 items-center gap-2 rounded-xl border border-stitch-border px-4 text-sm text-stitch-muted"><input type="checkbox" checked={onlineOnly} onChange={(event) => setOnlineOnly(event.target.checked)} />Доступно онлайн</label>
    </div>
    {selected ? <div role="dialog" aria-modal="true" className="fixed inset-0 z-50 grid place-items-end bg-black/70 p-0 sm:place-items-center sm:p-6" onMouseDown={(event) => { if (event.target === event.currentTarget) setSelected(null); }}><section className="max-h-[90vh] w-full max-w-xl overflow-y-auto rounded-t-2xl border border-stitch-border bg-stitch-surface p-5 sm:rounded-2xl sm:p-6"><DealRequestForm title={selected.title} priceRub={selected.priceRub} rights={rights.data ?? []} pending={request.isPending} error={error} onCancel={() => setSelected(null)} onSubmit={(data) => request.mutate({ commandId: crypto.randomUUID(), communityId, lotId: selected.id, bankId: data.bankId, requestMessage: data.requestMessage, requestedDeadlineAt: data.requestedDeadlineAt })} /></section></div> : null}
    {listings.isLoading ? <div className="grid gap-4 md:grid-cols-2" aria-busy><Skeleton className="h-64" /><Skeleton className="h-64" /></div> : listings.isError ? <QueryFailed onRetry={() => void listings.refetch()} /> : !visible.length ? <EmptyState title={query || onlineOnly ? 'Ничего не найдено' : 'В каталоге пока пусто'}>{query || onlineOnly ? <Button variant="ghost" onClick={() => { setQuery(''); setOnlineOnly(false); }}>Сбросить фильтры</Button> : loggedIn ? <Link href="/?tab=lots" className="text-stitch-accent underline">Добавьте первое предложение</Link> : 'Загляните позже.'}</EmptyState> : <ul className="grid gap-4 md:grid-cols-2">{visible.map((item) => <li key={item.id}><ListingCard listing={item} own={item.authorId === userId} affordable={canStart && item.priceRub <= maxNominal} onRequest={item.authorId === userId ? undefined : () => choose(item)} /></li>)}</ul>}
  </div></AppShell>;
}
