export const USER_COMMUNITY_ROLE_PERSISTENCE_PORT = Symbol('USER_COMMUNITY_ROLE_PERSISTENCE_PORT');

export interface UserCommunityRoleRecord {
  id: string;
  userId: string;
  communityId: string;
  role: 'lead' | 'participant';
  frozenInternalMerits?: number;
  leftAt?: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface UpsertUserCommunityRoleInput {
  id: string;
  userId: string;
  communityId: string;
  role: 'lead' | 'participant';
  createdAt: Date;
  updatedAt: Date;
}

/**
 * UserCommunityRolePersistencePort — per-community membership roles (V-12).
 */
export interface UserCommunityRolePersistencePort {
  findActiveRole(userId: string, communityId: string): Promise<UserCommunityRoleRecord | null>;

  findAnyRole(userId: string, communityId: string): Promise<UserCommunityRoleRecord | null>;

  findActiveRolesByUserId(userId: string): Promise<UserCommunityRoleRecord[]>;

  findActiveByCommunityAndRole(
    communityId: string,
    role: 'lead' | 'participant',
  ): Promise<UserCommunityRoleRecord[]>;

  countActiveMembersInCommunity(communityId: string): Promise<number>;

  countActiveMembersInCommunities(communityIds: string[]): Promise<Map<string, number>>;

  distinctActiveMemberUserIds(communityId: string): Promise<string[]>;

  distinctActiveUserIdsByRole(role: 'lead' | 'participant'): Promise<string[]>;

  findActiveCommunitiesByUserAndRole(
    userId: string,
    role: 'lead' | 'participant',
  ): Promise<string[]>;

  upsertRole(input: UpsertUserCommunityRoleInput): Promise<UserCommunityRoleRecord>;

  sumFrozenInternalMerits(communityId: string): Promise<number>;

  markLeftProject(
    userId: string,
    communityId: string,
    frozenInternalMerits: number,
    updatedAt: Date,
  ): Promise<void>;

  deleteRole(userId: string, communityId: string): Promise<void>;

  distinctUserIdsInCommunity(communityId: string): Promise<string[]>;
}
