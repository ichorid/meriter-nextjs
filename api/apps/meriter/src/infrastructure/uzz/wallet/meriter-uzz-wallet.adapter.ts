import { randomUUID } from 'crypto';
import { ClientSession, Connection } from 'mongoose';
import {
  UzzWalletBalance,
  UzzWalletOperationInput,
  UzzWalletPort,
  UzzWalletReservation,
} from '../../../application/uzz/ports/uzz-wallet.port';
import { UzzConflictError } from '../../../domain/uzz/errors';

export class MeriterUzzWalletAdapter implements UzzWalletPort {
  constructor(
    private readonly connection: Connection,
    private readonly session: ClientSession | null,
  ) {}

  async getBalances(input: {
    userId: string;
    localCommunityId: string;
    globalCommunityId: string;
  }): Promise<UzzWalletBalance> {
    if (input.localCommunityId === input.globalCommunityId) {
      const wallet = await this.connection.collection('wallets').findOne(
        { userId: input.userId, communityId: input.localCommunityId },
        { session: this.session ?? undefined },
      );
      const localBalance = Number(wallet?.balance ?? 0);
      return {
        localBalance,
        globalBalance: 0,
        totalBalance: localBalance,
        mode: 'shared',
      };
    }
    const [local, global] = await Promise.all([
      this.connection.collection('wallets').findOne(
        { userId: input.userId, communityId: input.localCommunityId },
        { session: this.session ?? undefined },
      ),
      this.connection.collection('wallets').findOne(
        { userId: input.userId, communityId: input.globalCommunityId },
        { session: this.session ?? undefined },
      ),
    ]);
    const localBalance = Number(local?.balance ?? 0);
    const globalBalance = Number(global?.balance ?? 0);
    return {
      localBalance,
      globalBalance,
      totalBalance: localBalance + globalBalance,
      mode: 'split',
    };
  }

  async reservePreferLocal(
    input: UzzWalletOperationInput,
  ): Promise<UzzWalletReservation> {
    return this.debitPreferLocal(input, 'uzz_fee_reserve', 'UZZ fee reserve');
  }

  private async debitPreferLocal(
    input: UzzWalletOperationInput,
    referenceType: 'uzz_fee_reserve' | 'uzz_transfer_send',
    description: string,
  ): Promise<UzzWalletReservation> {
    validateOperation(input.amount, input.operationId);
    const existing = await this.findEffect(input.operationId, referenceType);
    if (existing) {
      return {
        operationId: input.operationId,
        walletId: String(existing.walletId),
        sourceCommunityId: String(existing.description).split(':').at(-1) ?? '',
        amount: Number(existing.amount),
      };
    }

    const communityIds = input.localCommunityId === input.globalCommunityId
      ? [input.localCommunityId]
      : [input.localCommunityId, input.globalCommunityId];
    for (const communityId of communityIds) {
      const wallet = await this.connection.collection('wallets').findOneAndUpdate(
        {
          userId: input.userId,
          communityId,
          balance: { $gte: input.amount },
        },
        { $inc: { balance: -input.amount }, $set: { lastUpdated: new Date() } },
        { returnDocument: 'after', session: this.session ?? undefined },
      );
      if (!wallet) continue;

      await this.insertEffect({
        walletId: String(wallet.id),
        amount: input.amount,
        type: 'withdrawal',
        referenceType,
        referenceId: input.operationId,
        description: `${description}:${communityId}`,
      });
      return {
        operationId: input.operationId,
        walletId: String(wallet.id),
        sourceCommunityId: communityId,
        amount: input.amount,
      };
    }

    throw new UzzConflictError('WALLET_INSUFFICIENT_FUNDS');
  }

