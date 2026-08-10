export const USER_PERSISTENCE_PORT = Symbol('USER_PERSISTENCE_PORT');

export interface UserProfileRecord {
  bio?: string;
  location?: { region: string; city: string };
  website?: string;
  isVerified?: boolean;
  about?: string;
  contacts?: { email: string; messenger: string };
  educationalInstitution?: string;
}

export interface UserRecord {
  id: string;
  authProvider: string;
  authId: string;
  username?: string;
  firstName?: string;
  lastName?: string;
  displayName: string;
  avatarUrl?: string;
  profile: UserProfileRecord;
  globalRole?: 'superadmin';
  meritStats?: Record<string, number>;
  communityTags: string[];
  communityMemberships: string[];
  authenticators?: unknown[];
  token?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface AggregateCommunityMembersParams {
  memberIds: string[];
  search?: string;
  communityId: string;
  quotaStartTime: Date;
  dailyEmission: number;
  isFutureVision: boolean;
  limit: number;
  skip: number;
}

export interface AggregateCommunityMemberRow {
  id: string;
  username?: string;
  displayName?: string;
  avatarUrl?: string;
  globalRole?: string;
  role?: string;
  walletBalance?: number;
  quota?: {
    dailyEmission: number;
    usedToday: number;
  };
}

export interface AggregateCommunityMembersResult {
  members: AggregateCommunityMemberRow[];
  total: number;
}

/**
 * UserPersistencePort — user profile/auth/membership persistence (V-12).
 */
export interface UserPersistencePort {
  indexExists(indexName: string): Promise<boolean>;

  dropIndex(indexName: string): Promise<void>;

  findById(id: string): Promise<UserRecord | null>;

  findByAuth(authProvider: string, authId: string): Promise<UserRecord | null>;

  findByToken(token: string): Promise<UserRecord | null>;

  findByCredentialId(credentialId: string): Promise<UserRecord | null>;

  findByUsername(username: string): Promise<UserRecord | null>;

  findForEnrichment(ids: string[]): Promise<Array<Pick<UserRecord, 'id' | 'displayName' | 'avatarUrl'>>>;

  findForDisplayNames(ids: string[]): Promise<Array<Pick<UserRecord, 'id' | 'displayName'>>>;

  updateByAuth(authProvider: string, authId: string, set: Record<string, unknown>): Promise<void>;

  create(input: UserRecord): Promise<void>;

  updateById(id: string, set: Record<string, unknown>): Promise<void>;

  setGlobalRole(
    userId: string,
    role: 'superadmin' | undefined,
    updatedAt: Date,
  ): Promise<UserRecord | null>;

  addCommunityMembership(userId: string, communityId: string): Promise<void>;

  removeCommunityMembership(userId: string, communityId: string): Promise<void>;

  getCommunityMemberships(userId: string): Promise<string[]>;

  isMemberOfCommunity(userId: string, communityId: string): Promise<boolean>;

  findAll(limit: number, skip: number): Promise<UserRecord[]>;

  findByCommunity(communityId: string, limit: number, skip: number): Promise<UserRecord[]>;

  search(query: string, limit: number): Promise<UserRecord[]>;

  findAllUserIds(): Promise<string[]>;

  aggregateCommunityMembers(
    params: AggregateCommunityMembersParams,
  ): Promise<AggregateCommunityMembersResult>;
}
