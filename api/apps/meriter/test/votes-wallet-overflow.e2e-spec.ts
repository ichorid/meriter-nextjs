import { INestApplication } from '@nestjs/common';
import { getConnectionToken, getModelToken } from '@nestjs/mongoose';
import { Connection, Model } from 'mongoose';
import { uid } from 'uid';
import { TestSetupHelper } from './helpers/test-setup.helper';
import { trpcMutation, trpcQuery } from './helpers/trpc-test-helper';
import { Community, CommunityDocument } from '../src/domain/models/community/community.schema';
import { Publication, PublicationDocument } from '../src/domain/models/publication/publication.schema';
import { User, UserDocument } from '../src/domain/models/user/user.schema';
import { Wallet, WalletDocument } from '../src/domain/models/wallet/wallet.schema';

describe('Votes - wallet overflow (e2e)', () => {
  jest.setTimeout(60000);

  let app: INestApplication;
  let testDb: any;
  let connection: Connection;

  let communityModel: Model<CommunityDocument>;
  let userModel: Model<UserDocument>;
  let publicationModel: Model<PublicationDocument>;
  let walletModel: Model<WalletDocument>;

  const voterId = uid();
  const authorId = uid();

  const regularCommunityId = uid();
  const teamCommunityId = uid();

  const regularPublicationId = uid();
  const teamPublicationId = uid();

  beforeAll(async () => {
    process.env.JWT_SECRET = 'test-jwt-secret-key-for-wallet-overflow';
    const ctx = await TestSetupHelper.createTestApp();
    app = ctx.app;
    testDb = ctx.testDb;

    connection = app.get(getConnectionToken());
    communityModel = app.get<Model<CommunityDocument>>(getModelToken(Community.name));
    userModel = app.get<Model<UserDocument>>(getModelToken(User.name));
    publicationModel = app.get<Model<PublicationDocument>>(getModelToken(Publication.name));
    walletModel = app.get<Model<WalletDocument>>(getModelToken(Wallet.name));
  });

  beforeEach(async () => {
    // Reset DB between tests
    if (connection?.collections) {
      for (const key in connection.collections) {
        await connection.collections[key].deleteMany({});
      }
    }

    const now = new Date();

    // Users
    await userModel.create([
      {
        id: voterId,
        authProvider: 'telegram',
        authId: `voter_${voterId}`,
        displayName: 'Voter',
        username: 'voter',
        firstName: 'Vote',
        lastName: 'R',
        avatarUrl: 'https://example.com/v.jpg',
        createdAt: now,
        updatedAt: now,
      },
      {
        id: authorId,
        authProvider: 'telegram',
        authId: `author_${authorId}`,
        displayName: 'Author',
        username: 'author',
        firstName: 'Au',
        lastName: 'Thor',
        avatarUrl: 'https://example.com/a.jpg',
        createdAt: now,
        updatedAt: now,
      },
    ]);

    // Communities
    await communityModel.create([
      {
        id: regularCommunityId,
        name: 'Regular Community',
        typeTag: 'custom',
        members: [voterId, authorId],
        settings: {
          currencyNames: { singular: 'merit', plural: 'merits', genitive: 'merits' },
          dailyEmission: 5,
        },
        meritSettings: {
          dailyQuota: 5,
          quotaEnabled: true,
          quotaRecipients: ['superadmin', 'lead', 'participant'],
        },
        hashtags: ['test'],
        hashtagDescriptions: {},
        isActive: true,
        createdAt: now,
        updatedAt: now,
      },
      {
        id: teamCommunityId,
        name: 'Team Community',
        typeTag: 'team',
        members: [voterId, authorId],
        settings: {
          currencyNames: { singular: 'merit', plural: 'merits', genitive: 'merits' },
          dailyEmission: 5,
        },
        meritSettings: {
          dailyQuota: 5,
          quotaEnabled: true,
          quotaRecipients: ['superadmin', 'lead', 'participant'],
        },
        hashtags: ['team'],
        hashtagDescriptions: {},
        isActive: true,
        createdAt: now,
        updatedAt: now,
      },
    ]);

    // Roles (permission middleware requires user_community_roles)
    await connection.db.collection('user_community_roles').insertMany([
      { id: uid(), userId: voterId, communityId: regularCommunityId, role: 'lead', createdAt: now, updatedAt: now },
      { id: uid(), userId: authorId, communityId: regularCommunityId, role: 'participant', createdAt: now, updatedAt: now },
      { id: uid(), userId: voterId, communityId: teamCommunityId, role: 'lead', createdAt: now, updatedAt: now },
      { id: uid(), userId: authorId, communityId: teamCommunityId, role: 'participant', createdAt: now, updatedAt: now },
    ]);

    // Wallets (voter has funds in both communities)
    await walletModel.create([
      {
        id: uid(),
        userId: voterId,
        communityId: regularCommunityId,
        balance: 10,
        currency: { singular: 'merit', plural: 'merits', genitive: 'merits' },
        lastUpdated: now,
        createdAt: now,
        updatedAt: now,
      },
      {
        id: uid(),
        userId: voterId,
        communityId: teamCommunityId,
        balance: 10,
        currency: { singular: 'merit', plural: 'merits', genitive: 'merits' },
        lastUpdated: now,
        createdAt: now,
        updatedAt: now,
      },
    ]);

    // Publications (authored by a different user so voting is allowed)
    await publicationModel.create([
      {
        id: regularPublicationId,
        communityId: regularCommunityId,
        authorId,
        content: 'Regular pub',
        type: 'text',
        hashtags: [],
        metrics: { upvotes: 0, downvotes: 0, score: 0, commentCount: 0 },
        createdAt: now,
        updatedAt: now,
      },
      {
        id: teamPublicationId,
        communityId: teamCommunityId,
        authorId,
        content: 'Team pub',
        type: 'text',
        hashtags: [],
        metrics: { upvotes: 0, downvotes: 0, score: 0, commentCount: 0 },
        createdAt: now,
        updatedAt: now,
      },
    ]);

    // tRPC auth guard reads this global
    (global as any).testUserId = voterId;
  });

  afterAll(async () => {
    await app.close();
    await testDb.stop();
  });

  async function consumeQuotaToOneRemaining(communityId: string, publicationId: string) {
    // Spend 4 out of 5 quota, leaving 1 remaining.
    await trpcMutation(app, 'votes.createWithComment', {
      targetType: 'publication',
      targetId: publicationId,
      quotaAmount: 4,
      walletAmount: 0,
      comment: 'Consume quota',
      communityId,
    });

    const quota = await trpcQuery(app, 'wallets.getQuota', {
      userId: voterId,
      communityId,
    });

    expect(quota.dailyQuota).toBe(5);
    expect(quota.used).toBe(4);
    expect(quota.remaining).toBe(1);
  }

  it('should allow wallet overflow after daily quota is exhausted (regular community)', async () => {
    await consumeQuotaToOneRemaining(regularCommunityId, regularPublicationId);

    const walletBefore = await walletModel.findOne({ userId: voterId, communityId: regularCommunityId }).lean().exec();
    expect(walletBefore?.balance).toBe(10);

    // Vote total=3 using quota(1) + wallet(2)
    const result = await trpcMutation(app, 'votes.createWithComment', {
      targetType: 'publication',
      targetId: regularPublicationId,
      quotaAmount: 1,
      walletAmount: 2,
      comment: 'Overflow vote',
      communityId: regularCommunityId,
    });

    expect(result.amountQuota).toBe(1);
    expect(result.amountWallet).toBe(2);

    const quotaAfter = await trpcQuery(app, 'wallets.getQuota', {
      userId: voterId,
      communityId: regularCommunityId,
    });
    expect(quotaAfter.used).toBe(5);
    expect(quotaAfter.remaining).toBe(0);

    const walletAfter = await walletModel.findOne({ userId: voterId, communityId: regularCommunityId }).lean().exec();
    expect(walletAfter?.balance).toBe(8);
  });

  it('should allow wallet overflow after daily quota is exhausted (team community)', async () => {
    await consumeQuotaToOneRemaining(teamCommunityId, teamPublicationId);

    const walletBefore = await walletModel.findOne({ userId: voterId, communityId: teamCommunityId }).lean().exec();
    expect(walletBefore?.balance).toBe(10);

    const result = await trpcMutation(app, 'votes.createWithComment', {
      targetType: 'publication',
      targetId: teamPublicationId,
      quotaAmount: 1,
      walletAmount: 2,
      comment: 'Overflow vote (team)',
      communityId: teamCommunityId,
    });

    expect(result.amountQuota).toBe(1);
    expect(result.amountWallet).toBe(2);

    const quotaAfter = await trpcQuery(app, 'wallets.getQuota', {
      userId: voterId,
      communityId: teamCommunityId,
    });
    expect(quotaAfter.used).toBe(5);
    expect(quotaAfter.remaining).toBe(0);

    const walletAfter = await walletModel.findOne({ userId: voterId, communityId: teamCommunityId }).lean().exec();
    expect(walletAfter?.balance).toBe(8);
  });
});


