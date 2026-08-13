import { MongoMemoryReplSet } from 'mongodb-memory-server';
import { Connection, createConnection } from 'mongoose';
import { SendDealThanksUseCase } from '../src/application/uzz/use-cases/send-deal-thanks.use-case';
import { Deal, DealSnapshot } from '../src/domain/uzz/entities/deal';
import { TransactionSchema } from '../src/domain/models/transaction/transaction.schema';
import { WalletSchema } from '../src/domain/models/wallet/wallet.schema';
import {
  createMongooseUzzRepositories,
  initializeUzzModels,
} from '../src/infrastructure/uzz/persistence/mongoose-uzz-repositories';
import { MongooseUzzUnitOfWork } from '../src/infrastructure/uzz/persistence/mongoose-uzz-unit-of-work';
import { createMongoMemoryReplSetWithRetry } from './mongo-memory-shared';
import { unregisterReplSet } from './mongo-memory-registry.js';

const NOW = new Date('2026-08-14T00:00:00.000Z');
const LOCAL = 'community-1';
const GLOBAL = 'global';

describe('UZZ deal thanks', () => {
  jest.setTimeout(60_000);
  let replSet: MongoMemoryReplSet;
  let connection: Connection;
  let rawDb: NonNullable<Connection['db']>;
  let thanks: SendDealThanksUseCase;

  beforeAll(async () => {
    replSet = await createMongoMemoryReplSetWithRetry();
    connection = await createConnection(replSet.getUri()).asPromise();
    if (!connection.db) throw new Error('Mongo database unavailable');
    rawDb = connection.db;
    connection.model('WalletThanksTest', WalletSchema);
    connection.model('TransactionThanksTest', TransactionSchema);
    await initializeUzzModels(connection);
    await Promise.all(Object.values(connection.models).map((model) => model.init()));
    thanks = new SendDealThanksUseCase(new MongooseUzzUnitOfWork(connection), GLOBAL);
  });

  beforeEach(async () => {
    const repositories = createMongooseUzzRepositories(connection, null);
    await repositories.deals.insert(Deal.restore(closedDeal()));
    await seedWallet('buyer-local', 'buyer-1', LOCAL, 5);
    await seedWallet('buyer-global', 'buyer-1', GLOBAL, 5);
    await seedWallet('seller-local', 'seller-1', LOCAL, 0);
    await seedWallet('seller-global', 'seller-1', GLOBAL, 0);
  });

  afterEach(async () => {
    const collections = await rawDb.listCollections().toArray();
    await Promise.all(collections.map(({ name }) => rawDb.collection(name).deleteMany({})));
  });
  afterAll(async () => {
    await connection.close();
    unregisterReplSet(replSet);
    await replSet.stop();
  });

  it('N: transfers thanks from the local wallet', async () => {
    await thanks.execute({
      commandId: 'thanks-local-transfer', dealId: 'deal-1', actorUserId: 'buyer-1',
      merits: 2, comment: 'Thank you', now: NOW,
    });
    expect(await balance('buyer-1', LOCAL)).toBe(3);
    expect(await balance('seller-1', LOCAL)).toBe(2);
    const walletEffects = await rawDb.collection('transactions')
      .find({ referenceId: 'thanks-local-transfer:transfer' }).toArray();
    expect(walletEffects.map((entry) => entry.referenceType).sort()).toEqual([
      'uzz_transfer_receive', 'uzz_transfer_send',
    ]);
    const ledger = await rawDb.collection('uzz_ledger').find({ operationId: 'thanks-local-transfer' }).toArray();
    expect(ledger).toEqual(expect.arrayContaining([
      expect.objectContaining({ userId: 'buyer-1', type: 'thanks_sent', amount: -2 }),
      expect.objectContaining({ userId: 'seller-1', type: 'thanks_received', amount: 2 }),
    ]));
  });

  it('U: records incoming thanks for the recipient', async () => {
    await thanks.execute({
      commandId: 'thanks-recipient-ledger', dealId: 'deal-1', actorUserId: 'buyer-1',
      merits: 1, comment: 'Thank you', now: NOW,
    });
    await expect(
      rawDb.collection('uzz_ledger').findOne({
        operationId: 'thanks-recipient-ledger',
        userId: 'seller-1',
        type: 'thanks_received',
      }),
    ).resolves.toMatchObject({ amount: 1 });
  });

  it('falls back to the global wallet without touching the local wallet', async () => {
    await rawDb.collection('wallets').updateOne(
      { userId: 'buyer-1', communityId: LOCAL }, { $set: { balance: 0 } },
    );
    await thanks.execute({
      commandId: 'thanks-global-transfer', dealId: 'deal-1', actorUserId: 'buyer-1',
      merits: 2, comment: '', now: NOW,
    });
    expect(await balance('buyer-1', LOCAL)).toBe(0);
    expect(await balance('buyer-1', GLOBAL)).toBe(3);
    expect(await balance('seller-1', GLOBAL)).toBe(2);
  });

  it('allows a comment-only optional thanks without wallet effects', async () => {
    await thanks.execute({
      commandId: 'thanks-comment-only', dealId: 'deal-1', actorUserId: 'buyer-1',
      merits: 0, comment: 'Very helpful', now: NOW,
    });
    expect(await balance('buyer-1', LOCAL)).toBe(5);
    expect(await rawDb.collection('transactions').countDocuments()).toBe(0);
  });

  it('replays the same command without a second transfer and rejects a second thanks', async () => {
    const command = {
      commandId: 'thanks-replay-once', dealId: 'deal-1', actorUserId: 'buyer-1',
      merits: 1, comment: 'Thanks', now: NOW,
    };
    const first = await thanks.execute(command);
    expect(await thanks.execute(command)).toEqual(first);
    await expect(thanks.execute({ ...command, commandId: 'thanks-another-command' }))
      .rejects.toMatchObject({ code: 'DEAL_BUYER_ALREADY_THANKED' });
    expect(await balance('buyer-1', LOCAL)).toBe(4);
  });

  it('rolls back the thanks marker when funds are insufficient', async () => {
    await rawDb.collection('wallets').updateMany({ userId: 'buyer-1' }, { $set: { balance: 0 } });
    await expect(thanks.execute({
      commandId: 'thanks-insufficient', dealId: 'deal-1', actorUserId: 'buyer-1',
      merits: 1, comment: '', now: NOW,
    })).rejects.toMatchObject({ code: 'WALLET_INSUFFICIENT_FUNDS' });
    const deal = await createMongooseUzzRepositories(connection, null).deals.findById('deal-1');
    expect(deal?.snapshot().buyerThankedAt).toBeNull();
    expect(await rawDb.collection('uzz_ledger').countDocuments()).toBe(0);
  });

  async function seedWallet(id: string, userId: string, communityId: string, value: number) {
    await rawDb.collection('wallets').insertOne({
      id, userId, communityId, balance: value,
      currency: { singular: 'merit', plural: 'merits', genitive: 'merits' },
      lastUpdated: NOW, createdAt: NOW, updatedAt: NOW,
    });
  }

  async function balance(userId: string, communityId: string) {
    return (await rawDb.collection('wallets').findOne({ userId, communityId }))?.balance;
  }
});

