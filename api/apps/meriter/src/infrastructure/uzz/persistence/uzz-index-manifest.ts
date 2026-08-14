export const UZZ_INDEX_MANIFEST_VERSION = 1;

export type UzzIndexKey = Record<string, 1 | -1>;

export type UzzIndexOptions = {
  unique?: true;
  expireAfterSeconds?: number;
  partialFilterExpression?: Record<string, unknown>;
};

export type UzzRequiredIndex = {
  collection: string;
  name: string;
  key: UzzIndexKey;
} & UzzIndexOptions;

export const UZZ_REQUIRED_INDEXES: readonly UzzRequiredIndex[] = [
  {
    collection: 'uzz_identities',
    name: 'uzz_identities_id_unique',
    key: { id: 1 },
    unique: true,
  },
  {
    collection: 'uzz_identities',
    name: 'uzz_identities_canonical_user_unique',
    key: { canonicalUserId: 1 },
    unique: true,
  },
  {
    collection: 'uzz_identities',
    name: 'uzz_identities_email_unique',
    key: { normalizedEmail: 1 },
    unique: true,
    partialFilterExpression: { normalizedEmail: { $type: 'string' } },
  },
  {
    collection: 'uzz_identities',
    name: 'uzz_identities_telegram_user_unique',
    key: { telegramUserId: 1 },
    unique: true,
    partialFilterExpression: { telegramUserId: { $type: 'string' } },
  },
  {
    collection: 'uzz_identity_aliases',
    name: 'uzz_identity_aliases_id_unique',
    key: { id: 1 },
    unique: true,
  },
  {
    collection: 'uzz_identity_aliases',
    name: 'uzz_identity_aliases_user_unique',
    key: { aliasUserId: 1 },
    unique: true,
  },
  {
    collection: 'uzz_identity_tokens',
    name: 'uzz_identity_tokens_id_unique',
    key: { id: 1 },
    unique: true,
  },
  {
    collection: 'uzz_identity_tokens',
    name: 'uzz_identity_tokens_hash_unique',
    key: { tokenHash: 1 },
    unique: true,
  },
  {
    collection: 'uzz_deals',
    name: 'uzz_deals_v2_one_open_per_right',
    key: { exchangeRightId: 1 },
    unique: true,
    partialFilterExpression: {
      exchangeRightId: { $type: 'string' },
      status: { $in: ['requested', 'accepted', 'completed_by_seller'] },
    },
  },
  {
    collection: 'uzz_rights',
    name: 'uzz_rights_deal_lock_unique',
    key: { lockedByDealId: 1 },
    unique: true,
    partialFilterExpression: { lockedByDealId: { $type: 'string' } },
  },
  {
    collection: 'uzz_ledger',
    name: 'uzz_ledger_operation_user_type_unique',
    key: { operationId: 1, userId: 1, type: 1 },
    unique: true,
    partialFilterExpression: { operationId: { $type: 'string' } },
  },
  {
    collection: 'uzz_commands',
    name: 'uzz_commands_actor_command_unique',
    key: { actorId: 1, commandId: 1 },
    unique: true,
  },
  {
    collection: 'uzz_outbox',
    name: 'uzz_outbox_id_unique',
    key: { id: 1 },
    unique: true,
  },
  {
    collection: 'uzz_outbox',
    name: 'processedAt_1_availableAt_1',
    key: { processedAt: 1, availableAt: 1 },
  },
  {
    collection: 'uzz_outbox',
    name: 'deadLetteredAt_1_lockedUntil_1_availableAt_1',
    key: { deadLetteredAt: 1, lockedUntil: 1, availableAt: 1 },
  },
  {
    collection: 'uzz_rate_limits',
    name: 'uzz_rate_limits_scope_subject_window_unique',
    key: { scope: 1, subjectHash: 1, windowStart: 1 },
    unique: true,
  },
  {
    collection: 'uzz_rate_limits',
    name: 'uzz_rate_limits_expires_ttl',
    key: { expiresAt: 1 },
    expireAfterSeconds: 0,
  },
];
