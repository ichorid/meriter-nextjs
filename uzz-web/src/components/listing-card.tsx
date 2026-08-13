import { Badge, Button, Card } from '@/components/ui';

export interface ListingView {
  id: string; authorId: string; ownerName?: string; title: string; description: string;
  priceRub: number; deliveryMode: 'online' | 'offline' | 'both'; locationText: string;
  durationText: string; availabilityText: string; active: boolean;
}

const delivery: Record<ListingView['deliveryMode'], string> = { online: 'Онлайн', offline: 'Очно', both: 'Онлайн или очно' };

export function ListingCard({ listing, own, affordable, onRequest }: { listing: ListingView; own?: boolean; affordable?: boolean; onRequest?: () => void }) {
  return <Card className="flex h-full flex-col">
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div className="space-y-1"><h2 className="text-lg font-extrabold leading-snug">{listing.title}</h2><p className="text-sm text-stitch-muted">{listing.ownerName || 'Участник сообщества'}</p></div>
      <strong className="whitespace-nowrap text-lg text-stitch-accent">{listing.priceRub.toLocaleString('ru-RU')} ₽</strong>
    </div>
    {listing.description ? <p className="mt-4 whitespace-pre-wrap text-sm leading-6 text-stitch-text/90">{listing.description}</p> : null}
    <div className="mt-4 flex flex-wrap gap-2">
      <Badge tone="accent">{delivery[listing.deliveryMode]}</Badge>
      {listing.durationText ? <Badge>{listing.durationText}</Badge> : null}
      {listing.locationText ? <Badge>{listing.locationText}</Badge> : null}
    </div>
    {listing.availabilityText ? <p className="mt-3 text-xs leading-5 text-stitch-muted">Когда: {listing.availabilityText}</p> : null}
    <div className="mt-auto pt-5">
      {own ? <Badge>Ваше предложение</Badge> : onRequest ? <Button className="w-full" disabled={!affordable} onClick={onRequest}>{affordable ? 'Оставить заявку' : 'Нужен больший номинал'}</Button> : null}
    </div>
  </Card>;
}
