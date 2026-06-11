/**
 * Entrepreneurs demo pack: scoped seed, shared wallet on parent + child projects.
 */
import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import { MongoMemoryReplSet } from 'mongodb-memory-server';
import { getConnectionToken } from '@nestjs/mongoose';
import { Connection, Model } from 'mongoose';
import { uid } from 'uid';
import { MeriterModule } from '../src/meriter.module';
import { createMongoMemoryReplSetWithRetry } from './mongo-memory-shared';
import { TestSetupHelper } from './helpers/test-setup.helper';
import { trpcMutation, trpcMutationWithError } from './helpers/trpc-test-helper';
import { unregisterReplSet } from './mongo-memory-registry.js';
import { UserSchemaClass, UserDocument } from '../src/domain/models/user/user.schema';
import {
  CommunityWalletSchemaClass,
  CommunityWalletDocument,
} from '../src/domain/models/community-wallet/community-wallet.schema';
import { ENTREPRENEURS_DEMO_COMMUNITY_ID } from '../src/domain/common/constants/entrepreneurs-demo.constants';
import { PlatformEntrepreneursDemoSeedService } from '../src/domain/services/platform-entrepreneurs-demo-seed.service';
import { WalletContextResolverService } from '../src/domain/services/wallet-context-resolver.service';

describe('Entrepreneurs demo pack (integration)', () => {
  jest.setTimeout(180000);

  let app: INestApplication;
  let replSet: MongoMemoryReplSet;
  let userModel: Model<UserDocument>;
  let communityWalletModel: Model<CommunityWalletDocument>;
  let superadminId: string;

  beforeAll(async () => {
    replSet = await createMongoMemoryReplSetWithRetry({
      replSet: { count: 1, dbName: 'entrepreneurs_demo_test' },
    });
    const mongoUri = replSet.getUri();
    process.env.MONGO_URL = mongoUri;
    process.env.MONGO_URL_SECONDARY = mongoUri;
    process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-jwt-secret-entrepreneurs';

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [MeriterModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    TestSetupHelper.setupTrpcMiddleware(app);
    await app.init();
    await new Promise((r) => setTimeout(r, 300));

    const connection = app.get<Connection>(getConnectionToken());
    userModel = connection.model<UserDocument>(UserSchemaClass.name);
    communityWalletModel = connection.model<CommunityWalletDocument>(
      CommunityWalletSchemaClass.name,
    );

    superadminId = uid();
    const now = new Date();
    await userModel.create({
      id: superadminId,
      authProvider: 'fake',
      authId: `superadmin_${superadminId}`,
      displayName: 'Superadmin',
      username: `super_${superadminId}`,
      globalRole: 'superadmin',
      communityMemberships: [],
      createdAt: now,
      updatedAt: now,
    });
  });

  afterAll(async () => {
    unregisterReplSet(replSet);
    await replSet.stop();
    if (app) await app.close();
  });

  it('seeds community with shared wallet and reconciled community wallet balance', async () => {
    (global as { testUserId?: string }).testUserId = superadminId;

    const result = await trpcMutation(app, 'platformDev.seedEntrepreneursCommunity', {
      force: true,
    });

    expect(result.communityId).toBe(ENTREPRENEURS_DEMO_COMMUNITY_ID);
    expect(result.usersCreated).toBe(10);
    expect(result.publicationsCreated).toBeGreaterThan(0);
    expect(result.pollsCreated).toBe(2);

    const walletResolver = app.get(WalletContextResolverService);
    const childWalletKey = await walletResolver.resolveCommunityWalletCommunityId(
      'demo_ent_project_horeca',
    );
    expect(childWalletKey).toBe(ENTREPRENEURS_DEMO_COMMUNITY_ID);

    const parentWalletKey = await walletResolver.resolvePersonalWalletCommunityId(
      ENTREPRENEURS_DEMO_COMMUNITY_ID,
    );
    expect(parentWalletKey).toBe(ENTREPRENEURS_DEMO_COMMUNITY_ID);

    const cw = await communityWalletModel
      .findOne({ communityId: ENTREPRENEURS_DEMO_COMMUNITY_ID })
      .lean();
    expect(cw?.balance).toBeDefined();
    expect(result.communityWalletBalance).toBe(cw?.balance);

    // 420k top-ups − 120k payouts − post/poll fees (small)
    expect(cw!.balance).toBeGreaterThan(290_000);
    expect(cw!.balance).toBeLessThanOrEqual(300_000);

    const seedService = app.get(PlatformEntrepreneursDemoSeedService);
    const personas = seedService.getDemoPersonas();
    expect(personas).toHaveLength(10);
    expect(personas.some((p) => p.login === 'kravtsov_a' && p.role === 'lead')).toBe(
      true,
    );

    const duplicate = await trpcMutationWithError(
      app,
      'platformDev.seedEntrepreneursCommunity',
      {},
    );
    expect(duplicate.error?.message ?? '').toMatch(/already|уже/i);
  });
});
