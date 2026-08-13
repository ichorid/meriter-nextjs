'use client';

import { FormEvent, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { AppShell } from '@/components/app-shell';
import { Button, Card, EmptyState, Notice, QueryFailed, Skeleton, inputClass } from '@/components/ui';
import { trpc } from '@/lib/trpc/client';
import { useUzzCommunityId } from '@/lib/use-uzz-community';
import {
  dealNeedsAction,
  dealStatusLabel,
  feeChargedCopy,
  feeWalletPhrase,
  formatDeadline,
  isDeadlinePassed,
  meritsLabel,
  uzzErrorMessage,
} from '@/lib/utils';

export default function DealsPage() {
  const { communityId, loggedIn } = useUzzCommunityId();
  const enabled = Boolean(communityId) && loggedIn;
  const utils = trpc.useUtils();
  const [onlyOpen, setOnlyOpen] = useState(true);

  const deals = trpc.deals.list.useQuery(
    { communityId, mineOnly: true },
    { enabled, retry: false, refetchInterval: enabled ? 15_000 : false },
  );

  const invalidate = () => {
    void utils.deals.list.invalidate();
    void utils.banks.listMine.invalidate();
    void utils.wallet.getBalance.invalidate();
    void utils.ledger.listMine.invalidate();
    setConfirm(null);
  };

  const [flash, setFlash] = useState<string | null>(null);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('requested')) {
      const fee = params.get('fee');
      const charged =
        fee === 'community' || fee === 'global' ? feeChargedCopy(fee) : null;
      setFlash(
        charged
          ? `Запрос отправлен. ${charged}. Исполнитель получит короткое сообщение в Telegram.`
          : 'Запрос отправлен. Исполнитель получит короткое сообщение в Telegram.',
      );
      window.history.replaceState(null, '', '/deals');
    }
  }, []);

  const accept = trpc.deals.accept.useMutation({
    onSuccess: () => {
      invalidate();
      setFlash('Заявка принята. Когда сделаете услугу — нажмите «Сделано».');
    },
  });
  const reject = trpc.deals.reject.useMutation({
    onSuccess: () => {
      invalidate();
      setFlash('Заявка отклонена. Комиссия заказчику возвращена.');
    },
  });
  const complete = trpc.deals.complete.useMutation({
    onSuccess: () => {
      invalidate();
      setFlash('Отметили «сделано». Ждём подтверждения заказчика.');
    },
  });
  const close = trpc.deals.close.useMutation({
    onSuccess: () => {
      invalidate();
      setFlash('Сделка закрыта. Можно сказать спасибо.');
    },
  });
  const cancel = trpc.deals.cancel.useMutation({
    onSuccess: () => {
      invalidate();
      setFlash('Заявка отменена. Комиссия вернулась, право снова у вас.');
    },
  });
  const thank = trpc.deals.thank.useMutation({
    onSuccess: () => {
      invalidate();
      setThanksDealId(null);
      setThanksComment('');
      setThanksMerits('');
      setThanksError(null);
      setFlash('Благодарность отправлена.');
    },
    onError: (err) => setThanksError(uzzErrorMessage(err)),
  });

  const [thanksDealId, setThanksDealId] = useState<string | null>(null);
  const [thanksComment, setThanksComment] = useState('');
  const [thanksMerits, setThanksMerits] = useState('');
  const [thanksError, setThanksError] = useState<string | null>(null);
  const [confirm, setConfirm] = useState<{ id: string; kind: 'reject' | 'cancel' | 'close' } | null>(
    null,
  );

  const pending =
    accept.isPending ||
    reject.isPending ||
    complete.isPending ||
    close.isPending ||
    cancel.isPending;

  const visible = useMemo(() => {
    const rows = deals.data ?? [];
    if (!onlyOpen) return rows;
    return rows.filter((deal) => {
      if (
        deal.status === 'requested' ||
        deal.status === 'accepted' ||
        deal.status === 'completed_by_seller'
      ) {
        return true;
      }
      if (deal.status !== 'closed') return false;
      const thanked =
        deal.myRole === 'buyer'
          ? Boolean(deal.buyerThankedAt)
          : deal.myRole === 'seller'
            ? Boolean(deal.sellerThankedAt)
            : true;
      return !thanked;
    });
  }, [deals.data, onlyOpen]);

  function onThanks(e: FormEvent) {
    e.preventDefault();
    if (!thanksDealId) return;
    setThanksError(null);
    thank.mutate({
      dealId: thanksDealId,
      comment: thanksComment.trim() || undefined,
      merits: Number(thanksMerits) || 0,
    });
  }

  const actionError =
    accept.error || reject.error || complete.error || close.error || cancel.error;

  return (
    <AppShell>
      <div className="space-y-6">
        <header className="space-y-2">
          <h1 className="text-2xl font-extrabold tracking-tight">Сделки</h1>
          <p className="text-sm text-stitch-muted">
            Сначала ответ исполнителя, потом «сделано», потом закрытие. Комиссия 1 заслуга
            списывается сначала с кошелька сообщества, иначе с общего, и возвращается при отказе.
            После закрытия можно сказать спасибо — это не обязательно.
          </p>
        </header>

        <label className="flex items-center gap-2 text-sm text-stitch-muted">
          <input
            type="checkbox"
            checked={onlyOpen}
            onChange={(e) => setOnlyOpen(e.target.checked)}
          />
          Только открытые и без «спасибо»
        </label>

        {flash ? <Notice tone="ok">{flash}</Notice> : null}
        {actionError ? <Notice tone="warn">{uzzErrorMessage(actionError)}</Notice> : null}

        {deals.isLoading ? (
          <div className="space-y-3" aria-busy>
            <Skeleton className="h-28 w-full" />
            <Skeleton className="h-28 w-full" />
          </div>
        ) : deals.isError ? (
          <QueryFailed onRetry={() => void deals.refetch()} />
        ) : !deals.data?.length ? (
          <EmptyState title="Сделок пока нет">
            <Link href="/catalog" className="text-stitch-accent underline">
              Найдите услугу в «Обмене»
            </Link>
          </EmptyState>
        ) : onlyOpen && !visible.length ? (
          <EmptyState title="Сейчас ничего не требует действия">
            <button
              type="button"
              className="text-stitch-accent underline"
              onClick={() => setOnlyOpen(false)}
            >
              Показать все сделки
            </button>
          </EmptyState>
        ) : (
          <ul className="space-y-3">
            {visible.map((deal) => {
              const alreadyThanked =
                deal.myRole === 'buyer'
                  ? Boolean(deal.buyerThankedAt)
                  : Boolean(deal.sellerThankedAt);
              const deadline = formatDeadline(deal.expiresAt);
              const expired = isDeadlinePassed(deal.expiresAt);
              const requestExpired = expired && deal.status === 'requested';
              const priceRub =
                deal.status === 'closed' && deal.dealAmountRub != null
                  ? deal.dealAmountRub
                  : (deal.lotPriceRub ?? deal.dealAmountRub);
              return (
                <li key={deal.id}>
                  <Card className={dealNeedsAction(deal) ? 'ring-1 ring-stitch-accent/70' : undefined}>
                    <div className="flex flex-wrap items-baseline justify-between gap-2">
                      <h2 className="font-extrabold">{deal.lotTitle}</h2>
                      <span className="rounded-full bg-stitch-canvas px-2 py-0.5 text-xs text-stitch-muted">
                        {deal.myRole === 'buyer'
                          ? 'Вы заказчик'
                          : deal.myRole === 'seller'
                            ? 'Вы исполнитель'
                            : ''}
                      </span>
                    </div>
                    <p className="mt-2 text-sm">{dealStatusLabel(deal.status, deal.myRole)}</p>
                    <p className="mt-1 text-sm text-stitch-muted">
                      {deal.counterpartyName ? `с ${deal.counterpartyName}` : ''}
                      {priceRub != null ? ` · ${priceRub} ₽` : ''}
                      {deal.status === 'closed' &&
                      deal.dealAmountRub != null &&
                      deal.lotPriceRub != null &&
                      deal.dealAmountRub !== deal.lotPriceRub
                        ? ` · перешло целиком, без сдачи (услуга ${deal.lotPriceRub} ₽)`
                        : deal.status === 'closed' && deal.dealAmountRub != null
                          ? ' · право перешло целиком, без сдачи'
                          : ''}
                      {deadline ? ` · ${deadline}` : ''}
                    </p>
                    {deal.myRole === 'buyer' && deal.feeSource ? (
                      <p className="mt-1 text-sm text-stitch-muted">
                        {deal.feeReserved
                          ? feeChargedCopy(deal.feeSource)
                          : `Комиссия ${meritsLabel(1)} возвращена на ${feeWalletPhrase(deal.feeSource)}`}
                      </p>
                    ) : null}
                    {expired && deal.status === 'requested' ? (
                      <p className="mt-2 text-sm text-amber-200">
                        {deal.myRole === 'seller'
                          ? 'Срок ответа вышел. Принять уже нельзя — заявка снимется в течение часа.'
                          : 'Срок истёк. Можете отменить заявку — иначе она снимется в течение часа.'}
                      </p>
                    ) : expired && deal.status === 'accepted' ? (
                      <p className="mt-2 text-sm text-amber-200">
                        {deal.myRole === 'seller'
                          ? 'Срок исполнения вышел. Отметьте «сделано», если услуга оказана — иначе заявка снимется в течение часа.'
                          : 'Срок исполнения вышел. Исполнитель ещё не отметил «сделано». Заявка снимется в течение часа.'}
                      </p>
                    ) : null}
                    <div className="mt-4 flex flex-wrap gap-2">
                      {deal.status === 'requested' && deal.myRole === 'seller' ? (
                        <>
                          <Button
                            type="button"
                            disabled={pending || requestExpired}
                            onClick={() => accept.mutate({ dealId: deal.id })}
                          >
                            Принять
                          </Button>
                          <Button
                            type="button"
                            variant="danger"
                            disabled={pending || requestExpired}
                            onClick={() =>
                              confirm?.id === deal.id && confirm.kind === 'reject'
                                ? reject.mutate({ dealId: deal.id })
                                : setConfirm({ id: deal.id, kind: 'reject' })
                            }
                          >
                            {confirm?.id === deal.id && confirm.kind === 'reject'
                              ? 'Точно отклонить?'
                              : 'Отклонить'}
                          </Button>
                        </>
                      ) : null}
                      {deal.status === 'requested' && deal.myRole === 'buyer' ? (
                        <Button
                          type="button"
                          variant="danger"
                          disabled={pending}
                          onClick={() =>
                            confirm?.id === deal.id && confirm.kind === 'cancel'
                              ? cancel.mutate({ dealId: deal.id })
                              : setConfirm({ id: deal.id, kind: 'cancel' })
                          }
                        >
                          {confirm?.id === deal.id && confirm.kind === 'cancel'
                            ? 'Точно отменить?'
                            : 'Отменить заявку'}
                        </Button>
                      ) : null}
                      {deal.status === 'accepted' && deal.myRole === 'seller' ? (
                        <Button
                          type="button"
                          disabled={pending || requestExpired}
                          onClick={() => complete.mutate({ dealId: deal.id })}
                        >
                          Сделано
                        </Button>
                      ) : null}
                      {deal.status === 'accepted' && deal.myRole === 'buyer' ? (
                        <p className="text-sm text-stitch-muted">
                          Когда услуга будет оказана, исполнитель нажмёт «Сделано».
                        </p>
                      ) : null}
                      {deal.status === 'completed_by_seller' && deal.myRole === 'buyer' ? (
                        confirm?.id === deal.id && confirm.kind === 'close' ? (
                          <div className="space-y-2">
                            <p className="text-sm text-stitch-muted">
                              Право на обмен целиком перейдёт исполнителю (сегодняшний потолок, без
                              сдачи). Комиссия 1 заслуга останется у площадки.
                            </p>
                            <div className="flex flex-wrap gap-2">
                              <Button
                                type="button"
                                disabled={pending || requestExpired}
                                onClick={() => close.mutate({ dealId: deal.id })}
                              >
                                Да, закрыть
                              </Button>
                              <Button
                                type="button"
                                variant="ghost"
                                onClick={() => setConfirm(null)}
                              >
                                Ещё нет
                              </Button>
                            </div>
                          </div>
                        ) : (
                          <Button
                            type="button"
                            disabled={pending || requestExpired}
                            onClick={() => setConfirm({ id: deal.id, kind: 'close' })}
                          >
                            Подтвердить закрытие
                          </Button>
                        )
                      ) : null}
                      {deal.status === 'completed_by_seller' && deal.myRole === 'seller' ? (
                        <p className="text-sm text-stitch-muted">Заказчик ещё не подтвердил.</p>
                      ) : null}
                      {deal.status === 'closed' && !alreadyThanked ? (
                        <Button
                          type="button"
                          variant="ghost"
                          onClick={() => setThanksDealId(deal.id)}
                        >
                          Сказать спасибо
                        </Button>
                      ) : null}
                    </div>
                    {thanksDealId === deal.id ? (
                      <form
                        onSubmit={onThanks}
                        className="mt-4 space-y-2 border-t border-stitch-border pt-4"
                      >
                        <textarea
                          value={thanksComment}
                          onChange={(e) => setThanksComment(e.target.value)}
                          rows={2}
                          placeholder="Коротко, за что благодарите"
                          className={inputClass}
                        />
                        <input
                          type="number"
                          min={0}
                          value={thanksMerits}
                          onChange={(e) => setThanksMerits(e.target.value)}
                          className={inputClass}
                          placeholder="Заслуг (необязательно)"
                        />
                        <p className="text-xs text-stitch-muted">
                          Заслуги спишутся с кошелька, не из права на обмен. Нужен короткий текст
                          или хотя бы 1 заслуга.
                        </p>
                        {thanksError ? <p className="text-sm text-red-400">{thanksError}</p> : null}
                        <div className="flex gap-2">
                          <Button type="submit" disabled={thank.isPending}>
                            Отправить
                          </Button>
                          <Button type="button" variant="ghost" onClick={() => setThanksDealId(null)}>
                            Отмена
                          </Button>
                        </div>
                      </form>
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
