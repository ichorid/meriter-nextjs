export const INVESTMENT_PERSISTENCE_PORT = Symbol('INVESTMENT_PERSISTENCE_PORT');

export type InvestmentPersistenceSession = unknown;

export interface PublicationInvestorRecord {
  investorId: string;
  amount: number;
  investedAt: Date;
  expectedReturn?: number;
  earnings?: number;
  earningsHistory?: Array<{
    amount: number;
    reason: string;
    date: Date;
  }>;
}

export interface PublicationInvestmentRecord {
  id: string;
  title?: string;
  authorId: string;
  communityId: string;
  status?: string;
  investingEnabled?: boolean;
  investmentPool?: number;
  investmentPoolTotal?: number;
  investorSharePercent?: number;
  investments?: PublicationInvestorRecord[];
  createdAt?: Date;
  updatedAt?: Date;
  [key: string]: unknown;
}

export interface PortfolioAggregationRow {
  id: string;
  title?: string;
  communityId?: string;
  authorId?: string;
  status?: string;
  metrics?: { score?: number };
  investmentPool?: number;
  investmentPoolTotal?: number;
  ttlExpiresAt?: Date | null;
  closingSummary?: unknown;
  myInv: PublicationInvestorRecord & {
    updatedAt: Date;
    totalEarnings?: number;
    earningsHistory?: Array<{ amount: number; reason: string; date: Date }>;
  };
}

export interface InvestmentPersistencePort {
  findPublicationById(
    postId: string,
    session?: InvestmentPersistenceSession,
  ): Promise<PublicationInvestmentRecord | null>;

  updatePublication(
    postId: string,
    update: {
      set?: Record<string, unknown>;
      inc?: Record<string, number>;
      push?: Record<string, unknown>;
    },
    session?: InvestmentPersistenceSession,
  ): Promise<void>;

  findPublicationsByInvestor(userId: string): Promise<PublicationInvestmentRecord[]>;

  aggregatePortfolioByInvestor(
    userId: string,
    status?: 'active' | 'closed',
  ): Promise<PortfolioAggregationRow[]>;

  updateInvestorEarnings(
    postId: string,
    investorId: string,
    amount: number,
    reason: string,
    date: Date,
    session?: InvestmentPersistenceSession,
  ): Promise<void>;
}
