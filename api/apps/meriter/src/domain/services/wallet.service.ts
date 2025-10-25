import { Injectable, Logger, BadRequestException, NotFoundException } from '@nestjs/common';
import { WalletRepository } from '../models/wallet/wallet.repository';
import { TransactionRepository } from '../models/transaction/transaction.repository';
import { CommunityRepository } from '../models/community/community.repository';
import { UserRepository } from '../models/user/user.repository';
import { Wallet } from '../models/wallet/wallet.schema';
import { Transaction } from '../models/transaction/transaction.schema';
import { MeritAmount, UserId, CommunityId } from '../value-objects';
import { WalletBalanceChangedEvent } from '../events';
import { EventBus } from '../events/event-bus';
import { v4 as uuidv4 } from 'uuid';

@Injectable()
export class WalletService {
  private readonly logger = new Logger(WalletService.name);

  constructor(
    private walletRepository: WalletRepository,
    private transactionRepository: TransactionRepository,
    private communityRepository: CommunityRepository,
    private userRepository: UserRepository,
    private eventBus: EventBus,
  ) {}

  async getWallet(userId: string, communityId: string): Promise<Wallet | null> {
    return this.walletRepository.findByUserAndCommunity(userId, communityId);
  }

  async getUserWallets(userId: string): Promise<Wallet[]> {
    return this.walletRepository.findByUser(userId);
  }

  async getWalletBalance(userId: string, communityId: string): Promise<number> {
    const wallet = await this.getWallet(userId, communityId);
    return wallet?.balance || 0;
  }

  async createWallet(userId: string, communityId: string): Promise<Wallet> {
    this.logger.log(`Creating wallet: user=${userId}, community=${communityId}`);

    // Validate user and community exist
    const user = await this.userRepository.findById(userId);
    if (!user) {
      throw new NotFoundException('User not found');
    }

    const community = await this.communityRepository.findById(communityId);
    if (!community) {
      throw new NotFoundException('Community not found');
    }

    // Check if wallet already exists
    const existing = await this.getWallet(userId, communityId);
    if (existing) {
      return existing;
    }

    // Create wallet with community currency settings
    const wallet = await this.walletRepository.createOrUpdate(
      userId,
      communityId,
      {
        singular: community.settings.currencyNames.singular,
        plural: community.settings.currencyNames.plural,
        genitive: community.settings.currencyNames.genitive,
      },
      0
    );

    this.logger.log(`Wallet created successfully: ${wallet.id}`);
    return wallet;
  }

  async addMerits(
    userId: string,
    communityId: string,
    amount: number,
    sourceType: 'personal' | 'quota',
    referenceType: string,
    referenceId: string,
    description?: string
  ): Promise<Wallet> {
    this.logger.log(`Adding merits: user=${userId}, amount=${amount}, source=${sourceType}`);

    const wallet = await this.getOrCreateWallet(userId, communityId);

    // Create transaction record
    await this.transactionRepository.create({
      id: uuidv4(),
      walletId: wallet.id,
      type: 'credit',
      amount,
      sourceType,
      referenceType,
      referenceId,
      description,
      createdAt: new Date(),
    });

    // Update wallet balance
    const updated = await this.walletRepository.updateBalance(wallet.id, amount);
    if (!updated) {
      throw new NotFoundException('Failed to update wallet');
    }

    // Publish event
    await this.eventBus.publish(
      new WalletBalanceChangedEvent(wallet.id, userId, communityId, amount, 'credit')
    );

    return updated;
  }

  async deductMerits(
    userId: string,
    communityId: string,
    amount: number,
    sourceType: 'personal' | 'quota',
    referenceType: string,
    referenceId: string,
    description?: string
  ): Promise<Wallet> {
    this.logger.log(`Deducting merits: user=${userId}, amount=${amount}, source=${sourceType}`);

    const wallet = await this.getOrCreateWallet(userId, communityId);

    // Check balance
    if (wallet.balance < amount) {
      throw new BadRequestException('Insufficient balance');
    }

    // Create transaction record
    await this.transactionRepository.create({
      id: uuidv4(),
      walletId: wallet.id,
      type: 'debit',
      amount,
      sourceType,
      referenceType,
      referenceId,
      description,
      createdAt: new Date(),
    });

    // Update wallet balance
    const updated = await this.walletRepository.updateBalance(wallet.id, -amount);
    if (!updated) {
      throw new NotFoundException('Failed to update wallet');
    }

    // Publish event
    await this.eventBus.publish(
      new WalletBalanceChangedEvent(wallet.id, userId, communityId, amount, 'debit')
    );

    return updated;
  }

  async getTransactions(walletId: string, limit: number = 50, skip: number = 0): Promise<Transaction[]> {
    return this.transactionRepository.findByWallet(walletId, limit, skip);
  }

  private async getOrCreateWallet(userId: string, communityId: string): Promise<Wallet> {
    let wallet = await this.getWallet(userId, communityId);
    
    if (!wallet) {
      wallet = await this.createWallet(userId, communityId);
    }

    return wallet;
  }
}
