import { MongoMemoryReplSet } from 'mongodb-memory-server';
import { Connection, createConnection } from 'mongoose';
import { Deal } from '../src/domain/uzz/entities/deal';
import { ExchangeRight } from '../src/domain/uzz/entities/exchange-right';
import {
  createMongooseUzzRepositories,
  initializeUzzModels,
} from '../src/infrastructure/uzz/persistence/mongoose-uzz-repositories';
import { MongooseUzzUnitOfWork } from '../src/infrastructure/uzz/persistence/mongoose-uzz-unit-of-work';
import { createMongoMemoryReplSetWithRetry } from './mongo-memory-shared';
import { unregisterReplSet } from './mongo-memory-registry.js';

const NOW = new Date('2026-08-14T00:00:00.000Z');

describe('UZZ persistence boundary', () => {
  jest.setTimeout(60_000);

  let replSet: MongoMemoryReplSet;
  let connection: Connection;
  let uow: MongooseUzzUnitOfWork;

  beforeAll(async () => {
    replSet = await createMongoMemoryReplSetWithRetry({
      replSet: { count: 1, dbName: 'uzz-persistence-test' },
    });
    connection = await createConnection(replSet.getUri()).asPromise();
    await initializeUzzModels(connection);
    uow = new MongooseUzzUnitOfWork(connection);
  });

  afterEach(async () => {
    const collections = await connection.db.listCollections().toArray();
    await Promise.all(
      collections.map(({ name }) => connection.db.collection(name).deleteMany({})),
    );
  });

  afterAll(async () => {
    await connection?.close();
    if (replSet) {
      unregisterReplSet(replSet);
      await replSet.stop();
    }
  });

  it('rolls back right, deal, and ledger together', async () => {
    const right = ExchangeRight.restore({
      id: 'right-rollback',
      communityId: 'community-1',
      ownerId: 'buyer-1',
      sourcePublicationId: 'publication-rollback',
      nominalRub: 500,
      nominalAssignedAt: NOW,
      lastDemurrageAt: NOW,
      hopsLeft: 10,
      status: 'active',
      lockedByDealId: null,
      ownerHistory: [],
      version: 0,
      createdAt: NOW,
      updatedAt: NOW,
    });
    const deal = Deal.request({
      id: 'deal-rollback',
      communityId: 'community-1',
      buyerId: 'buyer-1',
      sellerId: 'seller-1',
      listingId: 'listing-1',
      exchangeRightId: 'right-rollback',
      requestMessage: 'Нужна помощь с отчётом',
      listingSnapshot: {
        title: 'Помогу настроить отчёт',
        priceRub: 500,
        deliveryMode: 'online',
        locationText: 'Zoom',
      },
      requestedDeadlineAt: null,
      requestExpiresAt: new Date('2026-08-16T00:00:00.000Z'),
      now: NOW,
    });

    await expect(
      uow.run(async (repositories) => {
        await repositories.rights.insert(right);
        await repositories.deals.insert(deal);
        await repositories.ledger.append({
          id: 'ledger-rollback',
          operationId: 'operation-rollback',
          communityId: 'community-1',
          userId: 'buyer-1',
          type: 'fee_reserved',
          amount: -1,
          createdAt: NOW,
          metadata: { dealId: 'deal-rollback' },
        });
        throw new Error('injected failure');
      }),
    ).rejects.toThrow('injected failure');

    expect(
      await connection.db.collection('uzz_rights').countDocuments(),
    ).toBe(0);
    expect(await connection.db.collection('uzz_deals').countDocuments()).toBe(
      0,
    );
    expect(
      await connection.db.collection('uzz_ledger').countDocuments(),
    ).toBe(0);
  });

  it('enforces unique sources, one open deal per right, and command idempotency', async () => {
    const repositories = createMongooseUzzRepositories(connection, null);
    const right = ExchangeRight.restore({
      id: 'right-1',
      communityId: 'community-1',
      ownerId: 'buyer-1',
      sourcePublicationId: 'publication-1',
      nominalRub: 500,
      nominalAssignedAt: NOW,
      lastDemurrageAt: NOW,
      hopsLeft: 10,
      status: 'active',
      lockedByDealId: null,
      ownerHistory: [],
      version: 0,
      createdAt: NOW,
      updatedAt: NOW,
    });
    await repositories.rights.insert(right);

    await expect(
      repositories.rights.insert(
        ExchangeRight.restore({ ...right.snapshot(), id: 'right-2' }),
      ),
    ).rejects.toMatchObject({ code: 11000 });

    const dealInput = {
      communityId: 'community-1',
      buyerId: 'buyer-1',
      sellerId: 'seller-1',
      listingId: 'listing-1',
      exchangeRightId: 'right-1',
      requestMessage: 'Нужна помощь с отчётом',
      listingSnapshot: {
        title: 'Помогу настроить отчёт',
        priceRub: 500,
        deliveryMode: 'online' as const,
        locationText: 'Zoom',
      },
      requestedDeadlineAt: null,
      requestExpiresAt: new Date('2026-08-16T00:00:00.000Z'),
      now: NOW,
    };
    await repositories.deals.insert(Deal.request({ id: 'deal-1', ...dealInput }));
    await expect(
      repositories.deals.insert(Deal.request({ id: 'deal-2', ...dealInput })),
    ).rejects.toMatchObject({ code: 11000 });

    await repositories.commands.insert({
      commandId: 'command-1',
      actorId: 'buyer-1',
      type: 'request_deal',
      status: 'started',
      createdAt: NOW,
      updatedAt: NOW,
    });
    await expect(
      repositories.commands.insert({
        commandId: 'command-1',
        actorId: 'buyer-1',
        type: 'request_deal',
        status: 'started',
        createdAt: NOW,
        updatedAt: NOW,
      }),
    ).rejects.toMatchObject({ code: 11000 });
  });

  it('enforces canonical identity aliases and expires raw identity tokens', async () => {
    const repositories = createMongooseUzzRepositories(connection, null);
    await repositories.identities.insert({
      id: 'identity-1',
      canonicalUserId: 'user-1',
      normalizedEmail: 'one@example.com',
      telegramUserId: '1001',
      telegramUsername: 'one',
      createdAt: NOW,
      updatedAt: NOW,
      version: 0,
    });

    await expect(
      repositories.identities.insert({
        id: 'identity-2',
        canonicalUserId: 'user-2',
        normalizedEmail: 'one@example.com',
        telegramUserId: '1002',
        telegramUsername: 'two',
        createdAt: NOW,
        updatedAt: NOW,
        version: 0,
      }),
    ).rejects.toMatchObject({ code: 11000 });
    await expect(
      repositories.identities.insert({
        id: 'identity-3',
        canonicalUserId: 'user-3',
        normalizedEmail: 'three@example.com',
        telegramUserId: '1001',
        telegramUsername: 'three',
        createdAt: NOW,
        updatedAt: NOW,
        version: 0,
      }),
    ).rejects.toMatchObject({ code: 11000 });

    const tokenIndexes = await connection.db
      .collection('uzz_identity_tokens')
      .indexes();
    expect(tokenIndexes).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ key: { expiresAt: 1 }, expireAfterSeconds: 0 }),
      ]),
    );
  });

  it('rejects a stale optimistic update instead of overwriting newer state', async () => {
    const repositories = createMongooseUzzRepositories(connection, null);
    const original = ExchangeRight.restore({
      id: 'right-versioned',
      communityId: 'community-1',
      ownerId: 'buyer-1',
      sourcePublicationId: 'publication-versioned',
      nominalRub: 500,
      nominalAssignedAt: NOW,
      lastDemurrageAt: NOW,
      hopsLeft: 10,
      status: 'active',
      lockedByDealId: null,
      ownerHistory: [],
      version: 0,
      createdAt: NOW,
      updatedAt: NOW,
    });
    await repositories.rights.insert(original);
    const firstReader = await repositories.rights.findById('right-versioned');
    const staleReader = await repositories.rights.findById('right-versioned');
    if (!firstReader || !staleReader) {
      throw new Error('Versioned right fixture was not persisted');
    }

    firstReader.lockForDeal('deal-first', new Date('2026-08-14T01:00:00.000Z'));
    await repositories.rights.update(firstReader);
    staleReader.lockForDeal('deal-stale', new Date('2026-08-14T02:00:00.000Z'));

    await expect(repositories.rights.update(staleReader)).rejects.toMatchObject({
      code: 'UZZ_CONCURRENT_MODIFICATION',
    });
    expect(
      await connection.db
        .collection('uzz_rights')
        .findOne({ id: 'right-versioned' }),
    ).toMatchObject({ lockedByDealId: 'deal-first', version: 1 });
  });

  it('allows multiple legacy ledger rows that have no operation id', async () => {
    const legacyLedger = connection.db.collection('uzz_ledger');

    await expect(
      legacyLedger.insertMany([
        {
          id: 'legacy-ledger-1',
          communityId: 'community-1',
          userId: 'user-1',
          type: 'bank_emitted',
          payload: {},
          createdAt: NOW,
        },
        {
          id: 'legacy-ledger-2',
          communityId: 'community-1',
          userId: 'user-1',
          type: 'bank_emitted',
          payload: {},
          createdAt: NOW,
        },
      ]),
    ).resolves.toMatchObject({ insertedCount: 2 });
  });

  it('allows legacy open deals that identify rights by bank id', async () => {
    const legacyDeals = connection.db.collection('uzz_deals');
    const baseDeal = {
      communityId: 'community-1',
      buyerId: 'buyer-1',
      sellerId: 'seller-1',
      lotId: 'legacy-lot',
      status: 'requested',
      dealAmountRub: null,
      feeReserved: true,
      requestedAt: NOW,
      createdAt: NOW,
      updatedAt: NOW,
    };

    await expect(
      legacyDeals.insertMany([
        { ...baseDeal, id: 'legacy-deal-1', bankId: 'legacy-bank-1' },
        { ...baseDeal, id: 'legacy-deal-2', bankId: 'legacy-bank-2' },
      ]),
    ).resolves.toMatchObject({ insertedCount: 2 });
  });
});
