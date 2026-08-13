import { MongoMemoryReplSet } from 'mongodb-memory-server';
import { Connection, createConnection } from 'mongoose';
import { UzzAccessPolicy } from '../src/application/uzz/policies/uzz-access-policy';
import { Clock } from '../src/application/uzz/ports/clock.port';
import { AcceptDealUseCase } from '../src/application/uzz/use-cases/accept-deal.use-case';
import { ApplyDemurrageUseCase } from '../src/application/uzz/use-cases/apply-demurrage.use-case';
import { ExpireDealsUseCase } from '../src/application/uzz/use-cases/expire-deals.use-case';
import { MarkDealCompletedUseCase } from '../src/application/uzz/use-cases/mark-deal-completed.use-case';
import { RequestDealUseCase } from '../src/application/uzz/use-cases/request-deal.use-case';
import { UpdateSettingsUseCase } from '../src/application/uzz/use-cases/update-settings.use-case';
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

const START = new Date('2026-08-14T00:00:00.000Z');

class MutableClock implements Clock {
  constructor(private current: Date) {}
  now() { return new Date(this.current); }
  set(value: string) { this.current = new Date(value); }
}

describe('UZZ time policies', () => {
  jest.setTimeout(60_000);
  let replSet: MongoMemoryReplSet;
  let connection: Connection;
  let rawDb: NonNullable<Connection['db']>;
  let uow: MongooseUzzUnitOfWork;
  let clock: MutableClock;
  let request: RequestDealUseCase;
  let accept: AcceptDealUseCase;
  let complete: MarkDealCompletedUseCase;
  let updateSettings: UpdateSettingsUseCase;
  let demurrage: ApplyDemurrageUseCase;
  let expiry: ExpireDealsUseCase;

  beforeAll(async () => {
    replSet = await createMongoMemoryReplSetWithRetry();
    connection = await createConnection(replSet.getUri()).asPromise();
    if (!connection.db) throw new Error('Mongo database unavailable');
    rawDb = connection.db;
    connection.model('WalletTimeTest', WalletSchema);
    connection.model('TransactionTimeTest', TransactionSchema);
    await initializeUzzModels(connection);
    await Promise.all(Object.values(connection.models).map((model) => model.init()));
    uow = new MongooseUzzUnitOfWork(connection);
    clock = new MutableClock(START);
    const access = new UzzAccessPolicy({ async isAnyMember() { return true; } });
    const admin = { async assertCommunityAdmin() { return; } };
    request = new RequestDealUseCase(uow, access, 'global');
    accept = new AcceptDealUseCase(uow, access);
    complete = new MarkDealCompletedUseCase(uow);
    updateSettings = new UpdateSettingsUseCase(uow, admin, clock);
    demurrage = new ApplyDemurrageUseCase(uow, clock);
    expiry = new ExpireDealsUseCase(uow, clock);
  });

  beforeEach(async () => {
    clock.set(START.toISOString());
    const repositories = createMongooseUzzRepositories(connection, null);
    for (const [id, email, telegramUserId, username] of [
      ['buyer-1', 'buyer@example.com', '1001', 'buyer'],
      ['seller-1', 'seller@example.com', '1002', 'seller'],
    ]) {
      await repositories.identities.insert({
        id: `identity-${id}`, canonicalUserId: id, normalizedEmail: email,
        telegramUserId, telegramUsername: username, createdAt: START,
        updatedAt: START, version: 0,
      });
    }
    await repositories.listings.insert(Listing.create({
      id: 'listing-1', communityId: 'community-1', authorId: 'seller-1',
      title: 'Prepare report', description: '', priceRub: 500,
      deliveryMode: 'online', locationText: 'Zoom', durationText: '',
      availabilityText: '', now: START,
    }));
    await repositories.rights.insert(ExchangeRight.restore({
      id: 'right-1', communityId: 'community-1', ownerId: 'buyer-1',
      sourcePublicationId: 'publication-1', nominalRub: 500,
      nominalAssignedAt: START, lastDemurrageAt: START, hopsLeft: 2,
      status: 'active', lockedByDealId: null, ownerHistory: [], version: 0,
      createdAt: START, updatedAt: START,
    }));
    await rawDb.collection('wallets').insertOne({
      id: 'wallet-1', userId: 'buyer-1', communityId: 'community-1', balance: 1,
      currency: { singular: 'merit', plural: 'merits', genitive: 'merits' },
      lastUpdated: START, createdAt: START, updatedAt: START,
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

  it('preserves remainder hours after catch-up demurrage', async () => {
    clock.set('2026-08-16T02:00:00.000Z');
    expect(await demurrage.executePage({ limit: 100 })).toMatchObject({ processed: 1 });
    const right = await createMongooseUzzRepositories(connection, null).rights.findById('right-1');
    expect(right?.snapshot()).toMatchObject({
      nominalRub: 300,
      lastDemurrageAt: new Date('2026-08-16T00:00:00.000Z'),
    });
  });

  it('never increases a right when an administrator raises the floor', async () => {
    await rawDb.collection('uzz_rights').updateOne(
      { id: 'right-1' },
      { $set: { nominalRub: 50, lastDemurrageAt: START } },
    );
    await updateSettings.execute({
      commandId: 'settings-floor-raise', communityId: 'community-1',
      adminId: 'admin-1', patch: { nominalFloorRub: 100 },
    });
    clock.set('2026-08-15T00:00:00.000Z');
    await demurrage.executePage({ limit: 100 });
    const right = await createMongooseUzzRepositories(connection, null).rights.findById('right-1');
    expect(right?.snapshot().nominalRub).toBe(50);
  });

  it('continues demurrage while the right is locked in an accepted deal', async () => {
    const deal = await createRequest();
    await accept.execute({
      commandId: 'accept-for-demurrage', dealId: deal.id, sellerId: 'seller-1',
      expectedNominalRub: 500, agreedDeadlineAt: null, now: START,
    });
    clock.set('2026-08-15T00:00:00.000Z');
    await demurrage.executePage({ limit: 100 });
    const right = await createMongooseUzzRepositories(connection, null).rights.findById('right-1');
    expect(right?.snapshot()).toMatchObject({ nominalRub: 400, status: 'in_deal' });
  });

  it('does not move an existing request deadline after settings change', async () => {
    const deal = await createRequest();
    await updateSettings.execute({
      commandId: 'settings-request-ttl', communityId: 'community-1',
      adminId: 'admin-1', patch: { requestTtlHours: 1 },
    });
    const persisted = await createMongooseUzzRepositories(connection, null).deals.findById(deal.id);
    expect(persisted?.snapshot().requestExpiresAt).toEqual(deal.requestExpiresAt);
  });

  it('expires a request from its snapshot deadline and refunds its fee', async () => {
    const deal = await createRequest();
    clock.set(deal.requestExpiresAt.toISOString());
    expect(await expiry.executePage({ limit: 100 })).toMatchObject({ processed: 1 });
    const persisted = await createMongooseUzzRepositories(connection, null).deals.findById(deal.id);
    const wallet = await rawDb.collection('wallets').findOne({ id: 'wallet-1' });
    expect(persisted?.snapshot()).toMatchObject({ status: 'cancelled', feeReserved: false });
    expect(wallet?.balance).toBe(1);
  });

  it('expires accepted fulfillment, unlocks the right, and refunds the fee', async () => {
    const deal = await createRequest();
    const accepted = await accept.execute({
      commandId: 'accept-for-fulfillment-expiry', dealId: deal.id, sellerId: 'seller-1',
      expectedNominalRub: 500, agreedDeadlineAt: null, now: START,
    });
    clock.set(accepted.fulfillmentExpiresAt!.toISOString());
    await expiry.executePage({ limit: 100 });
    const persisted = await createMongooseUzzRepositories(connection, null).deals.findById(deal.id);
    const right = await createMongooseUzzRepositories(connection, null).rights.findById('right-1');
    const wallet = await rawDb.collection('wallets').findOne({ id: 'wallet-1' });
    expect(persisted?.snapshot()).toMatchObject({ status: 'cancelled', feeReserved: false });
    expect(right?.snapshot()).toMatchObject({ status: 'active', lockedByDealId: null });
    expect(wallet?.balance).toBe(1);
  });

  it('automatically closes after the stored confirmation deadline', async () => {
    const deal = await createRequest();
    await accept.execute({
      commandId: 'accept-for-expiry', dealId: deal.id, sellerId: 'seller-1',
      expectedNominalRub: 500, agreedDeadlineAt: null, now: START,
    });
    const done = await complete.execute({
      commandId: 'complete-for-expiry', dealId: deal.id, sellerId: 'seller-1', now: START,
    });
    clock.set(done.confirmationExpiresAt!.toISOString());
    await expiry.executePage({ limit: 100 });
    const right = await createMongooseUzzRepositories(connection, null).rights.findById('right-1');
    const persisted = await createMongooseUzzRepositories(connection, null).deals.findById(deal.id);
    expect(persisted?.snapshot().status).toBe('closed');
    expect(right?.snapshot()).toMatchObject({ ownerId: 'seller-1', hopsLeft: 1 });
  });

  async function createRequest() {
    return request.execute({
      commandId: 'request-time-policy', communityId: 'community-1', buyerId: 'buyer-1',
      listingId: 'listing-1', exchangeRightId: 'right-1', requestMessage: 'Need help',
      requestedDeadlineAt: null, now: START,
    });
  }
});
