/**
 * Merit transfer: balances, persistence, listings (PRD stage 5: QA-1…QA-6 API; QA-7 = repo lint/test/build).
 */
import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import { MongoMemoryReplSet } from 'mongodb-memory-server';
import { MeriterModule } from '../src/meriter.module';
import { WalletService } from '../src/domain/services/wallet.service';
import { MeritTransferService } from '../src/domain/services/merit-transfer.service';
import { Model, Connection } from 'mongoose';
import { getConnectionToken } from '@nestjs/mongoose';
import { CommunitySchemaClass, CommunityDocument } from '../src/domain/models/community/community.schema';
import { UserSchemaClass, UserDocument } from '../src/domain/models/user/user.schema';
import {
  UserCommunityRoleSchemaClass,
  UserCommunityRoleDocument,
} from '../src/domain/models/user-community-role/user-community-role.schema';
import {
  PublicationSchemaClass,
  PublicationDocument,
} from '../src/domain/models/publication/publication.schema';
import { uid } from 'uid';
import { GLOBAL_COMMUNITY_ID } from '../src/domain/common/constants/global.constant';
import { TestSetupHelper } from './helpers/test-setup.helper';
import { trpcMutation } from './helpers/trpc-test-helper';
import { BadRequestException } from '@nestjs/common';

