import { WalletId, UserId, CommunityId } from '../../value-objects';

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
    return new Wallet(
      WalletId.generate(),
      userId,
      communityId,
      initialBalance,
      currency,
      new Date(),
    );
  }

  static fromSnapshot(snapshot: WalletSnapshot): Wallet {
    return new Wallet(
      WalletId.fromString(snapshot.id),
      UserId.fromString(snapshot.userId),
      CommunityId.fromString(snapshot.communityId),
      snapshot.balance,
      snapshot.currency,
      snapshot.lastUpdated,
    );
  }

  // Business operations
  add(amount: number): void {
    if (amount <= 0) throw new Error('Amount must be positive');
    this.balance += amount;
    this.lastUpdated = new Date();
  }

  deduct(amount: number): void {
    if (amount <= 0) throw new Error('Amount must be positive');
    if (this.balance < amount) throw new Error('Insufficient balance');
    this.balance -= amount;
    this.lastUpdated = new Date();
  }

  canAfford(amount: number): boolean {
    return this.balance >= amount;
  }

  get getBalance(): number {
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
