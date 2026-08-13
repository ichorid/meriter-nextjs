import { MongoMemoryReplSet } from 'mongodb-memory-server';
import { Connection, createConnection } from 'mongoose';
import { UzzAccessPolicy } from '../src/application/uzz/policies/uzz-access-policy';
import { AcceptDealUseCase } from '../src/application/uzz/use-cases/accept-deal.use-case';
import { AdminResolveDealUseCase } from '../src/application/uzz/use-cases/admin-resolve-deal.use-case';
import { CloseDealUseCase } from '../src/application/uzz/use-cases/close-deal.use-case';
import { MarkDealCompletedUseCase } from '../src/application/uzz/use-cases/mark-deal-completed.use-case';
import { RequestDealUseCase } from '../src/application/uzz/use-cases/request-deal.use-case';
import { ExchangeRight } from '../src/domain/uzz/entities/exchange-right';
import { Listing } from '../src/domain/uzz/entities/listing';
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

describe('UZZ deal use cases', () => {
  jest.setTimeout(60_000);
  let replSet: MongoMemoryReplSet;
  let connection: Connection;
  let rawDb: NonNullable<Connection['db']>;
  let uow: MongooseUzzUnitOfWork;
  let request: RequestDealUseCase;
  let accept: AcceptDealUseCase;
  let complete: MarkDealCompletedUseCase;
  let close: CloseDealUseCase;
  let adminResolve: AdminResolveDealUseCase;

  beforeAll(async () => {
    replSet = await createMongoMemoryReplSetWithRetry();
    connection = await createConnection(replSet.getUri()).asPromise();
    if (!connection.db) throw new Error('Mongo database unavailable');
    rawDb = connection.db;
    connection.model('WalletDealTest', WalletSchema);
    connection.model('TransactionDealTest', TransactionSchema);
    await initializeUzzModels(connection);
    await Promise.all(Object.values(connection.models).map((model) => model.init()));
    uow = new MongooseUzzUnitOfWork(connection);
    const access = new UzzAccessPolicy({
      async isAnyMember() {
        return true;
      },
    });
    request = new RequestDealUseCase(uow, access, 'global');
    accept = new AcceptDealUseCase(uow, access);
    complete = new MarkDealCompletedUseCase(uow);
    close = new CloseDealUseCase(uow);
    adminResolve = new AdminResolveDealUseCase(uow, {
      async assertCommunityAdmin(_communityId, userId) {
        if (userId !== 'admin-1') throw new Error('ADMIN_REQUIRED');
      },
    });
  });

  beforeEach(async () => {
    const repositories = createMongooseUzzRepositories(connection, null);
    for (const [id, email, telegramUserId, username] of [
      ['buyer-1', 'buyer@example.com', '1001', 'buyer'],
      ['seller-1', 'seller@example.com', '1002', 'seller'],
    ]) {
      await repositories.identities.insert({
        id: `identity-${id}`,
        canonicalUserId: id,
        normalizedEmail: email,
        telegramUserId,
        telegramUsername: username,
        createdAt: NOW,
        updatedAt: NOW,
        version: 0,
      });
    }
    await repositories.listings.insert(
      Listing.create({
        id: 'listing-1', communityId: 'community-1', authorId: 'seller-1',
        title: 'Настрою отчёт', description: '', priceRub: 500,
        deliveryMode: 'online', locationText: 'Zoom', durationText: '',
        availabilityText: '', now: NOW,
      }),
    );
    await repositories.rights.insert(
      ExchangeRight.restore({
        id: 'right-1', communityId: 'community-1', ownerId: 'buyer-1',
        sourcePublicationId: 'publication-1', nominalRub: 500,
        nominalAssignedAt: NOW, lastDemurrageAt: NOW, hopsLeft: 2,
        status: 'active', lockedByDealId: null, ownerHistory: [], version: 0,
        createdAt: NOW, updatedAt: NOW,
      }),
    );
    await rawDb.collection('wallets').insertOne({
      id: 'wallet-1', userId: 'buyer-1', communityId: 'community-1', balance: 1,
      currency: { singular: 'заслуга', plural: 'заслуги', genitive: 'заслуг' },
      lastUpdated: NOW, createdAt: NOW, updatedAt: NOW,
    });
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

  it('rejects accept after requestExpiresAt even before cron', async () => {
    const deal = await createRequest();
    await expect(
      accept.execute({
        commandId: 'accept-expired', dealId: deal.id, sellerId: 'seller-1',
        expectedNominalRub: 500, agreedDeadlineAt: null,
        now: new Date('2026-08-17T00:00:01.000Z'),
      }),
    ).rejects.toMatchObject({ code: 'DEAL_REQUEST_EXPIRED' });
  });

  it('requires nominal reconfirmation after demurrage', async () => {
    const deal = await createRequest();
    await rawDb.collection('uzz_rights').updateOne(
      { id: 'right-1' }, { $set: { nominalRub: 400 } },
    );
    await expect(
      accept.execute({
        commandId: 'accept-changed', dealId: deal.id, sellerId: 'seller-1',
        expectedNominalRub: 500, agreedDeadlineAt: null, now: new Date('2026-08-14T01:00:00Z'),
      }),
    ).rejects.toMatchObject({
      code: 'NOMINAL_CHANGED', details: { currentNominalRub: 400 },
    });
  });

  it('atomically closes the deal, transfers the right, and decrements one hop', async () => {
    const deal = await createRequest();
    await accept.execute({
      commandId: 'accept-1', dealId: deal.id, sellerId: 'seller-1',
      expectedNominalRub: 500, agreedDeadlineAt: null, now: new Date('2026-08-14T01:00:00Z'),
    });
    await complete.execute({
      commandId: 'complete-1', dealId: deal.id, sellerId: 'seller-1',
      now: new Date('2026-08-14T02:00:00Z'),
    });
    const closed = await close.execute({
      commandId: 'close-1', dealId: deal.id, buyerId: 'buyer-1',
      now: new Date('2026-08-14T03:00:00Z'),
    });
    const right = await createMongooseUzzRepositories(connection, null).rights.findById('right-1');
    expect(closed).toMatchObject({ status: 'closed', dealAmountRub: 500 });
    expect(right?.snapshot()).toMatchObject({
      ownerId: 'seller-1', hopsLeft: 1, status: 'active', lockedByDealId: null,
    });
    const ledger = await rawDb.collection('uzz_ledger').find({}).toArray();
    expect(ledger.map((entry) => entry.type)).toEqual(expect.arrayContaining([
      'fee_reserved', 'deal_requested', 'deal_accepted', 'deal_completed',
      'right_sent', 'right_received', 'deal_closed',
    ]));
  });

  it('requires a meaningful reason for an administrative resolution', async () => {
    const deal = await createRequest();
    await expect(adminResolve.execute({
      commandId: 'admin-cancel-short', dealId: deal.id, adminId: 'admin-1',
      outcome: 'cancel', reason: 'short', now: new Date('2026-08-14T01:00:00Z'),
    })).rejects.toMatchObject({ code: 'ADMIN_RESOLUTION_REASON_INVALID' });
  });

  it('admin cancellation unlocks the right and refunds the original fee source', async () => {
    const deal = await createRequest();
    await accept.execute({
      commandId: 'accept-admin-cancel', dealId: deal.id, sellerId: 'seller-1',
      expectedNominalRub: 500, agreedDeadlineAt: null, now: new Date('2026-08-14T01:00:00Z'),
    });
    const cancelled = await adminResolve.execute({
      commandId: 'admin-cancel-accepted', dealId: deal.id, adminId: 'admin-1',
      outcome: 'cancel', reason: 'Исполнитель и заказчик договорились об отмене',
      now: new Date('2026-08-14T02:00:00Z'),
    });
    const right = await createMongooseUzzRepositories(connection, null).rights.findById('right-1');
    const wallet = await rawDb.collection('wallets').findOne({ id: 'wallet-1' });
    const ledger = await rawDb.collection('uzz_ledger').find({ operationId: 'admin-cancel-accepted' }).toArray();
    expect(cancelled).toMatchObject({ status: 'cancelled', feeReserved: false });
    expect(right?.snapshot()).toMatchObject({ status: 'active', lockedByDealId: null, ownerId: 'buyer-1' });
    expect(wallet?.balance).toBe(1);
    expect(ledger.map((entry) => entry.type)).toEqual(expect.arrayContaining([
      'fee_refunded', 'admin_resolution',
    ]));
  });

  async function createRequest() {
    return request.execute({
      commandId: 'request-1', communityId: 'community-1', buyerId: 'buyer-1',
      listingId: 'listing-1', exchangeRightId: 'right-1',
      requestMessage: 'Нужна помощь с отчётом', requestedDeadlineAt: null, now: NOW,
    });
  }
});
