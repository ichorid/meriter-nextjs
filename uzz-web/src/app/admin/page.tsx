'use client';

import { FormEvent, useEffect, useState } from 'react';
import { AppShell } from '@/components/app-shell';
import { trpc } from '@/lib/trpc/client';
import { useUzzCommunityId } from '@/lib/use-uzz-community';
import { bankHeadline, bankHopsLabel, dealStatusLabel, formatWhen, ledgerTypeLabel, uzzErrorMessage } from '@/lib/utils';
import { QueryFailed } from '@/components/ui';

export default function AdminPage() {
  const { communityId, isUzzAdmin, loggedIn } = useUzzCommunityId();
  const enabled = Boolean(communityId) && loggedIn && isUzzAdmin;
  const utils = trpc.useUtils();

  const settings = trpc.settings.get.useQuery({ communityId }, { enabled, retry: false });
  const awaiting = trpc.banks.listAwaitingNominal.useQuery(
    { communityId },
    { enabled, retry: false },
  );
  const holding = trpc.banks.listHolding.useQuery({ communityId }, { enabled, retry: false });
  const ledger = trpc.ledger.list.useQuery(
    { communityId, limit: 30 },
    { enabled, retry: false },
  );
  const openDeals = trpc.deals.adminList.useQuery(
    { communityId },
    { enabled, retry: false },
  );

  const [emissionThreshold, setEmissionThreshold] = useState('10');
  const [demurrage, setDemurrage] = useState('100');
  const [floor, setFloor] = useState('100');
  const [minLots, setMinLots] = useState('3');
  const [requestTtl, setRequestTtl] = useState('48');
  const [fulfillmentDays, setFulfillmentDays] = useState('7');
  const [purchaseGate, setPurchaseGate] = useState<'nudge' | 'require_min_lots'>('nudge');
  const [bankTransferMode, setBankTransferMode] = useState<
    'escrow_until_close' | 'on_accept_locked' | 'on_close_only'
  >('escrow_until_close');
  const [notifyBankEmitted, setNotifyBankEmitted] = useState(true);
  const [notifyDealRequested, setNotifyDealRequested] = useState(true);
  const [notifyDealAccepted, setNotifyDealAccepted] = useState(true);
  const [notifyDealClosed, setNotifyDealClosed] = useState(true);
  const [nominalByBank, setNominalByBank] = useState<Record<string, string>>({});
  const [message, setMessage] = useState<string | null>(null);
  const [adminConfirm, setAdminConfirm] = useState<{
    id: string;
    kind: 'close' | 'return';
  } | null>(null);

  useEffect(() => {
    if (!settings.data) return;
    setEmissionThreshold(String(settings.data.emissionThreshold));
    setDemurrage(String(settings.data.demurrageRubPerDay));
    setFloor(String(settings.data.nominalFloorRub));
    setMinLots(String(settings.data.minLotsToBuy));
    setRequestTtl(String(settings.data.dealRequestTtlHours));
    setFulfillmentDays(String(settings.data.dealFulfillmentDays));
    setPurchaseGate(settings.data.purchaseGate);
    setBankTransferMode(settings.data.bankTransferMode);
    setNotifyBankEmitted(settings.data.notifyFlags?.bankEmitted ?? true);
    setNotifyDealRequested(settings.data.notifyFlags?.dealRequested ?? true);
    setNotifyDealAccepted(settings.data.notifyFlags?.dealAccepted ?? true);
    setNotifyDealClosed(settings.data.notifyFlags?.dealClosed ?? true);
  }, [settings.data]);

  const updateSettings = trpc.settings.update.useMutation({
    onSuccess: () => {
      setMessage('Настройки сохранены');
      void utils.settings.get.invalidate();
    },
    onError: (err) => setMessage(uzzErrorMessage(err)),
  });

  const setNominal = trpc.banks.setNominal.useMutation({
    onSuccess: () => {
      setMessage('Номинал назначен');
      void utils.banks.listAwaitingNominal.invalidate();
      void utils.banks.listHolding.invalidate();
      void utils.ledger.list.invalidate();
    },
    onError: (err) => setMessage(uzzErrorMessage(err)),
  });

  const adminClose = trpc.deals.adminClose.useMutation({
    onSuccess: () => {
      setMessage('Сделка закрыта');
      setAdminConfirm(null);
      void utils.deals.adminList.invalidate();
      void utils.ledger.list.invalidate();
    },
    onError: (err) => setMessage(uzzErrorMessage(err)),
  });
  const adminCancel = trpc.deals.adminCancel.useMutation({
    onSuccess: () => {
      setMessage('Сделка возвращена');
      setAdminConfirm(null);
      void utils.deals.adminList.invalidate();
      void utils.ledger.list.invalidate();
    },
    onError: (err) => setMessage(uzzErrorMessage(err)),
  });

  function onSaveSettings(e: FormEvent) {
    e.preventDefault();
    if (!communityId) return;
    updateSettings.mutate({
      communityId,
      patch: {
        emissionThreshold: Number(emissionThreshold),
        demurrageRubPerDay: Number(demurrage),
        nominalFloorRub: Number(floor),
        minLotsToBuy: Number(minLots),
        dealRequestTtlHours: Number(requestTtl),
        dealFulfillmentDays: Number(fulfillmentDays),
        purchaseGate,
        bankTransferMode,
        notifyFlags: {
          bankEmitted: notifyBankEmitted,
          dealRequested: notifyDealRequested,
          dealAccepted: notifyDealAccepted,
          dealClosed: notifyDealClosed,
        },
      },
    });
  }

  function NominalQueue({
    title,
    empty,
    items,
    isLoading,
    isError,
    onRetry,
    floorRub,
  }: {
    title: string;
    empty: string;
    items: typeof awaiting.data;
    isLoading: boolean;
    isError: boolean;
    onRetry: () => void;
    floorRub: number;
  }) {
    return (
      <section className="space-y-3 rounded-xl border border-stitch-border bg-stitch-surface p-5">
        <h2 className="font-extrabold">{title}</h2>
        {isLoading ? (
          <p className="text-sm text-stitch-muted">Загрузка…</p>
        ) : isError ? (
          <QueryFailed onRetry={onRetry} />
        ) : !items?.length ? (
          <p className="text-sm text-stitch-muted">{empty}</p>
        ) : (
          <ul className="space-y-3">
            {items.map((bank) => (
              <li
                key={bank.id}
                className="flex flex-wrap items-end gap-2 rounded-lg border border-stitch-border p-3"
              >
                <div className="min-w-[8rem] flex-1 text-sm">
                  <p className="font-medium">{bank.ownerName}</p>
                  {bank.sourceTitle ? (
                    <p className="mt-1 text-stitch-text">{bank.sourceTitle}</p>
                  ) : null}
                  <p className="text-stitch-muted">{bankHeadline(bank)}</p>
                  <p className="text-xs text-stitch-muted">
                    {typeof bank.sourceScore === 'number'
                      ? `${bank.sourceScore} заслуг · `
                      : ''}
                    {bankHopsLabel(bank.hopsLeft)}
                  </p>
                </div>
                <input
                  type="number"
                  min={floorRub}
                  placeholder="₽"
                  value={nominalByBank[bank.id] ?? ''}
                  onChange={(e) =>
                    setNominalByBank((prev) => ({ ...prev, [bank.id]: e.target.value }))
                  }
                  className="w-28 rounded-lg border border-stitch-border bg-stitch-canvas px-2 py-1.5 text-sm outline-none focus:ring-2 focus:ring-stitch-accent"
                />
                <button
                  type="button"
                  disabled={setNominal.isPending}
                  onClick={() => {
                    const n = Number(nominalByBank[bank.id]);
                    if (!Number.isFinite(n) || n <= 0) {
                      setMessage('Укажите положительный номинал');
                      return;
                    }
                    if (n < floorRub) {
                      setMessage(`Номинал не ниже ${floorRub} ₽`);
                      return;
                    }
                    setNominal.mutate({ bankId: bank.id, nominalRub: n });
                  }}
                  className="rounded-lg bg-stitch-accent px-3 py-1.5 text-sm font-medium text-white disabled:opacity-50"
                >
                  Назначить
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>
    );
  }

  return (
    <AppShell>
      <div className="space-y-6">
        <header className="space-y-2">
          <h1 className="text-2xl font-extrabold tracking-tight">Админ</h1>
          <p className="text-sm text-stitch-muted">
            Номиналы, режим покупки и короткие уведомления в Telegram.
          </p>
        </header>

        {!isUzzAdmin && loggedIn ? (
          <p className="text-sm text-stitch-muted">Нужна роль администратора сообщества.</p>
        ) : null}

        {message ? <p className="text-sm text-stitch-accent">{message}</p> : null}

        <NominalQueue
          title="Ждут номинал"
          empty="Пока нет прав, готовых к номиналу."
          items={awaiting.data}
          isLoading={awaiting.isLoading}
          isError={awaiting.isError}
          onRetry={() => void awaiting.refetch()}
          floorRub={settings.data?.nominalFloorRub ?? 100}
        />
        <section className="space-y-3 rounded-xl border border-stitch-border bg-stitch-surface p-5">
          <h2 className="font-extrabold">Ждут привязку</h2>
          {holding.isLoading ? (
            <p className="text-sm text-stitch-muted">Загрузка…</p>
          ) : holding.isError ? (
            <QueryFailed onRetry={() => void holding.refetch()} />
          ) : !holding.data?.length ? (
            <p className="text-sm text-stitch-muted">
              Нет прав в ожидании связки Telegram и почты.
            </p>
          ) : (
            <ul className="space-y-2 text-sm">
              {holding.data.map((bank) => (
                <li key={bank.id} className="rounded-lg border border-stitch-border p-3">
                  <p className="font-medium">{bank.ownerName}</p>
                  {bank.sourceTitle ? (
                    <p className="mt-1 text-sm">{bank.sourceTitle}</p>
                  ) : null}
                  {typeof bank.sourceScore === 'number' ? (
                    <p className="text-xs text-stitch-muted">{bank.sourceScore} заслуг на деле</p>
                  ) : null}
                  <p className="text-stitch-muted">Право появилось, но человек ещё не привязал Telegram и почту.</p>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="space-y-3 rounded-xl border border-stitch-border bg-stitch-surface p-5">
          <h2 className="font-extrabold">Открытые сделки</h2>
          {openDeals.isLoading ? (
            <p className="text-sm text-stitch-muted">Загрузка…</p>
          ) : openDeals.isError ? (
            <p className="text-sm text-amber-200">Не удалось загрузить сделки.</p>
          ) : !openDeals.data?.length ? (
            <p className="text-sm text-stitch-muted">Открытых сделок нет.</p>
          ) : (
            <ul className="space-y-3">
              {openDeals.data.map((deal) => (
                <li
                  key={deal.id}
                  className="flex flex-wrap items-end justify-between gap-2 rounded-lg border border-stitch-border p-3"
                >
                  <div className="min-w-[8rem] flex-1 text-sm">
                    <p className="font-medium">{deal.lotTitle}</p>
                    <p className="text-stitch-muted">
                      {dealStatusLabel(deal.status)}
                      {deal.counterpartyName ? ` · ${deal.counterpartyName}` : ''}
                      {deal.lotPriceRub != null ? ` · ${deal.lotPriceRub} ₽` : ''}
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {adminConfirm?.id === deal.id && adminConfirm.kind === 'close' ? (
                      <>
                        <button
                          type="button"
                          disabled={adminClose.isPending || adminCancel.isPending}
                          onClick={() => adminClose.mutate({ dealId: deal.id })}
                          className="rounded-lg bg-stitch-accent px-3 py-1.5 text-sm font-medium text-white disabled:opacity-50"
                        >
                          Точно закрыть?
                        </button>
                        <button
                          type="button"
                          onClick={() => setAdminConfirm(null)}
                          className="rounded-lg border border-stitch-border px-3 py-1.5 text-sm"
                        >
                          Нет
                        </button>
                      </>
                    ) : adminConfirm?.id === deal.id && adminConfirm.kind === 'return' ? (
                      <>
                        <button
                          type="button"
                          disabled={adminClose.isPending || adminCancel.isPending}
                          onClick={() => adminCancel.mutate({ dealId: deal.id })}
                          className="rounded-lg border border-stitch-border px-3 py-1.5 text-sm disabled:opacity-50"
                        >
                          Точно вернуть?
                        </button>
                        <button
                          type="button"
                          onClick={() => setAdminConfirm(null)}
                          className="rounded-lg border border-stitch-border px-3 py-1.5 text-sm"
                        >
                          Нет
                        </button>
                      </>
                    ) : (
                      <>
                        {deal.status === 'accepted' || deal.status === 'completed_by_seller' ? (
                          <button
                            type="button"
                            disabled={adminClose.isPending || adminCancel.isPending}
                            onClick={() => setAdminConfirm({ id: deal.id, kind: 'close' })}
                            className="rounded-lg bg-stitch-accent px-3 py-1.5 text-sm font-medium text-white disabled:opacity-50"
                          >
                            Закрыть
                          </button>
                        ) : null}
                        <button
                          type="button"
                          disabled={adminClose.isPending || adminCancel.isPending}
                          onClick={() => setAdminConfirm({ id: deal.id, kind: 'return' })}
                          className="rounded-lg border border-stitch-border px-3 py-1.5 text-sm disabled:opacity-50"
                        >
                          Вернуть
                        </button>
                      </>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>

        <form
          onSubmit={onSaveSettings}
          className="space-y-3 rounded-xl border border-stitch-border bg-stitch-surface p-5"
        >
          <h2 className="font-extrabold">Настройки</h2>
          <label className="block space-y-1 text-sm">
            <span className="text-stitch-muted">Порог эмиссии (заслуги на деле)</span>
            <input
              value={emissionThreshold}
              onChange={(e) => setEmissionThreshold(e.target.value)}
              className="w-full rounded-lg border border-stitch-border bg-stitch-canvas px-3 py-2 outline-none focus:ring-2 focus:ring-stitch-accent"
            />
          </label>
          <label className="block space-y-1 text-sm">
            <span className="text-stitch-muted">Таяние номинала (₽/сутки)</span>
            <input
              value={demurrage}
              onChange={(e) => setDemurrage(e.target.value)}
              className="w-full rounded-lg border border-stitch-border bg-stitch-canvas px-3 py-2 outline-none focus:ring-2 focus:ring-stitch-accent"
            />
          </label>
          <label className="block space-y-1 text-sm">
            <span className="text-stitch-muted">Минимальный номинал (₽)</span>
            <input
              value={floor}
              onChange={(e) => setFloor(e.target.value)}
              className="w-full rounded-lg border border-stitch-border bg-stitch-canvas px-3 py-2 outline-none focus:ring-2 focus:ring-stitch-accent"
            />
          </label>
          <label className="block space-y-1 text-sm">
            <span className="text-stitch-muted">Минимум своих услуг для покупки</span>
            <input
              value={minLots}
              onChange={(e) => setMinLots(e.target.value)}
              className="w-full rounded-lg border border-stitch-border bg-stitch-canvas px-3 py-2 outline-none focus:ring-2 focus:ring-stitch-accent"
            />
          </label>
          <label className="block space-y-1 text-sm">
            <span className="text-stitch-muted">Срок ответа на заявку (часы)</span>
            <input
              value={requestTtl}
              onChange={(e) => setRequestTtl(e.target.value)}
              className="w-full rounded-lg border border-stitch-border bg-stitch-canvas px-3 py-2 outline-none focus:ring-2 focus:ring-stitch-accent"
            />
          </label>
          <label className="block space-y-1 text-sm">
            <span className="text-stitch-muted">Срок исполнения (дни)</span>
            <input
              value={fulfillmentDays}
              onChange={(e) => setFulfillmentDays(e.target.value)}
              className="w-full rounded-lg border border-stitch-border bg-stitch-canvas px-3 py-2 outline-none focus:ring-2 focus:ring-stitch-accent"
            />
          </label>
          <label className="block space-y-1 text-sm">
            <span className="text-stitch-muted">Допуск к покупке</span>
            <select
              value={purchaseGate}
              onChange={(e) => setPurchaseGate(e.target.value as typeof purchaseGate)}
              className="w-full rounded-lg border border-stitch-border bg-stitch-canvas px-3 py-2"
            >
              <option value="nudge">Подсказка: добавьте свои услуги</option>
              <option value="require_min_lots">Обязательно свои услуги сначала</option>
            </select>
          </label>
          <label className="block space-y-1 text-sm">
            <span className="text-stitch-muted">Когда передавать право</span>
            <select
              value={bankTransferMode}
              onChange={(e) => setBankTransferMode(e.target.value as typeof bankTransferMode)}
              className="w-full rounded-lg border border-stitch-border bg-stitch-canvas px-3 py-2"
            >
              <option value="escrow_until_close">
                При закрытии (до этого право у заказчика, в сделке заблокировано)
              </option>
              <option value="on_accept_locked">Сразу при принятии заявки</option>
              <option value="on_close_only">Только в момент закрытия, без блокировки заранее</option>
            </select>
          </label>
          <fieldset className="space-y-2 text-sm">
            <legend className="text-stitch-muted">Короткие сообщения в Telegram</legend>
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={notifyBankEmitted}
                onChange={(e) => setNotifyBankEmitted(e.target.checked)}
              />
              Появилось право на обмен
            </label>
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={notifyDealRequested}
                onChange={(e) => setNotifyDealRequested(e.target.checked)}
              />
              Новая заявка / отмена
            </label>
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={notifyDealAccepted}
                onChange={(e) => setNotifyDealAccepted(e.target.checked)}
              />
              Заявка принята / сделано
            </label>
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={notifyDealClosed}
                onChange={(e) => setNotifyDealClosed(e.target.checked)}
              />
              Сделка закрыта
            </label>
          </fieldset>
          <button
            type="submit"
            disabled={updateSettings.isPending || !enabled || !settings.data || settings.isError}
            className="rounded-lg bg-stitch-accent px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
          >
            {updateSettings.isPending ? 'Сохранение…' : 'Сохранить'}
          </button>
        </form>

        <section className="space-y-3 rounded-xl border border-stitch-border bg-stitch-surface p-5">
          <h2 className="font-extrabold">Журнал площадки</h2>
          {ledger.isLoading ? (
            <p className="text-sm text-stitch-muted">Загрузка…</p>
          ) : ledger.isError ? (
            <QueryFailed onRetry={() => void ledger.refetch()} />
          ) : !ledger.data?.length ? (
            <p className="text-sm text-stitch-muted">Записей нет.</p>
          ) : (
            <ul className="max-h-80 space-y-2 overflow-y-auto text-sm">
              {ledger.data.map((row) => (
                <li
                  key={row.id}
                  className="rounded-lg border border-stitch-border/60 px-3 py-2 text-stitch-muted"
                >
                  <span className="text-stitch-text">{ledgerTypeLabel(row.type)}</span>
                  {row.createdAt ? (
                    <span className="ml-2 text-xs">{formatWhen(row.createdAt)}</span>
                  ) : null}
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </AppShell>
  );
}
