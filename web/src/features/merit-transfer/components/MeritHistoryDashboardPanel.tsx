'use client';

import { useMemo } from 'react';
import { useTranslations } from 'next-intl';
import { Loader2 } from 'lucide-react';
import { trpc } from '@/lib/trpc/client';
import { formatMerits } from '@/lib/utils/currency';
import { cn } from '@/lib/utils';

export type MeritHistoryDashboardCategory =
  | 'all'
  | 'peer_transfer'
  | 'voting'
  | 'investment'
  | 'tappalka'
  | 'fees_and_forward'
  | 'withdrawals'
  | 'welcome_and_system'
  | 'other';

export type MeritHistoryDashboardPeriod = 7 | 30 | 90;

function utcDateKeysForPeriod(periodDays: MeritHistoryDashboardPeriod): string[] {
  const now = new Date();
  const keys: string[] = [];
  for (let i = periodDays - 1; i >= 0; i -= 1) {
    const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
    d.setUTCDate(d.getUTCDate() - i);
    keys.push(d.toISOString().slice(0, 10));
  }
  return keys;
}

type Props = {
  userId: string;
  category: MeritHistoryDashboardCategory;
  permissionCommunityId?: string;
  enabled: boolean;
  periodDays: MeritHistoryDashboardPeriod;
  onPeriodDaysChange: (d: MeritHistoryDashboardPeriod) => void;
};

