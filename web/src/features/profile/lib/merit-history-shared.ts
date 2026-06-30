import type { MeritHistoryFeedRow } from '@/features/merit-transfer/components/MeritHistoryFeed';

/** Mirrors `MERIT_HISTORY_FILTER_KEYS` on the API — keep aligned when extending filters. */
export type MeritHistoryFilterTab =
  | 'all'
  | 'peer_transfer'
  | 'voting'
  | 'investment'
  | 'tappalka'
  | 'fees_and_forward'
  | 'withdrawals'
  | 'welcome_and_system'
  | 'other';

export const MERIT_HISTORY_FILTER_TABS: MeritHistoryFilterTab[] = [
  'all',
  'peer_transfer',
  'voting',
  'investment',
  'tappalka',
  'fees_and_forward',
  'withdrawals',
  'welcome_and_system',
  'other',
];

export const MERIT_HISTORY_PAGE_LIMIT = 20;

export function meritHistoryTabLabelKey(key: MeritHistoryFilterTab): string {
  return `filter.${key}`;
}

type WalletTransactionRow = {
  id: string;
  type: string;
  amount: number;
  description: string;
  referenceType: string;
  createdAt: string | Date;
  meritHistoryCategory: MeritHistoryFeedRow['meritHistoryCategory'];
  ledgerMultiplier: number;
  meritHistoryEnrichment: MeritHistoryFeedRow['meritHistoryEnrichment'];
};

export function mapWalletTransactionsToFeedRows(
  pages: { data: WalletTransactionRow[] }[] | undefined,
): MeritHistoryFeedRow[] {
  const flat = (pages ?? []).flatMap((p) => p.data);
  return flat.map(
    (row): MeritHistoryFeedRow => ({
      id: row.id,
      type: row.type,
      amount: row.amount,
      description: row.description,
      referenceType: row.referenceType,
      createdAt: typeof row.createdAt === 'string' ? row.createdAt : String(row.createdAt),
      meritHistoryCategory: row.meritHistoryCategory,
      ledgerMultiplier: row.ledgerMultiplier,
      meritHistoryEnrichment: row.meritHistoryEnrichment ?? null,
    }),
  );
}
