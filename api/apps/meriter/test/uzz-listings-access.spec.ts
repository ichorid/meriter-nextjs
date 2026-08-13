import { MongoMemoryReplSet } from 'mongodb-memory-server';
import { Connection, createConnection } from 'mongoose';
import { UzzCommunityAccessPort } from '../src/application/uzz/ports/uzz-community-access.port';
import { UzzAccessPolicy } from '../src/application/uzz/policies/uzz-access-policy';
import { CheckPurchaseGateUseCase } from '../src/application/uzz/use-cases/check-purchase-gate.use-case';
import { CreateListingUseCase } from '../src/application/uzz/use-cases/create-listing.use-case';
import { ListCatalogUseCase } from '../src/application/uzz/use-cases/list-catalog.use-case';
import { UpdateListingUseCase } from '../src/application/uzz/use-cases/update-listing.use-case';
import {
  createMongooseUzzRepositories,
  initializeUzzModels,
} from '../src/infrastructure/uzz/persistence/mongoose-uzz-repositories';
import { MongooseUzzUnitOfWork } from '../src/infrastructure/uzz/persistence/mongoose-uzz-unit-of-work';
import { createMongoMemoryReplSetWithRetry } from './mongo-memory-shared';
import { unregisterReplSet } from './mongo-memory-registry.js';

const NOW = new Date('2026-08-14T00:00:00.000Z');

