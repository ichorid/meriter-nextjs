/**
 * Withdraw flow for community-sourced posts (sourceEntityType='community') on МД:
 * mirror publications-withdraw-project.spec.ts — only source administrators; credits CommunityWallet(sourceEntityId).
 */
import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import { TestDatabaseHelper } from './test-db.helper';
import { MeriterModule } from '../src/meriter.module';
import { WalletService } from '../src/domain/services/wallet.service';
import { CommunityWalletService } from '../src/domain/services/community-wallet.service';
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

describe('Publications withdraw (community source)', () => {
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
  let participantId: string;
  let teamCommunityId: string;
  let marathonId: string;
  let communityPubId: string;
  let normalPubId: string;

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
        onError: ({ error, path }) => {
          console.error(`tRPC error on '${path}':`, error);
        },
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
    participantId = uid();
    teamCommunityId = uid();
    marathonId = uid();
    communityPubId = uid();
    normalPubId = uid();
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

  it('withdraw from community source post: only lead can withdraw; CW receives merits', async () => {
    await userModel.create([
      { id: leadId, authProvider: 'telegram', authId: `tg-${leadId}`, displayName: 'Lead', createdAt: new Date(), updatedAt: new Date() },
      { id: participantId, authProvider: 'telegram', authId: `tg-${participantId}`, displayName: 'Participant', createdAt: new Date(), updatedAt: new Date() },
    ]);

    await communityModel.create([
      {
        id: teamCommunityId,
        name: 'Team Alpha',
        typeTag: 'team',
        isProject: false,
        settings: { currencyNames: { singular: 'merit', plural: 'merits', genitive: 'merits' }, allowWithdraw: true },
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        id: marathonId,
        name: 'Marathon',
        typeTag: 'marathon-of-good',
        settings: { currencyNames: { singular: 'merit', plural: 'merits', genitive: 'merits' }, allowWithdraw: true },
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ]);

    const now = new Date();
    await userCommunityRoleModel.create([
      { id: uid(), userId: leadId, communityId: teamCommunityId, role: 'lead', createdAt: now, updatedAt: now },
      { id: uid(), userId: participantId, communityId: teamCommunityId, role: 'participant', createdAt: now, updatedAt: now },
    ]);

    await communityWalletService.createWallet(teamCommunityId);

    await publicationModel.create({
      id: communityPubId,
      communityId: marathonId,
      authorId: leadId,
      sourceEntityId: teamCommunityId,
      sourceEntityType: 'community',
      content: 'Community post on Birzha',
      type: 'text',
      hashtags: [],
      metrics: { upvotes: 0, downvotes: 0, score: 10, commentCount: 0 },
      status: 'active',
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    (global as unknown as { testUserId: string }).testUserId = participantId;
    const asParticipant = await trpcMutationWithError(app, 'publications.withdraw', {
      publicationId: communityPubId,
      amount: 5,
    });
    expect(asParticipant.error?.code).toBe('FORBIDDEN');
    expect(asParticipant.error?.message).toMatch(/administrator|lead/i);

    (global as unknown as { testUserId: string }).testUserId = leadId;
    const result = await trpcMutation(app, 'publications.withdraw', {
      publicationId: communityPubId,
      amount: 10,
    });
    expect(result.amount).toBe(10);

    const cw = await communityWalletService.getWallet(teamCommunityId);
    expect(cw?.balance).toBe(10);
    expect(cw?.totalReceived).toBe(10);
  });

  it('withdraw from normal post (no sourceEntityType): unchanged behavior', async () => {
    await userModel.create([
      { id: leadId, authProvider: 'telegram', authId: `tg-${leadId}`, displayName: 'Author', createdAt: new Date(), updatedAt: new Date() },
    ]);

    await communityModel.create({
      id: marathonId,
      name: 'Marathon',
      typeTag: 'marathon-of-good',
      settings: { currencyNames: { singular: 'merit', plural: 'merits', genitive: 'merits' }, allowWithdraw: true },
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    await publicationModel.create({
      id: normalPubId,
      communityId: marathonId,
      authorId: leadId,
      content: 'Normal post',
      type: 'text',
      hashtags: [],
      metrics: { upvotes: 0, downvotes: 0, score: 20, commentCount: 0 },
      status: 'active',
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    (global as unknown as { testUserId: string }).testUserId = leadId;
    const result = await trpcMutation(app, 'publications.withdraw', {
      publicationId: normalPubId,
      amount: 15,
    });
    expect(result.amount).toBe(15);

    const wallet = await walletService.getWallet(leadId, GLOBAL_COMMUNITY_ID);
    expect(wallet?.getBalance() ?? 0).toBe(15);
  });
});