function closedDeal(): DealSnapshot {
  return {
    id: 'deal-1', communityId: LOCAL, buyerId: 'buyer-1', sellerId: 'seller-1',
    listingId: 'listing-1', exchangeRightId: 'right-1', status: 'closed',
    requestMessage: 'Need help', listingSnapshot: {
      title: 'Prepare report', priceRub: 500, deliveryMode: 'online', locationText: 'Zoom',
    },
    requestedDeadlineAt: null, agreedDeadlineAt: null, acceptedNominalRub: 500,
    dealAmountRub: 500, requestExpiresAt: new Date('2026-08-16T00:00:00Z'),
    fulfillmentExpiresAt: new Date('2026-08-21T00:00:00Z'),
    confirmationExpiresAt: new Date('2026-08-28T00:00:00Z'),
    buyerContact: { telegramUsername: 'buyer' },
    sellerContact: { telegramUsername: 'seller' },
    feeReserved: true, feeSourceCommunityId: LOCAL, adminResolutionReason: null,
    requestedAt: NOW, acceptedAt: NOW, completedBySellerAt: NOW, closedAt: NOW,
    rejectedAt: null, cancelledAt: null, buyerThankedAt: null, sellerThankedAt: null,
    buyerThanksComment: null, sellerThanksComment: null,
    buyerThanksMerits: null, sellerThanksMerits: null,
    version: 0, createdAt: NOW, updatedAt: NOW,
  };
}
