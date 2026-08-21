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
  const record = {
    ...snapshot,
    listingSnapshot: {
      ...snapshot.listingSnapshot,
      locationText: snapshot.listingSnapshot.locationText ?? '',
    },
    lotId: snapshot.listingId,
    bankId: snapshot.exchangeRightId,
  } as DealSnapshot & { lotId: string; bankId: string };
  if (record.buyerContact == null) {
    delete (record as { buyerContact?: unknown }).buyerContact;
  }
  if (record.sellerContact == null) {
    delete (record as { sellerContact?: unknown }).sellerContact;
  }
  return record;
}

export function dealFromPersistence(raw: unknown): Deal {
  const record = toPlainObject(raw) as unknown as DealSnapshot;
  return Deal.restore({
    ...record,
    // Deals accepted before contacts carried telegramUserId keep only a username.
    buyerContact: restoreContact(record.buyerContact),
    sellerContact: restoreContact(record.sellerContact),
  });
}

function restoreContact(
  contact: DealSnapshot['buyerContact'],
): DealSnapshot['buyerContact'] {
  if (!contact) return null;
  return {
    telegramUserId: contact.telegramUserId ?? '',
    telegramUsername: contact.telegramUsername ?? null,
  };
}

function toPlainObject(raw: unknown): Record<string, unknown> {
  if (!raw || typeof raw !== 'object') {
    throw new TypeError('UZZ persistence document must be an object');
  }

  const candidate = raw as { toObject?: () => Record<string, unknown> };
  return candidate.toObject ? candidate.toObject() : (raw as Record<string, unknown>);
}
