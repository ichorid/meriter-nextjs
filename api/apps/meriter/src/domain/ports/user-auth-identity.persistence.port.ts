export const USER_AUTH_IDENTITY_PERSISTENCE_PORT = Symbol(
  'USER_AUTH_IDENTITY_PERSISTENCE_PORT',
);

export interface UserAuthIdentityRecord {
  id: string;
  userId: string;
  provider: string;
  authId: string;
  linkedAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface UserAuthIdentityPersistencePort {
  findByProviderAuth(
    provider: string,
    authId: string,
  ): Promise<UserAuthIdentityRecord | null>;

  findProvidersByUserId(userId: string): Promise<string[]>;

  linkIdentity(
    userId: string,
    provider: string,
    authId: string,
  ): Promise<UserAuthIdentityRecord>;

  countAll(): Promise<number>;

  bulkInsertFromLegacyUsers(
    rows: Array<{ userId: string; provider: string; authId: string }>,
  ): Promise<number>;
}
