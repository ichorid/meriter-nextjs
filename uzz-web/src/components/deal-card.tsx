'use client';
import { ReactNode } from 'react';
import { Badge, Card, userContentClass } from '@/components/ui';
import { DealTimeline } from '@/components/deal-timeline';
import { cn, dealNeedsAction, dealStatusLabel, formatDeadline } from '@/lib/utils';

export interface DealContact { telegramUserId?: string | null; telegramUsername?: string | null }

const CONTACT_VISIBLE_STATUSES = ['accepted', 'completed_by_seller', 'closed'];

export interface DealView {
  id: string; status: string; myRole: 'buyer' | 'seller' | 'other'; counterpartyName?: string; communityId?: string;
  listingSnapshot: { title: string; priceRub: number; deliveryMode: string; locationText: string };
  requestMessage: string; requestedDeadlineAt?: Date | string | null; agreedDeadlineAt?: Date | string | null;
  currentNominalRub?: number | null; acceptedNominalRub?: number | null; dealAmountRub?: number | null;
  expiresAt?: Date | string | null; requestedAt?: Date | string; acceptedAt?: Date | string | null;
  completedBySellerAt?: Date | string | null; closedAt?: Date | string | null;
  buyerContact?: DealContact | null; sellerContact?: DealContact | null;
  buyerThankedAt?: Date | string | null; sellerThankedAt?: Date | string | null;
  feeReserved?: boolean; feeSourceCommunityId?: string | null;
}

export function DealCard({ deal, children }: { deal: DealView; children?: ReactNode }) {
  const contact = deal.myRole === 'buyer' ? deal.sellerContact : deal.buyerContact; const deadline = formatDeadline(deal.expiresAt);
  const displayedNominal = deal.status === 'closed' && deal.dealAmountRub != null ? deal.dealAmountRub : deal.acceptedNominalRub ?? deal.currentNominalRub;
  const feeSource = deal.feeSourceCommunityId ? (deal.feeSourceCommunityId === deal.communityId ? 'кошелька сообщества' : 'общего кошелька') : null;
  const feeText = deal.myRole === 'buyer' && feeSource
    ? ['rejected', 'cancelled', 'expired'].includes(deal.status)
      ? `Возвращена 1 заслуга на ${feeSource}`
      : deal.status === 'closed'
        ? `Списана 1 заслуга с ${feeSource}`
        : `Зарезервирована 1 заслуга с ${feeSource}`
    : null;
  return <Card className={dealNeedsAction(deal) ? 'ring-2 ring-stitch-accent/50' : undefined}>
    <div className="flex min-w-0 flex-wrap items-start justify-between gap-3"><div className="min-w-0"><h2 className={cn('text-lg font-black', userContentClass)}>{deal.listingSnapshot.title}</h2><p className={cn('mt-1 text-sm text-stitch-muted', userContentClass)}>{deal.myRole === 'buyer' ? 'Вы заказчик' : 'Вы исполнитель'} · {deal.counterpartyName || 'участник сообщества'}</p></div><Badge tone={dealNeedsAction(deal) ? 'accent' : deal.status === 'closed' ? 'ok' : 'neutral'}>{dealStatusLabel(deal.status, deal.myRole)}</Badge></div>
    <div className="mt-5"><DealTimeline status={deal.status} dates={[deal.requestedAt, deal.acceptedAt, deal.completedBySellerAt, deal.closedAt]} /></div>
    <dl className="mt-5 grid min-w-0 gap-3 rounded-xl bg-stitch-canvas/50 p-4 text-sm sm:grid-cols-2"><div><dt className="text-xs text-stitch-muted">Цена услуги</dt><dd className="font-semibold">{deal.listingSnapshot.priceRub.toLocaleString('ru-RU')} ₽</dd></div><div><dt className="text-xs text-stitch-muted">Номинал сделки</dt><dd className="font-semibold">{displayedNominal?.toLocaleString('ru-RU') ?? 'будет зафиксирован при принятии'}{displayedNominal != null ? ' ₽' : ''}</dd>{deal.status === 'closed' ? <p className="mt-1 text-xs text-stitch-muted">Банк передан целиком, без сдачи.</p> : null}</div><div className="min-w-0 sm:col-span-2"><dt className="text-xs text-stitch-muted">Сообщение</dt><dd className={cn('whitespace-pre-wrap leading-6', userContentClass)}>{deal.requestMessage}</dd></div>{feeText ? <div className="sm:col-span-2"><dt className="text-xs text-stitch-muted">Комиссия</dt><dd>{feeText}</dd></div> : null}{deadline ? <div><dt className="text-xs text-stitch-muted">Текущий этап</dt><dd>{deadline}</dd></div> : null}{deal.agreedDeadlineAt ? <div><dt className="text-xs text-stitch-muted">Согласованный срок</dt><dd>{new Date(deal.agreedDeadlineAt).toLocaleString('ru-RU')}</dd></div> : null}</dl>
    {contact && CONTACT_VISIBLE_STATUSES.includes(deal.status) ? <ContactLink contact={contact} /> : null}
    {children ? <div className="mt-5 border-t border-stitch-border pt-5">{children}</div> : null}
  </Card>;
}

const contactLinkClass = 'inline-flex min-h-11 items-center rounded-xl border border-stitch-accent px-4 py-2 text-sm font-semibold text-stitch-accent-text';

function ContactLink({ contact }: { contact: DealContact }) {
  const username = contact.telegramUsername?.replace(/^@/, '');
  if (username) {
    return <a className={cn('mt-4', contactLinkClass)} href={`https://t.me/${username}`} target="_blank" rel="noreferrer">Написать @{username}</a>;
  }
  if (!contact.telegramUserId) return null;
  return <div className="mt-4 space-y-1">
    <a className={contactLinkClass} href={`tg://user?id=${contact.telegramUserId}`}>Открыть чат в Telegram</a>
    <p className="text-xs text-stitch-muted">Ссылка открывается в приложении Telegram: у собеседника не задан публичный @username.</p>
  </div>;
}
