import { UzzUserLabel } from './ports/uzz-platform.port';
import { UzzLedgerEntry } from './ports/uzz-repositories';

/**
 * Read-side context for a ledger row: who the counterparty was and what the
 * operation was about. Built from metadata already stored on the entries, so
 * old rows degrade gracefully to an empty context.
 */
export interface UzzLedgerContext {
  dealId?: string;
  counterpartyId?: string;
  counterpartyName?: string;
  /** Telegram login of the counterparty without the leading @, when known. */
  counterpartyUsername?: string;
  listingTitle?: string;
  publicationId?: string;
  publicationTitle?: string;
}

export interface LedgerDealInfo {
  id: string;
  buyerId: string;
  sellerId: string;
  listingTitle: string;
}

function metaString(
  metadata: Record<string, unknown> | undefined,
  key: string,
): string | undefined {
  const value = metadata?.[key];
  return typeof value === 'string' && value.length > 0 ? value : undefined;
}

export function collectLedgerRefs(items: UzzLedgerEntry[]): {
  dealIds: string[];
  publicationIds: string[];
} {
  const dealIds = new Set<string>();
  const publicationIds = new Set<string>();
  for (const item of items) {
    const dealId = metaString(item.metadata, 'dealId');
    if (dealId) dealIds.add(dealId);
    const publicationId = metaString(item.metadata, 'publicationId');
    if (publicationId) publicationIds.add(publicationId);
  }
  return { dealIds: [...dealIds], publicationIds: [...publicationIds] };
}

export function resolveLedgerCounterpartyId(
  item: UzzLedgerEntry,
  deal: LedgerDealInfo | undefined,
): string | undefined {
  const direct =
    metaString(item.metadata, 'counterpartyId') ??
    metaString(item.metadata, 'recipientId') ??
    metaString(item.metadata, 'senderId');
  if (direct) return direct;
  if (!deal) return undefined;
  if (item.userId === deal.buyerId) return deal.sellerId;
  if (item.userId === deal.sellerId) return deal.buyerId;
  return undefined;
}

export function buildLedgerContext(
  item: UzzLedgerEntry,
  deals: Map<string, LedgerDealInfo>,
  counterpartyLabels: Map<string, UzzUserLabel>,
  publicationTitles: Map<string, string>,
): UzzLedgerContext | undefined {
  const dealId = metaString(item.metadata, 'dealId');
  const deal = dealId ? deals.get(dealId) : undefined;
  const counterpartyId = resolveLedgerCounterpartyId(item, deal);
  const label = counterpartyId ? counterpartyLabels.get(counterpartyId) : undefined;
  const publicationId = metaString(item.metadata, 'publicationId');
  const context: UzzLedgerContext = {
    dealId,
    counterpartyId,
    counterpartyName: label?.name.trim() || undefined,
    counterpartyUsername: label?.username ?? undefined,
    listingTitle: deal?.listingTitle || undefined,
    publicationId,
    publicationTitle: publicationId
      ? publicationTitles.get(publicationId) || undefined
      : undefined,
  };
  return Object.values(context).some((value) => value !== undefined)
    ? context
    : undefined;
}