describe('UZZ listings access', () => {
  jest.setTimeout(60_000);

  let replSet: MongoMemoryReplSet;
  let connection: Connection;
  let rawDb: NonNullable<Connection['db']>;
  let uow: MongooseUzzUnitOfWork;
  let members: Set<string>;
  let access: UzzCommunityAccessPort;
  let createListing: CreateListingUseCase;
  let updateListing: UpdateListingUseCase;
  let listCatalog: ListCatalogUseCase;
  let checkPurchaseGate: CheckPurchaseGateUseCase;

  beforeAll(async () => {
    replSet = await createMongoMemoryReplSetWithRetry();
    connection = await createConnection(replSet.getUri()).asPromise();
    if (!connection.db) {
      throw new Error('Mongo connection did not expose a database');
    }
    rawDb = connection.db;
    await initializeUzzModels(connection);
    uow = new MongooseUzzUnitOfWork(connection);
  });

  beforeEach(async () => {
    members = new Set(['seller-1', 'buyer-1']);
    access = {
      async isAnyMember(_communityId, userIds) {
        return userIds.some((userId) => members.has(userId));
      },
    };
    const policy = new UzzAccessPolicy(access);
    createListing = new CreateListingUseCase(uow, policy);
    updateListing = new UpdateListingUseCase(uow, policy);
    listCatalog = new ListCatalogUseCase(uow);
    checkPurchaseGate = new CheckPurchaseGateUseCase(uow, policy);

    const repositories = createMongooseUzzRepositories(connection, null);
    await repositories.identities.insert({
      id: 'identity-seller',
      canonicalUserId: 'seller-1',
      normalizedEmail: 'seller@example.com',
      telegramUserId: '1001',
      telegramUsername: 'seller',
      createdAt: NOW,
      updatedAt: NOW,
      version: 0,
    });
    await repositories.identities.insert({
      id: 'identity-buyer',
      canonicalUserId: 'buyer-1',
      normalizedEmail: 'buyer@example.com',
      telegramUserId: '1002',
      telegramUsername: 'buyer',
      createdAt: NOW,
      updatedAt: NOW,
      version: 0,
    });
  });

  afterEach(async () => {
    const collections = await rawDb.listCollections().toArray();
    await Promise.all(
      collections.map(({ name }) => rawDb.collection(name).deleteMany({})),
    );
  });

  afterAll(async () => {
    await connection?.close();
    if (replSet) {
      unregisterReplSet(replSet);
      await replSet.stop();
    }
  });

  it('rejects a listing from a non-member', async () => {
    await expect(
      createListing.execute(validCommand({ authorId: 'outsider' })),
    ).rejects.toMatchObject({ code: 'COMMUNITY_MEMBERSHIP_REQUIRED' });
  });

  it('rejects a listing from a member without a full email and Telegram link', async () => {
    members.add('unlinked-seller');

    await expect(
      createListing.execute(validCommand({ authorId: 'unlinked-seller' })),
    ).rejects.toMatchObject({ code: 'IDENTITY_LINK_REQUIRED' });
  });

  it('accepts membership carried by an immutable canonical identity alias', async () => {
    members.delete('seller-1');
    members.add('telegram-user-1');
    const repositories = createMongooseUzzRepositories(connection, null);
    await repositories.identities.insertAlias({
      id: 'alias-telegram-user-1',
      identityId: 'identity-seller',
      aliasUserId: 'telegram-user-1',
      createdAt: NOW,
    });

    await expect(createListing.execute(validCommand())).resolves.toMatchObject({
      authorId: 'seller-1',
    });
  });

  it('rejects a whitespace title and fractional price', async () => {
    await expect(
      createListing.execute(validCommand({ title: '   ' })),
    ).rejects.toMatchObject({ code: 'LISTING_TITLE_INVALID' });
    await expect(
      createListing.execute(validCommand({ priceRub: 0.1 })),
    ).rejects.toMatchObject({ code: 'RUBLES_INVALID' });
  });

  it('creates, updates, and lists a complete delivery snapshot', async () => {
    const created = await createListing.execute(validCommand());
    const updated = await updateListing.execute({
      listingId: created.id,
      actorId: 'seller-1',
      title: '  Настрою отчёт и обучу команду  ',
      deliveryMode: 'both',
      locationText: '  Москва или Zoom  ',
      now: new Date('2026-08-14T01:00:00.000Z'),
    });
    const catalog = await listCatalog.execute({ communityId: 'community-1' });

    expect(updated).toMatchObject({
      title: 'Настрою отчёт и обучу команду',
      deliveryMode: 'both',
      locationText: 'Москва или Zoom',
      durationText: '60 минут',
      availabilityText: 'По будням',
    });
    expect(catalog).toEqual([expect.objectContaining({ id: created.id })]);
  });

  it('nudges in soft mode and blocks with a stable code in strict mode', async () => {
    const repositories = createMongooseUzzRepositories(connection, null);
    await repositories.settings.upsert(settings('nudge'));

    await expect(
      checkPurchaseGate.execute({
        communityId: 'community-1',
        buyerId: 'buyer-1',
      }),
    ).resolves.toEqual({
      allowed: true,
      nudge: true,
      missingListingCount: 3,
      activeListingCount: 0,
      minimumListings: 3,
    });

    await repositories.settings.upsert(settings('require_min_lots'));
    await expect(
      checkPurchaseGate.execute({
        communityId: 'community-1',
        buyerId: 'buyer-1',
      }),
    ).rejects.toMatchObject({ code: 'MIN_LISTINGS_REQUIRED' });
  });
});

function validCommand(patch: Record<string, unknown> = {}) {
  return {
    communityId: 'community-1',
    authorId: 'seller-1',
    title: '  Помогу настроить отчёт  ',
    description: '  За один созвон  ',
    priceRub: 500,
    deliveryMode: 'online' as const,
    locationText: '  Zoom  ',
    durationText: '  60 минут  ',
    availabilityText: '  По будням  ',
    now: NOW,
    ...patch,
  };
}

function settings(mode: 'nudge' | 'require_min_lots') {
  return {
    communityId: 'community-1',
    emissionThreshold: 10,
    initialHops: 10,
    demurrageRubPerDay: 100,
    nominalFloorRub: 100,
    minimumListingsToBuy: 3,
    purchaseGateMode: mode,
    requestTtlHours: 48,
    fulfillmentTtlDays: 7,
    confirmationTtlDays: 7,
    createdAt: NOW,
    updatedAt: NOW,
    version: 0,
  };
}
