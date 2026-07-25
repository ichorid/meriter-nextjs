/** Opaque persistence session handle (Mongoose ClientSession in adapter). */
export type PollPersistenceSession = unknown;

export const POLL_PERSISTENCE_PORT = Symbol('POLL_PERSISTENCE_PORT');

export interface PollOptionSnapshot {
  id: string;
  text: string;
  votes: number;
  /** Net amount (amountUp - amountDown); can be negative. */
  amount: number;
  /** Legacy docs may lack these; readers use amountUp ?? amount, amountDown ?? 0. */
  amountUp?: number;
  amountDown?: number;
  casterCount: number;
}

export interface PollMetricsSnapshot {
  totalCasts: number;
  casterCount: number;
  totalAmount: number;
}

export interface PollSettingsSnapshot {
  quotaAllowed: boolean;
}

export interface PollSnapshot {
  id: string;
  communityId: string;
  authorId: string;
  question: string;
  description?: string;
  options: PollOptionSnapshot[];
  expiresAt: Date;
  isActive: boolean;
  metrics: PollMetricsSnapshot;
  settings?: PollSettingsSnapshot;
  resultsAnnouncedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

export type InsertPollInput = PollSnapshot;

export interface CommunityPollsQuery {
  communityId: string;
  limit: number;
  skip: number;
  sortBy?: 'createdAt' | 'score';
  search?: string;
}

export interface PollPartialUpdate {
  question?: string;
  description?: string;
  options?: PollOptionSnapshot[];
  expiresAt?: Date;
  updatedAt: Date;
}

/**
 * PollPersistencePort — BC-07 poll persistence (Phase 9 partial).
 *
 * Domain services depend on this port; Mongoose schemas and mappers live under
 * infrastructure/persistence only.
 */
export interface PollPersistencePort {
  insertPoll(input: InsertPollInput, session?: PollPersistenceSession): Promise<void>;

  findById(id: string, session?: PollPersistenceSession): Promise<PollSnapshot | null>;

  deleteById(id: string): Promise<void>;

  countActiveByCommunity(communityId: string): Promise<number>;

  findByCommunity(query: CommunityPollsQuery): Promise<PollSnapshot[]>;

  findActiveNotExpired(limit: number, skip: number): Promise<PollSnapshot[]>;

  updateSnapshot(
    id: string,
    snapshot: PollSnapshot,
    session?: PollPersistenceSession,
  ): Promise<void>;

  countByFilter(filter: Record<string, unknown>): Promise<number>;

  findByFilter(
    filter: Record<string, unknown>,
    limit: number,
    skip: number,
  ): Promise<PollSnapshot[]>;

  partialUpdate(id: string, update: PollPartialUpdate): Promise<void>;
}
