import { Schema } from 'mongoose';

export const UZZ_IDENTITY_ALIAS_MODEL = 'UzzIdentityAlias';

export const UzzIdentityAliasPersistenceSchema = new Schema(
  {
    id: { type: String, required: true },
    identityId: { type: String, required: true },
    aliasUserId: { type: String, required: true },
    createdAt: { type: Date, required: true },
  },
  { collection: 'uzz_identity_aliases', versionKey: false },
);

UzzIdentityAliasPersistenceSchema.index(
  { id: 1 },
  { unique: true, name: 'uzz_identity_aliases_id_unique' },
);
UzzIdentityAliasPersistenceSchema.index(
  { aliasUserId: 1 },
  { unique: true, name: 'uzz_identity_aliases_user_unique' },
);
UzzIdentityAliasPersistenceSchema.index({ identityId: 1 });

