'use client';

import { FormEvent, useEffect, useState } from 'react';
import { AppShell } from '@/components/app-shell';
import { config } from '@/config';
import { trpc } from '@/lib/trpc/client';

export default function AdminPage() {
  const communityId = config.defaultCommunityId;
  const enabled = Boolean(communityId);
  const utils = trpc.useUtils();

  const settings = trpc.settings.get.useQuery({ communityId }, { enabled, retry: false });
  const awaiting = trpc.banks.listAwaitingNominal.useQuery(
    { communityId },
    { enabled, retry: false },
  );
  const ledger = trpc.ledger.list.useQuery(
    { communityId, limit: 30 },
    { enabled, retry: false },
  );

  const [emissionThreshold, setEmissionThreshold] = useState('10');
  const [demurrage, setDemurrage] = useState('100');
  const [floor, setFloor] = useState('100');
  const [nominalByBank, setNominalByBank] = useState<Record<string, string>>({});
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!settings.data) return;
    setEmissionThreshold(String(settings.data.emissionThreshold));
    setDemurrage(String(settings.data.demurrageRubPerDay));
    setFloor(String(settings.data.nominalFloorRub));
  }, [settings.data]);

  const updateSettings = trpc.settings.update.useMutation({
    onSuccess: () => {
      setMessage('Настройки сохранены');
      void utils.settings.get.invalidate();
    },
    onError: (err) => setMessage(err.message || 'Ошибка сохранения'),
  });

  const setNominal = trpc.banks.setNominal.useMutation({
    onSuccess: () => {
      setMessage('Номинал назначен');
      void utils.banks.listAwaitingNominal.invalidate();
      void utils.ledger.list.invalidate();
    },
    onError: (err) => setMessage(err.message || 'Ошибка номинала'),
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
      },
    });
  }

  return (
    <AppShell>
      <div className="space-y-6">
        <header className="space-y-2">
          <h1 className="text-2xl font-extrabold tracking-tight">Админ</h1>
          <p className="text-sm text-stitch-muted">
            Очередь номиналов, настройки пилота и журнал площадки.
          </p>
        </header>

        {message ? <p className="text-sm text-stitch-accent">{message}</p> : null}

        <section className="space-y-3 rounded-xl border border-stitch-border bg-stitch-surface p-5">
          <h2 className="font-extrabold">Очередь номиналов</h2>
          {awaiting.isLoading ? (
            <p className="text-sm text-stitch-muted">Загрузка…</p>
          ) : awaiting.isError ? (
            <p className="text-sm text-stitch-muted">Нет доступа или сессии (нужен admin community).</p>
          ) : !awaiting.data?.length ? (
            <div className="rounded-lg border border-dashed border-stitch-border p-4 text-sm text-stitch-muted">
              Банки в статусе awaiting_nominal появятся здесь.
            </div>
          ) : (
            <ul className="space-y-3">
              {awaiting.data.map((bank) => (
                <li
                  key={bank.id}
                  className="flex flex-wrap items-end gap-2 rounded-lg border border-stitch-border p-3"
                >
                  <div className="min-w-[8rem] flex-1 text-sm">
                    <p className="font-medium">{bank.id.slice(0, 10)}</p>
                    <p className="text-stitch-muted">owner {bank.ownerId.slice(0, 8)}</p>
                  </div>
                  <input
                    type="number"
                    min={1}
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

        <form
          onSubmit={onSaveSettings}
          className="space-y-3 rounded-xl border border-stitch-border bg-stitch-surface p-5"
        >
          <h2 className="font-extrabold">Настройки</h2>
          <label className="block space-y-1 text-sm">
            <span className="text-stitch-muted">Порог эмиссии (заслуги)</span>
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
            <span className="text-stitch-muted">Пол номинала (₽)</span>
            <input
              value={floor}
              onChange={(e) => setFloor(e.target.value)}
              className="w-full rounded-lg border border-stitch-border bg-stitch-canvas px-3 py-2 outline-none focus:ring-2 focus:ring-stitch-accent"
            />
          </label>
          <button
            type="submit"
            disabled={updateSettings.isPending || !enabled}
            className="rounded-lg bg-stitch-accent px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
          >
            {updateSettings.isPending ? 'Сохранение…' : 'Сохранить'}
          </button>
        </form>

        <section className="space-y-3 rounded-xl border border-stitch-border bg-stitch-surface p-5">
          <h2 className="font-extrabold">Журнал (ledger)</h2>
          {ledger.isLoading ? (
            <p className="text-sm text-stitch-muted">Загрузка…</p>
          ) : ledger.isError ? (
            <p className="text-sm text-stitch-muted">Нет доступа.</p>
          ) : !ledger.data?.length ? (
            <p className="text-sm text-stitch-muted">Записей нет.</p>
          ) : (
            <ul className="max-h-80 space-y-2 overflow-y-auto text-sm">
              {ledger.data.map((row) => (
                <li
                  key={row.id}
                  className="rounded-lg border border-stitch-border/60 px-3 py-2 text-stitch-muted"
                >
                  <span className="text-stitch-text">{row.type}</span>
                  {row.bankId ? ` · bank ${row.bankId.slice(0, 8)}` : ''}
                  {row.dealId ? ` · deal ${row.dealId.slice(0, 8)}` : ''}
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </AppShell>
  );
}
