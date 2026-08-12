'use client';

import { useState } from 'react';
import { AppShell } from '@/components/app-shell';
import { config } from '@/config';
import { trpc } from '@/lib/trpc/client';

export default function CatalogPage() {
  const communityId = config.defaultCommunityId;
  const enabled = Boolean(communityId);
  const utils = trpc.useUtils();

  const lots = trpc.lots.list.useQuery({ communityId }, { enabled, retry: false });
  const canBuy = trpc.lots.canBuy.useQuery({ communityId }, { enabled, retry: false });
  const banks = trpc.banks.listMine.useQuery({ communityId }, { enabled, retry: false });

  const [selectedLotId, setSelectedLotId] = useState<string | null>(null);
  const [bankId, setBankId] = useState('');
  const [message, setMessage] = useState<string | null>(null);

  const requestDeal = trpc.deals.request.useMutation({
    onSuccess: () => {
      setMessage('Запрос сделки отправлен');
      setSelectedLotId(null);
      setBankId('');
      void utils.deals.list.invalidate();
    },
    onError: (err) => setMessage(err.message || 'Не удалось создать запрос'),
  });

  const activeBanks =
    banks.data?.filter((b) => b.status === 'active' && b.nominalRub != null) ?? [];

  return (
    <AppShell>
      <div className="space-y-6">
        <header className="space-y-2">
          <h1 className="text-2xl font-extrabold tracking-tight">Каталог</h1>
          <p className="text-sm text-stitch-muted">
            Карточки услуг и товаров. Оплата — банком, если номинал покрывает цену.
          </p>
        </header>

        {canBuy.data && !canBuy.data.allowed ? (
          <div className="rounded-xl border border-amber-500/40 bg-amber-500/10 p-4 text-sm text-amber-100">
            Покупка ограничена: активных лотов {canBuy.data.activeLotCount} из{' '}
            {canBuy.data.minLotsToBuy}. Создайте карточки в «Услуги».
          </div>
        ) : null}

        {message ? <p className="text-sm text-stitch-accent">{message}</p> : null}

        {lots.isLoading ? (
          <p className="text-sm text-stitch-muted">Загрузка…</p>
        ) : lots.isError ? (
          <p className="text-sm text-stitch-muted">Нужна сессия или communityId.</p>
        ) : !lots.data?.length ? (
          <div className="rounded-xl border border-dashed border-stitch-border bg-stitch-surface/60 p-8 text-center text-sm text-stitch-muted">
            Лотов пока нет.
          </div>
        ) : (
          <ul className="space-y-3">
            {lots.data.map((lot) => (
              <li
                key={lot.id}
                className="rounded-xl border border-stitch-border bg-stitch-surface p-4"
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <h2 className="font-extrabold">{lot.title}</h2>
                    <p className="text-sm text-stitch-accent">до {lot.priceRub} ₽ номинала</p>
                    {lot.description ? (
                      <p className="mt-1 text-sm text-stitch-muted">{lot.description}</p>
                    ) : null}
                  </div>
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
                </div>

                {selectedLotId === lot.id ? (
                  <div className="mt-4 space-y-3 border-t border-stitch-border pt-4">
                    <label className="block space-y-1 text-sm">
                      <span className="text-stitch-muted">Банк для оплаты</span>
                      <select
                        value={bankId}
                        onChange={(e) => setBankId(e.target.value)}
                        className="w-full rounded-lg border border-stitch-border bg-stitch-canvas px-3 py-2 outline-none focus:ring-2 focus:ring-stitch-accent"
                      >
                        <option value="">Выберите банк</option>
                        {activeBanks.map((b) => (
                          <option key={b.id} value={b.id}>
                            {b.id.slice(0, 8)} · {b.nominalRub} ₽ · hops {b.hopsLeft}
                          </option>
                        ))}
                      </select>
                    </label>
                    {!activeBanks.length ? (
                      <p className="text-xs text-stitch-muted">
                        Нет активных банков с номиналом. Смотрите главную / админ.
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
            ))}
          </ul>
        )}
      </div>
    </AppShell>
  );
}
