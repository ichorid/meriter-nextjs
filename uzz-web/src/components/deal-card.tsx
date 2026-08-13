'use client';
import { ReactNode } from 'react';
import { Badge, Card } from '@/components/ui';
import { DealTimeline } from '@/components/deal-timeline';
import { dealNeedsAction, dealStatusLabel, formatDeadline } from '@/lib/utils';

export interface DealView {
  id: string; status: string; myRole: 'buyer' | 'seller' | 'other'; counterpartyName?: string;
  listingSnapshot: { title: string; priceRub: number; deliveryMode: string; locationText: string };
  requestMessage: string; requestedDeadlineAt?: Date | string | null; agreedDeadlineAt?: Date | string | null;
  currentNominalRub?: number | null; acceptedNominalRub?: number | null; dealAmountRub?: number | null;
  expiresAt?: Date | string | null; requestedAt?: Date | string; acceptedAt?: Date | string | null;
  completedBySellerAt?: Date | string | null; closedAt?: Date | string | null;
  buyerContact?: { telegramUsername: string } | null; sellerContact?: { telegramUsername: string } | null;
  buyerThankedAt?: Date | string | null; sellerThankedAt?: Date | string | null;
}

export function DealCard({ deal, children }: { deal: DealView; children?: ReactNode }) {
  const contact = deal.myRole === 'buyer' ? deal.sellerContact : deal.buyerContact; const deadline = formatDeadline(deal.expiresAt);
  return <Card className={dealNeedsAction(deal) ? 'ring-2 ring-stitch-accent/50' : undefined}>
    <div className="flex flex-wrap items-start justify-between gap-3"><div><h2 className="text-lg font-black">{deal.listingSnapshot.title}</h2><p className="mt-1 text-sm text-stitch-muted">{deal.myRole === 'buyer' ? 'Вы заказчик' : 'Вы исполнитель'} · {deal.counterpartyName || 'участник сообщества'}</p></div><Badge tone={dealNeedsAction(deal) ? 'accent' : deal.status === 'closed' ? 'ok' : 'neutral'}>{dealStatusLabel(deal.status, deal.myRole)}</Badge></div>
    <div className="mt-5"><DealTimeline status={deal.status} dates={[deal.requestedAt, deal.acceptedAt, deal.completedBySellerAt, deal.closedAt]} /></div>
    <dl className="mt-5 grid gap-3 rounded-xl bg-stitch-canvas/50 p-4 text-sm sm:grid-cols-2"><div><dt className="text-xs text-stitch-muted">Цена услуги</dt><dd className="font-semibold">{deal.listingSnapshot.priceRub.toLocaleString('ru-RU')} ₽</dd></div><div><dt className="text-xs text-stitch-muted">Номинал сделки</dt><dd className="font-semibold">{(deal.acceptedNominalRub ?? deal.currentNominalRub)?.toLocaleString('ru-RU') ?? 'будет зафиксирован при принятии'}{(deal.acceptedNominalRub ?? deal.currentNominalRub) != null ? ' ₽' : ''}</dd></div><div className="sm:col-span-2"><dt className="text-xs text-stitch-muted">Сообщение</dt><dd className="whitespace-pre-wrap leading-6">{deal.requestMessage}</dd></div>{deadline ? <div><dt className="text-xs text-stitch-muted">Текущий этап</dt><dd>{deadline}</dd></div> : null}{deal.agreedDeadlineAt ? <div><dt className="text-xs text-stitch-muted">Согласованный срок</dt><dd>{new Date(deal.agreedDeadlineAt).toLocaleString('ru-RU')}</dd></div> : null}</dl>
    {contact?.telegramUsername && ['accepted', 'completed_by_seller', 'closed'].includes(deal.status) ? <a className="mt-4 inline-flex min-h-11 items-center rounded-xl border border-stitch-accent px-4 py-2 text-sm font-semibold text-stitch-accent" href={`https://t.me/${contact.telegramUsername.replace(/^@/, '')}`} target="_blank" rel="noreferrer">Написать @{contact.telegramUsername.replace(/^@/, '')}</a> : null}
    {children ? <div className="mt-5 border-t border-stitch-border pt-5">{children}</div> : null}
  </Card>;
}
