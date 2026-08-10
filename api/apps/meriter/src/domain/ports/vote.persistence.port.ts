/** Opaque persistence session handle (Mongoose ClientSession in adapter). */
export type VotePersistenceSession = unknown;

export const VOTE_PERSISTENCE_PORT = Symbol('VOTE_PERSISTENCE_PORT');

export type VoteTargetType =
  | 'publication'
  | 'vote'
  | 'document-variant'
  | 'document-block-official';

export interface VoteRecord {
  id: string;
  targetType: VoteTargetType;
  targetId: string;
  userId: string;
  amountQuota: number;
  amountWallet: number;
  direction: 'up' | 'down';
  comment?: string;
  images?: string[];
  communityId: string;
  createdAt: Date;
  updatedAt?: Date;
}

export interface CreateVoteInput {
  id: string;
  targetType: VoteTargetType;
  targetId: string;
  userId: string;
  amountQuota: number;
  amountWallet: number;
  direction: 'up' | 'down';
  communityId: string;
  comment: string;
  images: string[];
  createdAt: Date;
}

export interface PublicationVotesQuery {
  publicationId: string;
  limit?: number;
  skip?: number;
  sortField?: string;
  sortOrder?: 'asc' | 'desc';
}

/**
 * VotePersistencePort — BC-04 vote persistence (Phase 9 partial).
 *
 * Domain services depend on this port; Mongoose schemas and mappers live under
 * infrastructure/persistence only.
 */
export interface VotePersistencePort {
  createVote(input: CreateVoteInput, session?: VotePersistenceSession): Promise<VoteRecord>;

  deleteVoteByUserTarget(
    userId: string,
    targetType: VoteTargetType,
    targetId: string,
  ): Promise<boolean>;

  findVotesByUserId(userId: string, limit: number, skip: number): Promise<VoteRecord[]>;

  findVoteById(voteId: string): Promise<VoteRecord | null>;

  findVotesByTarget(targetType: string, targetId: string): Promise<VoteRecord[]>;

  findDocumentBlockPanelVotes(
    documentId: string,
    blockId: string,
    variantIds: string[],
  ): Promise<VoteRecord[]>;

  findVotesOnVote(voteId: string): Promise<VoteRecord[]>;

  findVotesOnVotes(voteIds: string[]): Promise<VoteRecord[]>;

  findVotesOnPublication(publicationId: string): Promise<VoteRecord[]>;

  findPublicationVotes(query: PublicationVotesQuery): Promise<VoteRecord[]>;

  hasUserVote(userId: string, targetType: string, targetId: string): Promise<boolean>;

  sumPositiveAmountsOnVote(voteId: string): Promise<number>;
}
