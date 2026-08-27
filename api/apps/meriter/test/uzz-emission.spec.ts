import { MongoMemoryReplSet } from 'mongodb-memory-server';
import { Connection, createConnection } from 'mongoose';
import { Clock } from '../src/application/uzz/ports/clock.port';
import { UzzPlatformPort, UzzPlatformPublication } from '../src/application/uzz/ports/uzz-platform.port';
import { EmitExchangeRightUseCase } from '../src/application/uzz/use-cases/emit-exchange-right.use-case';
import { ListDeedsUseCase } from '../src/application/uzz/use-cases/list-deeds.use-case';
import { createMongooseUzzRepositories, initializeUzzModels } from '../src/infrastructure/uzz/persistence/mongoose-uzz-repositories';
import { MongooseUzzUnitOfWork } from '../src/infrastructure/uzz/persistence/mongoose-uzz-unit-of-work';
import { createMongoMemoryReplSetWithRetry } from './mongo-memory-shared';
import { unregisterReplSet } from './mongo-memory-registry.js';

const NOW = new Date('2026-08-14T00:00:00Z');

describe('UZZ exchange-right emission', () => {
  jest.setTimeout(60_000);
  let replSet: MongoMemoryReplSet; let connection: Connection; let useCase: EmitExchangeRightUseCase;
  let publication = { id: 'publication-1', communityId: 'community-1', authorId: 'author-1', ownerId: 'author-1', title: 'Доброе дело', score: 10, deleted: false, postType: 'basic' };
  let deedPublications: UzzPlatformPublication[] = [];
  let listDeeds: ListDeedsUseCase;

  beforeAll(async () => {
    replSet = await createMongoMemoryReplSetWithRetry(); connection = await createConnection(replSet.getUri()).asPromise(); await initializeUzzModels(connection);
  });
  beforeEach(async () => {
    publication = { id: 'publication-1', communityId: 'community-1', authorId: 'author-1', ownerId: 'author-1', title: 'Доброе дело', score: 10, deleted: false, postType: 'basic' };
    deedPublications = [];
    const platform: UzzPlatformPort = { configuredCommunityId: async () => 'community-1', setSelectedCommunityId: async () => undefined, async getPublication(id) { return id === publication.id ? publication : null; }, async listTelegramCommunities() { return []; }, async getCommunity() { return null; }, async getUserLabels() { return new Map(); }, async listDeedPublications() { return deedPublications; }, async listEligibleDeedPublications() { return []; } };
    const clock: Clock = { now: () => new Date(NOW) }; useCase = new EmitExchangeRightUseCase(new MongooseUzzUnitOfWork(connection), platform, clock);
    listDeeds = new ListDeedsUseCase(new MongooseUzzUnitOfWork(connection), platform, useCase, { assertCommunityParticipant: async () => undefined, resolveUserIds: async (userId: string) => [userId] });
  });
  afterEach(async () => { if (!connection.db) return; const collections = await connection.db.listCollections().toArray(); await Promise.all(collections.map(({ name }) => connection.db!.collection(name).deleteMany({}))); });
  afterAll(async () => { await connection.close(); unregisterReplSet(replSet); await replSet.stop(); });

  it('O: emits one right only for an eligible deed', async () => {
    const repositories = createMongooseUzzRepositories(connection, null);
    await repositories.identities.insert({ id: 'identity-1', canonicalUserId: 'author-1', normalizedEmail: 'author@example.com', telegramUserId: '1001', telegramUsername: 'author', createdAt: NOW, updatedAt: NOW, version: 0 });
    const first = await useCase.execute({ publicationId: publication.id }); const replay = await useCase.execute({ publicationId: publication.id });
    expect(first).toMatchObject({ sourcePublicationId: publication.id, status: 'awaiting_nominal', hopsLeft: 10 }); expect(replay?.id).toBe(first?.id);
    expect(await connection.db!.collection('uzz_rights').countDocuments({ sourcePublicationId: publication.id })).toBe(1);
  });

  it('holds the right until identity linking is complete', async () => {
    expect(await useCase.execute({ publicationId: publication.id })).toMatchObject({ status: 'holding', ownerId: 'author-1' });
  });

  it('notifies a Telegram-only participant when the right is emitted into holding', async () => {
    const repositories = createMongooseUzzRepositories(connection, null);
    await repositories.identities.insert({ id: 'identity-1', canonicalUserId: 'author-1', normalizedEmail: null, telegramUserId: '1001', telegramUsername: 'author', createdAt: NOW, updatedAt: NOW, version: 0 });

    expect(await useCase.execute({ publicationId: publication.id })).toMatchObject({ status: 'holding' });
    expect(await connection.db!.collection('uzz_outbox').findOne({ aggregateId: { $exists: true } })).toMatchObject({
      payload: { telegramUserId: '1001', kind: 'right_emitted', path: '/' },
    });
  });

  it('announces the emitted bank in the community group chat', async () => {
    const repositories = createMongooseUzzRepositories(connection, null);
    await repositories.identities.insert({ id: 'identity-1', canonicalUserId: 'author-1', normalizedEmail: 'author@example.com', telegramUserId: '1001', telegramUsername: 'author', createdAt: NOW, updatedAt: NOW, version: 0 });
    await repositories.settings.upsert({
      communityId: 'community-1',
      emissionThreshold: 10, initialHops: 10, demurrageRubPerDay: 100,
      nominalFloorRub: 100, defaultNominalRub: 100, autoAssignNominal: false,
      minimumListingsToBuy: 3, purchaseGateMode: 'nudge',
      requestTtlHours: 48, fulfillmentTtlDays: 7, confirmationTtlDays: 7,
      notifyRightEmitted: true, notifyRequestLifecycle: true,
      notifyDealProgress: true, notifyDealClosed: true,
      groupAnnounceRightEmitted: true, groupAnnounceDealClosed: false,
      backfillStartedAt: null, backfillEmittedAt: null, backfillEmittedBy: null,
      backfillScanned: null, backfillEmitted: null, backfillSkipped: null,
      createdAt: NOW, updatedAt: NOW, version: 0,
    }, null);
    const platform: UzzPlatformPort = {
      configuredCommunityId: async () => 'community-1',
      setSelectedCommunityId: async () => undefined,
      async getPublication(id) { return id === publication.id ? publication : null; },
      async listTelegramCommunities() { return []; },
      async getCommunity() { return { id: 'community-1', name: 'Тест', telegramChatId: '-100200300' }; },
      async getUserLabels() { return new Map([['author-1', { name: 'Автор', username: 'author' }]]); },
      async listDeedPublications() { return []; },
      async listEligibleDeedPublications() { return []; },
    };
    const emit = new EmitExchangeRightUseCase(new MongooseUzzUnitOfWork(connection), platform, { now: () => new Date(NOW) });

    await emit.execute({ publicationId: publication.id });

    const announcement = await connection.db!.collection('uzz_outbox').findOne({ 'payload.kind': 'group_right_emitted' });
    expect(announcement).toMatchObject({
      payload: { telegramChatId: '-100200300', path: '/catalog' },
    });
    expect((announcement?.payload as { text: string }).text).toContain('У Автор (@author) появился банк');
  });

  it('does not announce in the group chat unless the admin opts in', async () => {
    const repositories = createMongooseUzzRepositories(connection, null);
    await repositories.identities.insert({
      id: 'identity-1', canonicalUserId: 'author-1', normalizedEmail: 'author@example.com',
      telegramUserId: '1001', telegramUsername: 'author', createdAt: NOW, updatedAt: NOW, version: 0,
    });
    const platform: UzzPlatformPort = {
      configuredCommunityId: async () => 'community-1',
      setSelectedCommunityId: async () => undefined,
      async getPublication(id) { return id === publication.id ? publication : null; },
      async listTelegramCommunities() { return []; },
      async getCommunity() { return { id: 'community-1', name: 'Тест', telegramChatId: '-100200300' }; },
      async getUserLabels() { return new Map([['author-1', { name: 'Автор', username: 'author' }]]); },
      async listDeedPublications() { return []; },
      async listEligibleDeedPublications() { return []; },
    };
    const emit = new EmitExchangeRightUseCase(
      new MongooseUzzUnitOfWork(connection), platform, { now: () => new Date(NOW) },
    );

    await emit.execute({ publicationId: publication.id });

    expect(await connection.db!.collection('uzz_outbox').countDocuments({ 'payload.kind': 'group_right_emitted' })).toBe(0);
    expect(await connection.db!.collection('uzz_outbox').findOne({ 'payload.kind': 'right_emitted' })).toMatchObject({
      payload: { telegramUserId: '1001' },
    });
  });

  it('emits the bank to the nomination beneficiary, not the post author', async () => {
    publication.ownerId = 'beneficiary-1';
    const repositories = createMongooseUzzRepositories(connection, null);
    await repositories.identities.insert({ id: 'identity-2', canonicalUserId: 'beneficiary-1', normalizedEmail: 'beneficiary@example.com', telegramUserId: '2002', telegramUsername: 'beneficiary', createdAt: NOW, updatedAt: NOW, version: 0 });

    expect(await useCase.execute({ publicationId: publication.id })).toMatchObject({
      status: 'awaiting_nominal',
      ownerId: 'beneficiary-1',
      ownerHistory: [expect.objectContaining({ userId: 'beneficiary-1' })],
    });
    expect(await connection.db!.collection('uzz_outbox').findOne({ 'payload.kind': 'right_emitted' })).toMatchObject({
      payload: { telegramUserId: '2002' },
    });
    expect(await connection.db!.collection('uzz_ledger').findOne({ type: 'right_emitted' })).toMatchObject({
      userId: 'beneficiary-1',
    });
  });

  it('does not emit below threshold or outside the configured community', async () => {
    publication.score = 9; expect(await useCase.execute({ publicationId: publication.id })).toBeNull();
    publication.score = 10; publication.communityId = 'other'; expect(await useCase.execute({ publicationId: publication.id })).toBeNull();
  });

  it('treats a Telegram alias of a fully linked profile as ready', async () => {
    const repositories = createMongooseUzzRepositories(connection, null);
    await repositories.identities.insert({
      id: 'identity-1',
      canonicalUserId: 'email-user-1',
      normalizedEmail: 'author@example.com',
      telegramUserId: '1001',
      telegramUsername: 'author',
      createdAt: NOW,
      updatedAt: NOW,
      version: 0,
    });
    await repositories.identities.insertAlias({
      id: 'identity-1:author-1',
      identityId: 'identity-1',
      aliasUserId: 'author-1',
      createdAt: NOW,
    });

    expect(await useCase.execute({ publicationId: publication.id })).toMatchObject({
      status: 'awaiting_nominal',
      ownerId: 'author-1',
    });
  });

  it('emits a bank for a deed that is already over the threshold when the list is opened', async () => {
    const repositories = createMongooseUzzRepositories(connection, null);
    await repositories.identities.insert({ id: 'identity-1', canonicalUserId: 'author-1', normalizedEmail: 'author@example.com', telegramUserId: '1001', telegramUsername: 'author', createdAt: NOW, updatedAt: NOW, version: 0 });
    deedPublications = [publication];

    const deeds = await listDeeds.execute({ userId: 'author-1', communityId: 'community-1' });

    expect(deeds).toEqual([expect.objectContaining({
      publicationId: publication.id, score: 10, emissionThreshold: 10, bankStatus: 'awaiting_nominal',
    })]);
    expect(await connection.db!.collection('uzz_rights').countDocuments({ sourcePublicationId: publication.id })).toBe(1);
  });

  it('does not emit a second bank when the deed list is opened again', async () => {
    const repositories = createMongooseUzzRepositories(connection, null);
    await repositories.identities.insert({ id: 'identity-1', canonicalUserId: 'author-1', normalizedEmail: 'author@example.com', telegramUserId: '1001', telegramUsername: 'author', createdAt: NOW, updatedAt: NOW, version: 0 });
    deedPublications = [publication];

    await listDeeds.execute({ userId: 'author-1', communityId: 'community-1' });
    await listDeeds.execute({ userId: 'author-1', communityId: 'community-1' });

    expect(await connection.db!.collection('uzz_rights').countDocuments({ sourcePublicationId: publication.id })).toBe(1);
  });

  it('leaves a below-threshold deed without a bank and reports its progress', async () => {
    publication.score = 4;
    deedPublications = [{ id: publication.id, title: publication.title, score: 4 }];

    const deeds = await listDeeds.execute({ userId: 'author-1', communityId: 'community-1' });

    expect(deeds).toEqual([expect.objectContaining({ bankStatus: undefined, progress: 0.4 })]);
    expect(await connection.db!.collection('uzz_rights').countDocuments({})).toBe(0);
  });

  it('auto-assigns the default nominal when the setting is on and the profile is linked', async () => {
    const repositories = createMongooseUzzRepositories(connection, null);
    await repositories.identities.insert({
      id: 'identity-1',
      canonicalUserId: 'author-1',
      normalizedEmail: 'author@example.com',
      telegramUserId: '1001',
      telegramUsername: 'author',
      createdAt: NOW,
      updatedAt: NOW,
      version: 0,
    });
    await repositories.settings.upsert({
      communityId: 'community-1',
      emissionThreshold: 10,
      initialHops: 10,
      demurrageRubPerDay: 100,
      nominalFloorRub: 100,
      defaultNominalRub: 500,
      autoAssignNominal: true,
      minimumListingsToBuy: 3,
      purchaseGateMode: 'nudge',
      requestTtlHours: 48,
      fulfillmentTtlDays: 7,
      confirmationTtlDays: 7,
      notifyRightEmitted: true,
      notifyRequestLifecycle: true,
      notifyDealProgress: true,
      notifyDealClosed: true,
      groupAnnounceRightEmitted: true,
      groupAnnounceDealClosed: true,
      backfillStartedAt: null, backfillEmittedAt: null, backfillEmittedBy: null,
      backfillScanned: null, backfillEmitted: null, backfillSkipped: null,
      createdAt: NOW,
      updatedAt: NOW,
      version: 0,
    }, null);

    expect(await useCase.execute({ publicationId: publication.id })).toMatchObject({
      status: 'active',
      nominalRub: 500,
      ownerId: 'author-1',
    });
  });

  it('keeps an unlinked right in holding even when auto-assign is on', async () => {
    const repositories = createMongooseUzzRepositories(connection, null);
    await repositories.settings.upsert({
      communityId: 'community-1',
      emissionThreshold: 10,
      initialHops: 10,
      demurrageRubPerDay: 100,
      nominalFloorRub: 100,
      defaultNominalRub: 500,
      autoAssignNominal: true,
      minimumListingsToBuy: 3,
      purchaseGateMode: 'nudge',
      requestTtlHours: 48,
      fulfillmentTtlDays: 7,
      confirmationTtlDays: 7,
      notifyRightEmitted: true,
      notifyRequestLifecycle: true,
      notifyDealProgress: true,
      notifyDealClosed: true,
      groupAnnounceRightEmitted: true,
      groupAnnounceDealClosed: true,
      backfillStartedAt: null, backfillEmittedAt: null, backfillEmittedBy: null,
      backfillScanned: null, backfillEmitted: null, backfillSkipped: null,
      createdAt: NOW,
      updatedAt: NOW,
      version: 0,
    }, null);

    expect(await useCase.execute({ publicationId: publication.id })).toMatchObject({
      status: 'holding',
      nominalRub: null,
    });
  });
});
