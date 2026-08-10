export const MERIT_TRANSFER_PERSISTENCE_PORT = Symbol(
  'MERIT_TRANSFER_PERSISTENCE_PORT',
);

export type MeritTransferPersistenceSession = unknown;

export interface MeritTransferRecord {
  id: string;
  senderId: string;
  receiverId: string;
  amount: number;
  communityContextId: string;
  comment?: string;
  sourceWalletType: 'global' | 'community' | 'project';
  sourceContextId?: string;
  targetWalletType: 'global' | 'community' | 'project';
  targetContextId?: string;
  eventPostId?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface MeritTransferPersistencePort {
  create(
    input: MeritTransferRecord,
    session?: MeritTransferPersistenceSession,
  ): Promise<MeritTransferRecord>;

  findMany(
    filter: Record<string, unknown>,
    options: {
      skip: number;
      limit: number;
      sort: Record<string, 1 | -1>;
    },
  ): Promise<MeritTransferRecord[]>;

  count(filter: Record<string, unknown>): Promise<number>;

  runInTransaction<T>(
    operation: (session: MeritTransferPersistenceSession) => Promise<T>,
  ): Promise<T>;
}
