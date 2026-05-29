import {
  Injectable,
  NotFoundException,
  BadRequestException,
  Inject,
} from '@nestjs/common';
import type { CommunityWallet } from '../models/community-wallet/community-wallet.schema';
import { uid } from 'uid';
import {
  COMMUNITY_WALLET_PERSISTENCE_PORT,
  type CommunityWalletPersistencePort,
} from '../ports/community-wallet.persistence.port';

@Injectable()
export class CommunityWalletService {
  constructor(
    @Inject(COMMUNITY_WALLET_PERSISTENCE_PORT)
    private readonly communityWalletPersistence: CommunityWalletPersistencePort,
  ) {}

  /**
   * Create a wallet for a community (e.g. project). Idempotent: if wallet exists, return it.
   */
  async createWallet(communityId: string): Promise<CommunityWallet> {
    const existing = await this.communityWalletPersistence.findByCommunityId(
      communityId,
    );
    if (existing) {
      return existing as unknown as CommunityWallet;
    }
    const doc = await this.communityWalletPersistence.createWallet({
      id: uid(),
      communityId,
      balance: 0,
      totalReceived: 0,
      totalDistributed: 0,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    return doc as unknown as CommunityWallet;
  }

  /**
   * Get wallet by community ID.
   */
  async getWallet(communityId: string): Promise<CommunityWallet | null> {
    const doc = await this.communityWalletPersistence.findByCommunityId(
      communityId,
    );
    return doc ? (doc as unknown as CommunityWallet) : null;
  }

  /**
   * Get balance for a community wallet. Returns 0 if no wallet.
   */
  async getBalance(communityId: string): Promise<number> {
    const wallet = await this.getWallet(communityId);
    return wallet?.balance ?? 0;
  }

  /**
   * Atomic deposit: increment balance and totalReceived.
   */
  async deposit(
    communityId: string,
    amount: number,
    _reason?: string,
  ): Promise<CommunityWallet> {
    if (amount <= 0) {
      throw new BadRequestException('Deposit amount must be positive');
    }
    const doc = await this.communityWalletPersistence.deposit(
      communityId,
      amount,
      new Date(),
    );
    if (!doc) {
      throw new NotFoundException(
        `CommunityWallet not found for community ${communityId}`,
      );
    }
    return doc as unknown as CommunityWallet;
  }

  /**
   * Deduct from balance only (operational cost, e.g. postCost). Does not change totalDistributed.
   */
  async deductBalance(
    communityId: string,
    amount: number,
    _reason?: string,
  ): Promise<CommunityWallet> {
    if (amount <= 0) {
      throw new BadRequestException('Amount must be positive');
    }
    const doc = await this.communityWalletPersistence.deductBalance(
      communityId,
      amount,
      new Date(),
    );
    if (!doc) {
      const wallet = await this.getWallet(communityId);
      const balance = wallet?.balance ?? 0;
      throw new BadRequestException(
        `Insufficient balance: have ${balance}, need ${amount}`,
      );
    }
    return doc as unknown as CommunityWallet;
  }

  /**
   * Atomic debit: decrement balance and increment totalDistributed only if balance >= amount.
   */
  async debit(
    communityId: string,
    amount: number,
    _reason?: string,
  ): Promise<CommunityWallet> {
    if (amount <= 0) {
      throw new BadRequestException('Debit amount must be positive');
    }
    const doc = await this.communityWalletPersistence.debit(
      communityId,
      amount,
      new Date(),
    );
    if (!doc) {
      const wallet = await this.getWallet(communityId);
      const balance = wallet?.balance ?? 0;
      throw new BadRequestException(
        `Insufficient balance: have ${balance}, need ${amount}`,
      );
    }
    return doc as unknown as CommunityWallet;
  }

  /**
   * Increment only totalDistributed (transit flow: distribution to members; balance unchanged).
   */
  async addTotalDistributed(
    communityId: string,
    amount: number,
  ): Promise<CommunityWallet> {
    if (amount <= 0) {
      throw new BadRequestException('Amount must be positive');
    }
    const doc = await this.communityWalletPersistence.addTotalDistributed(
      communityId,
      amount,
      new Date(),
    );
    if (!doc) {
      throw new NotFoundException(
        `CommunityWallet not found for community ${communityId}`,
      );
    }
    return doc as unknown as CommunityWallet;
  }
}
