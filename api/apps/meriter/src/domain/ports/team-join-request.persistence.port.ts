export const TEAM_JOIN_REQUEST_PERSISTENCE_PORT = Symbol(
  'TEAM_JOIN_REQUEST_PERSISTENCE_PORT',
);

export interface TeamJoinRequestRecord {
  id: string;
  userId: string;
  communityId: string;
  message?: string;
  status: 'pending' | 'approved' | 'rejected' | 'cancelled';
  createdAt: Date;
  updatedAt: Date;
  [key: string]: unknown;
}

export interface TeamJoinRequestMutableRecord extends TeamJoinRequestRecord {
  save(): Promise<void>;
  set(path: string, value: unknown): void;
  toObject(): Record<string, unknown>;
}

export interface TeamJoinRequestPersistencePort {
  create(input: Record<string, unknown>): Promise<TeamJoinRequestRecord>;

  findById(requestId: string): Promise<TeamJoinRequestMutableRecord | null>;

  findPendingByUserAndCommunity(
    userId: string,
    communityId: string,
  ): Promise<TeamJoinRequestRecord | null>;

  listPendingByCommunity(communityId: string): Promise<TeamJoinRequestRecord[]>;

  listByUser(userId: string): Promise<TeamJoinRequestRecord[]>;

  deleteById(requestId: string): Promise<void>;
}
