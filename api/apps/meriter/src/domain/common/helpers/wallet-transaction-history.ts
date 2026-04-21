/**
 * Merit History (global wallet feed): UI filter buckets ↔ transaction.referenceType.
 * Keep in sync with all WalletService.addTransaction call sites.
 */

export const MERIT_HISTORY_FILTER_KEYS = [
  'all',
  'peer_transfer',
  'voting',
  'investment',
  'tappalka',
  'fees_and_forward',
  'withdrawals',
  'welcome_and_system',
  'other',
] as const;

export type MeritHistoryFilterKey = (typeof MERIT_HISTORY_FILTER_KEYS)[number];

/** referenceType values observed in codebase (wallet lines). */
const REFERENCE_TYPES = {
  peer_transfer: ['merit_transfer'] as const,

  voting: [
    'publication_vote',
    'vote_vote',
    'vote',
    'comment_vote',
    'project_appreciation',
  ] as const,

  investment: ['investment', 'investment_distribution', 'investment_pool_return'] as const,

  tappalka: ['tappalka_show_cost', 'tappalka_reward'] as const,

  fees_and_forward: [
    'publication_creation',
    'publication_post_cost',
    'poll_creation',
    'poll_cast',
    'forward_proposal',
  ] as const,

  withdrawals: ['publication_withdrawal', 'comment_withdrawal', 'vote_withdrawal'] as const,

  welcome_and_system: ['welcome_merits', 'community_starting_merits'] as const,

  other_explicit: ['project_payout'] as const,
} as const;

const ALL_TYPED = [
  ...REFERENCE_TYPES.peer_transfer,
  ...REFERENCE_TYPES.voting,
  ...REFERENCE_TYPES.investment,
  ...REFERENCE_TYPES.tappalka,
  ...REFERENCE_TYPES.fees_and_forward,
  ...REFERENCE_TYPES.withdrawals,
  ...REFERENCE_TYPES.welcome_and_system,
  ...REFERENCE_TYPES.other_explicit,
] as string[];

const FILTER_TO_TYPES: Record<
  Exclude<MeritHistoryFilterKey, 'all' | 'other'>,
  readonly string[]
> = {
  peer_transfer: REFERENCE_TYPES.peer_transfer,
  voting: REFERENCE_TYPES.voting,
  investment: REFERENCE_TYPES.investment,
  tappalka: REFERENCE_TYPES.tappalka,
  fees_and_forward: REFERENCE_TYPES.fees_and_forward,
  withdrawals: REFERENCE_TYPES.withdrawals,
  welcome_and_system: REFERENCE_TYPES.welcome_and_system,
};

/**
 * Mongo match fragment for referenceType when filtering by Merit History category.
 * Combine with `{ walletId }` at the same query level (see WalletService).
 * - `all`: no fragment (null)
 * - `other`: referenceType not in known set OR missing
 */
export function meritHistoryReferenceTypeMatch(
  filter: MeritHistoryFilterKey,
): Record<string, unknown> | null {
  if (filter === 'all') {
    return null;
  }
  if (filter === 'other') {
    return {
      $or: [
        { referenceType: { $exists: false } },
        { referenceType: null },
        { referenceType: '' },
        { referenceType: { $nin: ALL_TYPED } },
      ],
    };
  }
  const include = FILTER_TO_TYPES[filter];
  return { referenceType: { $in: [...include] } };
}

/**
 * Display sign for global wallet ledger lines (+ incoming / − outgoing).
 * publication_*_withdrawal credits use stored type `withdrawal` but are incoming merits.
 */
export function meritHistoryLedgerMultiplier(tx: {
  type: string;
  referenceType?: string | null;
}): 1 | -1 {
  const rt = tx.referenceType ?? '';
  if (
    rt === 'publication_withdrawal' ||
    rt === 'comment_withdrawal' ||
    rt === 'vote_withdrawal'
  ) {
    return 1;
  }
  if (tx.type === 'deposit') return 1;
  return -1;
}

