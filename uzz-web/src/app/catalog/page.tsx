'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { AppShell } from '@/components/app-shell';
import { DealRequestForm } from '@/components/deal-request-form';
import { Dialog, DialogTitle } from '@/components/dialog';
import { ListingCard, type ListingView } from '@/components/listing-card';
import { Button, EmptyState, Notice, PageHeader, QueryFailed, Skeleton, inputClass } from '@/components/ui';
import { trpc } from '@/lib/trpc/client';
import { useUzzCommunityId } from '@/lib/use-uzz-community';
import { listingsWord, uzzErrorMessage } from '@/lib/utils';

export default function CatalogPage() {
  const router = useRouter(); const utils = trpc.useUtils();
  const { communityId, loggedIn, sessionLoading, userId } = useUzzCommunityId(); const enabled = Boolean(communityId);
  const community = trpc.community.getPublic.useQuery({ communityId }, { enabled, retry: false });
  const listings = trpc.lots.list.useQuery({ communityId }, { enabled, retry: false });
  const rights = trpc.banks.listMine.useQuery({ communityId }, { enabled: enabled && loggedIn, retry: false });
  const gate = trpc.lots.canBuy.useQuery({ communityId }, { enabled: enabled && loggedIn, retry: false });
  const wallet = trpc.wallet.getBalance.useQuery({ communityId }, { enabled: enabled && loggedIn, retry: false });
  const settings = trpc.settings.get.useQuery({ communityId }, { enabled: enabled && loggedIn, retry: false });
  const link = trpc.identity.getLinkStatus.useQuery(undefined, { enabled: loggedIn, retry: false });
  const [query, setQuery] = useState(''); const [onlineOnly, setOnlineOnly] = useState(false); const [affordableOnly, setAffordableOnly] = useState(false); const [selected, setSelected] = useState<ListingView | null>(null); const [error, setError] = useState<string | null>(null);

  const request = trpc.deals.request.useMutation({ onSuccess: (deal) => { void Promise.all([utils.deals.list.invalidate(), utils.banks.listMine.invalidate(), utils.wallet.getBalance.invalidate()]); const feeSource = deal.feeSourceCommunityId === communityId ? 'local' : 'global'; router.push(`/deals?requested=1&feeSource=${feeSource}`); }, onError: (err) => setError(uzzErrorMessage(err)) });
  const activeRights = rights.data?.filter((right) => right.status === 'active' && right.nominalRub != null) ?? [];
  const maxNominal = Math.max(0, ...activeRights.map((right) => right.nominalRub ?? 0));
  const visible = useMemo(() => { const needle = query.trim().toLocaleLowerCase('ru-RU'); return (listings.data ?? []).filter((item) => (!onlineOnly || item.deliveryMode !== 'offline') && (!affordableOnly || item.priceRub <= maxNominal) && (!needle || `${item.title} ${item.description} ${item.ownerName}`.toLocaleLowerCase('ru-RU').includes(needle))); }, [affordableOnly, listings.data, maxNominal, onlineOnly, query]);
  const strictGateBlocked = gate.isError && gate.error.message.includes('MIN_LISTINGS_REQUIRED');
  const identityGateBlocked = gate.isError && gate.error.message.includes('IDENTITY_LINK_REQUIRED');
  const membershipGateBlocked = gate.isError && gate.error.message.includes('COMMUNITY_MEMBERSHIP_REQUIRED');

  function choose(item: ListingView) {
    if (!loggedIn) { router.push(`/login?next=${encodeURIComponent('/catalog')}`); return; }
    if (!link.data?.linked) { router.push('/profile'); return; }
    setError(null); setSelected(item);
  }

  function requestAction(item: ListingView): { label: string; disabled: boolean } {
    if (sessionLoading) return { label: 'Проверяем вход…', disabled: true };
    if (!loggedIn) return { label: 'Войти, чтобы оформить', disabled: false };
    if (link.isLoading) return { label: 'Проверяем Telegram…', disabled: true };
    if (link.isError) return { label: uzzErrorMessage(link.error), disabled: true };
    if (!link.data?.linked) return { label: 'Сначала привяжите Telegram', disabled: false };
    if (rights.isLoading) return { label: 'Проверяем ваши банки…', disabled: true };
    if (rights.isError) return { label: uzzErrorMessage(rights.error), disabled: true };
    if (gate.isLoading || wallet.isLoading || settings.isLoading) return { label: 'Загружаем условия…', disabled: true };
    if (strictGateBlocked) return { label: 'Сначала добавьте свои услуги', disabled: true };
    if (membershipGateBlocked) return { label: 'Нужно быть участником сообщества', disabled: true };
    if (gate.isError) return { label: uzzErrorMessage(gate.error), disabled: true };
    if (wallet.isError) return { label: uzzErrorMessage(wallet.error), disabled: true };
    if (settings.isError) return { label: uzzErrorMessage(settings.error), disabled: true };
    if (settings.data == null || wallet.data == null) return { label: 'Загружаем условия…', disabled: true };
    if (!wallet.data?.canPayFee) return { label: 'Не хватает заслуги на комиссию', disabled: true };
    if (item.priceRub > maxNominal) return { label: 'Нужен больший номинал', disabled: true };
    return { label: 'Оставить заявку', disabled: false };
  }

  return <AppShell><div className="space-y-8">
    <PageHeader
      eyebrow={community.data?.name ? `Услуги сообщества «${community.data.name}»` : 'Услуги сообщества'}
      title="Найдите услуги, которые вам нужны"
    >
      Цена показывает минимальный номинал вашего банка, который нужен для оформления заявки. Контакт исполнителя откроется только после того, как он примет заявку.
    </PageHeader>
    {!loggedIn && !sessionLoading ? (
      <Notice>
        Вы не авторизованы. Чтобы оставить заявку,{' '}
        <Link href="/login?next=/catalog" className="text-stitch-accent-text underline">войдите по одноразовой ссылке</Link>.
      </Notice>
    ) : null}
    {gate.data?.nudge ? <Notice tone="info"><strong>Добавьте ещё {gate.data.missingListingCount} {listingsWord(gate.data.missingListingCount)}.</strong> Это мягкая рекомендация: обмен уже доступен, но взаимность делает каталог полезнее. <Link href="/?tab=lots" className="underline">Добавить услугу</Link></Notice> : null}
    {strictGateBlocked ? <Notice tone="warn">Администратор включил обязательный режим: прежде чем заказывать, добавьте нужное количество активных предложений. <Link href="/?tab=lots" className="underline">Перейти к своим услугам</Link></Notice> : null}
    {membershipGateBlocked ? <Notice tone="warn" role="alert">{uzzErrorMessage(gate.error)}</Notice> : null}
    {gate.isError && !strictGateBlocked && !identityGateBlocked && !membershipGateBlocked && loggedIn ? <Notice tone="warn" role="alert">{uzzErrorMessage(gate.error)} <button className="underline" onClick={() => void gate.refetch()}>Повторить</button></Notice> : null}
    {link.isError && loggedIn ? <Notice tone="warn" role="alert">{uzzErrorMessage(link.error)} <button className="underline" onClick={() => void link.refetch()}>Повторить</button></Notice> : null}
    {rights.isError && loggedIn ? <Notice tone="warn" role="alert">{uzzErrorMessage(rights.error)} <button className="underline" onClick={() => void rights.refetch()}>Повторить</button></Notice> : null}
    {wallet.data && !wallet.data.canPayFee ? <Notice tone="warn">Для заявки нужна комиссия 1 заслуга. Сначала пополните кошелёк сообщества или общий кошелёк.</Notice> : null}
    <div className="grid gap-3 sm:grid-cols-[1fr_auto_auto]">
      <label><span className="sr-only">Поиск по каталогу</span><input type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Поиск по названию, описанию или автору" className={inputClass} /></label>
      <label className="flex min-h-11 items-center gap-2 rounded-xl border border-stitch-border px-4 text-sm text-stitch-muted"><input type="checkbox" checked={onlineOnly} onChange={(event) => setOnlineOnly(event.target.checked)} />Доступно онлайн</label>
      {loggedIn ? <label className="flex min-h-11 items-center gap-2 rounded-xl border border-stitch-border px-4 text-sm text-stitch-muted"><input type="checkbox" checked={affordableOnly} disabled={rights.isLoading || rights.isError} onChange={(event) => setAffordableOnly(event.target.checked)} />По карману</label> : null}
    </div>
    {selected ? <Dialog open onClose={() => setSelected(null)} labelledBy="uzz-request-dialog-title" describedBy="uzz-request-dialog-desc"><DialogTitle id="uzz-request-dialog-title">Запросить услугу «{selected.title}»</DialogTitle><p id="uzz-request-dialog-desc" className="sr-only">Цена {selected.priceRub.toLocaleString('ru-RU')} ₽. Комиссия 1 заслуга: {(wallet.data?.localBalance ?? 0) >= 1 ? 'кошелёк сообщества' : 'общий кошелёк'}. Желаемый срок можно указать в форме.</p><DealRequestForm title={selected.title} description={selected.description} priceRub={selected.priceRub} rights={rights.data ?? []} pending={request.isPending} error={error} demurrageRubPerDay={settings.data?.demurrageRubPerDay} nominalFloorRub={settings.data?.nominalFloorRub} feeSourceLabel={(wallet.data?.localBalance ?? 0) >= 1 ? 'кошелёк сообщества' : 'общий кошелёк'} onCancel={() => setSelected(null)} onSubmit={(data) => request.mutate({ commandId: crypto.randomUUID(), communityId, lotId: selected.id, bankId: data.bankId, requestMessage: data.requestMessage, requestedDeadlineAt: data.requestedDeadlineAt ?? null })} /></Dialog> : null}
    {listings.isLoading ? <div className="grid gap-4 md:grid-cols-2" aria-busy><Skeleton className="h-64" /><Skeleton className="h-64" /></div> : listings.isError ? <QueryFailed onRetry={() => void listings.refetch()} error={listings.error} /> : !visible.length ? <EmptyState title={query || onlineOnly || affordableOnly ? 'Ничего не найдено' : 'В каталоге пока пусто'}>{query || onlineOnly || affordableOnly ? <Button variant="ghost" onClick={() => { setQuery(''); setOnlineOnly(false); setAffordableOnly(false); }}>Сбросить фильтры</Button> : loggedIn ? <Link href="/?tab=lots" className="text-stitch-accent-text underline">Добавьте первое предложение</Link> : 'Загляните позже.'}</EmptyState> : <ul className="grid gap-4 md:grid-cols-2">{visible.map((item) => { const action = requestAction(item); return <li key={item.id}><ListingCard listing={item} own={item.authorId === userId} affordable={!action.disabled} requestLabel={action.label} requestDisabled={action.disabled} onRequest={item.authorId === userId ? undefined : () => choose(item)} /></li>; })}</ul>}
  </div></AppShell>;
}
