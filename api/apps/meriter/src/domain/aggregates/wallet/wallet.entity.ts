import { WalletId, UserId, CommunityId } from '../../value-objects';
import { GLOBAL_COMMUNITY_ID } from '../../common/constants/global.constant';

export interface WalletSnapshot {
  id: string;
  userId: string;
  communityId: string;
  balance: number;
  currency: {
    singular: string;
    plural: string;
    genitive: string;
  };
  lastUpdated: Date;
}

export class Wallet {
  private constructor(
    private readonly id: WalletId,
    private readonly userId: UserId,
    private readonly communityId: CommunityId,
    private balance: number,
    private readonly currency: { singular: string; plural: string; genitive: string },
    private lastUpdated: Date,
  ) {}

  static create(
    userId: UserId,
    communityId: CommunityId,
    currency: { singular: string; plural: string; genitive: string },
    initialBalance: number = 0,
  ): Wallet {
    const bal =
      communityId.getValue() === GLOBAL_COMMUNITY_ID
        ? Wallet.normalizeGlobalBalance(initialBalance)
        : initialBalance;
    return new Wallet(
      WalletId.generate(),
      userId,
      communityId,
      bal,
      currency,
      new Date(),
    );
  }

  static fromSnapshot(snapshot: WalletSnapshot): Wallet {
    const balance =
      snapshot.communityId === GLOBAL_COMMUNITY_ID
        ? Wallet.normalizeGlobalBalance(snapshot.balance)
        : snapshot.balance;
    return new Wallet(
      WalletId.fromString(snapshot.id),
      UserId.fromString(snapshot.userId),
      CommunityId.fromString(snapshot.communityId),
      balance,
      snapshot.currency,
      snapshot.lastUpdated,
    );
  }

  /** Global merits wallet: single decimal place max (stable storage and arithmetic). */
  private static normalizeGlobalBalance(balance: number): number {
    const n = Number(balance);
    if (!Number.isFinite(n)) return 0;
    return Math.round((n + Number.EPSILON) * 10) / 10;
  }

  private applyGlobalBalanceNormalization(): void {
    if (this.communityId.getValue() !== GLOBAL_COMMUNITY_ID) return;
    this.balance = Wallet.normalizeGlobalBalance(this.balance);
  }

  // Business operations
  add(amount: number): void {
    if (amount <= 0) throw new Error('Amount must be positive');
    this.balance += amount;
    this.applyGlobalBalanceNormalization();
    this.lastUpdated = new Date();
  }

  deduct(amount: number): void {
    if (amount <= 0) throw new Error('Amount must be positive');
    this.applyGlobalBalanceNormalization();
    if (this.balance < amount) throw new Error('Insufficient balance');
    this.balance -= amount;
    this.applyGlobalBalanceNormalization();
    this.lastUpdated = new Date();
  }

  canAfford(amount: number): boolean {
    return this.balance >= amount;
  }

  getBalance(): number {
    return this.balance;
  }

  get getId(): WalletId {
    return this.id;
  }

  get getUserId(): UserId {
    return this.userId;
  }

  get getCommunityId(): CommunityId {
    return this.communityId;
  }

  toSnapshot(): WalletSnapshot {
    return {
      id: this.id.getValue(),
      userId: this.userId.getValue(),
      communityId: this.communityId.getValue(),
      balance: this.balance,
      currency: this.currency,
      lastUpdated: this.lastUpdated,
    };
  }
}
