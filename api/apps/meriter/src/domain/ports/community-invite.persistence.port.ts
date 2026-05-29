export const COMMUNITY_INVITE_PERSISTENCE_PORT = Symbol('COMMUNITY_INVITE_PERSISTENCE_PORT');

export interface CommunityInviteRecord {
  id: string;
  token: string;
  communityId: string;
  parentCommunityId?: string;
  inviterUserId: string;
  inviterIsAdmin: boolean;
  expiresAt: Date;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface CreateCommunityInviteInput {
  id: string;
  token: string;
  communityId: string;
  parentCommunityId?: string;
  inviterUserId: string;
  inviterIsAdmin: boolean;
  expiresAt: Date;
}

/**
 * CommunityInvitePersistencePort — DB-backed community invite links (V-12).
 */
export interface CommunityInvitePersistencePort {
  create(input: CreateCommunityInviteInput): Promise<void>;

  findByToken(token: string): Promise<CommunityInviteRecord | null>;
}
