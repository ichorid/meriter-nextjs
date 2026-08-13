'use client';

import { FormEvent, useEffect, useState } from 'react';
import Link from 'next/link';
import { AppShell } from '@/components/app-shell';
import { Button, Card, EmptyState, Field, Notice, Skeleton, inputClass } from '@/components/ui';
import { trpc } from '@/lib/trpc/client';
import { useUzzCommunityId } from '@/lib/use-uzz-community';
import {
  bankHeadline,
  bankStatusLabel,
  tomorrowNominal,
} from '@/lib/utils';
import { config } from '@/config';

type MineTab = 'rights' | 'lots' | 'deeds';

export default function HomePage() {
  const { communityId, loggedIn, sessionLoading } = useUzzCommunityId();
  if (sessionLoading) {
    return (
      <AppShell>
        <div className="space-y-3" aria-busy>
          <Skeleton className="h-10 w-40" />
          <Skeleton className="h-16 w-full" />
          <Skeleton className="h-28 w-full" />
        </div>
      </AppShell>
    );
  }
  if (!loggedIn) {
    return (
      <AppShell>
        <GuestLanding />
      </AppShell>
    );
  }
  return (
    <AppShell>
      <MinePanel communityId={communityId} loggedIn={loggedIn} />
    </AppShell>
  );
}

function GuestLanding() {
  return (
    <div className="space-y-8">
      <section className="space-y-3">
        <p className="text-xs font-medium uppercase tracking-wide text-stitch-accent">
          Обмен внутри сообщества
        </p>
        <h1 className="text-3xl font-extrabold tracking-tight">
          Сделали доброе дело — можете попросить услугу
        </h1>
        <p className="max-w-xl text-sm text-stitch-muted">
          Не деньги. Право на обмен появляется, когда сообщество признаёт ваше дело заслугами.
          Потолок сделки в рублях назначает администратор и понемногу тает каждый день.
        </p>
        <div className="flex flex-wrap gap-2">
          <Link
            href="/catalog"
            className="rounded-lg bg-stitch-accent px-4 py-2.5 text-sm font-medium text-white"
          >
            Смотреть услуги
          </Link>
          <Link
            href="/login"
            className="rounded-lg border border-stitch-border px-4 py-2.5 text-sm"
          >
            Войти по почте
          </Link>
        </div>
      </section>
      <ol className="grid gap-3 sm:grid-cols-3">
        {[
          {
            n: '1',
            t: 'Дело в Telegram',
            d: 'Расскажите о добром деле в чате. Когда наберётся признание — появится право на обмен.',
          },
          {
            n: '2',
            t: 'Карточка услуги',
            d: 'Опишите, чем можете помочь. Цена — в рублях, в пределах сегодняшнего номинала.',
          },
          {
            n: '3',
            t: 'Сделка',
            d: 'Запрос, ответ, «сделано», закрытие. Комиссия — 1 заслуга, вернётся, если откажут.',
          },
        ].map((step) => (
          <Card key={step.n}>
            <p className="text-xs text-stitch-accent">Шаг {step.n}</p>
            <h2 className="mt-1 font-extrabold">{step.t}</h2>
            <p className="mt-1 text-sm text-stitch-muted">{step.d}</p>
          </Card>
        ))}
      </ol>
    </div>
  );
}

