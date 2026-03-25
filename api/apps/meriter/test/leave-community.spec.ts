import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import { TestDatabaseHelper } from './test-db.helper';
import { MeriterModule } from '../src/meriter.module';
import * as request from 'supertest';
import { trpcMutation } from './helpers/trpc-test-helper';
import superjson from 'superjson';
import { Model, Connection } from 'mongoose';
import { getConnectionToken } from '@nestjs/mongoose';
import { UserSchemaClass, UserDocument } from '../src/domain/models/user/user.schema';
import {
  UserCommunityRoleSchemaClass,
  UserCommunityRoleDocument,
} from '../src/domain/models/user-community-role/user-community-role.schema';
import { CommunitySchemaClass, CommunityDocument } from '../src/domain/models/community/community.schema';
import { WalletSchemaClass, WalletDocument } from '../src/domain/models/wallet/wallet.schema';
import { uid } from 'uid';
import { TestSetupHelper } from './helpers/test-setup.helper';

describe('communities.leaveCommunity', () => {
  jest.setTimeout(60000);

  let app: INestApplication;
  let testDb: TestDatabaseHelper;
  let connection: Connection;

  let userModel: Model<UserDocument>;
  let userCommunityRoleModel: Model<UserCommunityRoleDocument>;
  let communityModel: Model<CommunityDocument>;
  let walletModel: Model<WalletDocument>;

  let teamId: string;
  let leadId: string;
  let memberId: string;

  beforeAll(async () => {
    testDb = new TestDatabaseHelper();
    const mongoUri = await testDb.start();
    process.env.MONGO_URL = mongoUri;
    process.env.JWT_SECRET = 'test-jwt-secret-leave-community';

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [MeriterModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    TestSetupHelper.setupTrpcMiddleware(app);
    await app.init();

    await new Promise((resolve) => setTimeout(resolve, 1000));

    connection = app.get<Connection>(getConnectionToken());
    userModel = connection.model<UserDocument>(UserSchemaClass.name);
    userCommunityRoleModel = connection.model<UserCommunityRoleDocument>(
      UserCommunityRoleSchemaClass.name,
    );
    communityModel = connection.model<CommunityDocument>(CommunitySchemaClass.name);
    walletModel = connection.model<WalletDocument>(WalletSchemaClass.name);

    teamId = uid();
    leadId = uid();
    memberId = uid();
  });

  afterAll(async () => {
    if (app) await app.close();
    if (testDb) await testDb.stop();
  });

  beforeEach(async () => {
    await userModel.deleteMany({});
    await userCommunityRoleModel.deleteMany({});
    await communityModel.deleteMany({});
    await walletModel.deleteMany({});
  });

  async function seedTeam() {
    await communityModel.create({
      id: teamId,
      name: 'Test Team',
      typeTag: 'team',
      isActive: true,
      isPriority: false,
      members: [leadId, memberId],
      settings: {
        currencyNames: { singular: 'merit', plural: 'merits', genitive: 'merits' },
      },
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    await userModel.create([
      {
        id: leadId,
        authProvider: 'telegram',
        authId: `tg-${leadId}`,
        displayName: 'Lead',
        username: 'lead',
        communityMemberships: [teamId],
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        id: memberId,
        authProvider: 'telegram',
        authId: `tg-${memberId}`,
        displayName: 'Member',
        username: 'member',
        communityMemberships: [teamId],
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ]);

    await userCommunityRoleModel.create([
      {
        id: uid(),
        userId: leadId,
        communityId: teamId,
        role: 'lead',
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        id: uid(),
        userId: memberId,
        communityId: teamId,
        role: 'participant',
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ]);
  }

  it('participant can leave team; role and wallet row removed', async () => {
    await seedTeam();
    const walletId = uid();
    await walletModel.create({
      id: walletId,
      userId: memberId,
      communityId: teamId,
      balance: 42,
      currency: { singular: 'merit', plural: 'merits', genitive: 'merits' },
      lastUpdated: new Date(),
    });

    (global as unknown as { testUserId: string }).testUserId = memberId;

    await trpcMutation(app, 'communities.leaveCommunity', { id: teamId });

    const role = await userCommunityRoleModel.findOne({
      userId: memberId,
      communityId: teamId,
    });
    expect(role).toBeNull();

    const user = await userModel.findOne({ id: memberId }).lean();
    expect(user?.communityMemberships?.includes(teamId)).toBe(false);

    const w = await walletModel.findOne({ userId: memberId, communityId: teamId });
    expect(w).toBeNull();
  });

  it('rejects leave for priority community', async () => {
    const hubId = uid();
    await communityModel.create({
      id: hubId,
      name: 'Marathon',
      typeTag: 'marathon-of-good',
      isActive: true,
      isPriority: true,
      members: [memberId],
      settings: {
        currencyNames: { singular: 'merit', plural: 'merits', genitive: 'merits' },
      },
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    await userModel.create({
      id: memberId,
      authProvider: 'telegram',
      authId: `tg-${memberId}`,
      displayName: 'Member',
      username: 'member',
      communityMemberships: [hubId],
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    await userCommunityRoleModel.create({
      id: uid(),
      userId: memberId,
      communityId: hubId,
      role: 'participant',
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    (global as unknown as { testUserId: string }).testUserId = memberId;

    const body = superjson.stringify({ id: hubId });
    const res = await request(app.getHttpServer())
      .post('/trpc/communities.leaveCommunity')
      .send(body)
      .set('Content-Type', 'application/json')
      .expect(400);

    const errJson = JSON.stringify(res.body);
    expect(errJson).toMatch(/Cannot leave priority communities/i);
  });
});
