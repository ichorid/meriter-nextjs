import type { WalletSnapshot } from '../aggregates/wallet/wallet.entity';
import type {
  MeritHistoryDashboardPeriodDays,
  MeritHistoryFilterKey,
} from '../common/helpers/wallet-transaction-history';

/** Opaque persistence session handle (Mongoose ClientSession in adapter). */
export type WalletPersistenceSession = unknown;

export const WALLET_PERSISTENCE_PORT = Symbol('WALLET_PERSISTENCE_PORT');

export interface WalletTransactionRecord {
  id: string;
  walletId: string;
  type: 'vote' | 'comment' | 'poll_cast' | 'withdrawal' | 'deposit';
  amount: number;
  description: string;
  referenceType?: string;
  referenceId?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateWalletTransactionInput {
  id: string;
  walletId: string;
  type: WalletTransactionRecord['type'];
  amount: number;
  description: string;
  referenceType: string;
  referenceId: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface WalletOwnerRef {
  id: string;
  userId: string;
}

export interface MeritHistoryDashboardKpisRecord {
  inflow: number;
  outflow: number;
  net: number;
  count: number;
}

export interface MeritHistoryDashboardSeriesPointRecord {
  date: string;
  net: number;
}

export interface MeritHistoryDashboardBreakdownRowRecord {
  category: Exclude<MeritHistoryFilterKey, 'all'>;
  net: number;
  grossVolume: number;
  count: number;
}

export interface MeritHistoryDashboardAggregateResult {
  kpis: MeritHistoryDashboardKpisRecord;
  series: MeritHistoryDashboardSeriesPointRecord[];
  breakdown?: MeritHistoryDashboardBreakdownRowRecord[];
}

export interface CommunityMeritHistoryQueryResult {
  data: WalletTransactionRecord[];
  total: number;
  walletOwnerByTxId: Map<string, string>;
}

/**
 * WalletPersistencePort — BC-02 wallet + transaction ledger persistence (Phase 9 partial).
 *
 * Domain services depend on this port; Mongoose schemas and mappers live under
 * infrastructure/persistence only.
 */
export interface WalletPersistencePort {
  startSession(): Promise<WalletPersistenceSession>;

  findWalletByUserAndCommunity(
    userId: string,
    communityId: string,
  ): Promise<WalletSnapshot | null>;

  insertWallet(snapshot: WalletSnapshot, session?: WalletPersistenceSession): Promise<void>;

  updateWallet(snapshot: WalletSnapshot, session?: WalletPersistenceSession): Promise<void>;

  /**
   * Atomic conditional debit: decrements balance only when it is sufficient.
   * Returns the updated snapshot, or null when the wallet is missing or balance < amount.
   */
  debitWalletIfSufficient(
    userId: string,
    communityId: string,
    amount: number,
    session?: WalletPersistenceSession,
  ): Promise<WalletSnapshot | null>;

  deleteWalletById(walletId: string): Promise<void>;

  findWalletsByUserId(userId: string): Promise<WalletSnapshot[]>;

  findGlobalWalletIdByUserId(userId: string): Promise<string | null>;

  findWalletOwnersByCommunityId(communityId: string): Promise<WalletOwnerRef[]>;

  hasPositiveBalanceForCommunity(communityId: string): Promise<boolean>;

  findWalletOwnersByIds(walletIds: string[]): Promise<WalletOwnerRef[]>;

  findTransactionByWalletAndReferenceType(
    walletId: string,
    referenceType: string,
  ): Promise<WalletTransactionRecord | null>;

  insertTransaction(
    input: CreateWalletTransactionInput,
    session?: WalletPersistenceSession,
  ): Promise<void>;

  deleteTransactionsByWalletId(walletId: string): Promise<void>;

  findTransactionsByWalletId(
    walletId: string,
    limit: number,
    skip: number,
  ): Promise<WalletTransactionRecord[]>;

  countMeritHistoryTransactions(
    walletId: string,
    category: MeritHistoryFilterKey,
  ): Promise<number>;

  findMeritHistoryTransactions(
    walletId: string,
    category: MeritHistoryFilterKey,
    limit: number,
    skip: number,
  ): Promise<WalletTransactionRecord[]>;

  sumWithdrawnByReference(referenceType: string, referenceId: string): Promise<number>;

  sumProjectInvestorPayoutCredits(
    walletId: string,
    projectIds: string[],
  ): Promise<Map<string, number>>;

  aggregateMeritHistoryDashboard(
    walletId: string,
    category: MeritHistoryFilterKey,
    periodDays: MeritHistoryDashboardPeriodDays,
  ): Promise<MeritHistoryDashboardAggregateResult>;

  findCommunityMeritHistoryTransactions(
    contextCommunityId: string,
    category: MeritHistoryFilterKey,
    limit: number,
    skip: number,
  ): Promise<CommunityMeritHistoryQueryResult>;
}
