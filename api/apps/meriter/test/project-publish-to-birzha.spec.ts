/**
 * publishToBirzha: postCost from CommunityWallet, post created with sourceEntityId/Type.
 * getWallet: member can read project wallet.
 */
import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import { TestDatabaseHelper } from './test-db.helper';
import { MeriterModule } from '../src/meriter.module';
import { CommunityWalletService } from '../src/domain/services/community-wallet.service';
import { Model, Connection } from 'mongoose';
import { getConnectionToken } from '@nestjs/mongoose';
import { CommunitySchemaClass, CommunityDocument } from '../src/domain/models/community/community.schema';
import { UserSchemaClass, UserDocument } from '../src/domain/models/user/user.schema';
import { PublicationSchemaClass, PublicationDocument } from '../src/domain/models/publication/publication.schema';
import { UserCommunityRoleSchemaClass, UserCommunityRoleDocument } from '../src/domain/models/user-community-role/user-community-role.schema';
import { uid } from 'uid';
import { trpcMutation, trpcMutationWithError, trpcQuery } from './helpers/trpc-test-helper';
import { TrpcService } from '../src/trpc/trpc.service';
import { createExpressMiddleware } from '@trpc/server/adapters/express';
import * as cookieParser from 'cookie-parser';

describe('Project publishToBirzha and getWallet', () => {
  jest.setTimeout(30000);

  let app: INestApplication;
  let testDb: TestDatabaseHelper;
  let connection: Connection;
  let communityWalletService: CommunityWalletService;

  let communityModel: Model<CommunityDocument>;
  let userModel: Model<UserDocument>;
  let publicationModel: Model<PublicationDocument>;
  let userCommunityRoleModel: Model<UserCommunityRoleDocument>;

  let leadId: string;
  let participantId: string;
  let projectId: string;
  let marathonId: string;

  beforeAll(async () => {
    testDb = new TestDatabaseHelper();
    const mongoUri = await testDb.start();
    process.env.MONGO_URL = mongoUri;
    process.env.JWT_SECRET = 'test-jwt-secret';

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [MeriterModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.use(cookieParser());
    const trpcService = app.get(TrpcService);
    app.use(
      '/trpc',
      createExpressMiddleware({
        router: trpcService.getRouter(),
        createContext: ({ req, res }) => trpcService.createContext(req, res),
        onError: () => {},
      }),
    );
    await app.init();

    await new Promise((r) => setTimeout(r, 500));

    communityWalletService = app.get(CommunityWalletService);
    connection = app.get(getConnectionToken());
    communityModel = connection.model<CommunityDocument>(CommunitySchemaClass.name);
    userModel = connection.model<UserDocument>(UserSchemaClass.name);
    publicationModel = connection.model<PublicationDocument>(PublicationSchemaClass.name);
    userCommunityRoleModel = connection.model<UserCommunityRoleDocument>(UserCommunityRoleSchemaClass.name);

    leadId = uid();
    participantId = uid();
    projectId = uid();
    marathonId = uid();
  });

  beforeEach(async () => {
    await communityModel.deleteMany({});
    await userModel.deleteMany({});
    await publicationModel.deleteMany({});
    await userCommunityRoleModel.deleteMany({});
    await connection.db.collection('community_wallets').deleteMany({});
  });

  afterAll(async () => {
    await app?.close();
    await testDb?.stop();
  });

  it('publishToBirzha: postCost deducted when balance sufficient; post has sourceEntityId/Type', async () => {
    await userModel.create([
      { id: leadId, authProvider: 'telegram', authId: `tg-${leadId}`, displayName: 'Lead', createdAt: new Date(), updatedAt: new Date() },
    ]);

    await communityModel.create([
      {
        id: projectId,
        name: 'Project',
        typeTag: 'team',
        isProject: true,
        founderSharePercent: 10,
        investorSharePercent: 20,
        settings: { currencyNames: { singular: 'merit', plural: 'merits', genitive: 'merits' } },
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        id: marathonId,
        name: 'Marathon',
        typeTag: 'marathon-of-good',
        settings: {
          currencyNames: { singular: 'merit', plural: 'merits', genitive: 'merits' },
          postCost: 2,
          investorShareMin: 1,
          investorShareMax: 99,
        },
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ]);

    const now = new Date();
    await userCommunityRoleModel.create([
      { id: uid(), userId: leadId, communityId: projectId, role: 'lead', createdAt: now, updatedAt: now },
    ]);

    await communityWalletService.createWallet(projectId);
    await communityWalletService.deposit(projectId, 10);

    (global as any).testUserId = leadId;
    const result = await trpcMutation(app, 'project.publishToBirzha', {
      projectId,
      content: 'Post on Birzha',
      type: 'text',
      investorSharePercent: 25,
    });

    expect(result.id).toBeDefined();

    const pub = await publicationModel.findOne({ id: result.id }).lean();
    expect(pub?.sourceEntityId).toBe(projectId);
    expect(pub?.sourceEntityType).toBe('project');
    expect(pub?.communityId).toBe(marathonId);
    expect(pub?.authorId).toBe(leadId);

    const wallet = await communityWalletService.getWallet(projectId);
    expect(wallet?.balance).toBe(8);
  });

  it('publishToBirzha: error when insufficient balance', async () => {
    await userModel.create([
      { id: leadId, authProvider: 'telegram', authId: `tg-${leadId}`, displayName: 'Lead', createdAt: new Date(), updatedAt: new Date() },
    ]);

    await communityModel.create([
      {
        id: projectId,
        name: 'Project',
        typeTag: 'team',
        isProject: true,
        founderSharePercent: 10,
        settings: { currencyNames: { singular: 'merit', plural: 'merits', genitive: 'merits' } },
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        id: marathonId,
        name: 'Marathon',
        typeTag: 'marathon-of-good',
        settings: { currencyNames: { singular: 'merit', plural: 'merits', genitive: 'merits' }, postCost: 100, investorShareMin: 1, investorShareMax: 99 },
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ]);

    const now = new Date();
    await userCommunityRoleModel.create([
      { id: uid(), userId: leadId, communityId: projectId, role: 'lead', createdAt: now, updatedAt: now },
    ]);

    await communityWalletService.createWallet(projectId);

    (global as any).testUserId = leadId;
    const res = await trpcMutationWithError(app, 'project.publishToBirzha', {
      projectId,
      content: 'Post',
      type: 'text',
    });

    expect(res.error?.code).toBe('BAD_REQUEST');
    expect(res.error?.message).toContain('Insufficient');
  });

  it('getWallet: member can read project wallet', async () => {
    await userModel.create([
      { id: leadId, authProvider: 'telegram', authId: `tg-${leadId}`, displayName: 'Lead', createdAt: new Date(), updatedAt: new Date() },
      { id: participantId, authProvider: 'telegram', authId: `tg-${participantId}`, displayName: 'P', createdAt: new Date(), updatedAt: new Date() },
    ]);

    await communityModel.create({
      id: projectId,
      name: 'Project',
      typeTag: 'team',
      isProject: true,
      settings: { currencyNames: { singular: 'merit', plural: 'merits', genitive: 'merits' } },
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    const now = new Date();
    await userCommunityRoleModel.create([
      { id: uid(), userId: leadId, communityId: projectId, role: 'lead', createdAt: now, updatedAt: now },
      { id: uid(), userId: participantId, communityId: projectId, role: 'participant', createdAt: now, updatedAt: now },
    ]);

    await communityWalletService.createWallet(projectId);
    await communityWalletService.deposit(projectId, 50);

    (global as any).testUserId = participantId;
    const wallet = await trpcQuery(app, 'project.getWallet', { projectId });
    expect(wallet.balance).toBe(50);
  });
});
