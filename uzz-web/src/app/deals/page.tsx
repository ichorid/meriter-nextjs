'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';
import { AppShell } from '@/components/app-shell';
import { DealAcceptForm } from '@/components/deal-accept-form';
import { DealCard, type DealView } from '@/components/deal-card';
import { ThanksForm } from '@/components/thanks-form';
import { Button, EmptyState, Notice, PageHeader, QueryFailed, Skeleton } from '@/components/ui';
import { mapDeadlineError } from '@/lib/local-datetime';
import { trpc } from '@/lib/trpc/client';
import { useUzzCommunityId } from '@/lib/use-uzz-community';
import { uzzErrorMessage } from '@/lib/utils';

type Panel = { dealId: string; kind: 'accept' | 'reject' | 'cancel' | 'close' | 'thanks' } | null;
type ActionError = { dealId: string; action: string; message: string } | null;

export default function DealsPage() {
  const { communityId, loggedIn } = useUzzCommunityId();
  const utils = trpc.useUtils();
  const [openOnly, setOpenOnly] = useState(true);
  const [panel, setPanel] = useState<Panel>(null);
  const [flash, setFlash] = useState<string | null>(null);
  const [actionError, setActionError] = useState<ActionError>(null);
  const deals = trpc.deals.list.useQuery({ communityId, mineOnly: true }, { enabled: Boolean(communityId) && loggedIn, retry: false, refetchInterval: 15_000 });
  const settings = trpc.settings.get.useQuery({ communityId }, { enabled: Boolean(communityId) && loggedIn, retry: false });
  const refresh = () => { setPanel(null); setActionError(null); void Promise.all([utils.deals.list.invalidate(), utils.banks.listMine.invalidate(), utils.wallet.getBalance.invalidate()]); };

  function mapActionMessage(err: { message?: string }): string {
    return mapDeadlineError(err.message) ?? uzzErrorMessage(err);
  }

  function clearActionError(dealId: string, action: string) {
    setActionError((current) => (current?.dealId === dealId && current.action === action ? null : current));
  }

  const mutationOptions = (action: string, message: string) => ({
    onSuccess: () => { setFlash(message); refresh(); },
    onError: (err: { message?: string }, variables: { dealId: string }) => {
      setActionError({ dealId: variables.dealId, action, message: mapActionMessage(err) });
      void deals.refetch();
    },
  });
  const accept = trpc.deals.accept.useMutation(mutationOptions('accept', 'Заявка принята. Контакты открыты обеим сторонам.'));
  const reject = trpc.deals.reject.useMutation(mutationOptions('reject', 'Заявка отклонена. Комиссия и право возвращены заказчику.'));
  const cancel = trpc.deals.cancel.useMutation(mutationOptions('cancel', 'Заявка отменена. Комиссия и право возвращены.'));
  const complete = trpc.deals.complete.useMutation(mutationOptions('complete', 'Отмечено как выполненное. Если заказчик не ответит, сделка закроется автоматически.'));
  const close = trpc.deals.close.useMutation(mutationOptions('close', 'Сделка закрыта, право целиком перешло исполнителю.'));
  const thank = trpc.deals.thank.useMutation(mutationOptions('thanks', 'Благодарность отправлена.'));
  const pending = accept.isPending || reject.isPending || cancel.isPending || complete.isPending || close.isPending || thank.isPending;
  const visible = useMemo(() => (deals.data ?? []).filter((deal) => !openOnly || ['requested', 'accepted', 'completed_by_seller'].includes(deal.status)), [deals.data, openOnly]);
  const searchParams = new URLSearchParams(typeof window === 'undefined' ? '' : window.location.search);
  const requestedFeeSource = searchParams.get('feeSource');

  function act(kind: NonNullable<Panel>['kind'], deal: DealView) {
    setFlash(null);
    if (panel?.dealId !== deal.id || panel.kind !== kind) { setPanel({ dealId: deal.id, kind }); return; }
    clearActionError(deal.id, kind);
    const input = { commandId: crypto.randomUUID(), dealId: deal.id };
    if (kind === 'reject') reject.mutate(input); if (kind === 'cancel') cancel.mutate(input); if (kind === 'close') close.mutate(input);
  }

  const panelError = (dealId: string) => actionError?.dealId === dealId ? actionError.message : undefined;

  return <AppShell><div className="space-y-8">
    <PageHeader eyebrow="Ваши договорённости" title="Сделки">Следуйте одному следующему действию. Сроки каждого этапа зафиксированы в сделке и не меняются задним числом при обновлении настроек.</PageHeader>
    {searchParams.has('requested') ? <Notice tone="ok">Заявка отправлена. Зарезервирована 1 заслуга {requestedFeeSource === 'local' ? 'с кошелька сообщества' : requestedFeeSource === 'global' ? 'с общего кошелька' : 'с доступного кошелька'}.</Notice> : null}
    {flash ? <Notice tone="ok">{flash}</Notice> : null}
    {actionError ? <div role="alert" aria-live="assertive" className="flex flex-col gap-3 rounded-xl border border-amber-400/40 bg-amber-400/10 p-4 text-sm leading-6 text-amber-100 sm:flex-row sm:items-start sm:justify-between">
      <p>{actionError.message}</p>
      <Button type="button" variant="ghost" onClick={() => setActionError(null)}>Скрыть</Button>
    </div> : null}
    <label className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-stitch-border px-4 text-sm text-stitch-muted"><input type="checkbox" checked={openOnly} onChange={(event) => setOpenOnly(event.target.checked)} />Только активные</label>
    {deals.isLoading ? <div className="space-y-4" aria-busy><Skeleton className="h-72" /><Skeleton className="h-72" /></div> : deals.isError ? <QueryFailed onRetry={() => void deals.refetch()} /> : !deals.data?.length ? <EmptyState title="Сделок пока нет"><Link className="text-stitch-accent-text underline" href="/catalog">Выбрать услугу в каталоге</Link></EmptyState> : !visible.length ? <EmptyState title="Активных сделок нет"><button className="text-stitch-accent-text underline" onClick={() => setOpenOnly(false)}>Показать историю</button></EmptyState> : <ul aria-label="Сделки" className="space-y-4">{visible.map((deal) => <li key={deal.id}><DealCard deal={deal}>
      {deal.status === 'requested' && deal.myRole === 'seller' ? panel?.dealId === deal.id && panel.kind === 'accept' ? <DealAcceptForm listingPriceRub={deal.listingSnapshot.priceRub} currentNominalRub={deal.currentNominalRub} demurrageRubPerDay={settings.data?.demurrageRubPerDay} requestMessage={deal.requestMessage} requestedDeadlineAt={deal.requestedDeadlineAt} agreedDeadlineAt={deal.agreedDeadlineAt} pending={accept.isPending} error={panelError(deal.id)} onCancel={() => setPanel(null)} onAccept={(deadline) => { clearActionError(deal.id, 'accept'); accept.mutate({ commandId: crypto.randomUUID(), dealId: deal.id, expectedNominalRub: deal.currentNominalRub!, agreedDeadlineAt: deadline }); }} /> : <div className="flex flex-wrap gap-2"><Button onClick={() => act('accept', deal)}>Рассмотреть и принять</Button><Button variant="danger" disabled={pending} onClick={() => act('reject', deal)}>{panel?.dealId === deal.id && panel.kind === 'reject' ? 'Подтвердить отклонение' : 'Отклонить'}</Button></div> : null}
      {deal.status === 'requested' && deal.myRole === 'buyer' ? <div className="space-y-3"><p className="text-sm text-stitch-muted">До принятия контакт скрыт. Заявку можно отменить без потери комиссии.</p><Button variant="danger" disabled={pending} onClick={() => act('cancel', deal)}>{panel?.dealId === deal.id && panel.kind === 'cancel' ? 'Подтвердить отмену' : 'Отменить заявку'}</Button></div> : null}
      {deal.status === 'accepted' && deal.myRole === 'seller' ? <Button disabled={pending} onClick={() => { clearActionError(deal.id, 'complete'); complete.mutate({ commandId: crypto.randomUUID(), dealId: deal.id }); }}>Услуга выполнена</Button> : null}
      {deal.status === 'accepted' && deal.myRole === 'buyer' ? <p className="text-sm leading-6 text-stitch-muted">Свяжитесь с исполнителем. Когда услуга будет готова, он отметит выполнение, а вы сможете подтвердить закрытие.</p> : null}
      {deal.status === 'completed_by_seller' && deal.myRole === 'buyer' ? <div className="space-y-3"><Notice>Подтвердите, если всё выполнено. Без ответа сделка закроется автоматически по окончании срока подтверждения.</Notice><Button disabled={pending} onClick={() => act('close', deal)}>{panel?.dealId === deal.id && panel.kind === 'close' ? 'Подтвердить закрытие и передачу права' : 'Всё выполнено'}</Button></div> : null}
      {deal.status === 'completed_by_seller' && deal.myRole === 'seller' ? <p className="text-sm text-stitch-muted">Ждём подтверждения заказчика. После истечения срока сделка закроется автоматически.</p> : null}
      {deal.status === 'closed' && !(deal.myRole === 'buyer' ? deal.buyerThankedAt : deal.sellerThankedAt) ? panel?.dealId === deal.id && panel.kind === 'thanks' ? <ThanksForm pending={thank.isPending} error={panelError(deal.id)} onCancel={() => setPanel(null)} onSubmit={({ comment, merits }) => { clearActionError(deal.id, 'thanks'); thank.mutate({ commandId: crypto.randomUUID(), dealId: deal.id, comment, merits }); }} /> : <div className="flex flex-wrap items-center gap-3"><Button variant="ghost" onClick={() => { setPanel({ dealId: deal.id, kind: 'thanks' }); }}>Сказать спасибо</Button><span className="text-xs text-stitch-muted">Необязательно</span></div> : null}
    </DealCard></li>)}</ul>}
  </div></AppShell>;
}