export function MeritHistoryDashboardPanel({
  userId,
  category,
  permissionCommunityId,
  enabled,
  periodDays,
  onPeriodDaysChange,
}: Props) {
  const t = useTranslations('meritHistory.dashboard');
  const tFilter = useTranslations('meritHistory.filter');

  const query = trpc.wallets.getMeritHistoryDashboard.useQuery(
    {
      userId,
      category,
      periodDays,
      permissionCommunityId: permissionCommunityId?.trim() || undefined,
    },
    {
      enabled: enabled && Boolean(userId),
      staleTime: 60_000,
    },
  );

  const dateKeys = useMemo(() => utcDateKeysForPeriod(periodDays), [periodDays]);

  const filledSeries = useMemo(() => {
    const byDay = new Map<string, number>();
    for (const p of query.data?.series ?? []) {
      byDay.set(p.date, p.net);
    }
    return dateKeys.map((date) => ({ date, net: byDay.get(date) ?? 0 }));
  }, [query.data?.series, dateKeys]);

  const sparkSummary = useMemo(() => {
    const nets = filledSeries.map((p) => p.net);
    const sum = nets.reduce((a, b) => a + b, 0);
    if (nets.length === 0 || nets.every((n) => n === 0)) {
      return t('sparklineSummaryFlat');
    }
    if (sum > 0) {
      return t('sparklineSummaryUp', { net: formatMerits(sum) });
    }
    if (sum < 0) {
      return t('sparklineSummaryDown', { net: formatMerits(Math.abs(sum)) });
    }
    return t('sparklineSummaryMixed');
  }, [filledSeries, t]);

  const chartGeometry = useMemo(() => {
    const nets = filledSeries.map((p) => p.net);
    const maxAbs = Math.max(1, ...nets.map((n) => Math.abs(n)));
    const w = 320;
    const h = 56;
    const pad = 4;
    const mid = h / 2;
    const n = nets.length || 1;
    const step = (w - pad * 2) / Math.max(1, n - 1);
    const points = nets.map((net, i) => {
      const x = pad + i * step;
      const y = mid - (net / maxAbs) * (mid - pad);
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    });
    return { w, h, pad, mid, points: points.join(' ') };
  }, [filledSeries]);

  const periods: MeritHistoryDashboardPeriod[] = [7, 30, 90];

  if (!enabled || !userId) {
    return null;
  }

  return (
    <section
      className="rounded-xl border border-base-300/80 bg-base-200/40 p-4 shadow-sm"
      aria-labelledby="merit-history-dashboard-heading"
    >
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <h2 id="merit-history-dashboard-heading" className="text-sm font-semibold text-base-content">
          {t('title')}
        </h2>
        <div
          className="flex gap-1 rounded-md border border-base-300 bg-base-100/80 p-0.5"
          role="group"
          aria-label={t('periodAriaLabel')}
        >
          {periods.map((d) => (
            <button
              key={d}
              type="button"
              onClick={() => onPeriodDaysChange(d)}
              className={cn(
                'rounded px-2 py-1 text-xs font-medium transition-colors',
                periodDays === d
                  ? 'bg-brand-primary text-primary-content'
                  : 'text-base-content/80 hover:bg-base-200',
              )}
            >
              {t(`period.${d}` as const)}
            </button>
          ))}
        </div>
      </div>

      {query.isLoading ? (
        <div className="flex h-32 items-center justify-center text-base-content/60" aria-busy="true">
          <Loader2 className="h-6 w-6 animate-spin" />
        </div>
      ) : null}

      {query.error ? (
        <p className="text-sm text-destructive" role="alert">
          {query.error.message}
        </p>
      ) : null}

      {!query.isLoading && !query.error && query.data ? (
        <>
          <div className="mb-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
            <Kpi label={t('kpi.inflow')} value={formatMerits(query.data.kpis.inflow)} />
            <Kpi label={t('kpi.outflow')} value={formatMerits(query.data.kpis.outflow)} />
            <Kpi label={t('kpi.net')} value={formatMerits(query.data.kpis.net)} />
            <Kpi label={t('kpi.count')} value={String(query.data.kpis.count)} />
          </div>

          <div className="mb-1">
            <svg
              width="100%"
              height={chartGeometry.h}
              viewBox={`0 0 ${chartGeometry.w} ${chartGeometry.h}`}
              preserveAspectRatio="none"
              className="text-brand-primary"
              role="img"
              aria-label={sparkSummary}
            >
              <line
                x1={chartGeometry.pad}
                x2={chartGeometry.w - chartGeometry.pad}
                y1={chartGeometry.mid}
                y2={chartGeometry.mid}
                stroke="currentColor"
                strokeOpacity={0.15}
                strokeWidth={1}
              />
              <polyline
                fill="none"
                stroke="currentColor"
                strokeWidth={2}
                strokeLinejoin="round"
                strokeLinecap="round"
                points={chartGeometry.points}
              />
            </svg>
          </div>
          <p className="mb-4 text-xs text-base-content/60">{t('sparklineCaption')}</p>

          {category === 'all' && query.data.breakdown && query.data.breakdown.length > 0 ? (
            <div className="overflow-x-auto rounded-md border border-base-300/60">
              <table className="w-full min-w-[280px] text-left text-xs">
                <thead className="border-b border-base-300/60 bg-base-100/50">
                  <tr>
                    <th className="px-2 py-2 font-medium">{t('breakdown.category')}</th>
                    <th className="px-2 py-2 font-medium">{t('breakdown.net')}</th>
                    <th className="px-2 py-2 font-medium">{t('breakdown.gross')}</th>
                    <th className="px-2 py-2 font-medium">{t('breakdown.count')}</th>
                  </tr>
                </thead>
                <tbody>
                  {query.data.breakdown.map((row) => (
                    <tr key={row.category} className="border-b border-base-300/40 last:border-0">
                      <td className="px-2 py-1.5">
                        {tFilter(row.category)}
                      </td>
                      <td className="px-2 py-1.5 tabular-nums">{formatMerits(row.net)}</td>
                      <td className="px-2 py-1.5 tabular-nums">{formatMerits(row.grossVolume)}</td>
                      <td className="px-2 py-1.5 tabular-nums">{row.count}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : null}

          {!query.isLoading && query.data.kpis.count === 0 ? (
            <p className="mt-2 text-xs text-base-content/60">{t('emptyPeriod')}</p>
          ) : null}
        </>
      ) : null}
    </section>
  );
}

function Kpi({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border border-base-300/50 bg-base-100/60 px-2 py-2">
      <div className="text-[10px] font-medium uppercase tracking-wide text-base-content/60">{label}</div>
      <div className="text-sm font-semibold tabular-nums text-base-content">{value}</div>
    </div>
  );
}
