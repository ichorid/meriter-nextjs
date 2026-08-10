'use client';

import { useMemo } from 'react';
import { AuthGate } from '@/components/shell';
import { CommunityShell } from '@/components/community-shell';
import { MeritHistoryRow, type MeritHistoryRowData } from '@/components/merit-history-row';
import { useCommunityId } from '@/lib/use-route-params';
import { useTelegramMiniApp } from '@/lib/telegram-mini-app-context';
import { trpc } from '@/lib/trpc/client';

const PAGE_SIZE = 20;

function formatMeritAmount(amount: number): string {
  const sign = amount > 0 ? '+' : '';
  return `${sign}${amount}`;
}

function MeritHistoryInner({ communityId }: { communityId: string }) {
  const { isMiniApp } = useTelegramMiniApp();

  const personalInfiniteQuery = trpc.wallets.getTransactions.useInfiniteQuery(
    {
      userId: 'me',
      limit: PAGE_SIZE,
      communityId,
      permissionCommunityId: communityId,
    },
    {
      enabled: isMiniApp,
      initialPageParam: 0,
      getNextPageParam: (lastPage) =>
        lastPage.hasMore ? lastPage.skip + lastPage.data.length : undefined,
    },
  );

  const historyQuery = trpc.wallets.getCommunityMeritHistory.useQuery(
    {
      communityId,
      page: 1,
      pageSize: 30,
    },
    { enabled: !isMiniApp },
  );

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

  const miniAppRows = useMemo((): MeritHistoryRowData[] => {
    const pages = personalInfiniteQuery.data?.pages ?? [];
    return pages.flatMap((page) =>
      page.data.map((row) => ({
        id: row.id,
        type: row.type,
        amount: row.amount,
        description: row.description,
        referenceType: row.referenceType,
        createdAt: row.createdAt,
        ledgerMultiplier: row.ledgerMultiplier,
        meritHistoryEnrichment: row.meritHistoryEnrichment,
      })),
    );
  }, [personalInfiniteQuery.data?.pages]);

  const communityRows = historyQuery.data?.data ?? [];
  const personalRows = personalQuery.data?.data ?? [];
  const kpis = dashboardQuery.data?.kpis;

  const isLoading = isMiniApp
    ? personalInfiniteQuery.isLoading
    : historyQuery.isLoading || personalQuery.isLoading;

  return (
    <CommunityShell communityId={communityId} active="merit-history" tgActive="history">
      <div className="space-y-6">
        <section className="space-y-3">
          <h1 className="text-xl font-extrabold tracking-tight">История заслуг</h1>
          {isMiniApp ? (
            <p className="text-sm text-stitch-muted">
              Ваши операции в этом сообществе: приветственные начисления, переводы и голоса.
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
          {isLoading && <p className="text-sm text-stitch-muted">Загрузка…</p>}

          {isMiniApp ? (
            <>
              <ul className="space-y-2">
                {miniAppRows.map((row) => (
                  <MeritHistoryRow key={row.id} row={row} />
                ))}
              </ul>
              {personalInfiniteQuery.hasNextPage ? (
                <button
                  type="button"
                  onClick={() => personalInfiniteQuery.fetchNextPage()}
                  disabled={personalInfiniteQuery.isFetchingNextPage}
                  className="min-h-[44px] w-full rounded-lg border border-stitch-border bg-stitch-surface px-4 py-2 text-sm font-medium disabled:opacity-50"
                >
                  {personalInfiniteQuery.isFetchingNextPage ? 'Загрузка…' : 'Загрузить ещё'}
                </button>
              ) : null}
              {!isLoading && miniAppRows.length === 0 && (
                <p className="text-sm text-stitch-muted">Нет операций.</p>
              )}
            </>
          ) : (
            <>
              <ul className="space-y-2">
                {communityRows.map((row) => (
                  <MeritHistoryRow
                    key={row.id}
                    row={{
                      id: row.id,
                      type: row.type,
                      amount: row.amount,
                      description: row.description,
                      referenceType: row.referenceType,
                      createdAt: row.createdAt,
                      ledgerMultiplier: row.ledgerMultiplier,
                      meritHistoryEnrichment: row.meritHistoryEnrichment,
                    }}
                  />
                ))}
              </ul>
              {!historyQuery.isLoading && communityRows.length === 0 && (
                <p className="text-sm text-stitch-muted">Нет операций.</p>
              )}
            </>
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
                <MeritHistoryRow
                  key={row.id}
                  row={{
                    id: row.id,
                    type: row.type,
                    amount: row.amount,
                    description: row.description,
                    referenceType: row.referenceType,
                    createdAt: row.createdAt,
                    ledgerMultiplier: row.ledgerMultiplier,
                    meritHistoryEnrichment: row.meritHistoryEnrichment,
                  }}
                />
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
