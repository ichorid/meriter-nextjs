import type { PublicationSnapshot } from '../../common/interfaces/publication-document.interface';

/** Opaque persistence session handle (Mongoose ClientSession in adapter). */
export type PublicationPersistenceSession = unknown;

export const PUBLICATION_PERSISTENCE_PORT = Symbol('PUBLICATION_PERSISTENCE_PORT');

export interface PublicationEditHistoryEntry {
  editedBy: string;
  editedAt: Date;
}

export type InsertPublicationInput = PublicationSnapshot;

export interface CommunityPublicationsQuery {
  communityId: string;
  limit: number;
  skip: number;
  sortBy?: 'createdAt' | 'score';
  hashtag?: string;
  filters?: {
    impactArea?: string;
    stage?: string;
    beneficiaries?: string[];
    methods?: string[];
    helpNeeded?: string[];
    categories?: string[];
    valueTags?: string[];
  };
  search?: string;
  hubPostsFeedOnly?: boolean;
}

export interface ObPostSummary {
  id: string;
  sourceEntityId: string;
  metrics: { score: number };
  createdAt?: Date;
}

export interface PublicationVoteUpdate {
  snapshot: PublicationSnapshot;
  lifetimeCreditIncrement?: number;
}

export interface PublicationForwardProposalInput {
  targetCommunityId: string;
  proposedBy: string;
}

export interface PublicationQueryListOptions {
  query: Record<string, unknown>;
  limit?: number;
  skip?: number;
  sort?: Record<string, 1 | -1>;
  select?: Record<string, 0 | 1 | boolean>;
}

export interface PublicationPatchUpdate {
  set?: Record<string, unknown>;
  push?: Record<string, unknown>;
  unset?: Record<string, unknown>;
}

export interface ClosePublicationInput {
  id: string;
  reason: string;
  closingSummary: Record<string, unknown>;
  session?: PublicationPersistenceSession;
}

/**
 * PublicationPersistencePort — BC-03 publication persistence (Phase 9 partial).
 *
 * Domain services depend on this port; Mongoose schemas and mappers live under
 * infrastructure/persistence only.
 */
export interface PublicationPersistencePort {
  startSession(): Promise<PublicationPersistenceSession>;

  findById(
    id: string,
    session?: PublicationPersistenceSession,
  ): Promise<PublicationSnapshot | null>;

  insertPublication(
    input: InsertPublicationInput,
    session?: PublicationPersistenceSession,
  ): Promise<void>;

  updateSnapshot(
    id: string,
    snapshot: PublicationSnapshot,
    session?: PublicationPersistenceSession,
  ): Promise<void>;

  updateWithVoteMetrics(
    id: string,
    update: PublicationVoteUpdate,
    session?: PublicationPersistenceSession,
  ): Promise<void>;

  updateWithEditHistory(
    id: string,
    payload: Partial<PublicationSnapshot>,
    editHistoryEntry: PublicationEditHistoryEntry,
    session?: PublicationPersistenceSession,
  ): Promise<void>;

  setPublicationTimestampsForSeed(
    id: string,
    createdAt: Date,
    ttlExpiresAt: Date | null,
  ): Promise<void>;

  updateFutureVisionPostContent(
    futureVisionCommunityId: string,
    sourceCommunityId: string,
    content: string,
  ): Promise<boolean>;

  findFutureVisionPostId(
    futureVisionCommunityId: string,
    sourceCommunityId: string,
  ): Promise<string | null>;

  findObPosts(
    futureVisionCommunityId: string,
    params: { sort: 'score' | 'createdAt' },
  ): Promise<ObPostSummary[]>;

  countHubFeedPublicationsByCommunity(communityId: string): Promise<number>;

  countProjectHubPosts(projectId: string): Promise<number>;

  countBirzhaPostsBySourceEntity(
    birzhaCommunityId: string,
    sourceEntityType: 'project' | 'community',
    sourceEntityId: string,
  ): Promise<number>;

  findBirzhaPostsBySourceEntity(
    birzhaCommunityId: string,
    sourceEntityType: 'project' | 'community',
    sourceEntityId: string,
    limit: number,
    skip: number,
  ): Promise<PublicationSnapshot[]>;

  findPublicationsByCommunity(
    query: CommunityPublicationsQuery,
  ): Promise<PublicationSnapshot[]>;

  findTopPublications(limit: number, skip: number): Promise<PublicationSnapshot[]>;

  findPublicationsByAuthor(
    authorId: string,
    limit: number,
    skip: number,
  ): Promise<PublicationSnapshot[]>;

  countProfilePublicationsByAuthor(authorId: string): Promise<number>;

  findPublicationsByHashtag(
    hashtag: string,
    limit: number,
    skip: number,
  ): Promise<PublicationSnapshot[]>;

  findDeletedPublicationsByCommunity(
    communityId: string,
    limit: number,
    skip: number,
  ): Promise<PublicationSnapshot[]>;

  softDelete(id: string): Promise<void>;

  restore(id: string): Promise<void>;

  updateForwardProposal(
    id: string,
    input: PublicationForwardProposalInput,
  ): Promise<void>;

  markAsForwarded(id: string, targetCommunityId: string): Promise<void>;

  clearForwardProposal(id: string): Promise<void>;

  findActiveIdsBySource(
    communityId: string,
    sourceEntityType: string,
    sourceEntityId: string,
  ): Promise<string[]>;

  deleteById(id: string): Promise<void>;

  deleteVotesByPublicationId(publicationId: string): Promise<void>;

  deleteCommentsRecursivelyForPublication(publicationId: string): Promise<void>;

  findByQuery(options: PublicationQueryListOptions): Promise<PublicationSnapshot[]>;

  countByQuery(query: Record<string, unknown>): Promise<number>;

  patchById(
    id: string,
    update: PublicationPatchUpdate,
    session?: PublicationPersistenceSession,
  ): Promise<void>;

  closePublication(input: ClosePublicationInput): Promise<void>;

  runInTransaction<T>(
    fn: (session: PublicationPersistenceSession) => Promise<T>,
  ): Promise<T>;
}