export type MeritHistoryDashboardPeriodDays = 7 | 30 | 90;

/**
 * UTC calendar window: `periodDays` days ending today (inclusive), `[fromInclusive, toExclusive)`.
 */
export function meritHistoryUtcCalendarRange(
  periodDays: MeritHistoryDashboardPeriodDays,
  now: Date = new Date(),
): { fromInclusive: Date; toExclusive: Date } {
  const y = now.getUTCFullYear();
  const m = now.getUTCMonth();
  const d = now.getUTCDate();
  const toExclusive = new Date(Date.UTC(y, m, d + 1));
  const fromInclusive = new Date(Date.UTC(y, m, d));
  fromInclusive.setUTCDate(fromInclusive.getUTCDate() - (periodDays - 1));
  fromInclusive.setUTCHours(0, 0, 0, 0);
  return { fromInclusive, toExclusive };
}

/**
 * MongoDB `$match` for merit-history rows: global `walletId`, optional category filter, optional date range.
 */
export function buildMeritHistoryTransactionMatch(
  walletId: string,
  category: MeritHistoryFilterKey,
  dateRange?: { fromInclusive: Date; toExclusive: Date },
): Record<string, unknown> {
  const refClause = meritHistoryReferenceTypeMatch(category);
  const match: Record<string, unknown> =
    refClause === null ? { walletId } : { walletId, ...refClause };
  if (dateRange) {
    match.createdAt = {
      $gte: dateRange.fromInclusive,
      $lt: dateRange.toExclusive,
    };
  }
  return match;
}

/** `$multiply` factor for ledger sign (same rules as `meritHistoryLedgerMultiplier`). */
export function meritHistorySignedAmountMongoExpr(): Record<string, unknown> {
  const mult: Record<string, unknown> = {
    $cond: [
      {
        $or: [
          { $eq: ['$referenceType', 'publication_withdrawal'] },
          { $eq: ['$referenceType', 'comment_withdrawal'] },
          { $eq: ['$referenceType', 'vote_withdrawal'] },
        ],
      },
      1,
      { $cond: [{ $eq: ['$type', 'deposit'] }, 1, -1] },
    ],
  };
  return { $multiply: ['$amount', mult] };
}

const TYPED_CATEGORY_KEYS = Object.keys(FILTER_TO_TYPES) as Array<
  Exclude<MeritHistoryFilterKey, 'all' | 'other'>
>;

/**
 * Mongo expression: document → merit-history bucket (`all` excluded), under `$let` var `rt` = trimmed `referenceType`.
 */
export function meritHistoryCategoryMongoExprOnRtVar(): Record<string, unknown> {
  const branches: Array<{ case: Record<string, unknown>; then: string }> = [];
  for (const cat of TYPED_CATEGORY_KEYS) {
    const types = FILTER_TO_TYPES[cat];
    for (const rt of types) {
      branches.push({ case: { $eq: ['$$rt', rt] }, then: cat });
    }
  }
  for (const rt of REFERENCE_TYPES.other_explicit) {
    branches.push({ case: { $eq: ['$$rt', rt] }, then: 'other' });
  }
  return {
    $let: {
      vars: {
        rt: {
          $trim: { input: { $toString: { $ifNull: ['$referenceType', ''] } } },
        },
      },
      in: {
        $switch: {
          branches,
          default: 'other',
        },
      },
    },
  };
}

export function meritHistoryCategoryForReferenceType(
  referenceType: string | undefined | null,
): Exclude<MeritHistoryFilterKey, 'all'> {
  const rt = referenceType?.trim() || '';
  if (!rt) return 'other';

  const typedKeys = Object.keys(FILTER_TO_TYPES) as Array<
    Exclude<MeritHistoryFilterKey, 'all' | 'other'>
  >;
  for (const key of typedKeys) {
    if ((FILTER_TO_TYPES[key] as readonly string[]).includes(rt)) return key;
  }
  if ((REFERENCE_TYPES.other_explicit as readonly string[]).includes(rt)) return 'other';
  return 'other';
}
