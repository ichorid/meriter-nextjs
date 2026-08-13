'use client';

import { FormEvent, useState } from 'react';
import { AppShell } from '@/components/app-shell';
import { trpc } from '@/lib/trpc/client';
import { useUzzCommunityId } from '@/lib/use-uzz-community';
import { dealStatusLabel } from '@/lib/utils';

export default function DealsPage() {
  const { communityId, loggedIn } = useUzzCommunityId();
  const enabled = Boolean(communityId) && loggedIn;
  const utils = trpc.useUtils();

  const deals = trpc.deals.list.useQuery(
    { communityId, mineOnly: true },
    { enabled, retry: false },
  );

  const invalidate = () => {
    void utils.deals.list.invalidate();
    void utils.banks.listMine.invalidate();
    void utils.wallet.getBalance.invalidate();
    void utils.ledger.listMine.invalidate();
  };

  const accept = trpc.deals.accept.useMutation({ onSuccess: invalidate });
  const reject = trpc.deals.reject.useMutation({ onSuccess: invalidate });
  const complete = trpc.deals.complete.useMutation({ onSuccess: invalidate });
  const close = trpc.deals.close.useMutation({ onSuccess: invalidate });
  const cancel = trpc.deals.cancel.useMutation({ onSuccess: invalidate });
  const thank = trpc.deals.thank.useMutation({ onSuccess: invalidate });

  const [thanksDealId, setThanksDealId] = useState<string | null>(null);
  const [thanksComment, setThanksComment] = useState('');
  const [thanksMerits, setThanksMerits] = useState('0');

  const pending =
    accept.isPending ||
    reject.isPending ||
    complete.isPending ||
    close.isPending ||
    cancel.isPending;

  function onThanks(e: FormEvent) {
    e.preventDefault();
    if (!thanksDealId) return;
    thank.mutate({
      dealId: thanksDealId,
      comment: thanksComment.trim() || undefined,
      merits: Number(thanksMerits) || 0,
    });
    setThanksDealId(null);
    setThanksComment('');
    setThanksMerits('0');
  }

  return (
    <AppShell>
      <div className="space-y-6">
        <header className="space-y-2">
          <h1 className="text-2xl font-extrabold tracking-tight">Сделки</h1>
          <p className="text-sm text-stitch-muted">
            Запрос → ответ исполнителя → «сделано» → закрытие. Комиссия 1 заслуга резервируется при
            запросе и возвращается, если сделку отклонят или отменят.
          </p>
        </header>

        {deals.isLoading ? (
          <p className="text-sm text-stitch-muted">Загрузка…</p>
        ) : !deals.data?.length ? (
          <div className="rounded-xl border border-dashed border-stitch-border bg-stitch-surface/60 p-6 text-sm text-stitch-muted">
            Сделок пока нет. Найдите услугу во вкладке «Обмен».
          </div>
        ) : (
          <ul className="space-y-3">
            {deals.data.map((deal) => {
              const alreadyThanked =
                deal.myRole === 'buyer' ? Boolean(deal.buyerThankedAt) : Boolean(deal.sellerThankedAt);
              return (
                <li
                  key={deal.id}
                  className="rounded-xl border border-stitch-border bg-stitch-surface p-5"
                >
                  <div className="flex flex-wrap items-baseline justify-between gap-2">
                    <h2 className="font-extrabold">{deal.lotTitle}</h2>
                    <span className="text-sm text-stitch-muted">
                      {deal.myRole === 'buyer' ? 'Вы заказчик' : deal.myRole === 'seller' ? 'Вы исполнитель' : ''}
                    </span>
                  </div>
                  <p className="mt-1 text-sm text-stitch-muted">
                    {dealStatusLabel(deal.status)}
                    {deal.counterpartyName ? ` · с ${deal.counterpartyName}` : ''}
                    {deal.dealAmountRub != null ? ` · ${deal.dealAmountRub} ₽` : ''}
                  </p>
                  <div className="mt-4 flex flex-wrap gap-2">
                    {deal.status === 'requested' && deal.myRole === 'seller' ? (
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
                    {deal.status === 'requested' && deal.myRole === 'buyer' ? (
                      <button
                        type="button"
                        disabled={pending}
                        onClick={() => cancel.mutate({ dealId: deal.id })}
                        className="rounded-lg border border-stitch-border px-3 py-1.5 text-sm hover:border-red-400 disabled:opacity-50"
                      >
                        Отменить
                      </button>
                    ) : null}
                    {deal.status === 'accepted' && deal.myRole === 'seller' ? (
                      <button
                        type="button"
                        disabled={pending}
                        onClick={() => complete.mutate({ dealId: deal.id })}
                        className="rounded-lg border border-stitch-border px-3 py-1.5 text-sm hover:border-stitch-accent disabled:opacity-50"
                      >
                        Сделано
                      </button>
                    ) : null}
                    {deal.status === 'accepted' && deal.myRole === 'buyer' ? (
                      <p className="text-sm text-stitch-muted">Ждём, когда исполнитель отметит «сделано».</p>
                    ) : null}
                    {deal.status === 'completed_by_seller' && deal.myRole === 'buyer' ? (
                      <button
                        type="button"
                        disabled={pending}
                        onClick={() => close.mutate({ dealId: deal.id })}
                        className="rounded-lg bg-stitch-accent px-3 py-1.5 text-sm font-medium text-white disabled:opacity-50"
                      >
                        Подтвердить закрытие
                      </button>
                    ) : null}
                    {deal.status === 'closed' && !alreadyThanked ? (
                      <button
                        type="button"
                        onClick={() => setThanksDealId(deal.id)}
                        className="rounded-lg border border-stitch-border px-3 py-1.5 text-sm hover:border-stitch-accent"
                      >
                        Спасибо
                      </button>
                    ) : null}
                  </div>
                  {thanksDealId === deal.id ? (
                    <form onSubmit={onThanks} className="mt-4 space-y-2 border-t border-stitch-border pt-4">
                      <textarea
                        value={thanksComment}
                        onChange={(e) => setThanksComment(e.target.value)}
                        rows={2}
                        placeholder="Коротко, за что благодарите"
                        className="w-full rounded-lg border border-stitch-border bg-stitch-canvas px-3 py-2 text-sm"
                      />
                      <input
                        type="number"
                        min={0}
                        value={thanksMerits}
                        onChange={(e) => setThanksMerits(e.target.value)}
                        className="w-full rounded-lg border border-stitch-border bg-stitch-canvas px-3 py-2 text-sm"
                        placeholder="Заслуг (необязательно)"
                      />
                      <div className="flex gap-2">
                        <button
                          type="submit"
                          disabled={thank.isPending}
                          className="rounded-lg bg-stitch-accent px-3 py-1.5 text-sm text-white"
                        >
                          Отправить
                        </button>
                        <button
                          type="button"
                          className="rounded-lg border border-stitch-border px-3 py-1.5 text-sm"
                          onClick={() => setThanksDealId(null)}
                        >
                          Отмена
                        </button>
                      </div>
                    </form>
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
