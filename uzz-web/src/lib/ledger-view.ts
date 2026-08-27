import { ledgerReasonLabel, ledgerTypeLabel, meritsWord, userLabelText } from '@/lib/utils';

export type LedgerRowContext = {
  dealId?: string;
  counterpartyId?: string;
  counterpartyName?: string;
  counterpartyUsername?: string;
  listingTitle?: string;
  publicationId?: string;
  publicationTitle?: string;
};

export type LedgerRowInput = {
  type: string;
  amount: number;
  metadata?: Record<string, unknown>;
  context?: LedgerRowContext;
};

export type LedgerRowView = {
  title: string;
  subtitle?: string;
  comment?: string;
  amountText?: string;
  unitText?: string;
  dealId?: string;
  statusMarker: boolean;
};

const STATUS_MARKER_TYPES = new Set([
  'deal_requested',
  'deal_accepted',
  'deal_completed',
  'deal_completed_by_seller',
  'deal_closed',
  'deal_cancelled',
  'deal_rejected',
  'admin_resolution',
]);

const MERIT_UNIT_TYPES = new Set([
  'fee_reserved',
  'deal_fee_reserved',
  'fee_refunded',
  'deal_fee_refunded',
  'thanks_sent',
  'thanks_received',
  'deal_thanks',
]);

const NOMINAL_UNIT_TYPES = new Set([
  'nominal_assigned',
  'right_nominal_assigned',
  'bank_nominal_set',
  'demurrage',
  'right_demurrage_applied',
  'right_sent',
  'right_received',
  'right_transferred',
  'bank_transferred',
]);

const TYPE_ALIASES: Record<string, string> = {
  deal_fee_reserved: 'fee_reserved',
  deal_fee_refunded: 'fee_refunded',
  right_demurrage_applied: 'demurrage',
  bank_emitted: 'right_emitted',
  right_nominal_assigned: 'nominal_assigned',
  bank_nominal_set: 'nominal_assigned',
  deal_completed_by_seller: 'deal_completed',
};

function canonicalType(type: string): string {
  return TYPE_ALIASES[type] ?? type;
}

function text(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined;
  const trimmed = value.trim();
  return trimmed || undefined;
}

function joinDash(parts: Array<string | undefined>): string | undefined {
  const present = parts.filter((part): part is string => Boolean(part));
  return present.length ? present.join(' — ') : undefined;
}

function metaNumber(metadata: Record<string, unknown> | undefined, key: string): number | undefined {
  const value = metadata?.[key];
  return typeof value === 'number' && Number.isFinite(value) ? value : undefined;
}

export function isLedgerStatusMarker(type: string): boolean {
  return STATUS_MARKER_TYPES.has(canonicalType(type));
}

export function visibleLedgerRows<T extends { type: string }>(items: T[], showAllEvents: boolean): T[] {
  if (showAllEvents) return items;
  return items.filter((row) => !isLedgerStatusMarker(row.type));
}

function subtitleFor(row: LedgerRowInput, kind: string): string | undefined {
  const rawName = text(row.context?.counterpartyName);
  const username = text(row.context?.counterpartyUsername);
  // «Имя (@логин)» — the login doubles as an anti-phishing anchor.
  const name = rawName || username ? userLabelText(rawName, username) : undefined;
  const listing = text(row.context?.listingTitle);
  const publication = text(row.context?.publicationTitle);

  switch (kind) {
    case 'thanks_received':
      return joinDash([name ? `От ${name}` : undefined, listing ? `за услугу «${listing}»` : undefined]);
    case 'thanks_sent':
      return joinDash([name ? `Для ${name}` : undefined, listing ? `за услугу «${listing}»` : undefined]);
    case 'right_received':
      return joinDash([name ? `Банк от ${name}` : undefined, listing ? `услуга «${listing}»` : undefined]);
    case 'right_sent':
      return joinDash([name ? `Банк передан ${name}` : undefined, listing ? `услуга «${listing}»` : undefined]);
    case 'fee_reserved':
      return listing ? `Заявка на услугу «${listing}»` : undefined;
    case 'fee_refunded': {
      const reasonRaw = text(row.metadata?.reason);
      const reason = reasonRaw ? ledgerReasonLabel(reasonRaw) : undefined;
      const listingLine = listing ? `Услуга «${listing}»` : undefined;
      const parts = [reason, listingLine].filter((part): part is string => Boolean(part));
      return parts.length ? parts.join(' · ') : undefined;
    }
    case 'right_emitted':
      return publication ? `За пост «${publication}»` : undefined;
    case 'nominal_assigned':
      return 'Номинал банка назначен';
    case 'demurrage': {
      const from = metaNumber(row.metadata, 'from');
      const to = metaNumber(row.metadata, 'to');
      if (from === undefined || to === undefined) return undefined;
      return `Номинал ${from.toLocaleString('ru-RU')} → ${to.toLocaleString('ru-RU')} ₽`;
    }
    default:
      return undefined;
  }
}

export function ledgerRowView(row: LedgerRowInput): LedgerRowView {
  const kind = canonicalType(row.type);
  const comment = kind === 'thanks_received' || kind === 'thanks_sent' ? text(row.metadata?.comment) : undefined;
  const amountText = row.amount === 0 ? undefined : `${row.amount > 0 ? '+' : ''}${row.amount}`;
  let unitText: string | undefined;
  if (amountText) {
    if (MERIT_UNIT_TYPES.has(row.type) || MERIT_UNIT_TYPES.has(kind)) unitText = meritsWord(row.amount);
    else if (NOMINAL_UNIT_TYPES.has(row.type) || NOMINAL_UNIT_TYPES.has(kind)) unitText = '₽ номинала';
  }

  return {
    title: ledgerTypeLabel(row.type),
    subtitle: subtitleFor(row, kind),
    comment,
    amountText,
    unitText,
    dealId: text(row.context?.dealId),
    statusMarker: isLedgerStatusMarker(row.type),
  };
}
