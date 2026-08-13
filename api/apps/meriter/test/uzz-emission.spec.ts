import { MongoMemoryReplSet } from 'mongodb-memory-server';
import { Connection, createConnection } from 'mongoose';
import { Clock } from '../src/application/uzz/ports/clock.port';
import { UzzPlatformPort } from '../src/application/uzz/ports/uzz-platform.port';
import { EmitExchangeRightUseCase } from '../src/application/uzz/use-cases/emit-exchange-right.use-case';
import { createMongooseUzzRepositories, initializeUzzModels } from '../src/infrastructure/uzz/persistence/mongoose-uzz-repositories';
import { MongooseUzzUnitOfWork } from '../src/infrastructure/uzz/persistence/mongoose-uzz-unit-of-work';
import { createMongoMemoryReplSetWithRetry } from './mongo-memory-shared';
import { unregisterReplSet } from './mongo-memory-registry.js';

const NOW = new Date('2026-08-14T00:00:00Z');

describe('UZZ exchange-right emission', () => {
  jest.setTimeout(60_000);
  let replSet: MongoMemoryReplSet; let connection: Connection; let useCase: EmitExchangeRightUseCase;
  let publication = { id: 'publication-1', communityId: 'community-1', authorId: 'author-1', title: 'Доброе дело', score: 10, deleted: false, postType: 'basic' };

  beforeAll(async () => {
    replSet = await createMongoMemoryReplSetWithRetry(); connection = await createConnection(replSet.getUri()).asPromise(); await initializeUzzModels(connection);
  });
  beforeEach(async () => {
    publication = { id: 'publication-1', communityId: 'community-1', authorId: 'author-1', title: 'Доброе дело', score: 10, deleted: false, postType: 'basic' };
    const platform: UzzPlatformPort = { configuredCommunityId: () => 'community-1', async getPublication(id) { return id === publication.id ? publication : null; }, async listUserCommunities() { return []; }, async getCommunity() { return null; }, async getDisplayNames() { return new Map(); }, async listDeedPublications() { return []; } };
    const clock: Clock = { now: () => new Date(NOW) }; useCase = new EmitExchangeRightUseCase(new MongooseUzzUnitOfWork(connection), platform, clock);
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

  it('does not emit below threshold or outside the configured community', async () => {
    publication.score = 9; expect(await useCase.execute({ publicationId: publication.id })).toBeNull();
    publication.score = 10; publication.communityId = 'other'; expect(await useCase.execute({ publicationId: publication.id })).toBeNull();
  });
});
