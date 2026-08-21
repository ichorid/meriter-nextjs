import { Badge, Button, Card, userContentClass } from '@/components/ui';
import { cn } from '@/lib/utils';

export interface ListingView {
  id: string; authorId: string; ownerName?: string; title: string; description: string;
  priceRub: number; deliveryMode: 'online' | 'offline' | 'both'; locationText: string;
  durationText: string; availabilityText: string; active: boolean;
}

const delivery: Record<ListingView['deliveryMode'], string> = { online: 'Онлайн', offline: 'Очно', both: 'Онлайн или очно' };

export function ListingCard({ listing, own, affordable, requestLabel, requestDisabled, onRequest }: { listing: ListingView; own?: boolean; affordable?: boolean; requestLabel?: string; requestDisabled?: boolean; onRequest?: () => void }) {
  return <Card className="flex h-full min-w-0 max-w-full flex-col">
    <div className="flex min-w-0 flex-wrap items-start justify-between gap-3">
      <div className="min-w-0 space-y-1"><h2 className={cn('line-clamp-2 text-lg font-extrabold leading-snug', userContentClass)}>{listing.title}</h2><p className={cn('text-sm text-stitch-muted', userContentClass)}>{listing.ownerName || 'Участник сообщества'}</p></div>
      <strong className="whitespace-nowrap text-lg text-stitch-accent-text">{listing.priceRub.toLocaleString('ru-RU')} ₽</strong>
    </div>
    {listing.description ? <p className={cn('mt-4 line-clamp-4 whitespace-pre-wrap text-sm leading-6 text-stitch-text/90', userContentClass)}>{listing.description}</p> : null}
    <div className="mt-4 flex flex-wrap gap-2">
      <Badge tone="accent">{delivery[listing.deliveryMode]}</Badge>
      {listing.durationText ? <Badge>{listing.durationText}</Badge> : null}
      {listing.locationText ? <Badge>{listing.locationText}</Badge> : null}
    </div>
    {listing.availabilityText ? <p className={cn('mt-3 line-clamp-2 text-xs leading-5 text-stitch-muted', userContentClass)}>Когда: {listing.availabilityText}</p> : null}
    <div className="mt-auto pt-5">
      {own ? <Badge>Ваше предложение</Badge> : onRequest ? <Button className="w-full" disabled={requestDisabled ?? !affordable} onClick={onRequest}>{requestLabel ?? (affordable ? 'Оставить заявку' : 'Нужен больший номинал')}</Button> : null}
    </div>
  </Card>;
}