function MinePanel({
  communityId,
  loggedIn,
}: {
  communityId: string;
  loggedIn: boolean;
}) {
  const enabled = Boolean(communityId) && loggedIn;
  const utils = trpc.useUtils();
  const [tab, setTab] = useState<MineTab>('rights');

  useEffect(() => {
    const requested = new URLSearchParams(window.location.search).get('tab');
    if (requested === 'lots' || requested === 'deeds') setTab(requested);
  }, []);

  function selectTab(id: MineTab) {
    setTab(id);
    const url = id === 'rights' ? '/' : `/?tab=${id}`;
    window.history.replaceState(null, '', url);
  }

  const banks = trpc.banks.listMine.useQuery({ communityId }, { enabled, retry: false });
  const myLots = trpc.lots.myLots.useQuery({ communityId }, { enabled, retry: false });
  const deeds = trpc.deeds.list.useQuery({ communityId }, { enabled, retry: false });
  const settings = trpc.settings.get.useQuery({ communityId }, { enabled, retry: false });
  const canBuy = trpc.lots.canBuy.useQuery({ communityId }, { enabled, retry: false });
  const linkStatus = trpc.identity.getLinkStatus.useQuery(undefined, {
    enabled: loggedIn,
    retry: false,
  });

  const [title, setTitle] = useState('');
  const [priceRub, setPriceRub] = useState('500');
  const [description, setDescription] = useState('');
  const [lotError, setLotError] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState('');
  const [editPrice, setEditPrice] = useState('');
  const [editDescription, setEditDescription] = useState('');

  const createLot = trpc.lots.create.useMutation({
    onSuccess: () => {
      setTitle('');
      setDescription('');
      setLotError(null);
      void utils.lots.myLots.invalidate();
      void utils.lots.list.invalidate();
      void utils.lots.canBuy.invalidate();
    },
    onError: (err) => setLotError(err.message || 'Не удалось создать'),
  });
  const updateLot = trpc.lots.update.useMutation({
    onSuccess: () => {
      setEditingId(null);
      void utils.lots.myLots.invalidate();
      void utils.lots.list.invalidate();
    },
  });

  function onCreateLot(e: FormEvent) {
    e.preventDefault();
    const price = Number(priceRub);
    if (!title.trim() || !Number.isFinite(price) || price <= 0) {
      setLotError('Укажите название и цену в рублях');
      return;
    }
    createLot.mutate({
      communityId,
      title: title.trim(),
      description: description.trim() || undefined,
      priceRub: price,
    });
  }

  const demurrage = settings.data?.demurrageRubPerDay ?? 100;
  const floor = settings.data?.nominalFloorRub ?? 100;

  return (
    <div className="space-y-6">
      <header className="space-y-2">
        <h1 className="text-2xl font-extrabold tracking-tight">Моё</h1>
        <p className="text-sm text-stitch-muted">
          Права, ваши услуги и добрые дела. Обмен с другими — во вкладке «Обмен».
        </p>
      </header>

      {config.development.fakeDataMode && linkStatus.data && !linkStatus.data.linked ? (
        <Notice tone="warn">
          Тестовый вход: Telegram можно не привязывать. На пилоте без связки права и сделки
          недоступны.
        </Notice>
      ) : null}

      {linkStatus.data && !linkStatus.data.linked && !config.development.fakeDataMode ? (
        <Notice tone="warn">
          Привяжите Telegram в профиле, чтобы видеть права на обмен.{' '}
          <Link href="/profile" className="underline">
            Профиль
          </Link>
        </Notice>
      ) : null}

      <div className="flex gap-1 rounded-xl border border-stitch-border bg-stitch-sidebar p-1" role="tablist">
        {(
          [
            ['rights', 'Права'],
            ['lots', 'Услуги'],
            ['deeds', 'Дела'],
          ] as const
        ).map(([id, label]) => (
          <button
            key={id}
            type="button"
            role="tab"
            aria-selected={tab === id}
            onClick={() => selectTab(id)}
            className={`flex-1 rounded-lg px-3 py-2 text-sm ${
              tab === id ? 'bg-stitch-accent/20 font-medium' : 'text-stitch-muted'
            }`}
          >
            {id === 'lots' && myLots.data?.length
              ? `${label} (${myLots.data.length})`
              : label}
          </button>
        ))}
      </div>

      {tab === 'rights' ? (
        <div className="space-y-3">
          <div className="flex items-baseline justify-between">
            <h2 className="font-extrabold">Права на обмен</h2>
            <Link href="/wallet" className="text-sm text-stitch-accent hover:underline">
              Кошелёк
            </Link>
          </div>
          {banks.isLoading ? (
            <p className="text-sm text-stitch-muted">Загрузка…</p>
          ) : !banks.data?.length ? (
            <EmptyState title="Пока нет прав на обмен">
              Опубликуйте доброе дело в Telegram. Когда сообщество начислит заслуги до порога,
              здесь появится право.
            </EmptyState>
          ) : (
            banks.data.map((bank) => {
              const next = tomorrowNominal(bank.nominalRub, demurrage, floor);
              return (
                <Card key={bank.id}>
                  <p className="font-extrabold">{bankHeadline(bank)}</p>
                  <p className="mt-1 text-sm text-stitch-muted">{bankStatusLabel(bank.status)}</p>
                  {bank.status === 'active' && next != null && next < (bank.nominalRub ?? 0) ? (
                    <p className="mt-2 text-xs text-amber-200">
                      Завтра потолок будет около {next} ₽ — успейте обменять, если планируете.
                    </p>
                  ) : null}
                </Card>
              );
            })
          )}
        </div>
      ) : null}

      {tab === 'lots' ? (
        <div className="space-y-3">
          <form onSubmit={onCreateLot} className="space-y-3">
            <Card className="space-y-3">
              <h2 className="font-extrabold">Новая услуга</h2>
              {canBuy.data && !canBuy.data.allowed ? (
                <Notice tone="warn">
                  Чтобы запрашивать чужие услуги, сначала покажите свою. Нужно ещё{' '}
                  {Math.max(0, canBuy.data.minLotsToBuy - canBuy.data.activeLotCount)}.
                </Notice>
              ) : null}
              <Field label="Название">
                <input
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className={inputClass}
                  placeholder="Например: помощь с переездом"
                />
              </Field>
              <Field label="Цена, ₽">
                <input
                  type="number"
                  min={1}
                  value={priceRub}
                  onChange={(e) => setPriceRub(e.target.value)}
                  className={inputClass}
                />
              </Field>
              <Field label="Что входит">
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  rows={2}
                  className={inputClass}
                />
              </Field>
              {lotError ? <p className="text-sm text-red-400">{lotError}</p> : null}
              <Button type="submit" disabled={createLot.isPending}>
                {createLot.isPending ? 'Сохранение…' : 'Показать в каталоге'}
              </Button>
            </Card>
          </form>
          {!myLots.isLoading && !myLots.data?.length ? (
            <EmptyState title="Своих карточек пока нет">
              Одна услуга уже помогает обмену быть взаимным.
            </EmptyState>
          ) : myLots.isLoading ? (
            <p className="text-sm text-stitch-muted">Загрузка…</p>
          ) : (
            myLots.data?.map((lot) => (
              <Card key={lot.id} className="space-y-2">
                {editingId === lot.id ? (
                  <>
                    <input
                      value={editTitle}
                      onChange={(e) => setEditTitle(e.target.value)}
                      className={inputClass}
                    />
                    <input
                      type="number"
                      min={1}
                      value={editPrice}
                      onChange={(e) => setEditPrice(e.target.value)}
                      className={inputClass}
                    />
                    <textarea
                      value={editDescription}
                      onChange={(e) => setEditDescription(e.target.value)}
                      rows={2}
                      className={inputClass}
                    />
                    <div className="flex gap-2">
                      <Button
                        type="button"
                        onClick={() =>
                          updateLot.mutate({
                            lotId: lot.id,
                            title: editTitle.trim(),
                            description: editDescription,
                            priceRub: Number(editPrice),
                          })
                        }
                      >
                        Сохранить
                      </Button>
                      <Button type="button" variant="ghost" onClick={() => setEditingId(null)}>
                        Отмена
                      </Button>
                    </div>
                  </>
                ) : (
                  <>
                    <h3 className="font-extrabold">{lot.title}</h3>
                    <p className="text-sm text-stitch-accent">{lot.priceRub} ₽</p>
                    {lot.description ? (
                      <p className="text-sm text-stitch-muted">{lot.description}</p>
                    ) : null}
                    <p className="text-xs text-stitch-muted">
                      {lot.active ? 'Видна в каталоге' : 'Скрыта с витрины'}
                    </p>
                    <div className="flex flex-wrap gap-2">
                      <Button
                        type="button"
                        variant="ghost"
                        onClick={() => {
                          setEditingId(lot.id);
                          setEditTitle(lot.title);
                          setEditPrice(String(lot.priceRub));
                          setEditDescription(lot.description ?? '');
                        }}
                      >
                        Изменить
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        onClick={() => updateLot.mutate({ lotId: lot.id, active: !lot.active })}
                      >
                        {lot.active ? 'Снять с витрины' : 'Вернуть'}
                      </Button>
                    </div>
                  </>
                )}
              </Card>
            ))
          )}
        </div>
      ) : null}

      {tab === 'deeds' ? (
        <div className="space-y-3">
          {!deeds.isLoading && !deeds.data?.length ? (
            <EmptyState title="Добрых дел пока не видно">
              Напишите о деле в Telegram-чате сообщества — прогресс до права появится здесь.
            </EmptyState>
          ) : deeds.isLoading ? (
            <p className="text-sm text-stitch-muted">Загрузка…</p>
          ) : (
            deeds.data?.map((deed) => {
              const pct = Math.min(100, Math.round((deed.progress || 0) * 100));
              return (
                <Card key={deed.publicationId}>
                  <div className="flex items-center justify-between gap-3 text-sm">
                    <span className="font-extrabold">{deed.title?.trim() || 'Доброе дело'}</span>
                    <span>
                      {deed.score} из {deed.emissionThreshold}
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
                      {bankStatusLabel(deed.bankStatus)}
                    </p>
                  ) : (
                    <p className="mt-2 text-xs text-stitch-muted">Ещё копим признание</p>
                  )}
                </Card>
              );
            })
          )}
        </div>
      ) : null}
    </div>
  );
}
