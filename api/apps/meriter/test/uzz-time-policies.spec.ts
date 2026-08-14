import { MongoMemoryReplSet } from 'mongodb-memory-server';
import { Connection, createConnection } from 'mongoose';
import { UzzAccessPolicy } from '../src/application/uzz/policies/uzz-access-policy';
import { Clock } from '../src/application/uzz/ports/clock.port';
import { UzzUnitOfWork } from '../src/application/uzz/ports/uzz-unit-of-work';
import { AcceptDealUseCase } from '../src/application/uzz/use-cases/accept-deal.use-case';
import { ApplyDemurrageUseCase } from '../src/application/uzz/use-cases/apply-demurrage.use-case';
import { CloseDealUseCase } from '../src/application/uzz/use-cases/close-deal.use-case';
import { ExpireDealsUseCase } from '../src/application/uzz/use-cases/expire-deals.use-case';
import { MarkDealCompletedUseCase } from '../src/application/uzz/use-cases/mark-deal-completed.use-case';
import { RequestDealUseCase } from '../src/application/uzz/use-cases/request-deal.use-case';
import { UpdateSettingsUseCase } from '../src/application/uzz/use-cases/update-settings.use-case';
import { ExchangeRight } from '../src/domain/uzz/entities/exchange-right';
import { Listing } from '../src/domain/uzz/entities/listing';
import { UzzValidationError } from '../src/domain/uzz/errors';
import { DealDeadline } from '../src/domain/uzz/value-objects/deal-deadline';
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
const DEADLINE_NOW = new Date('2026-08-14T10:00:00.000Z');

