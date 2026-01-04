import { INestApplication } from '@nestjs/common';
import { getModelToken } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { uid } from 'uid';
import { TestSetupHelper } from './helpers/test-setup.helper';
import { trpcMutation, trpcQuery } from './helpers/trpc-test-helper';
import { CommunitySchemaClass, CommunityDocument } from '../src/domain/models/community/community.schema';
import { UserSchemaClass, UserDocument } from '../src/domain/models/user/user.schema';
import { WalletSchemaClass, WalletDocument } from '../src/domain/models/wallet/wallet.schema';
import { UserCommunityRoleSchemaClass, UserCommunityRoleDocument } from '../src/domain/models/user-community-role/user-community-role.schema';

describe('Comments and Votes Integration (e2e)', () => {
  jest.setTimeout(60000);

  let app: INestApplication;
  let testDb: any;

  let communityModel: Model<CommunityDocument>;
  let userModel: Model<UserDocument>;
  let walletModel: Model<WalletDocument>;
  let userCommunityRoleModel: Model<UserCommunityRoleDocument>;

  beforeAll(async () => {
    const context = await TestSetupHelper.createTestApp();
    app = context.app;
    testDb = context.testDb;

    communityModel = app.get(getModelToken(CommunitySchemaClass.name));
    userModel = app.get(getModelToken(UserSchemaClass.name));
    walletModel = app.get(getModelToken(WalletSchemaClass.name));
    userCommunityRoleModel = app.get(getModelToken(UserCommunityRoleSchemaClass.name));
  });

  afterAll(async () => {
    await TestSetupHelper.cleanup({ app, testDb });
  });

  async function seed(): Promise<{
    communityId: string;
    authorId: string;
    voterId: string;
    publicationId: string;
  }> {
    const now = new Date();
    const communityId = uid();
    const authorId = uid();
    const voterId = uid();

    await userModel.create([
      {
        id: authorId,
        telegramId: `author_${authorId}`,
        authProvider: 'telegram',
        authId: `author_${authorId}`,
        displayName: 'Author',
        username: `author_${authorId}`,
        firstName: 'Author',
        lastName: 'User',
        avatarUrl: 'https://example.com/a.jpg',
        communityMemberships: [],
        communityTags: [],
        profile: {},
        createdAt: now,
        updatedAt: now,
      },
      {
        id: voterId,
        telegramId: `voter_${voterId}`,
        authProvider: 'telegram',
        authId: `voter_${voterId}`,
        displayName: 'Voter',
        username: `voter_${voterId}`,
        firstName: 'Voter',
        lastName: 'User',
        avatarUrl: 'https://example.com/v.jpg',
        communityMemberships: [],
        communityTags: [],
        profile: {},
        createdAt: now,
        updatedAt: now,
      },
    ]);

    await communityModel.create({
      id: communityId,
      name: 'Comments/Votes Community',
      typeTag: 'future-vision',
      members: [authorId, voterId],
      settings: {
        currencyNames: { singular: 'merit', plural: 'merits', genitive: 'merits' },
        dailyEmission: 10,
        postCost: 1,
      },
      votingRules: {
        allowedRoles: ['superadmin', 'lead', 'participant', 'viewer'],
        canVoteForOwnPosts: false,
        participantsCannotVoteForLead: false,
        spendsMerits: true,
        awardsMerits: true,
      },
      hashtags: ['test'],
      hashtagDescriptions: {},
      isActive: true,
      createdAt: now,
      updatedAt: now,
    });

    await userCommunityRoleModel.create([
      { id: uid(), userId: authorId, communityId, role: 'participant', createdAt: now, updatedAt: now },
      { id: uid(), userId: voterId, communityId, role: 'participant', createdAt: now, updatedAt: now },
    ]);

    // publications.create charges community.settings.postCost from the author's wallet.
    // This suite focuses on vote-comments listing, so seed wallets to keep setup unblocked.
    await walletModel.create([
      {
        id: uid(),
        userId: voterId,
        communityId,
        balance: 100,
        currency: { singular: 'merit', plural: 'merits', genitive: 'merits' },
        lastUpdated: now,
        createdAt: now,
        updatedAt: now,
      },
      {
        id: uid(),
        userId: authorId,
        communityId,
        balance: 100,
        currency: { singular: 'merit', plural: 'merits', genitive: 'merits' },
        lastUpdated: now,
        createdAt: now,
        updatedAt: now,
      },
    ]);

    (global as any).testUserId = authorId;
    const publication = await trpcMutation(app, 'publications.create', {
      communityId,
      content: 'Publication for comment list',
      type: 'text',
      hashtags: ['test'],
      postType: 'basic',
      isProject: false,
    });

    return { communityId, authorId, voterId, publicationId: publication.id };
  }

  beforeEach(async () => {
    await communityModel.deleteMany({});
    await userModel.deleteMany({});
    await walletModel.deleteMany({});
    await userCommunityRoleModel.deleteMany({});
  });

  it('returns vote-comments with vote transaction fields when listing comments by publication', async () => {
    const { voterId, publicationId } = await seed();

    (global as any).testUserId = voterId;
    const vote = await trpcMutation(app, 'votes.createWithComment', {
      targetType: 'publication',
      targetId: publicationId,
      quotaAmount: 0,
      walletAmount: 5,
      comment: 'Nice post',
    });

    const commentsPage = await trpcQuery(app, 'comments.getByPublicationId', {
      publicationId,
      page: 1,
      pageSize: 20,
    });

    const found = commentsPage.data.find((c: any) => c.id === vote.id);
    expect(found).toBeTruthy();
    expect(found.content).toBe('Nice post');
    expect(found.amountTotal).toBe(5);
    expect(found.plus).toBe(5);
    expect(found.minus).toBe(0);
    expect(found.sum).toBe(5);
  });

  it('handles downvotes with comment correctly in the comment list', async () => {
    const { voterId, publicationId } = await seed();

    (global as any).testUserId = voterId;
    const vote = await trpcMutation(app, 'votes.createWithComment', {
      targetType: 'publication',
      targetId: publicationId,
      quotaAmount: 0,
      walletAmount: 3,
      direction: 'down',
      comment: 'Not good',
    });

    const commentsPage = await trpcQuery(app, 'comments.getByPublicationId', {
      publicationId,
      page: 1,
      pageSize: 20,
    });

    const found = commentsPage.data.find((c: any) => c.id === vote.id);
    expect(found).toBeTruthy();
    expect(found.content).toBe('Not good');
    expect(found.amountTotal).toBe(3);
    expect(found.plus).toBe(0);
    expect(found.minus).toBe(3);
    expect(found.sum).toBe(-3);
  });

  it('returns multiple vote-comments with their own vote transaction fields', async () => {
    const { voterId, publicationId } = await seed();

    (global as any).testUserId = voterId;
    const v1 = await trpcMutation(app, 'votes.createWithComment', {
      targetType: 'publication',
      targetId: publicationId,
      quotaAmount: 0,
      walletAmount: 2,
      comment: 'One',
    });
    const v2 = await trpcMutation(app, 'votes.createWithComment', {
      targetType: 'publication',
      targetId: publicationId,
      quotaAmount: 0,
      walletAmount: 4,
      comment: 'Two',
    });

    const commentsPage = await trpcQuery(app, 'comments.getByPublicationId', {
      publicationId,
      page: 1,
      pageSize: 20,
    });

    const ids = commentsPage.data.map((c: any) => c.id);
    expect(ids).toEqual(expect.arrayContaining([v1.id, v2.id]));
  });

  it('does not include legacy comments in comments.getByPublicationId (it lists vote-comments only)', async () => {
    const { authorId, voterId, publicationId } = await seed();

    (global as any).testUserId = voterId;
    const vote = await trpcMutation(app, 'votes.createWithComment', {
      targetType: 'publication',
      targetId: publicationId,
      quotaAmount: 0,
      walletAmount: 1,
      comment: 'Vote comment',
    });

    // Create a legacy comment document too
    (global as any).testUserId = authorId;
    const legacy = await trpcMutation(app, 'comments.create', {
      targetType: 'publication',
      targetId: publicationId,
      content: 'Legacy comment',
    });

    const commentsPage = await trpcQuery(app, 'comments.getByPublicationId', {
      publicationId,
      page: 1,
      pageSize: 50,
    });

    const ids = commentsPage.data.map((c: any) => c.id);
    expect(ids).toContain(vote.id);
    expect(ids).not.toContain(legacy.id);
  });
});


