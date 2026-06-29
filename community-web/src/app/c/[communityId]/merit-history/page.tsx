'use client';

import { AuthGate } from '@/components/shell';
import { CommunityShell } from '@/components/community-shell';
import { useCommunityId } from '@/lib/use-route-params';
import { useTelegramMiniApp } from '@/lib/telegram-mini-app-context';
import { trpc } from '@/lib/trpc/client';

function formatMeritAmount(amount: number): string {
  const sign = amount > 0 ? '+' : '';
  return `${sign}${amount}`;
}

function MeritHistoryInner({ communityId }: { communityId: string }) {
  const { isMiniApp } = useTelegramMiniApp();
  const historyQuery = trpc.wallets.getCommunityMeritHistory.useQuery({
    communityId,
    page: 1,
    pageSize: isMiniApp ? 50 : 30,
  });
  const personalQuery = trpc.wallets.getTransactions.useQuery(
    {
      userId: 'me',
      page: 1,
      pageSize: 20,
      permissionCommunityId: communityId,
    },
    { enabled: !isMiniApp },
  );
  const dashboardQuery = trpc.wallets.getMeritHistoryDashboard.useQuery(
    {
      userId: 'me',
      category: 'all',
      periodDays: 30,
      permissionCommunityId: communityId,
    },
    { enabled: !isMiniApp },
  );

  const communityRows = historyQuery.data?.data ?? [];
  const personalRows = personalQuery.data?.data ?? [];
  const kpis = dashboardQuery.data?.kpis;

  return (
    <CommunityShell communityId={communityId} active="merit-history" tgActive="history">
      <div className="space-y-6">
        <section className="space-y-3">
          <h1 className="text-xl font-extrabold tracking-tight">История заслуг</h1>
          {isMiniApp ? (
            <p className="text-sm text-stitch-muted">
              Кто, кому и когда — операции в этом сообществе.
            </p>
          ) : (
            kpis && (
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                <div className="rounded-xl border border-stitch-border bg-stitch-surface p-3">
                  <p className="text-xs text-stitch-muted">За 30 дней</p>
                  <p className="text-lg font-semibold">{formatMeritAmount(kpis.net)}</p>
                </div>
                <div className="rounded-xl border border-stitch-border bg-stitch-surface p-3">
                  <p className="text-xs text-stitch-muted">Получено</p>
                  <p className="text-lg font-semibold text-green-400">+{kpis.inflow}</p>
                </div>
                <div className="rounded-xl border border-stitch-border bg-stitch-surface p-3">
                  <p className="text-xs text-stitch-muted">Потрачено</p>
                  <p className="text-lg font-semibold text-red-400">−{kpis.outflow}</p>
                </div>
              </div>
            )
          )}
        </section>

        <section className="space-y-3">
          {!isMiniApp && (
            <h2 className="text-sm font-semibold text-stitch-muted">
              Сообщество (сводка)
            </h2>
          )}
          {historyQuery.isLoading && (
            <p className="text-sm text-stitch-muted">Загрузка…</p>
          )}
          <ul className="space-y-2">
            {communityRows.map((row) => (
              <li
                key={row.id}
                className="rounded-lg border border-stitch-border bg-stitch-surface px-3 py-2 text-sm"
              >
                <div className="flex justify-between gap-2">
                  <span>
                    {(row as { subjectDisplayName?: string | null }).subjectDisplayName ??
                      row.meritHistoryEnrichment?.title ??
                      row.meritHistoryCategory ??
                      row.referenceType}
                  </span>
                  <span
                    className={
                      row.amount >= 0 ? 'text-green-400 shrink-0' : 'text-red-400 shrink-0'
                    }
                  >
                    {formatMeritAmount(row.amount)}
                  </span>
                </div>
                <p className="text-xs text-stitch-muted mt-0.5">
                  {new Date(row.createdAt).toLocaleString('ru-RU')}
                </p>
              </li>
            ))}
          </ul>
          {!historyQuery.isLoading && communityRows.length === 0 && (
            <p className="text-sm text-stitch-muted">Нет операций.</p>
          )}
        </section>

        {!isMiniApp && (
          <section className="space-y-3">
            <h2 className="text-sm font-semibold text-stitch-muted">Личные операции</h2>
            {personalQuery.isLoading && (
              <p className="text-sm text-stitch-muted">Загрузка…</p>
            )}
            <ul className="space-y-2">
              {personalRows.map((row) => (
                <li
                  key={row.id}
                  className="rounded-lg border border-stitch-border bg-stitch-surface px-3 py-2 text-sm"
                >
                  <div className="flex justify-between gap-2">
                    <span>
                      {row.meritHistoryEnrichment?.title ??
                        row.meritHistoryCategory ??
                        row.referenceType ??
                        row.type}
                    </span>
                    <span
                      className={
                        row.amount >= 0 ? 'text-green-400 shrink-0' : 'text-red-400 shrink-0'
                      }
                    >
                      {formatMeritAmount(row.amount)}
                    </span>
                  </div>
                  <p className="text-xs text-stitch-muted mt-0.5">
                    {new Date(row.createdAt).toLocaleString('ru-RU')}
                  </p>
                </li>
              ))}
            </ul>
            {!personalQuery.isLoading && personalRows.length === 0 && (
              <p className="text-sm text-stitch-muted">Нет операций.</p>
            )}
          </section>
        )}
      </div>
    </CommunityShell>
  );
}

export default function MeritHistoryPage() {
  const communityId = useCommunityId();
  return (
    <AuthGate>
      <MeritHistoryInner communityId={communityId} />
    </AuthGate>
  );
}