describe('DealDeadline', () => {
  it.each([
    new Date('2026-08-14T09:59:59Z'),
    new Date('2026-08-14T10:04:59Z'),
  ])('rejects a deadline without five minutes lead time', (deadline) => {
    expect(() => DealDeadline.optionalFuture(deadline, DEADLINE_NOW)).toThrow(
      UzzValidationError,
    );
    expect(() => DealDeadline.optionalFuture(deadline, DEADLINE_NOW)).toThrow(
      'DEAL_DEADLINE_NOT_FUTURE',
    );
  });

  it('allows omitting a deadline', () => {
    expect(DealDeadline.optionalFuture(undefined, DEADLINE_NOW)).toBeUndefined();
  });

  it('preserves the exact UTC instant', () => {
    const deadline = new Date('2026-08-14T12:30:00.000Z');
    const result = DealDeadline.optionalFuture(deadline, DEADLINE_NOW);
    expect(result?.toISOString()).toBe('2026-08-14T12:30:00.000Z');
    expect(result).not.toBe(deadline);
    expect(result?.getTime()).toBe(deadline.getTime());
  });
});

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
  let close: CloseDealUseCase;
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
    request = new RequestDealUseCase(uow, access, 'global', clock);
    accept = new AcceptDealUseCase(uow, access, clock);
    complete = new MarkDealCompletedUseCase(uow);
    close = new CloseDealUseCase(uow);
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

  it('W: preserves stored deadlines after settings change', async () => {
    const deal = await createRequest();
    await updateSettings.execute({
      commandId: 'settings-request-ttl', communityId: 'community-1',
      adminId: 'admin-1', patch: { requestTtlHours: 1 },
    });
    const persisted = await createMongooseUzzRepositories(connection, null).deals.findById(deal.id);
    expect(persisted?.snapshot().requestExpiresAt).toEqual(deal.requestExpiresAt);
  });

  it('skips stale scanned deals and expires the rest of the page', async () => {
    await rawDb.collection('wallets').updateOne({ id: 'wallet-1' }, { $set: { balance: 3 } });
    const first = await createRequest();
    const second = await seedDueRequest('2');
    const third = await seedDueRequest('3');
    const ordered = [first, second, third].sort((left, right) => left.id.localeCompare(right.id));
    clock.set(ordered[0].requestExpiresAt.toISOString());

    let scanned = false;
    const racingUow: UzzUnitOfWork = {
      run: async (work) => {
        const result = await uow.run(work);
        if (!scanned) {
          scanned = true;
          await accept.execute({
            commandId: 'accept-stale-first',
            dealId: ordered[0].id,
            sellerId: 'seller-1',
            expectedNominalRub: 500,
            agreedDeadlineAt: null,
            now: START,
          });
          await accept.execute({
            commandId: 'accept-stale-second',
            dealId: ordered[1].id,
            sellerId: 'seller-1',
            expectedNominalRub: 500,
            agreedDeadlineAt: null,
            now: START,
          });
          await complete.execute({
            commandId: 'complete-stale-second',
            dealId: ordered[1].id,
            sellerId: 'seller-1',
            now: START,
          });
          await close.execute({
            commandId: 'close-stale-second',
            dealId: ordered[1].id,
            buyerId: 'buyer-1',
            now: START,
          });
        }
        return result;
      },
    };
    const racingExpiry = new ExpireDealsUseCase(racingUow, clock);
    const page = await racingExpiry.executePage({ limit: 3 });

    expect(page).toMatchObject({
      processed: 1,
      skipped: 2,
      failed: 0,
      lastId: ordered[2].id,
    });
    const repos = createMongooseUzzRepositories(connection, null);
    expect((await repos.deals.findById(ordered[0].id))?.snapshot().status).toBe('accepted');
    expect((await repos.deals.findById(ordered[1].id))?.snapshot().status).toBe('closed');
    expect((await repos.deals.findById(ordered[2].id))?.snapshot().status).toBe('cancelled');
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

  it('M: auto-closes after seller completion', async () => {
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

  it.each([
    new Date('2026-08-14T09:59:59Z'),
    new Date('2026-08-14T10:04:59Z'),
  ])('rejects a deadline without five minutes lead time', async (deadline) => {
    await expect(
      request.execute({
        commandId: `request-deadline-${deadline.toISOString()}`,
        communityId: 'community-1',
        buyerId: 'buyer-1',
        listingId: 'listing-1',
        exchangeRightId: 'right-1',
        requestMessage: 'Need help',
        requestedDeadlineAt: deadline,
        now: DEADLINE_NOW,
      }),
    ).rejects.toMatchObject({
      code: 'DEAL_DEADLINE_NOT_FUTURE',
    });
  });

  it.each([
    new Date('2026-08-14T09:59:59Z'),
    new Date('2026-08-14T10:04:59Z'),
  ])('rejects an agreed deadline without five minutes lead time', async (deadline) => {
    const deal = await createRequest();
    await expect(
      accept.execute({
        commandId: `accept-deadline-${deadline.toISOString()}`,
        dealId: deal.id,
        sellerId: 'seller-1',
        expectedNominalRub: 500,
        agreedDeadlineAt: deadline,
        now: DEADLINE_NOW,
      }),
    ).rejects.toMatchObject({
      code: 'DEAL_DEADLINE_NOT_FUTURE',
    });
  });

  it('allows omitting a requested deadline', async () => {
    const deal = await request.execute({
      commandId: 'request-deadline-omitted',
      communityId: 'community-1',
      buyerId: 'buyer-1',
      listingId: 'listing-1',
      exchangeRightId: 'right-1',
      requestMessage: 'Need help',
      requestedDeadlineAt: null,
      now: DEADLINE_NOW,
    });
    expect(deal.requestedDeadlineAt).toBeNull();
  });

  it('preserves the exact UTC instant of a valid deadline', async () => {
    const deadline = new Date('2026-08-14T12:30:00.000Z');
    const deal = await request.execute({
      commandId: 'request-deadline-utc',
      communityId: 'community-1',
      buyerId: 'buyer-1',
      listingId: 'listing-1',
      exchangeRightId: 'right-1',
      requestMessage: 'Need help',
      requestedDeadlineAt: deadline,
      now: DEADLINE_NOW,
    });
    expect(deal.requestedDeadlineAt?.toISOString()).toBe('2026-08-14T12:30:00.000Z');
  });

  it('rejects a deadline using the injected clock', async () => {
    clock.set('2026-08-14T10:00:00.000Z');
    await expect(
      request.execute({
        commandId: 'request-clock-deadline',
        communityId: 'community-1',
        buyerId: 'buyer-1',
        listingId: 'listing-1',
        exchangeRightId: 'right-1',
        requestMessage: 'Need help',
        requestedDeadlineAt: new Date('2026-08-14T10:04:59Z'),
      }),
    ).rejects.toMatchObject({
      code: 'DEAL_DEADLINE_NOT_FUTURE',
    });
  });

  async function createRequest() {
    return request.execute({
      commandId: 'request-time-policy', communityId: 'community-1', buyerId: 'buyer-1',
      listingId: 'listing-1', exchangeRightId: 'right-1', requestMessage: 'Need help',
      requestedDeadlineAt: null, now: START,
    });
  }

  async function seedDueRequest(suffix: string) {
    const repositories = createMongooseUzzRepositories(connection, null);
    await repositories.listings.insert(Listing.create({
      id: `listing-${suffix}`, communityId: 'community-1', authorId: 'seller-1',
      title: 'Prepare report', description: '', priceRub: 500,
      deliveryMode: 'online', locationText: 'Zoom', durationText: '',
      availabilityText: '', now: START,
    }));
    await repositories.rights.insert(ExchangeRight.restore({
      id: `right-${suffix}`, communityId: 'community-1', ownerId: 'buyer-1',
      sourcePublicationId: `publication-${suffix}`, nominalRub: 500,
      nominalAssignedAt: START, lastDemurrageAt: START, hopsLeft: 2,
      status: 'active', lockedByDealId: null, ownerHistory: [], version: 0,
      createdAt: START, updatedAt: START,
    }));
    return request.execute({
      commandId: `request-time-policy-${suffix}`, communityId: 'community-1', buyerId: 'buyer-1',
      listingId: `listing-${suffix}`, exchangeRightId: `right-${suffix}`,
      requestMessage: 'Need help', requestedDeadlineAt: null, now: START,
    });
  }
});
