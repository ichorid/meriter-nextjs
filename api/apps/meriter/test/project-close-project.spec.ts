/**
 * closeProject: close Birzha posts (sourceEntityType='project'), then sweep project CommunityWallet to global wallets,
 * then set projectStatus='archived'. Birzha close credits the project wallet; auto payout empties it.
 */
import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import { TestDatabaseHelper } from './test-db.helper';
import { MeriterModule } from '../src/meriter.module';
import { CommunityWalletService } from '../src/domain/services/community-wallet.service';
import { WalletService } from '../src/domain/services/wallet.service';
import { Model, Connection } from 'mongoose';
import { getConnectionToken } from '@nestjs/mongoose';
import { CommunitySchemaClass, CommunityDocument } from '../src/domain/models/community/community.schema';
import { UserSchemaClass, UserDocument } from '../src/domain/models/user/user.schema';
import { PublicationSchemaClass, PublicationDocument } from '../src/domain/models/publication/publication.schema';
import { UserCommunityRoleSchemaClass, UserCommunityRoleDocument } from '../src/domain/models/user-community-role/user-community-role.schema';
import { CommunityWalletSchemaClass, CommunityWalletDocument } from '../src/domain/models/community-wallet/community-wallet.schema';
import { uid } from 'uid';
import { trpcMutation, trpcMutationWithError } from './helpers/trpc-test-helper';
import { GLOBAL_COMMUNITY_ID } from '../src/domain/common/constants/global.constant';
import { TrpcService } from '../src/trpc/trpc.service';
import { createExpressMiddleware } from '@trpc/server/adapters/express';
import * as cookieParser from 'cookie-parser';

describe('Project closeProject', () => {
  jest.setTimeout(30000);

  let app: INestApplication;
  let testDb: TestDatabaseHelper;
  let connection: Connection;
  let walletService: WalletService;
  let communityWalletService: CommunityWalletService;

  let communityModel: Model<CommunityDocument>;
  let userModel: Model<UserDocument>;
  let publicationModel: Model<PublicationDocument>;
  let userCommunityRoleModel: Model<UserCommunityRoleDocument>;
  let communityWalletModel: Model<CommunityWalletDocument>;

  let leadId: string;
  let projectId: string;
  let marathonId: string;
  let projectPostId: string;

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

    walletService = app.get(WalletService);
    communityWalletService = app.get(CommunityWalletService);
    connection = app.get(getConnectionToken());
    communityModel = connection.model<CommunityDocument>(CommunitySchemaClass.name);
    userModel = connection.model<UserDocument>(UserSchemaClass.name);
    publicationModel = connection.model<PublicationDocument>(PublicationSchemaClass.name);
    userCommunityRoleModel = connection.model<UserCommunityRoleDocument>(UserCommunityRoleSchemaClass.name);
    communityWalletModel = connection.model<CommunityWalletDocument>(CommunityWalletSchemaClass.name);

    leadId = uid();
    projectId = uid();
    marathonId = uid();
    projectPostId = uid();
  });

  beforeEach(async () => {
    await communityModel.deleteMany({});
    await userModel.deleteMany({});
    await publicationModel.deleteMany({});
    await userCommunityRoleModel.deleteMany({});
    await communityWalletModel.deleteMany({});
    await connection.db.collection('wallets').deleteMany({});
    await connection.db.collection('transactions').deleteMany({});
  });

  afterAll(async () => {
    await app?.close();
    await testDb?.stop();
  });

  it('closeProject: closes Birzha posts, pays out project wallet to global, archives project', async () => {
    await userModel.create([
      { id: leadId, authProvider: 'telegram', authId: `tg-${leadId}`, displayName: 'Lead', createdAt: new Date(), updatedAt: new Date() },
    ]);

    await communityModel.create([
      {
        id: projectId,
        name: 'Test Project',
        typeTag: 'project',
        isProject: true,
        projectStatus: 'active',
        founderSharePercent: 20,
        settings: { currencyNames: { singular: 'merit', plural: 'merits', genitive: 'merits' } },
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        id: marathonId,
        name: 'Marathon',
        typeTag: 'marathon-of-good',
        settings: { currencyNames: { singular: 'merit', plural: 'merits', genitive: 'merits' } },
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ]);

    await userCommunityRoleModel.create([
      { id: uid(), userId: leadId, communityId: projectId, role: 'lead', createdAt: new Date(), updatedAt: new Date() },
    ]);

    await communityWalletService.createWallet(projectId);

    await publicationModel.create({
      id: projectPostId,
      communityId: marathonId,
      authorId: leadId,
      sourceEntityId: projectId,
      sourceEntityType: 'project',
      content: 'Project report on Birzha',
      type: 'text',
      hashtags: [],
      metrics: { upvotes: 0, downvotes: 0, score: 15, commentCount: 0 },
      status: 'active',
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    (global as any).testUserId = leadId;
    await trpcMutation(app, 'project.closeProject', { projectId });

    const pub = await publicationModel.findOne({ id: projectPostId }).lean();
    expect(pub?.status).toBe('closed');
    expect(pub?.closeReason).toBe('manual');

    const project = await communityModel.findOne({ id: projectId }).lean();
    expect(project?.projectStatus).toBe('archived');

    const cw = await communityWalletService.getWallet(projectId);
    expect(cw?.balance).toBe(0);
    expect(cw?.totalReceived).toBe(15);

    const leadWallet = await walletService.getWallet(leadId, GLOBAL_COMMUNITY_ID);
    expect(leadWallet?.getBalance() ?? 0).toBe(15);
  });

  it('closeProject: only lead can close', async () => {
    const participantId = uid();
    await userModel.create([
      { id: leadId, authProvider: 'telegram', authId: `tg-${leadId}`, displayName: 'Lead', createdAt: new Date(), updatedAt: new Date() },
      { id: participantId, authProvider: 'telegram', authId: `tg-${participantId}`, displayName: 'Part', createdAt: new Date(), updatedAt: new Date() },
    ]);

    await communityModel.create([
      {
        id: projectId,
        name: 'Project',
        typeTag: 'project',
        isProject: true,
        projectStatus: 'active',
        founderSharePercent: 10,
        settings: {},
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        id: marathonId,
        name: 'Marathon',
        typeTag: 'marathon-of-good',
        settings: {},
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ]);

    await userCommunityRoleModel.create([
      { id: uid(), userId: leadId, communityId: projectId, role: 'lead', createdAt: new Date(), updatedAt: new Date() },
      { id: uid(), userId: participantId, communityId: projectId, role: 'participant', createdAt: new Date(), updatedAt: new Date() },
    ]);

    (global as any).testUserId = participantId;
    const res = await trpcMutationWithError(app, 'project.closeProject', { projectId });
    expect(res.error?.code).toBe('FORBIDDEN');

    const project = await communityModel.findOne({ id: projectId }).lean();
    expect(project?.projectStatus).toBe('active');
  });
});
