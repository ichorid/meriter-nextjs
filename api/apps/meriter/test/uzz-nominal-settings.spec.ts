import { MongoMemoryReplSet } from 'mongodb-memory-server';
import { Connection, createConnection } from 'mongoose';
import { Clock } from '../src/application/uzz/ports/clock.port';
import { UpdateSettingsUseCase } from '../src/application/uzz/use-cases/update-settings.use-case';
import { releaseReadyHoldingRightsInCommunity } from '../src/application/uzz/use-cases/identity-link.helpers';
import { ExchangeRight } from '../src/domain/uzz/entities/exchange-right';
import { UzzValidationError } from '../src/domain/uzz/errors';
import { defaultSettings } from '../src/application/uzz/uzz-settings';
import {
  createMongooseUzzRepositories,
  initializeUzzModels,
} from '../src/infrastructure/uzz/persistence/mongoose-uzz-repositories';
import { MongooseUzzUnitOfWork } from '../src/infrastructure/uzz/persistence/mongoose-uzz-unit-of-work';
import { createMongoMemoryReplSetWithRetry } from './mongo-memory-shared';
import { unregisterReplSet } from './mongo-memory-registry.js';

const NOW = new Date('2026-08-14T00:00:00.000Z');

describe('UZZ nominal settings', () => {
  jest.setTimeout(60_000);
  let replSet: MongoMemoryReplSet;
  let connection: Connection;
  let updateSettings: UpdateSettingsUseCase;

  beforeAll(async () => {
    replSet = await createMongoMemoryReplSetWithRetry();
    connection = await createConnection(replSet.getUri()).asPromise();
    await initializeUzzModels(connection);
    const clock: Clock = { now: () => new Date(NOW) };
    updateSettings = new UpdateSettingsUseCase(
      new MongooseUzzUnitOfWork(connection),
      { assertCommunityAdmin: async () => undefined },
      clock,
    );
  });

  afterEach(async () => {
    if (!connection.db) return;
    const collections = await connection.db.listCollections().toArray();
    await Promise.all(
      collections.map(({ name }) => connection.db!.collection(name).deleteMany({})),
    );
  });

  afterAll(async () => {
    await connection.close();
    unregisterReplSet(replSet);
    await replSet.stop();
  });

  it('rejects auto-assign when the default nominal is below the floor', async () => {
    await expect(
      updateSettings.execute({
        commandId: 'settings-invalid-default',
        communityId: 'community-1',
        adminId: 'admin-1',
        patch: {
          autoAssignNominal: true,
          defaultNominalRub: 50,
          nominalFloorRub: 100,
        },
      }),
    ).rejects.toBeInstanceOf(UzzValidationError);
  });

  it('lifts the default nominal when the floor is raised above it', async () => {
    await updateSettings.execute({
      commandId: 'settings-seed-floor',
      communityId: 'community-1',
      adminId: 'admin-1',
      patch: { nominalFloorRub: 100, defaultNominalRub: 100 },
    });

    const next = await updateSettings.execute({
      commandId: 'settings-raise-floor',
      communityId: 'community-1',
      adminId: 'admin-1',
      patch: { nominalFloorRub: 500 },
    });

    expect(next).toMatchObject({ nominalFloorRub: 500, defaultNominalRub: 500 });
  });

  it('still rejects an explicit default nominal below an explicit floor', async () => {
    await expect(
      updateSettings.execute({
        commandId: 'settings-explicit-conflict',
        communityId: 'community-1',
        adminId: 'admin-1',
        patch: { autoAssignNominal: true, nominalFloorRub: 500, defaultNominalRub: 300 },
      }),
    ).rejects.toBeInstanceOf(UzzValidationError);
  });

  it('keeps the nominal assignment form working after the floor was raised', async () => {
    await updateSettings.execute({
      commandId: 'settings-autoassign-on',
      communityId: 'community-1',
      adminId: 'admin-1',
      patch: { autoAssignNominal: true, defaultNominalRub: 100, nominalFloorRub: 100 },
    });
    // "Правила пилота" raises the floor without touching the nominal block.
    await updateSettings.execute({
      commandId: 'settings-floor-up',
      communityId: 'community-1',
      adminId: 'admin-1',
      patch: { nominalFloorRub: 800 },
    });
    // "Сохранить назначение номинала" re-submits only its own two fields.
    const saved = await updateSettings.execute({
      commandId: 'settings-nominal-block',
      communityId: 'community-1',
      adminId: 'admin-1',
      patch: { autoAssignNominal: true, defaultNominalRub: 800 },
    });

    expect(saved).toMatchObject({ nominalFloorRub: 800, defaultNominalRub: 800 });
  });

  it('releases a stuck holding bank when the owner is already fully linked', async () => {
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
      id: 'identity-1:owner-1',
      identityId: 'identity-1',
      aliasUserId: 'owner-1',
      createdAt: NOW,
    });
    await repositories.rights.insert(ExchangeRight.restore({
      id: 'right-stuck',
      communityId: 'community-1',
      ownerId: 'owner-1',
      sourcePublicationId: 'publication-stuck',
      nominalRub: null,
      nominalAssignedAt: null,
      lastDemurrageAt: null,
      hopsLeft: 10,
      status: 'holding',
      lockedByDealId: null,
      ownerHistory: [{ userId: 'owner-1', at: NOW, reason: 'emission_holding' }],
      version: 0,
      createdAt: NOW,
      updatedAt: NOW,
    }));

    await releaseReadyHoldingRightsInCommunity(repositories, 'community-1', NOW);

    expect(
      (await repositories.rights.findById('right-stuck'))?.snapshot().status,
    ).toBe('awaiting_nominal');
  });

  it('assigns the default nominal to the waiting queue when auto-assign is enabled', async () => {
    const repositories = createMongooseUzzRepositories(connection, null);
    await repositories.settings.upsert(defaultSettings('community-1', NOW), null);
    await repositories.rights.insert(ExchangeRight.restore({
      id: 'right-waiting',
      communityId: 'community-1',
      ownerId: 'owner-1',
      sourcePublicationId: 'publication-waiting',
      nominalRub: null,
      nominalAssignedAt: null,
      lastDemurrageAt: null,
      hopsLeft: 10,
      status: 'awaiting_nominal',
      lockedByDealId: null,
      ownerHistory: [{ userId: 'owner-1', at: NOW, reason: 'emission' }],
      version: 0,
      createdAt: NOW,
      updatedAt: NOW,
    }));

    await updateSettings.execute({
      commandId: 'settings-auto-assign',
      communityId: 'community-1',
      adminId: 'admin-1',
      patch: { autoAssignNominal: true, defaultNominalRub: 400 },
    });

    expect(
      (await repositories.rights.findById('right-waiting'))?.snapshot(),
    ).toMatchObject({ status: 'active', nominalRub: 400 });
  });
});
