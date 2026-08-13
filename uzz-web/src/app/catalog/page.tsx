'use client';

import { useState } from 'react';
import Link from 'next/link';
import { AppShell } from '@/components/app-shell';
import { trpc } from '@/lib/trpc/client';
import { useUzzCommunityId } from '@/lib/use-uzz-community';
import { bankHeadline } from '@/lib/utils';

export default function CatalogPage() {
  const { communityId, loggedIn } = useUzzCommunityId();
  const enabled = Boolean(communityId);
  const utils = trpc.useUtils();

  const lots = trpc.lots.list.useQuery({ communityId }, { enabled, retry: false });
  const canBuy = trpc.lots.canBuy.useQuery(
    { communityId },
    { enabled: enabled && loggedIn, retry: false },
  );
  const banks = trpc.banks.listMine.useQuery(
    { communityId },
    { enabled: enabled && loggedIn, retry: false },
  );
  const myLots = trpc.lots.myLots.useQuery(
    { communityId },
    { enabled: enabled && loggedIn, retry: false },
  );
  const me = trpc.auth.me.useQuery(undefined, { retry: false });

  const [affordableOnly, setAffordableOnly] = useState(false);
  const [selectedLotId, setSelectedLotId] = useState<string | null>(null);
  const [bankId, setBankId] = useState('');
  const [message, setMessage] = useState<string | null>(null);

  const requestDeal = trpc.deals.request.useMutation({
    onSuccess: () => {
      setMessage('Запрос отправлен исполнителю');
      setSelectedLotId(null);
      setBankId('');
      void utils.deals.list.invalidate();
    },
    onError: (err) => setMessage(err.message || 'Не удалось создать запрос'),
  });

  const activeBanks =
    banks.data?.filter((b) => b.status === 'active' && b.nominalRub != null) ?? [];
  const maxNominal = Math.max(0, ...activeBanks.map((b) => b.nominalRub ?? 0));
  const myLotIds = new Set(myLots.data?.map((l) => l.id) ?? []);

  const visibleLots = (lots.data ?? []).filter((lot) => {
    if (!affordableOnly) return true;
    return maxNominal > 0 && lot.priceRub <= maxNominal;
  });

  return (
    <AppShell>
      <div className="space-y-6">
        <header className="space-y-2">
          <h1 className="text-2xl font-extrabold tracking-tight">Обмен</h1>
          <p className="text-sm text-stitch-muted">
            Услуги и товары сообщества. Оплата — правом на обмен, если сегодняшний номинал покрывает
            цену.
          </p>
        </header>

        {!loggedIn && !me.isLoading ? (
          <p className="text-sm text-stitch-muted">
            Смотрите витрину свободно.{' '}
            <Link href="/login" className="text-stitch-accent hover:underline">
              Войдите
            </Link>
            , чтобы запросить услугу.
          </p>
        ) : null}

        {canBuy.data?.reason === 'nudge' ? (
          <div className="rounded-xl border border-amber-500/40 bg-amber-500/10 p-4 text-sm text-amber-100">
            Чтобы обмен был взаимным, добавьте свои услуги во вкладке «Моё». Сейчас карточек:{' '}
            {canBuy.data.activeLotCount} из {canBuy.data.minLotsToBuy}.
          </div>
        ) : null}

        {canBuy.data && !canBuy.data.allowed ? (
          <div className="rounded-xl border border-amber-500/40 bg-amber-500/10 p-4 text-sm text-amber-100">
            Сначала опубликуйте свои услуги (нужно {canBuy.data.minLotsToBuy}), затем можно
            запрашивать чужие.
          </div>
        ) : null}

        {loggedIn ? (
          <label className="flex items-center gap-2 text-sm text-stitch-muted">
            <input
              type="checkbox"
              checked={affordableOnly}
              onChange={(e) => setAffordableOnly(e.target.checked)}
            />
            Мне по карману
          </label>
        ) : null}

        {message ? <p className="text-sm text-stitch-accent">{message}</p> : null}

        {lots.isLoading ? (
          <p className="text-sm text-stitch-muted">Загрузка…</p>
        ) : !visibleLots.length ? (
          <div className="rounded-xl border border-dashed border-stitch-border bg-stitch-surface/60 p-8 text-center text-sm text-stitch-muted">
            Пока нет услуг. Добавьте свою во вкладке «Моё».
          </div>
        ) : (
          <ul className="space-y-3">
            {visibleLots.map((lot) => {
              const own = myLotIds.has(lot.id);
              const covered = maxNominal >= lot.priceRub && maxNominal > 0;
              return (
                <li
                  key={lot.id}
                  className="rounded-xl border border-stitch-border bg-stitch-surface p-4"
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <h2 className="font-extrabold">{lot.title}</h2>
                      <p className="text-sm text-stitch-accent">{lot.priceRub} ₽</p>
                      <p className="text-xs text-stitch-muted">от {lot.ownerName}</p>
                      {lot.description ? (
                        <p className="mt-1 text-sm text-stitch-muted">{lot.description}</p>
                      ) : null}
                      {loggedIn && !own ? (
                        <p className="mt-2 text-xs">
                          {covered ? (
                            <span className="text-stitch-accent">Ваше право покрывает цену</span>
                          ) : (
                            <span className="text-amber-200">Не хватает номинала</span>
                          )}
                        </p>
                      ) : null}
                    </div>
                    {own ? (
                      <span className="text-xs text-stitch-muted">Ваша карточка</span>
                    ) : loggedIn ? (
                      <button
                        type="button"
                        disabled={canBuy.data?.allowed === false}
                        onClick={() => {
                          setSelectedLotId(lot.id);
                          setMessage(null);
                        }}
                        className="rounded-lg bg-stitch-accent px-3 py-1.5 text-sm font-medium text-white disabled:opacity-50"
                      >
                        Запросить
                      </button>
                    ) : (
                      <Link
                        href="/login"
                        className="rounded-lg border border-stitch-border px-3 py-1.5 text-sm text-stitch-muted"
                      >
                        Войти
                      </Link>
                    )}
                  </div>

                  {selectedLotId === lot.id ? (
                    <div className="mt-4 space-y-3 border-t border-stitch-border pt-4">
                      <label className="block space-y-1 text-sm">
                        <span className="text-stitch-muted">Чем оплатить</span>
                        <select
                          value={bankId}
                          onChange={(e) => setBankId(e.target.value)}
                          className="w-full rounded-lg border border-stitch-border bg-stitch-canvas px-3 py-2 outline-none focus:ring-2 focus:ring-stitch-accent"
                        >
                          <option value="">Выберите право на обмен</option>
                          {activeBanks
                            .filter((b) => (b.nominalRub ?? 0) >= lot.priceRub)
                            .map((b) => (
                              <option key={b.id} value={b.id}>
                                {bankHeadline(b)}
                              </option>
                            ))}
                        </select>
                      </label>
                      {!activeBanks.length ? (
                        <p className="text-xs text-stitch-muted">
                          Нет активного права на обмен. Смотрите вкладку «Моё».
                        </p>
                      ) : null}
                      <div className="flex flex-wrap gap-2">
                        <button
                          type="button"
                          disabled={!bankId || requestDeal.isPending}
                          onClick={() =>
                            requestDeal.mutate({ communityId, lotId: lot.id, bankId })
                          }
                          className="rounded-lg bg-stitch-accent px-3 py-1.5 text-sm font-medium text-white disabled:opacity-50"
                        >
                          {requestDeal.isPending ? 'Отправка…' : 'Отправить запрос'}
                        </button>
                        <button
                          type="button"
                          onClick={() => setSelectedLotId(null)}
                          className="rounded-lg border border-stitch-border px-3 py-1.5 text-sm text-stitch-muted"
                        >
                          Отмена
                        </button>
                      </div>
                    </div>
                  ) : null}
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </AppShell>
  );
}
