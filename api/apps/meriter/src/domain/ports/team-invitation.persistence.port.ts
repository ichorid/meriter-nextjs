export const TEAM_INVITATION_PERSISTENCE_PORT = Symbol(
  'TEAM_INVITATION_PERSISTENCE_PORT',
);

export interface TeamInvitationRecord {
  id: string;
  communityId: string;
  inviterId: string;
  targetUserId: string;
  status: 'pending' | 'accepted' | 'rejected' | 'cancelled';
  action?: 'accept' | 'reject';
  createdAt: Date;
  updatedAt: Date;
  [key: string]: unknown;
}

export interface TeamInvitationMutableRecord extends TeamInvitationRecord {
  save(): Promise<void>;
  set(path: string, value: unknown): void;
  toObject(): Record<string, unknown>;
}

export interface TeamInvitationPersistencePort {
  create(input: Record<string, unknown>): Promise<TeamInvitationRecord>;

  findById(invitationId: string): Promise<TeamInvitationMutableRecord | null>;

  findPendingByTargetAndCommunity(
    targetUserId: string,
    communityId: string,
  ): Promise<TeamInvitationRecord | null>;

  findPendingByInviterTargetCommunity(
    inviterId: string,
    targetUserId: string,
    communityId: string,
  ): Promise<TeamInvitationRecord | null>;

  listPendingForTarget(targetUserId: string): Promise<TeamInvitationRecord[]>;
}