  async refundToSource(input: {
    userId: string;
    sourceCommunityId: string;
    amount: number;
    operationId: string;
  }): Promise<void> {
    validateOperation(input.amount, input.operationId);
    if (await this.findEffect(input.operationId, 'uzz_fee_refund')) return;
    const wallet = await this.connection.collection('wallets').findOneAndUpdate(
      { userId: input.userId, communityId: input.sourceCommunityId },
      { $inc: { balance: input.amount }, $set: { lastUpdated: new Date() } },
      { returnDocument: 'after', session: this.session ?? undefined },
    );
    if (!wallet) throw new UzzConflictError('WALLET_NOT_FOUND');
    await this.insertEffect({
      walletId: String(wallet.id),
      amount: input.amount,
      type: 'deposit',
      referenceType: 'uzz_fee_refund',
      referenceId: input.operationId,
      description: `UZZ fee refund:${input.sourceCommunityId}`,
    });
  }

  async transferPreferLocal(
    input: UzzWalletOperationInput & { recipientUserIds: string[] },
  ): Promise<UzzWalletReservation> {
    if (!input.recipientUserIds.length) {
      throw new UzzConflictError('WALLET_OPERATION_INVALID');
    }
    const reserved = await this.debitPreferLocal(
      input,
      'uzz_transfer_send',
      'UZZ transfer send',
    );
    if (await this.findEffect(input.operationId, 'uzz_transfer_receive')) {
      return reserved;
    }
    const recipientWalletId = await this.creditRecipient(
      input.recipientUserIds,
      reserved.sourceCommunityId,
      input.amount,
      reserved.walletId,
    );
    await this.insertEffect({
      walletId: recipientWalletId,
      amount: input.amount,
      type: 'deposit',
      referenceType: 'uzz_transfer_receive',
      referenceId: input.operationId,
      description: `UZZ transfer receive:${reserved.sourceCommunityId}`,
    });
    return reserved;
  }

  /**
   * Credits whichever linked account already holds a wallet in the community;
   * when none exists yet, creates one for the first (canonical) id — the
   * platform creates wallets lazily on first credit, and a thanks transfer
   * must never fail because the recipient has not touched this community yet.
   */
  private async creditRecipient(
    recipientUserIds: string[],
    communityId: string,
    amount: number,
    payerWalletId: string,
  ): Promise<string> {
    const existing = await this.connection.collection('wallets').findOneAndUpdate(
      { userId: { $in: recipientUserIds }, communityId },
      { $inc: { balance: amount }, $set: { lastUpdated: new Date() } },
      { returnDocument: 'after', session: this.session ?? undefined },
    );
    if (existing) return String(existing.id);
    // The payer wallet in this community exists (the debit just went through);
    // reuse its currency for the new recipient wallet.
    const payerWallet = await this.connection.collection('wallets').findOne(
      { id: payerWalletId },
      { session: this.session ?? undefined },
    );
    const now = new Date();
    const walletId = randomUUID();
    await this.connection.collection('wallets').insertOne(
      {
        id: walletId,
        userId: recipientUserIds[0],
        communityId,
        balance: amount,
        currency: payerWallet?.currency
          ?? { singular: 'заслуга', plural: 'заслуги', genitive: 'заслуг' },
        lastUpdated: now,
        createdAt: now,
        updatedAt: now,
      },
      { session: this.session ?? undefined },
    );
    return walletId;
  }

  private async findEffect(operationId: string, referenceType: string) {
    return this.connection.collection('transactions').findOne(
      { referenceType, referenceId: operationId },
      { session: this.session ?? undefined },
    );
  }

  private async insertEffect(input: {
    walletId: string;
    type: 'withdrawal' | 'deposit';
    amount: number;
    description: string;
    referenceType: string;
    referenceId: string;
  }): Promise<void> {
    const now = new Date();
    await this.connection.collection('transactions').insertOne(
      { id: randomUUID(), ...input, createdAt: now, updatedAt: now },
      { session: this.session ?? undefined },
    );
  }
}

function validateOperation(amount: number, operationId: string): void {
  if (!Number.isSafeInteger(amount) || amount <= 0 || !operationId.trim()) {
    throw new UzzConflictError('WALLET_OPERATION_INVALID');
  }
}
