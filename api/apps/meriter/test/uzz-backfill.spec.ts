import { MongoMemoryReplSet } from 'mongodb-memory-server';
import { Connection, createConnection } from 'mongoose';
import { UzzPlatformPort, UzzPlatformPublication } from '../src/application/uzz/ports/uzz-platform.port';
import {
  BackfillExchangeRightsUseCase,
  formatBackfillDigest,
} from '../src/application/uzz/use-cases/backfill-exchange-rights.use-case';
import { EmitExchangeRightUseCase } from '../src/application/uzz/use-cases/emit-exchange-right.use-case';
import {
  createMongooseUzzRepositories,
  initializeUzzModels,
} from '../src/infrastructure/uzz/persistence/mongoose-uzz-repositories';
import { MongooseUzzUnitOfWork } from '../src/infrastructure/uzz/persistence/mongoose-uzz-unit-of-work';
import { createMongoMemoryReplSetWithRetry } from './mongo-memory-shared';
import { unregisterReplSet } from './mongo-memory-registry.js';

const NOW = new Date('2026-08-14T00:00:00.000Z');

describe('formatBackfillDigest', () => {
  it('lists titles and mentions holding when needed', () => {
    expect(formatBackfillDigest(['Уборка', 'Урок'], false))
      .toBe('Вам начислены банки на обмен: 2. За дела: «Уборка», «Урок». Банком можно оплатить услугу из каталога.');
    expect(formatBackfillDigest(['Уборка'], true)).toContain('привяжите email');
  });
});

describe('UZZ launch backfill', () => {
  jest.setTimeout(60_000);
  let replSet: MongoMemoryReplSet;
  let connection: Connection;
  let eligible: UzzPlatformPublication[];
  let backfill: BackfillExchangeRightsUseCase;

  beforeAll(async () => {
    replSet = await createMongoMemoryReplSetWithRetry();
    connection = await createConnection(replSet.getUri()).asPromise();
    await initializeUzzModels(connection);
  });
  beforeEach(async () => {
    eligible = [
      publication('pub-a', 'author-1', 'Уборка двора', 12),
      publication('pub-b', 'author-1', 'Помог с уроком', 10),
      publication('pub-c', 'author-2', 'Сопроводил младших', 15),
    ];
    const platform = platformStub(() => eligible);
    const unitOfWork = new MongooseUzzUnitOfWork(connection);
    const emit = new EmitExchangeRightUseCase(unitOfWork, platform, { now: () => new Date(NOW) });
    backfill = new BackfillExchangeRightsUseCase(
      unitOfWork,
      platform,
      emit,
      { assertCommunityAdmin: async () => undefined },
      { now: () => new Date(NOW) },
    );
  });
  afterEach(async () => {
    if (!connection.db) return;
    const collections = await connection.db.listCollections().toArray();
    await Promise.all(collections.map(({ name }) => connection.db!.collection(name).deleteMany({})));
  });
  afterAll(async () => {
    await connection.close();
    unregisterReplSet(replSet);
    await replSet.stop();
  });

  it('emits banks silently, then sends one digest DM per owner', async () => {
    const repositories = createMongooseUzzRepositories(connection, null);
    await repositories.identities.insert({
      id: 'identity-1', canonicalUserId: 'author-1', normalizedEmail: 'a@example.com',
      telegramUserId: '1001', telegramUsername: 'anna', createdAt: NOW, updatedAt: NOW, version: 0,
    });
    await repositories.identities.insert({
      id: 'identity-2', canonicalUserId: 'author-2', normalizedEmail: 'b@example.com',
      telegramUserId: '1002', telegramUsername: 'boris', createdAt: NOW, updatedAt: NOW, version: 0,
    });

    const preview = await backfill.preview({ communityId: 'community-1', adminId: 'admin-1' });
    expect(preview).toMatchObject({ wouldEmit: 3, owners: 2, alreadyHaveBank: 0 });

    const result = await backfill.execute({ communityId: 'community-1', adminId: 'admin-1' });
    expect(result).toMatchObject({ emitted: 3, skipped: 0, ownersNotified: 2 });
    expect(await connection.db!.collection('uzz_rights').countDocuments()).toBe(3);

    const dms = await connection.db!.collection('uzz_outbox').find({ 'payload.kind': 'rights_backfilled' }).toArray();
    expect(dms).toHaveLength(2);
    const anna = dms.find((row) => (row.payload as { telegramUserId: string }).telegramUserId === '1001');
    expect((anna?.payload as { text: string }).text).toContain('банки на обмен: 2');
    expect((anna?.payload as { text: string }).text).toContain('Уборка двора');
    expect(await connection.db!.collection('uzz_outbox').countDocuments({ 'payload.kind': 'right_emitted' })).toBe(0);
    expect(await connection.db!.collection('uzz_outbox').countDocuments({ 'payload.kind': 'group_right_emitted' })).toBe(0);

    await expect(backfill.execute({ communityId: 'community-1', adminId: 'admin-1' }))
      .rejects.toMatchObject({ code: 'BACKFILL_ALREADY_RAN' });
  });

  it('does not emit a second bank for a deed that already has one', async () => {
    const repositories = createMongooseUzzRepositories(connection, null);
    await repositories.identities.insert({
      id: 'identity-1', canonicalUserId: 'author-1', normalizedEmail: 'a@example.com',
      telegramUserId: '1001', telegramUsername: 'anna', createdAt: NOW, updatedAt: NOW, version: 0,
    });
    const platform = platformStub(() => eligible);
    const emit = new EmitExchangeRightUseCase(
      new MongooseUzzUnitOfWork(connection), platform, { now: () => new Date(NOW) },
    );
    await emit.execute({ publicationId: 'pub-a', notify: false });

    const result = await backfill.execute({ communityId: 'community-1', adminId: 'admin-1' });
    expect(result).toMatchObject({ emitted: 2, skipped: 1 });
    expect(await connection.db!.collection('uzz_rights').countDocuments()).toBe(3);
  });
});

function publication(
  id: string, ownerId: string, title: string, score: number,
): UzzPlatformPublication {
  return {
    id, communityId: 'community-1', authorId: ownerId, ownerId, title, score,
    deleted: false, postType: 'basic',
  };
}

function platformStub(eligible: () => UzzPlatformPublication[]): UzzPlatformPort {
  return {
    configuredCommunityId: async () => 'community-1',
    setSelectedCommunityId: async () => undefined,
    async getPublication(id) {
      return eligible().find((item) => item.id === id) ?? null;
    },
    async listTelegramCommunities() { return []; },
    async getCommunity() { return { id: 'community-1', name: 'Тест', telegramChatId: '-100200300' }; },
    async getUserLabels() { return new Map(); },
    async listDeedPublications() { return []; },
    async listEligibleDeedPublications() { return eligible(); },
  };
}