describe('MeritTransferService (integration)', () => {
  jest.setTimeout(45000);

  let app: INestApplication;
  let replSet: MongoMemoryReplSet;
  let connection: Connection;
  let walletService: WalletService;
  let meritTransferService: MeritTransferService;

  let communityModel: Model<CommunityDocument>;
  let userModel: Model<UserDocument>;
  let userCommunityRoleModel: Model<UserCommunityRoleDocument>;
  let publicationModel: Model<PublicationDocument>;

  let teamId: string;
  let senderId: string;
  let receiverId: string;
  let leadId: string;

  const currency = { singular: 'merit', plural: 'merits', genitive: 'merits' } as const;

  beforeAll(async () => {
    replSet = await MongoMemoryReplSet.create({
      replSet: { count: 1, dbName: 'test' },
    });
    const mongoUri = replSet.getUri();
    process.env.MONGO_URL = mongoUri;
    process.env.MONGO_URL_SECONDARY = mongoUri;
    process.env.JWT_SECRET = 'test-jwt-secret-merit-transfer';

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [MeriterModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    TestSetupHelper.setupTrpcMiddleware(app);
    await app.init();
    await new Promise((r) => setTimeout(r, 300));

    walletService = app.get(WalletService);
    meritTransferService = app.get(MeritTransferService);
    connection = app.get(getConnectionToken());
    communityModel = connection.model<CommunityDocument>(CommunitySchemaClass.name);
    userModel = connection.model<UserDocument>(UserSchemaClass.name);
    userCommunityRoleModel = connection.model<UserCommunityRoleDocument>(
      UserCommunityRoleSchemaClass.name,
    );
    publicationModel = connection.model<PublicationDocument>(PublicationSchemaClass.name);

    teamId = uid();
    senderId = uid();
    receiverId = uid();
    leadId = uid();
  });

  beforeEach(async () => {
    for (const key of Object.keys(connection.collections)) {
      await connection.collections[key].deleteMany({});
    }

    await communityModel.create({
      id: teamId,
      name: 'Transfer Test Team',
      typeTag: 'team',
      isProject: false,
      telegramChatId: `chat_${teamId}_${Date.now()}`,
      members: [senderId, receiverId, leadId],
      settings: {
        currencyNames: currency,
        dailyEmission: 10,
      },
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    await userModel.create([
      {
        id: senderId,
        authProvider: 'telegram',
        authId: `tg-${senderId}`,
        displayName: 'Sender',
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        id: receiverId,
        authProvider: 'telegram',
        authId: `tg-${receiverId}`,
        displayName: 'Receiver',
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        id: leadId,
        authProvider: 'telegram',
        authId: `tg-${leadId}`,
        displayName: 'Lead',
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ]);

    const now = new Date();
    await userCommunityRoleModel.create([
      { id: uid(), userId: senderId, communityId: teamId, role: 'participant', createdAt: now, updatedAt: now },
      { id: uid(), userId: receiverId, communityId: teamId, role: 'participant', createdAt: now, updatedAt: now },
      { id: uid(), userId: leadId, communityId: teamId, role: 'lead', createdAt: now, updatedAt: now },
    ]);
  });

  afterAll(async () => {
    await app?.close();
    await replSet?.stop();
  });

  it('QA-1: transfers community-wallet merits between members; balances and list update', async () => {
    await walletService.addTransaction(senderId, teamId, 'credit', 50, 'personal', 'test_setup', 's1', currency);
    await walletService.addTransaction(receiverId, teamId, 'credit', 5, 'personal', 'test_setup', 'r1', currency);

    const record = await meritTransferService.create({
      senderId,
      receiverId,
      amount: 12,
      comment: 'team wallet share',
      sourceWalletType: 'community',
      sourceContextId: teamId,
      targetWalletType: 'community',
      targetContextId: teamId,
      communityContextId: teamId,
    });

    expect(record.amount).toBe(12);
    expect(record.communityContextId).toBe(teamId);

    const senderBal = (await walletService.getWallet(senderId, teamId))?.getBalance() ?? 0;
    const receiverBal = (await walletService.getWallet(receiverId, teamId))?.getBalance() ?? 0;
    expect(senderBal).toBe(38);
    expect(receiverBal).toBe(17);

    const list = await meritTransferService.getByCommunityContext(teamId, { page: 1, limit: 10 });
    expect(list.data.some((r) => r.id === record.id)).toBe(true);
  });

  it('QA-2: global → global transfer in team context', async () => {
    await walletService.addTransaction(senderId, GLOBAL_COMMUNITY_ID, 'credit', 40, 'personal', 'test_setup', 'g1', currency);

    await meritTransferService.create({
      senderId,
      receiverId,
      amount: 8,
      comment: 'global gift',
      sourceWalletType: 'global',
      targetWalletType: 'global',
      communityContextId: teamId,
    });

    const sGlobal = (await walletService.getWallet(senderId, GLOBAL_COMMUNITY_ID))?.getBalance() ?? 0;
    const rGlobal = (await walletService.getWallet(receiverId, GLOBAL_COMMUNITY_ID))?.getBalance() ?? 0;
    expect(sGlobal).toBe(32);
    expect(rGlobal).toBe(8);
  });

  it('QA-3: global → community wallet (receiver local bucket)', async () => {
    await walletService.addTransaction(senderId, GLOBAL_COMMUNITY_ID, 'credit', 100, 'personal', 'test_setup', 'g2', currency);

    await meritTransferService.create({
      senderId,
      receiverId,
      amount: 15,
      sourceWalletType: 'global',
      targetWalletType: 'community',
      targetContextId: teamId,
      communityContextId: teamId,
    });

    const sGlobal = (await walletService.getWallet(senderId, GLOBAL_COMMUNITY_ID))?.getBalance() ?? 0;
    const rTeam = (await walletService.getWallet(receiverId, teamId))?.getBalance() ?? 0;
    expect(sGlobal).toBe(85);
    expect(rTeam).toBe(15);
  });

  it('QA-4: insufficient balance throws; optional comment omitted is valid', async () => {
    await walletService.addTransaction(senderId, GLOBAL_COMMUNITY_ID, 'credit', 3, 'personal', 'test_setup', 'g3', currency);

    await expect(
      meritTransferService.create({
        senderId,
        receiverId,
        amount: 10,
        sourceWalletType: 'global',
        targetWalletType: 'global',
        communityContextId: teamId,
      }),
    ).rejects.toThrow(BadRequestException);

    const rec = await meritTransferService.create({
      senderId,
      receiverId,
      amount: 2,
      sourceWalletType: 'global',
      targetWalletType: 'global',
      communityContextId: teamId,
    });
    expect(rec.comment).toBeUndefined();
  });

  it('QA-4: invalid amount (non-positive) rejected at parse', async () => {
    await expect(
      meritTransferService.create({
        senderId,
        receiverId,
        amount: 0,
        sourceWalletType: 'global',
        targetWalletType: 'global',
        communityContextId: teamId,
      }),
    ).rejects.toThrow(BadRequestException);
  });

  it('QA-5: wallets.addMeritsToUser still credits target (lead admin)', async () => {
    (global as { testUserId?: string }).testUserId = leadId;

    await trpcMutation(app, 'wallets.addMeritsToUser', {
      userId: receiverId,
      communityId: teamId,
      amount: 25,
    });

    const bal = (await walletService.getWallet(receiverId, teamId))?.getBalance() ?? 0;
    expect(bal).toBe(25);
  });

  it('QA-6 (API): getByUser incoming vs outgoing', async () => {
    await walletService.addTransaction(senderId, GLOBAL_COMMUNITY_ID, 'credit', 20, 'personal', 'test_setup', 'g4', currency);

    await meritTransferService.create({
      senderId,
      receiverId,
      amount: 4,
      comment: 'x',
      sourceWalletType: 'global',
      targetWalletType: 'global',
      communityContextId: teamId,
    });

    const incoming = await meritTransferService.getByUser(receiverId, 'incoming', { page: 1, limit: 5 });
    const outgoing = await meritTransferService.getByUser(senderId, 'outgoing', { page: 1, limit: 5 });

    expect(incoming.data.length).toBe(1);
    expect(incoming.data[0].receiverId).toBe(receiverId);
    expect(outgoing.data.length).toBe(1);
    expect(outgoing.data[0].senderId).toBe(senderId);
  });

  it('QA-7: event invitee (not a community member) receives global→global transfer when eventPostId + RSVP', async () => {
    const outsiderId = uid();
    await userModel.create({
      id: outsiderId,
      authProvider: 'telegram',
      authId: `tg-${outsiderId}`,
      displayName: 'Invitee',
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    const eventPostId = uid();
    const now = new Date();
    const start = new Date(now.getTime() + 86400000);
    const end = new Date(now.getTime() + 172800000);
    await publicationModel.create({
      id: eventPostId,
      communityId: teamId,
      authorId: senderId,
      postType: 'event',
      title: 'Park cleanup',
      description: 'Join us',
      content: 'Details',
      type: 'text',
      hashtags: [],
      categories: [],
      valueTags: [],
      metrics: { upvotes: 0, downvotes: 0, score: 0, commentCount: 0 },
      images: [],
      eventStartDate: start,
      eventEndDate: end,
      eventAttendees: [outsiderId],
      status: 'active',
      createdAt: now,
      updatedAt: now,
    });

    await walletService.addTransaction(senderId, GLOBAL_COMMUNITY_ID, 'credit', 30, 'personal', 'test_setup', 'g-ev', currency);

    const record = await meritTransferService.create({
      senderId,
      receiverId: outsiderId,
      amount: 5,
      comment: 'thanks for joining',
      sourceWalletType: 'global',
      targetWalletType: 'global',
      communityContextId: teamId,
      eventPostId,
    });

    expect(record.eventPostId).toBe(eventPostId);
    const outsiderGlobal =
      (await walletService.getWallet(outsiderId, GLOBAL_COMMUNITY_ID))?.getBalance() ?? 0;
    expect(outsiderGlobal).toBe(5);
  });

  it('QA-7b: non-member invitee cannot use community target wallet', async () => {
    const outsiderId = uid();
    await userModel.create({
      id: outsiderId,
      authProvider: 'telegram',
      authId: `tg-${outsiderId}-2`,
      displayName: 'Invitee2',
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    const eventPostId = uid();
    const now = new Date();
    await publicationModel.create({
      id: eventPostId,
      communityId: teamId,
      authorId: senderId,
      postType: 'event',
      title: 'Meetup',
      description: 'Hi',
      content: 'X',
      type: 'text',
      hashtags: [],
      categories: [],
      valueTags: [],
      metrics: { upvotes: 0, downvotes: 0, score: 0, commentCount: 0 },
      images: [],
      eventStartDate: now,
      eventEndDate: now,
      eventAttendees: [outsiderId],
      status: 'active',
      createdAt: now,
      updatedAt: now,
    });

    await walletService.addTransaction(senderId, GLOBAL_COMMUNITY_ID, 'credit', 20, 'personal', 'test_setup', 'g-ev2', currency);

    await expect(
      meritTransferService.create({
        senderId,
        receiverId: outsiderId,
        amount: 3,
        sourceWalletType: 'global',
        targetWalletType: 'community',
        targetContextId: teamId,
        communityContextId: teamId,
        eventPostId,
      }),
    ).rejects.toThrow(BadRequestException);
  });
});
