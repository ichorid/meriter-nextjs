'use client';

import { FormEvent, useState } from 'react';
import { AppShell } from '@/components/app-shell';
import { config } from '@/config';
import { trpc } from '@/lib/trpc/client';

export default function LotsPage() {
  const communityId = config.defaultCommunityId;
  const enabled = Boolean(communityId);
  const utils = trpc.useUtils();

  const myLots = trpc.lots.myLots.useQuery({ communityId }, { enabled, retry: false });
  const [title, setTitle] = useState('');
  const [priceRub, setPriceRub] = useState('500');
  const [description, setDescription] = useState('');
  const [error, setError] = useState<string | null>(null);

  const createLot = trpc.lots.create.useMutation({
    onSuccess: () => {
      setTitle('');
      setDescription('');
      setError(null);
      void utils.lots.myLots.invalidate();
      void utils.lots.list.invalidate();
      void utils.lots.canBuy.invalidate();
    },
    onError: (err) => setError(err.message || 'Не удалось создать'),
  });

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    const price = Number(priceRub);
    if (!title.trim() || !Number.isFinite(price) || price <= 0) {
      setError('Укажите название и положительную цену');
      return;
    }
    if (!communityId) {
      setError('Задайте NEXT_PUBLIC_DEFAULT_COMMUNITY_ID');
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
      <div className="space-y-6">
        <header className="space-y-2">
          <h1 className="text-2xl font-extrabold tracking-tight">Мои услуги</h1>
          <p className="text-sm text-stitch-muted">Карточки ваших предложений на площадке.</p>
        </header>

        <form
          onSubmit={onSubmit}
          className="space-y-3 rounded-xl border border-stitch-border bg-stitch-surface p-5"
        >
          <h2 className="font-extrabold">Новая карточка</h2>
          <label className="block space-y-1">
            <span className="text-xs text-stitch-muted">Название</span>
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full rounded-lg border border-stitch-border bg-stitch-canvas px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-stitch-accent"
              placeholder="Например: помощь с переездом"
            />
          </label>
          <label className="block space-y-1">
            <span className="text-xs text-stitch-muted">Цена (₽ номинала)</span>
            <input
              type="number"
              min={1}
              value={priceRub}
              onChange={(e) => setPriceRub(e.target.value)}
              className="w-full rounded-lg border border-stitch-border bg-stitch-canvas px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-stitch-accent"
            />
          </label>
          <label className="block space-y-1">
            <span className="text-xs text-stitch-muted">Описание</span>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              className="w-full rounded-lg border border-stitch-border bg-stitch-canvas px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-stitch-accent"
            />
          </label>
          {error ? <p className="text-sm text-red-400">{error}</p> : null}
          <button
            type="submit"
            disabled={createLot.isPending}
            className="rounded-lg bg-stitch-accent px-4 py-2 text-sm font-medium text-white disabled:opacity-60"
          >
            {createLot.isPending ? 'Сохранение…' : 'Создать'}
          </button>
        </form>

        <section className="space-y-3">
          {myLots.isLoading ? (
            <p className="text-sm text-stitch-muted">Загрузка…</p>
          ) : myLots.isError ? (
            <p className="text-sm text-stitch-muted">Нужна сессия.</p>
          ) : !myLots.data?.length ? (
            <p className="text-sm text-stitch-muted">Пока нет карточек.</p>
          ) : (
            myLots.data.map((lot) => (
              <article
                key={lot.id}
                className="rounded-xl border border-stitch-border bg-stitch-surface p-4"
              >
                <h3 className="font-extrabold">{lot.title}</h3>
                <p className="text-sm text-stitch-accent">до {lot.priceRub} ₽ номинала</p>
                {lot.description ? (
                  <p className="mt-1 text-sm text-stitch-muted">{lot.description}</p>
                ) : null}
                <p className="mt-1 text-xs text-stitch-muted">
                  {lot.active ? 'активна' : 'неактивна'}
                </p>
              </article>
            ))
          )}
        </section>
      </div>
    </AppShell>
  );
}
