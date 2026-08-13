'use client';

import { FormEvent, useState } from 'react';
import Link from 'next/link';
import { AppShell } from '@/components/app-shell';
import { trpc } from '@/lib/trpc/client';
import { useUzzCommunityId } from '@/lib/use-uzz-community';
import { bankHeadline, bankStatusLabel } from '@/lib/utils';

export default function HomePage() {
  const { communityId, loggedIn } = useUzzCommunityId();
  const enabled = Boolean(communityId) && loggedIn;
  const utils = trpc.useUtils();

  const banks = trpc.banks.listMine.useQuery({ communityId }, { enabled, retry: false });
  const myLots = trpc.lots.myLots.useQuery({ communityId }, { enabled, retry: false });
  const deeds = trpc.deeds.list.useQuery({ communityId }, { enabled, retry: false });
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

  return (
    <AppShell>
      <div className="space-y-8">
        <section className="space-y-2">
          <h1 className="text-2xl font-extrabold tracking-tight">Моё</h1>
          <p className="text-sm text-stitch-muted">
            Права на обмен, ваши услуги и добрые дела. Каталог — во вкладке «Обмен».
          </p>
        </section>

        {linkStatus.data && !linkStatus.data.linked ? (
          <div className="rounded-xl border border-amber-500/40 bg-amber-500/10 p-4 text-sm text-amber-100">
            Привяжите Telegram в профиле, чтобы видеть права на обмен и сделки. Каталог доступен без
            привязки.
          </div>
        ) : null}

        <section className="space-y-3">
          <div className="flex items-baseline justify-between gap-3">
            <h2 className="font-extrabold">Права на обмен</h2>
            <Link href="/wallet" className="text-sm text-stitch-accent hover:underline">
              Кошелёк
            </Link>
          </div>
          {banks.isLoading ? (
            <p className="text-sm text-stitch-muted">Загрузка…</p>
          ) : !banks.data?.length ? (
            <div className="rounded-xl border border-stitch-border bg-stitch-surface p-5">
              <p className="text-sm text-stitch-muted">
                Пока нет прав на обмен. Опубликуйте доброе дело в Telegram — когда наберут признание,
                здесь появится право.
              </p>
            </div>
          ) : (
            banks.data.map((bank) => (
              <article
                key={bank.id}
                className="rounded-xl border border-stitch-border bg-stitch-surface p-4"
              >
                <p className="font-extrabold">{bankHeadline(bank)}</p>
                <p className="mt-1 text-sm text-stitch-muted">{bankStatusLabel(bank.status)}</p>
              </article>
            ))
          )}
        </section>

        <section className="space-y-3">
          <h2 className="font-extrabold">Мои услуги</h2>
          <form
            onSubmit={onCreateLot}
            className="space-y-3 rounded-xl border border-stitch-border bg-stitch-surface p-5"
          >
            <p className="text-sm text-stitch-muted">Новая карточка для каталога</p>
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full rounded-lg border border-stitch-border bg-stitch-canvas px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-stitch-accent"
              placeholder="Например: помощь с переездом"
            />
            <input
              type="number"
              min={1}
              value={priceRub}
              onChange={(e) => setPriceRub(e.target.value)}
              className="w-full rounded-lg border border-stitch-border bg-stitch-canvas px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-stitch-accent"
              placeholder="Цена, ₽"
            />
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={2}
              className="w-full rounded-lg border border-stitch-border bg-stitch-canvas px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-stitch-accent"
              placeholder="Коротко, что входит"
            />
            {lotError ? <p className="text-sm text-red-400">{lotError}</p> : null}
            <button
              type="submit"
              disabled={createLot.isPending}
              className="rounded-lg bg-stitch-accent px-4 py-2 text-sm font-medium text-white disabled:opacity-60"
            >
              {createLot.isPending ? 'Сохранение…' : 'Добавить услугу'}
            </button>
          </form>

          {myLots.data?.map((lot) => (
            <article
              key={lot.id}
              className="space-y-2 rounded-xl border border-stitch-border bg-stitch-surface p-4"
            >
              {editingId === lot.id ? (
                <>
                  <input
                    value={editTitle}
                    onChange={(e) => setEditTitle(e.target.value)}
                    className="w-full rounded-lg border border-stitch-border bg-stitch-canvas px-3 py-2 text-sm"
                  />
                  <input
                    type="number"
                    min={1}
                    value={editPrice}
                    onChange={(e) => setEditPrice(e.target.value)}
                    className="w-full rounded-lg border border-stitch-border bg-stitch-canvas px-3 py-2 text-sm"
                  />
                  <textarea
                    value={editDescription}
                    onChange={(e) => setEditDescription(e.target.value)}
                    rows={2}
                    className="w-full rounded-lg border border-stitch-border bg-stitch-canvas px-3 py-2 text-sm"
                  />
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      className="rounded-lg bg-stitch-accent px-3 py-1.5 text-sm text-white"
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
                    </button>
                    <button
                      type="button"
                      className="rounded-lg border border-stitch-border px-3 py-1.5 text-sm"
                      onClick={() => setEditingId(null)}
                    >
                      Отмена
                    </button>
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
                    {lot.active ? 'Видна в каталоге' : 'Скрыта'}
                  </p>
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      className="rounded-lg border border-stitch-border px-3 py-1.5 text-sm"
                      onClick={() => {
                        setEditingId(lot.id);
                        setEditTitle(lot.title);
                        setEditPrice(String(lot.priceRub));
                        setEditDescription(lot.description ?? '');
                      }}
                    >
                      Изменить
                    </button>
                    <button
                      type="button"
                      className="rounded-lg border border-stitch-border px-3 py-1.5 text-sm"
                      onClick={() => updateLot.mutate({ lotId: lot.id, active: !lot.active })}
                    >
                      {lot.active ? 'Снять с витрины' : 'Вернуть на витрину'}
                    </button>
                  </div>
                </>
              )}
            </article>
          ))}
        </section>

        <section className="space-y-3">
          <h2 className="font-extrabold">Добрые дела</h2>
          {!deeds.data?.length ? (
            <p className="text-sm text-stitch-muted">
              Публикуйте добрые дела в Telegram — здесь будет прогресс до права на обмен.
            </p>
          ) : (
            deeds.data.map((deed) => {
              const pct = Math.min(100, Math.round((deed.progress || 0) * 100));
              return (
                <article
                  key={deed.publicationId}
                  className="rounded-xl border border-stitch-border bg-stitch-surface p-4"
                >
                  <div className="flex items-center justify-between gap-3 text-sm">
                    <span className="font-extrabold">{deed.title?.trim() || 'Доброе дело'}</span>
                    <span>
                      {deed.score} из {deed.emissionThreshold} заслуг
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
                  ) : null}
                </article>
              );
            })
          )}
        </section>
      </div>
    </AppShell>
  );
}
