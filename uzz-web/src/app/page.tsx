'use client';

import Link from 'next/link';
import { Suspense, useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { AppShell } from '@/components/app-shell';
import { ListingCard } from '@/components/listing-card';
import { ListingEditor, type ListingDraft } from '@/components/listing-editor';
import { Tab, TabPanel, Tabs } from '@/components/tabs';
import { Badge, Button, Card, EmptyState, PageHeader, QueryFailed, Skeleton } from '@/components/ui';
import { trpc } from '@/lib/trpc/client';
import { useUzzCommunityId } from '@/lib/use-uzz-community';
import { bankHeadline, bankHopsLabel, bankStatusLabel, hadUzzSession, tomorrowNominal, uzzErrorMessage } from '@/lib/utils';

type HomeTab = 'rights' | 'listings' | 'deeds';
export default function HomePage() {
  return <Suspense fallback={<AppShell><Skeleton className="h-64" /></AppShell>}><HomeContent /></Suspense>;
}

function HomeContent() {
  const { communityId, loggedIn, sessionLoading } = useUzzCommunityId(); const [tab, setTab] = useState<HomeTab>('rights');
  const searchParams = useSearchParams(); const router = useRouter();
  useEffect(() => { const value = searchParams.get('tab'); setTab(value === 'lots' ? 'listings' : value === 'deeds' ? 'deeds' : 'rights'); }, [searchParams]);
  function selectTab(value: string) {
    const next: HomeTab = value === 'listings' ? 'listings' : value === 'deeds' ? 'deeds' : 'rights';
    setTab(next);
    router.replace(next === 'listings' ? '/?tab=lots' : next === 'deeds' ? '/?tab=deeds' : '/', { scroll: false });
  }
  if (sessionLoading) return <AppShell><Skeleton className="h-64" /></AppShell>;
  if (!loggedIn) return <AppShell><Guest expired={hadUzzSession()} /></AppShell>;
  return <AppShell><div className="space-y-8"><PageHeader eyebrow="Личный раздел" title="Моё">Банки на обмен, предложения и добрые дела — разные сущности. Банк — это не кошелёк заслуг, а условная сумма, в пределах которой можно заказать услугу.</PageHeader>
    <Tabs value={tab} onChange={selectTab} aria-label="Личный раздел">
      <Tab value="rights">Банки</Tab>
      <Tab value="listings">Мои услуги</Tab>
      <Tab value="deeds">Добрые дела</Tab>
      <TabPanel value="rights"><Rights communityId={communityId} /></TabPanel>
      <TabPanel value="listings"><Listings communityId={communityId} /></TabPanel>
      <TabPanel value="deeds"><Deeds communityId={communityId} /></TabPanel>
    </Tabs>
  </div></AppShell>;
}

function Guest({ expired }: { expired: boolean }) {
  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="Обмен внутри сообщества"
        title={expired ? 'Сессия истекла' : 'Доброе дело превращается в возможность получить услуги'}
      >
        {expired
          ? 'Войдите снова по одноразовой ссылке из письма.'
          : 'Заслуги – это не деньги. Они просто подтверждают, что сообщество признаёт ваш вклад и готово меняться с вами услугами.'}
      </PageHeader>
      <div className="grid gap-4 sm:grid-cols-3">
        {[
          ['1', 'Сделайте доброе дело', 'Расскажите о нём в Telegram-сообществе и получите заслуги'],
          ['2', 'Получите банк на обмен', 'Когда доброе дело наберёт порог заслуг, появится банк: условная сумма для заказа услуги. После закрытия сделки банк целиком переходит исполнителю, без сдачи. Номинал каждый день немного тает.'],
          ['3', 'Обменяйтесь', 'Выберите интересную вам услугу и отправьте заявку.'],
        ].map(([n, title, copy]) => (
          <Card key={n}>
            <Badge tone="accent">Шаг {n}</Badge>
            <h2 className="mt-3 font-black">{title}</h2>
            <p className="mt-2 text-sm leading-6 text-stitch-muted">{copy}</p>
          </Card>
        ))}
      </div>
      <div className="flex flex-wrap gap-2">
        <Link href="/catalog" className="rounded-xl bg-stitch-accent-solid px-4 py-3 text-sm font-semibold text-white">Смотреть услуги</Link>
        <Link href="/login?next=/" className="rounded-xl border border-stitch-border px-4 py-3 text-sm font-semibold">Войти по email</Link>
      </div>
    </div>
  );
}

