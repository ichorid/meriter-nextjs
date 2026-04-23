export type MeritHistoryLineDescriptionSpec =
  | { kind: 'i18n'; messageKey: string; params?: Record<string, string> }
  | { kind: 'raw'; text: string };

type RowSlice = {
  referenceType?: string | null;
  type: string;
  description: string;
};

const PROJECT_PAYOUT_BUCKETS = ['founder', 'investor', 'team'] as const;

/**
 * Maps wallet transaction rows to next-intl keys under `meritHistory.lineDescription.*`.
 * Raw English `description` from the API is not shown when a key exists here.
 */
export function resolveMeritHistoryLineDescription(row: RowSlice): MeritHistoryLineDescriptionSpec {
  const rt = row.referenceType?.trim() || '';
  const desc = row.description?.trim() || '';

  if (rt === 'merit_transfer') {
    const incoming = row.type === 'deposit';
    return {
      kind: 'i18n',
      messageKey: incoming ? 'merit_transfer_received' : 'merit_transfer_sent',
    };
  }

  if (rt === 'community_wallet_topup') {
    return { kind: 'i18n', messageKey: 'community_wallet_topup' };
  }

  if (rt === 'community_starting_merits') {
    return { kind: 'i18n', messageKey: 'community_starting_merits' };
  }

  if (rt === 'welcome_merits') {
    return { kind: 'i18n', messageKey: 'welcome_merits' };
  }

  if (rt === 'project_topup') {
    const donation = desc.includes('donation');
    return {
      kind: 'i18n',
      messageKey: donation ? 'project_topup_donation' : 'project_topup_member',
    };
  }

  if (rt === 'project_investment') {
    return { kind: 'i18n', messageKey: 'project_investment' };
  }

  if (rt === 'project_payout') {
    const m = /^Project payout \((founder|investor|team)\)\s*$/i.exec(desc);
    if (m) {
      const bucket = m[1].toLowerCase() as (typeof PROJECT_PAYOUT_BUCKETS)[number];
      if ((PROJECT_PAYOUT_BUCKETS as readonly string[]).includes(bucket)) {
        return { kind: 'i18n', messageKey: `project_payout_${bucket}` };
      }
    }
    return { kind: 'i18n', messageKey: 'project_payout' };
  }

  if (rt === 'project_distribution') {
    return { kind: 'i18n', messageKey: 'project_distribution' };
  }

  if (rt === 'investment_pool_return') {
    if (desc.includes('remainder')) {
      return { kind: 'i18n', messageKey: 'investment_pool_return_remainder' };
    }
    return { kind: 'i18n', messageKey: 'investment_pool_return' };
  }

  if (rt === 'publication_creation') {
    // Match EN label or RU «Биржа» fragments without Cyrillic literals (scan-translations).
    const mentionsBirzha =
      /birzha/i.test(desc) ||
      desc.includes('\u0411\u0438\u0440\u0436') ||
      desc.includes('\u0431\u0438\u0440\u0436');
    if (mentionsBirzha) {
      return { kind: 'i18n', messageKey: 'publication_creation_birzha' };
    }
    return { kind: 'i18n', messageKey: 'publication_creation' };
  }

  const byRefType: Record<string, string> = {
    publication_vote: 'publication_vote',
    vote_vote: 'vote_vote',
    vote: 'vote_vote',
    comment_vote: 'comment_vote',
    project_appreciation: 'project_appreciation',
    investment: 'investment',
    investment_distribution: 'investment_distribution',
    tappalka_show_cost: 'tappalka_show_cost',
    tappalka_reward: 'tappalka_reward',
    publication_post_cost: 'publication_post_cost',
    poll_creation: 'poll_creation',
    poll_cast: 'poll_cast',
    forward_proposal: 'forward_proposal',
    publication_withdrawal: 'publication_withdrawal',
    comment_withdrawal: 'comment_withdrawal',
    vote_withdrawal: 'vote_withdrawal',
    demo_seed: 'demo_seed',
    demo_seed_balance: 'demo_seed_balance',
    fake_data_add: 'fake_data_add',
    admin_add_merits: 'admin_add_merits',
  };

  const messageKey = byRefType[rt];
  if (messageKey) {
    return { kind: 'i18n', messageKey };
  }

  return { kind: 'raw', text: desc || row.referenceType || '—' };
}
