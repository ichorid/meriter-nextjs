export const TAPPALKA_PERSISTENCE_PORT = Symbol('TAPPALKA_PERSISTENCE_PORT');

export interface TappalkaProgressRecord {
  id: string;
  userId: string;
  communityId: string;
  comparisonCount: number;
  totalComparisons: number;
  totalRewardsEarned: number;
  onboardingSeen: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface TappalkaSessionResultRecord {
  winnerPostId: string;
  loserPostId: string;
  processedAt: Date;
}

export interface TappalkaSessionRecord {
  id: string;
  userId: string;
  communityId: string;
  postAId: string;
  postBId: string;
  status: 'pending' | 'processing' | 'consumed';
  storedResult?: unknown;
  consumedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
  expiresAt: Date;
}

export interface TappalkaPersistencePort {
  createSession(input: Record<string, unknown>): Promise<TappalkaSessionRecord>;

  claimPendingSession(
    sessionId: string,
    userId: string,
    processingAt: Date,
  ): Promise<TappalkaSessionRecord | null>;

  findConsumedSession(
    sessionId: string,
    userId: string,
  ): Promise<TappalkaSessionRecord | null>;

  consumeSession(
    sessionId: string,
    result: unknown,
    consumedAt: Date,
    updatedAt: Date,
  ): Promise<void>;

  releaseProcessingSession(sessionId: string, updatedAt: Date): Promise<void>;

  findProgress(
    userId: string,
    communityId: string,
  ): Promise<TappalkaProgressRecord | null>;

  createProgress(input: Record<string, unknown>): Promise<TappalkaProgressRecord>;

  updateProgress(
    userId: string,
    communityId: string,
    update: {
      set?: Record<string, unknown>;
      inc?: Record<string, number>;
    },
  ): Promise<void>;
}
