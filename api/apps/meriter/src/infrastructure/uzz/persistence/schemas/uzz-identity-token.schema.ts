import { Schema } from 'mongoose';

export const UZZ_IDENTITY_TOKEN_MODEL = 'UzzIdentityToken';

export const UzzIdentityTokenPersistenceSchema = new Schema(
  {
    id: { type: String, required: true },
    identityId: { type: String, required: true },
    purpose: { type: String, enum: ['telegram_link'], required: true },
    tokenHash: { type: String, required: true },
    expiresAt: { type: Date, required: true },
    consumedAt: { type: Date, default: null },
    attemptCount: { type: Number, required: true, default: 0 },
    createdAt: { type: Date, required: true },
  },
  { collection: 'uzz_identity_tokens', versionKey: false },
);

UzzIdentityTokenPersistenceSchema.index(
  { id: 1 },
  { unique: true, name: 'uzz_identity_tokens_id_unique' },
);
UzzIdentityTokenPersistenceSchema.index(
  { tokenHash: 1 },
  { unique: true, name: 'uzz_identity_tokens_hash_unique' },
);
UzzIdentityTokenPersistenceSchema.index(
  { expiresAt: 1 },
  { expireAfterSeconds: 0, name: 'uzz_identity_tokens_expiry_ttl' },
);

