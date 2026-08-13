'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { AppShell } from '@/components/app-shell';
import { Button, Card, EmptyState, Notice, Skeleton, inputClass } from '@/components/ui';
import { trpc } from '@/lib/trpc/client';
import { useUzzCommunityId } from '@/lib/use-uzz-community';
import { bankHeadline } from '@/lib/utils';

export default function CatalogPage() {
  const router = useRouter();
  const { communityId, loggedIn, sessionLoading } = useUzzCommunityId();
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
  const balance = trpc.wallet.getBalance.useQuery(
    { communityId },
    { enabled: enabled && loggedIn, retry: false },
  );

  const [query, setQuery] = useState('');
  const [affordableOnly, setAffordableOnly] = useState(false);
  const [selectedLotId, setSelectedLotId] = useState<string | null>(null);
  const [bankId, setBankId] = useState('');
  const [message, setMessage] = useState<string | null>(null);

  const requestDeal = trpc.deals.request.useMutation({
    onSuccess: () => {
      void utils.deals.list.invalidate();
      void utils.wallet.getBalance.invalidate();
      void utils.banks.listMine.invalidate();
      router.push('/deals?requested=1');
    },
    onError: (err) => setMessage(err.message || 'Не удалось создать запрос'),
  });

  const activeBanks =
    banks.data?.filter((b) => b.status === 'active' && b.nominalRub != null) ?? [];
  const maxNominal = Math.max(0, ...activeBanks.map((b) => b.nominalRub ?? 0));
  const myLotIds = new Set(myLots.data?.map((l) => l.id) ?? []);
  const q = query.trim().toLowerCase();

  const visibleLots = useMemo(() => {
    return (lots.data ?? []).filter((lot) => {
      if (affordableOnly && !(maxNominal > 0 && lot.priceRub <= maxNominal)) return false;
      if (!q) return true;
      return `${lot.title} ${lot.description} ${lot.ownerName}`.toLowerCase().includes(q);
    });
  }, [lots.data, affordableOnly, maxNominal, q]);

  return (
    <AppShell>
      <div className="space-y-6">
        <header className="space-y-2">
          <h1 className="text-2xl font-extrabold tracking-tight">Обмен</h1>
          <p className="text-sm text-stitch-muted">
            Услуги сообщества. Платите правом на обмен: сегодняшний номинал должен покрывать цену.
          </p>
        </header>

        {!loggedIn && !sessionLoading ? (
          <Notice>
            Витрина открыта без входа.{' '}
            <Link href="/login" className="font-medium text-stitch-accent underline">
              Войдите по почте
            </Link>
            , чтобы запросить услугу.
          </Notice>
        ) : null}

        {canBuy.data?.reason === 'nudge' ? (
          <Notice tone="warn">
            Чтобы обмен был взаимным, добавьте свои услуги во вкладке «Моё». Сейчас{' '}
            {canBuy.data.activeLotCount} из {canBuy.data.minLotsToBuy}.
          </Notice>
        ) : null}

        {canBuy.data && !canBuy.data.allowed ? (
          <Notice tone="warn">
            Сначала опубликуйте свои услуги (нужно {canBuy.data.minLotsToBuy}).
          </Notice>
        ) : null}

        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className={inputClass}
            placeholder="Найти услугу"
            aria-label="Найти услугу"
          />
          {loggedIn ? (
            <label className="flex shrink-0 items-center gap-2 text-sm text-stitch-muted">
              <input
                type="checkbox"
                checked={affordableOnly}
                onChange={(e) => setAffordableOnly(e.target.checked)}
              />
              Мне по карману
            </label>
          ) : null}
        </div>

        {message ? (
          <Notice tone={message.startsWith('Запрос отправлен') ? 'ok' : 'warn'}>{message}</Notice>
        ) : null}

        {lots.isLoading ? (
          <div className="space-y-3" aria-busy>
            <Skeleton className="h-28 w-full" />
            <Skeleton className="h-28 w-full" />
          </div>
        ) : !visibleLots.length ? (
          <EmptyState
            title={q || affordableOnly ? 'Ничего не нашлось' : 'Пока нет подходящих услуг'}
          >
            {loggedIn ? (
              <Link href="/" className="text-stitch-accent underline">
                Добавьте свою во вкладке «Моё»
              </Link>
            ) : (
              'Загляните позже или войдите, чтобы предложить свою.'
            )}
          </EmptyState>
        ) : (
          <ul className="space-y-3">
            {visibleLots.map((lot) => {
              const own = myLotIds.has(lot.id);
              const covered = maxNominal >= lot.priceRub && maxNominal > 0;
              return (
                <li key={lot.id}>
                  <Card>
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <h2 className="font-extrabold">{lot.title}</h2>
                        <p className="mt-1 text-2xl font-extrabold text-stitch-accent">
                          {lot.priceRub} ₽
                        </p>
                        <p className="text-xs text-stitch-muted">от {lot.ownerName}</p>
                        {lot.description ? (
                          <p className="mt-2 text-sm text-stitch-muted">{lot.description}</p>
                        ) : null}
                        {loggedIn && !own ? (
                          <p className="mt-2 text-xs">
                            {covered ? (
                              <span className="text-stitch-accent">Ваше право покрывает цену</span>
                            ) : (
                              <span className="text-amber-200">Не хватает сегодняшнего номинала</span>
                            )}
                          </p>
                        ) : null}
                      </div>
                      {own ? (
                        <span className="text-xs text-stitch-muted">Ваша карточка</span>
                      ) : loggedIn ? (
                        <Button
                          type="button"
                          disabled={canBuy.data?.allowed === false}
                          onClick={() => {
                            setSelectedLotId(lot.id);
                            setMessage(null);
                            const first = activeBanks.find(
                              (b) => (b.nominalRub ?? 0) >= lot.priceRub,
                            );
                            setBankId(first?.id ?? '');
                          }}
                        >
                          Запросить
                        </Button>
                      ) : (
                        <Link
                          href="/login"
                          className="rounded-lg border border-stitch-border px-3 py-2 text-sm"
                        >
                          Войти
                        </Link>
                      )}
                    </div>

                    {selectedLotId === lot.id ? (
                      <div className="mt-4 space-y-3 border-t border-stitch-border pt-4">
                        <p className="text-sm text-stitch-muted">
                          С кошелька уйдёт 1 заслуга. Вернём, если исполнитель откажется или вы
                          отмените заявку.
                          {typeof balance.data?.balance === 'number'
                            ? ` Сейчас у вас ${balance.data.balance}.`
                            : ''}
                        </p>
                        <label className="block space-y-1 text-sm">
                          <span className="text-stitch-muted">Чем оплатить</span>
                          <select
                            value={bankId}
                            onChange={(e) => setBankId(e.target.value)}
                            className={inputClass}
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
                            Нет активного права.{' '}
                            <Link href="/" className="text-stitch-accent underline">
                              Смотрите вкладку «Моё»
                            </Link>
                            .
                          </p>
                        ) : null}
                        {typeof balance.data?.balance === 'number' && balance.data.balance < 1 ? (
                          <Notice tone="warn">
                            Нужна 1 заслуга на комиссию. Сейчас {balance.data.balance}.
                          </Notice>
                        ) : null}
                        <div className="flex flex-wrap gap-2">
                          <Button
                            type="button"
                            disabled={
                              !bankId ||
                              requestDeal.isPending ||
                              (typeof balance.data?.balance === 'number' &&
                                balance.data.balance < 1)
                            }
                            onClick={() =>
                              requestDeal.mutate({ communityId, lotId: lot.id, bankId })
                            }
                          >
                            {requestDeal.isPending ? 'Отправка…' : 'Отправить запрос'}
                          </Button>
                          <Button type="button" variant="ghost" onClick={() => setSelectedLotId(null)}>
                            Отмена
                          </Button>
                        </div>
                      </div>
                    ) : null}
                  </Card>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </AppShell>
  );
}
