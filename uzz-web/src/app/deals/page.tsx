'use client';

import { AppShell } from '@/components/app-shell';
import { config } from '@/config';
import { trpc } from '@/lib/trpc/client';
import { dealStatusLabel } from '@/lib/utils';

export default function DealsPage() {
  const communityId = config.defaultCommunityId;
  const enabled = Boolean(communityId);
  const utils = trpc.useUtils();

  const deals = trpc.deals.list.useQuery(
    { communityId, mineOnly: true },
    { enabled, retry: false },
  );

  const invalidate = () => void utils.deals.list.invalidate();

  const accept = trpc.deals.accept.useMutation({ onSuccess: invalidate });
  const reject = trpc.deals.reject.useMutation({ onSuccess: invalidate });
  const complete = trpc.deals.complete.useMutation({ onSuccess: invalidate });
  const close = trpc.deals.close.useMutation({ onSuccess: invalidate });

  const pending =
    accept.isPending || reject.isPending || complete.isPending || close.isPending;

  return (
    <AppShell>
      <div className="space-y-6">
        <header className="space-y-2">
          <h1 className="text-2xl font-extrabold tracking-tight">Сделки</h1>
          <p className="text-sm text-stitch-muted">
            Запрос → принятие → исполнение → закрытие. Комиссия — 1 заслуга с кошелька.
          </p>
        </header>

        {deals.isLoading ? (
          <p className="text-sm text-stitch-muted">Загрузка…</p>
        ) : deals.isError ? (
          <p className="text-sm text-stitch-muted">Нужна сессия.</p>
        ) : !deals.data?.length ? (
          <div className="rounded-xl border border-dashed border-stitch-border bg-stitch-surface/60 p-6 text-sm text-stitch-muted">
            Сделок пока нет.
          </div>
        ) : (
          <ul className="space-y-3">
            {deals.data.map((deal) => (
              <li
                key={deal.id}
                className="rounded-xl border border-stitch-border bg-stitch-surface p-5"
              >
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <h2 className="font-extrabold">Сделка {deal.id.slice(0, 8)}</h2>
                  <span className="text-sm text-stitch-muted">
                    {dealStatusLabel(deal.status)}
                  </span>
                </div>
                <p className="mt-1 text-sm text-stitch-muted">
                  лот {deal.lotId.slice(0, 8)} · банк {deal.bankId.slice(0, 8)}
                  {deal.dealAmountRub != null ? ` · ${deal.dealAmountRub} ₽` : ''}
                </p>
                <div className="mt-4 flex flex-wrap gap-2">
                  {deal.status === 'requested' ? (
                    <>
                      <button
                        type="button"
                        disabled={pending}
                        onClick={() => accept.mutate({ dealId: deal.id })}
                        className="rounded-lg border border-stitch-border px-3 py-1.5 text-sm hover:border-stitch-accent disabled:opacity-50"
                      >
                        Принять
                      </button>
                      <button
                        type="button"
                        disabled={pending}
                        onClick={() => reject.mutate({ dealId: deal.id })}
                        className="rounded-lg border border-stitch-border px-3 py-1.5 text-sm hover:border-red-400 disabled:opacity-50"
                      >
                        Отклонить
                      </button>
                    </>
                  ) : null}
                  {deal.status === 'accepted' ? (
                    <button
                      type="button"
                      disabled={pending}
                      onClick={() => complete.mutate({ dealId: deal.id })}
                      className="rounded-lg border border-stitch-border px-3 py-1.5 text-sm hover:border-stitch-accent disabled:opacity-50"
                    >
                      Сделано
                    </button>
                  ) : null}
                  {deal.status === 'completed_by_seller' ? (
                    <button
                      type="button"
                      disabled={pending}
                      onClick={() => close.mutate({ dealId: deal.id })}
                      className="rounded-lg bg-stitch-accent px-3 py-1.5 text-sm font-medium text-white disabled:opacity-50"
                    >
                      Подтвердить закрытие
                    </button>
                  ) : null}
                </div>
                {(accept.error || reject.error || complete.error || close.error) && (
                  <p className="mt-2 text-sm text-red-400">
                    {(accept.error || reject.error || complete.error || close.error)?.message}
                  </p>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>
    </AppShell>
  );
}
