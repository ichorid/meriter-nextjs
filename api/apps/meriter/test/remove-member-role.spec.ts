import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import { TestDatabaseHelper } from './test-db.helper';
import { MeriterModule } from '../src/meriter.module';
import { trpcMutation, trpcQuery } from './helpers/trpc-test-helper';
import { Model, Connection } from 'mongoose';
import { getConnectionToken } from '@nestjs/mongoose';
import { UserSchemaClass, UserDocument } from '../src/domain/models/user/user.schema';
import { UserCommunityRoleSchemaClass, UserCommunityRoleDocument } from '../src/domain/models/user-community-role/user-community-role.schema';
import { CommunitySchemaClass, CommunityDocument } from '../src/domain/models/community/community.schema';
import { uid } from 'uid';
import { TestSetupHelper } from './helpers/test-setup.helper';

/**
 * Unit test for removeMember: when a user is removed from a team,
 * their UserCommunityRole must also be removed so the user's profile
 * no longer shows them as part of that team.
 */
describe('communities.removeMember - removes user role so profile is in sync', () => {
  jest.setTimeout(60000);

  let app: INestApplication;
  let testDb: TestDatabaseHelper;
  let connection: Connection;

  let userModel: Model<UserDocument>;
  let userCommunityRoleModel: Model<UserCommunityRoleDocument>;
  let communityModel: Model<CommunityDocument>;

  let teamId: string;
  let leadId: string;
  let memberId: string;

  beforeAll(async () => {
    testDb = new TestDatabaseHelper();
    const mongoUri = await testDb.start();
    process.env.MONGO_URL = mongoUri;
    process.env.JWT_SECRET = 'test-jwt-secret-remove-member-role';

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [MeriterModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    TestSetupHelper.setupTrpcMiddleware(app);
    await app.init();

    await new Promise((resolve) => setTimeout(resolve, 1000));

    connection = app.get<Connection>(getConnectionToken());
    userModel = connection.model<UserDocument>(UserSchemaClass.name);
    userCommunityRoleModel = connection.model<UserCommunityRoleDocument>(UserCommunityRoleSchemaClass.name);
    communityModel = connection.model<CommunityDocument>(CommunitySchemaClass.name);

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
  });

  it('removes user from community and removes their role so getUserRoles no longer includes the team', async () => {
    await communityModel.create({
      id: teamId,
      name: 'Test Team',
      typeTag: 'team',
      isActive: true,
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
      { id: uid(), userId: leadId, communityId: teamId, role: 'lead', createdAt: new Date(), updatedAt: new Date() },
      { id: uid(), userId: memberId, communityId: teamId, role: 'participant', createdAt: new Date(), updatedAt: new Date() },
    ]);

    (global as any).testUserId = leadId;

    const rolesBefore = await trpcQuery(app, 'users.getUserRoles', { userId: memberId });
    expect(rolesBefore.some((r: { communityId: string }) => r.communityId === teamId)).toBe(true);

    await trpcMutation(app, 'communities.removeMember', { id: teamId, userId: memberId });

    const rolesAfter = await trpcQuery(app, 'users.getUserRoles', { userId: memberId });
    const roleForTeam = rolesAfter.find((r: { communityId: string }) => r.communityId === teamId);
    expect(roleForTeam).toBeUndefined();
  });
});
