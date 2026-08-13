import { Deal, DealSnapshot } from '../../../domain/uzz/entities/deal';
import {
  ExchangeRight,
  ExchangeRightSnapshot,
} from '../../../domain/uzz/entities/exchange-right';
import {
  Listing,
  ListingSnapshot,
} from '../../../domain/uzz/entities/listing';

export function exchangeRightToPersistence(
  right: ExchangeRight,
): ExchangeRightSnapshot {
  return right.snapshot();
}

export function exchangeRightFromPersistence(raw: unknown): ExchangeRight {
  return ExchangeRight.restore(toPlainObject(raw) as unknown as ExchangeRightSnapshot);
}

export function listingToPersistence(listing: Listing): ListingSnapshot {
  return listing.snapshot();
}

export function listingFromPersistence(raw: unknown): Listing {
  return Listing.restore(toPlainObject(raw) as unknown as ListingSnapshot);
}

export function dealToPersistence(deal: Deal): DealSnapshot {
  const snapshot = deal.snapshot();
  return {
    ...snapshot,
    lotId: snapshot.listingId,
    bankId: snapshot.exchangeRightId,
  } as DealSnapshot;
}

export function dealFromPersistence(raw: unknown): Deal {
  return Deal.restore(toPlainObject(raw) as unknown as DealSnapshot);
}

function toPlainObject(raw: unknown): Record<string, unknown> {
  if (!raw || typeof raw !== 'object') {
    throw new TypeError('UZZ persistence document must be an object');
  }

  const candidate = raw as { toObject?: () => Record<string, unknown> };
  return candidate.toObject ? candidate.toObject() : (raw as Record<string, unknown>);
}
