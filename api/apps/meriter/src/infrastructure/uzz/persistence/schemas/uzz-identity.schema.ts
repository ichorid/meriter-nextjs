import { Schema } from 'mongoose';

export const UZZ_IDENTITY_MODEL = 'UzzIdentity';

export const UzzIdentityPersistenceSchema = new Schema(
  {
    id: { type: String, required: true },
    canonicalUserId: { type: String, required: true },
    normalizedEmail: { type: String, default: null },
    telegramUserId: { type: String, default: null },
    telegramUsername: { type: String, default: null },
    version: { type: Number, required: true, default: 0 },
  },
  { collection: 'uzz_identities', timestamps: true, versionKey: false },
);

UzzIdentityPersistenceSchema.index(
  { id: 1 },
  { unique: true, name: 'uzz_identities_id_unique' },
);
UzzIdentityPersistenceSchema.index(
  { canonicalUserId: 1 },
  { unique: true, name: 'uzz_identities_canonical_user_unique' },
);
UzzIdentityPersistenceSchema.index(
  { normalizedEmail: 1 },
  {
    unique: true,
    name: 'uzz_identities_email_unique',
    partialFilterExpression: { normalizedEmail: { $type: 'string' } },
  },
);
UzzIdentityPersistenceSchema.index(
  { telegramUserId: 1 },
  {
    unique: true,
    name: 'uzz_identities_telegram_user_unique',
    partialFilterExpression: { telegramUserId: { $type: 'string' } },
  },
);

