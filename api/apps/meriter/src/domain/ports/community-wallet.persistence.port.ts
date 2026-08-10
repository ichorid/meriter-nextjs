export const COMMUNITY_WALLET_PERSISTENCE_PORT = Symbol('COMMUNITY_WALLET_PERSISTENCE_PORT');

export interface CommunityWalletRecord {
  id: string;
  communityId: string;
  balance: number;
  totalReceived: number;
  totalDistributed: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateCommunityWalletInput {
  id: string;
  communityId: string;
  balance: number;
  totalReceived: number;
  totalDistributed: number;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * CommunityWalletPersistencePort — project/community operational wallet (V-12).
 */
export interface CommunityWalletPersistencePort {
  findByCommunityId(communityId: string): Promise<CommunityWalletRecord | null>;

  createWallet(input: CreateCommunityWalletInput): Promise<CommunityWalletRecord>;

  deposit(communityId: string, amount: number, updatedAt: Date): Promise<CommunityWalletRecord | null>;

  deductBalance(
    communityId: string,
    amount: number,
    updatedAt: Date,
  ): Promise<CommunityWalletRecord | null>;

  debit(communityId: string, amount: number, updatedAt: Date): Promise<CommunityWalletRecord | null>;

  addTotalDistributed(
    communityId: string,
    amount: number,
    updatedAt: Date,
  ): Promise<CommunityWalletRecord | null>;
}