function Rights({ communityId }: { communityId: string }) {
  const rights = trpc.banks.listMine.useQuery({ communityId }, { retry: false }); const settings = trpc.settings.get.useQuery({ communityId }, { retry: false });
  if (rights.isLoading) return <Skeleton className="h-56" />; if (rights.isError) return <QueryFailed onRetry={() => void rights.refetch()} />; if (!rights.data?.length) return <EmptyState title="Банков пока нет">Банк на обмен появляется, когда доброе дело набирает порог заслуг. Им можно заказать услугу; после закрытия сделки банк целиком переходит исполнителю.</EmptyState>;
  return <ul className="grid gap-4 md:grid-cols-2">{rights.data.map((right) => { const demurrage = settings.data?.demurrageRubPerDay; const floor = settings.data?.nominalFloorRub; const tomorrow = demurrage == null || floor == null ? null : tomorrowNominal(right.nominalRub, demurrage, floor); return <li key={right.id}><Card><div className="flex flex-wrap justify-between gap-3"><div><h2 className="font-black">{right.sourceTitle || 'Банк на обмен'}</h2><p className="mt-1 text-sm text-stitch-muted">{bankHeadline(right)}</p></div><Badge tone={right.status === 'active' ? 'ok' : right.status === 'in_deal' ? 'warn' : 'neutral'}>{bankStatusLabel(right.status)}</Badge></div><div className="mt-4 grid grid-cols-2 gap-3 rounded-xl bg-stitch-canvas/60 p-4 text-sm"><div><p className="text-xs text-stitch-muted">Переходы</p><p className="font-semibold">{bankHopsLabel(right.hopsLeft)}</p></div><div><p className="text-xs text-stitch-muted">Завтра</p><p className="font-semibold">{tomorrow == null ? '—' : `${tomorrow} ₽`}</p></div></div>{floor != null && right.nominalRub === floor ? <p className="mt-3 text-xs text-stitch-muted">Достигнут нижний предел: банк продолжает действовать и не исчерпывается из-за номинала.</p> : null}</Card></li>; })}</ul>;
}

function Listings({ communityId }: { communityId: string }) {
  const utils = trpc.useUtils(); const listings = trpc.lots.myLots.useQuery({ communityId }, { retry: false }); const [showForm, setShowForm] = useState(false); const [editingId, setEditingId] = useState<string | null>(null); const [error, setError] = useState<string | null>(null);
  const invalidate = () => void Promise.all([utils.lots.myLots.invalidate(), utils.lots.list.invalidate(), utils.lots.canBuy.invalidate()]);
  const create = trpc.lots.create.useMutation({ onSuccess: () => { setShowForm(false); setError(null); invalidate(); }, onError: (err) => setError(uzzErrorMessage(err)) });
  const update = trpc.lots.update.useMutation({ onSuccess: () => { setEditingId(null); setError(null); invalidate(); }, onError: (err) => setError(uzzErrorMessage(err)) });
  const updateListing = (lotId: string, data: ListingDraft) => update.mutate({ commandId: crypto.randomUUID(), lotId, ...data });
  return <div className="space-y-5"><div className="flex items-center justify-between gap-3"><div><h2 className="text-xl font-black">Ваши предложения</h2><p className="text-sm text-stitch-muted">Три карточки по умолчанию — рекомендация, а не запрет.</p></div><Button onClick={() => { setEditingId(null); setError(null); setShowForm((value) => !value); }}>{showForm ? 'Закрыть форму' : 'Добавить услугу'}</Button></div>{showForm ? <ListingEditor pending={create.isPending} error={error} onCancel={() => { setShowForm(false); setError(null); }} onSubmit={(data) => create.mutate({ commandId: crypto.randomUUID(), communityId, ...data })} /> : null}{listings.isLoading ? <Skeleton className="h-48" /> : listings.isError ? <QueryFailed onRetry={() => void listings.refetch()} /> : !listings.data?.length ? <EmptyState title="Предложений пока нет">Добавьте то, чем готовы помочь сообществу.</EmptyState> : <ul className="grid gap-4 md:grid-cols-2">{listings.data.map((item) => <li key={item.id} className={!item.active ? 'opacity-60' : ''}><ListingCard listing={item} own />{editingId === item.id ? <div className="mt-3"><ListingEditor initial={item} pending={update.isPending} error={error} submitLabel="Сохранить изменения" onCancel={() => setEditingId(null)} onSubmit={(data) => updateListing(item.id, data)} /></div> : <div className="mt-2 grid grid-cols-2 gap-2"><Button variant="ghost" onClick={() => { setShowForm(false); setError(null); setEditingId(item.id); }}>Редактировать</Button><Button variant="ghost" disabled={update.isPending} onClick={() => update.mutate({ commandId: crypto.randomUUID(), lotId: item.id, active: !item.active })}>{item.active ? 'Скрыть из каталога' : 'Вернуть в каталог'}</Button></div>}</li>)}</ul>}</div>;
}

function Deeds({ communityId }: { communityId: string }) { const deeds = trpc.deeds.list.useQuery({ communityId }, { retry: false }); if (deeds.isLoading) return <Skeleton className="h-48" />; if (deeds.isError) return <QueryFailed onRetry={() => void deeds.refetch()} />; if (!deeds.data?.length) return <EmptyState title="Добрых дел пока нет" />; return <ul className="space-y-3">{deeds.data.map((deed) => <li key={deed.publicationId}><Card><div className="flex flex-wrap items-start justify-between gap-3"><div><h2 className="font-black">{deed.title}</h2><p className="mt-1 text-sm text-stitch-muted">{deed.score} из {deed.emissionThreshold} заслуг</p></div>{deed.bankStatus ? <Badge tone="ok">Банк создан</Badge> : <Badge>{Math.round(deed.progress * 100)}%</Badge>}</div><div className="mt-4 h-2 overflow-hidden rounded-full bg-stitch-canvas"><div className="h-full rounded-full bg-stitch-accent" style={{ width: `${Math.round(deed.progress * 100)}%` }} /></div></Card></li>)}</ul>; }
