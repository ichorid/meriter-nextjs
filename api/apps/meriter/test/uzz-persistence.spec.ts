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

  it('G: refuses a second request for one right', async () => {
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
      payloadHash: 'hash-1',
      status: 'started',
      createdAt: NOW,
      updatedAt: NOW,
    });
    await expect(
      repositories.commands.insert({
        commandId: 'command-1',
        actorId: 'buyer-1',
        type: 'request_deal',
        payloadHash: 'hash-1',
        status: 'started',
        createdAt: NOW,
        updatedAt: NOW,
      }),
    ).rejects.toMatchObject({ code: 11000 });

    await expect(
      repositories.commands.insert({
        commandId: 'command-1',
        actorId: 'seller-1',
        type: 'request_deal',
        payloadHash: 'hash-1',
        status: 'started',
        createdAt: NOW,
        updatedAt: NOW,
      }),
    ).resolves.toBeUndefined();

    const commandIndexes = await connection.db.collection('uzz_commands').indexes();
    expect(commandIndexes).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          name: 'uzz_commands_actor_command_unique',
          unique: true,
          key: { actorId: 1, commandId: 1 },
        }),
      ]),
    );
    expect(commandIndexes.find((index) => index.name === 'uzz_commands_id_unique')).toBeUndefined();
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

  it('reads deals accepted before contacts carried a telegram user id', async () => {
    const repositories = createMongooseUzzRepositories(connection, null);
    await connection.db.collection('uzz_deals').insertOne({
      id: 'legacy-accepted-deal',
      communityId: 'community-1',
      buyerId: 'buyer-1',
      sellerId: 'seller-1',
      listingId: 'listing-1',
      lotId: 'listing-1',
      exchangeRightId: 'right-1',
      bankId: 'right-1',
      status: 'accepted',
      requestMessage: 'Нужна помощь',
      listingSnapshot: { title: 'Настрою отчёт', priceRub: 500, deliveryMode: 'online', locationText: '' },
      requestedDeadlineAt: null,
      agreedDeadlineAt: null,
      acceptedNominalRub: 500,
      dealAmountRub: null,
      requestExpiresAt: new Date('2026-08-16T00:00:00.000Z'),
      fulfillmentExpiresAt: new Date('2026-08-21T00:00:00.000Z'),
      confirmationExpiresAt: null,
      // The shape written before telegramUserId joined the contact snapshot.
      buyerContact: { telegramUsername: 'buyer' },
      sellerContact: { telegramUsername: 'seller' },
      feeReserved: true,
      feeSourceCommunityId: 'community-1',
      adminResolutionReason: null,
      requestedAt: NOW,
      acceptedAt: NOW,
      completedBySellerAt: null,
      closedAt: null,
      rejectedAt: null,
      cancelledAt: null,
      buyerThankedAt: null,
      sellerThankedAt: null,
      buyerThanksComment: null,
      sellerThanksComment: null,
      buyerThanksMerits: null,
      sellerThanksMerits: null,
      version: 1,
      createdAt: NOW,
      updatedAt: NOW,
    });

    const deal = await repositories.deals.findById('legacy-accepted-deal');

    expect(deal?.snapshot()).toMatchObject({
      status: 'accepted',
      buyerContact: { telegramUserId: '', telegramUsername: 'buyer' },
      sellerContact: { telegramUserId: '', telegramUsername: 'seller' },
    });
  });

  it('pages ledger entries by createdAt+id cursor without duplicates or gaps', async () => {
    const repositories = createMongooseUzzRepositories(connection, null);
    const entries = Array.from({ length: 75 }, (_, index) => ({
      id: `led-${String(index).padStart(3, '0')}`,
      operationId: `op-${index}`,
      communityId: 'community-1',
      userId: 'user-1',
      type: 'fee_reserved' as const,
      amount: -1,
      createdAt: new Date(NOW.getTime() - Math.floor(index / 3) * 1000),
      metadata: {},
    }));
    for (const entry of entries) {
      await repositories.ledger.append(entry);
    }

    const expectedIds = [...entries]
      .sort((left, right) => {
        const time = right.createdAt.getTime() - left.createdAt.getTime();
        if (time !== 0) return time;
        return right.id.localeCompare(left.id);
      })
      .map((entry) => entry.id);

    const first = await repositories.ledger.list({
      communityId: 'community-1',
      limit: 30,
    });
    expect(first.items.map((row) => row.id)).toEqual(expectedIds.slice(0, 30));
    expect(first.nextCursor).toEqual({
      createdAt: first.items[29].createdAt,
      id: first.items[29].id,
    });

    const second = await repositories.ledger.list({
      communityId: 'community-1',
      limit: 30,
      cursor: first.nextCursor,
    });
    expect(second.items.map((row) => row.id)).toEqual(expectedIds.slice(30, 60));
    const firstIds = new Set(first.items.map((row) => row.id));
    for (const row of second.items) {
      expect(firstIds.has(row.id)).toBe(false);
    }

    const third = await repositories.ledger.list({
      communityId: 'community-1',
      limit: 30,
      cursor: second.nextCursor,
    });
    expect(third.items.map((row) => row.id)).toEqual(expectedIds.slice(60));
    expect(third.nextCursor).toBeNull();
    expect([...first.items, ...second.items, ...third.items].map((row) => row.id)).toEqual(
      expectedIds,
    );
  });

  it('stores a requested deal whose listing has an empty location', async () => {
    const repositories = createMongooseUzzRepositories(connection, null);
    const deal = Deal.request({
      id: 'deal-online-no-place',
      communityId: 'community-1',
      buyerId: 'buyer-1',
      sellerId: 'seller-1',
      listingId: 'listing-online',
      exchangeRightId: 'right-online',
      requestMessage: 'Тест',
      listingSnapshot: {
        title: 'Обучаю работе с платформой',
        priceRub: 500,
        deliveryMode: 'online',
        locationText: '',
      },
      requestedDeadlineAt: null,
      requestExpiresAt: new Date('2026-08-16T00:00:00.000Z'),
      now: NOW,
    });

    await expect(repositories.deals.insert(deal)).resolves.toBeUndefined();
    const stored = await connection.db
      .collection('uzz_deals')
      .findOne({ id: 'deal-online-no-place' });
    expect(stored?.listingSnapshot).toEqual(
      expect.objectContaining({ locationText: '', deliveryMode: 'online' }),
    );
  });
});
