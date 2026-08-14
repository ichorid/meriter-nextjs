const dbName = 'uzz_e2e';
const target = db.getSiblingDB(dbName);

const indexes = [
  { c: 'uzz_identities', n: 'uzz_identities_id_unique', k: { id: 1 }, u: true },
  { c: 'uzz_identities', n: 'uzz_identities_canonical_user_unique', k: { canonicalUserId: 1 }, u: true },
  {
    c: 'uzz_identities',
    n: 'uzz_identities_email_unique',
    k: { normalizedEmail: 1 },
    u: true,
    p: { normalizedEmail: { $type: 'string' } },
  },
  {
    c: 'uzz_identities',
    n: 'uzz_identities_telegram_user_unique',
    k: { telegramUserId: 1 },
    u: true,
    p: { telegramUserId: { $type: 'string' } },
  },
  { c: 'uzz_identity_aliases', n: 'uzz_identity_aliases_id_unique', k: { id: 1 }, u: true },
  { c: 'uzz_identity_aliases', n: 'uzz_identity_aliases_user_unique', k: { aliasUserId: 1 }, u: true },
  { c: 'uzz_identity_tokens', n: 'uzz_identity_tokens_id_unique', k: { id: 1 }, u: true },
  { c: 'uzz_identity_tokens', n: 'uzz_identity_tokens_hash_unique', k: { tokenHash: 1 }, u: true },
  {
    c: 'uzz_deals',
    n: 'uzz_deals_v2_one_open_per_right',
    k: { exchangeRightId: 1 },
    u: true,
    p: {
      exchangeRightId: { $type: 'string' },
      status: { $in: ['requested', 'accepted', 'completed_by_seller'] },
    },
  },
  {
    c: 'uzz_rights',
    n: 'uzz_rights_deal_lock_unique',
    k: { lockedByDealId: 1 },
    u: true,
    p: { lockedByDealId: { $type: 'string' } },
  },
  {
    c: 'uzz_ledger',
    n: 'uzz_ledger_operation_user_type_unique',
    k: { operationId: 1, userId: 1, type: 1 },
    u: true,
    p: { operationId: { $type: 'string' } },
  },
  { c: 'uzz_commands', n: 'uzz_commands_actor_command_unique', k: { actorId: 1, commandId: 1 }, u: true },
  { c: 'uzz_outbox', n: 'uzz_outbox_id_unique', k: { id: 1 }, u: true },
  { c: 'uzz_outbox', n: 'processedAt_1_availableAt_1', k: { processedAt: 1, availableAt: 1 } },
  {
    c: 'uzz_outbox',
    n: 'deadLetteredAt_1_lockedUntil_1_availableAt_1',
    k: { deadLetteredAt: 1, lockedUntil: 1, availableAt: 1 },
  },
  {
    c: 'uzz_rate_limits',
    n: 'uzz_rate_limits_scope_subject_window_unique',
    k: { scope: 1, subjectHash: 1, windowStart: 1 },
    u: true,
  },
  { c: 'uzz_rate_limits', n: 'uzz_rate_limits_expires_ttl', k: { expiresAt: 1 }, ttl: 0 },
];

for (const spec of indexes) {
  const options = { name: spec.n };
  if (spec.u) options.unique = true;
  if (spec.p) options.partialFilterExpression = spec.p;
  if (spec.ttl !== undefined) options.expireAfterSeconds = spec.ttl;
  target.getCollection(spec.c).createIndex(spec.k, options);
}

print('uzz-e2e indexes ready');
