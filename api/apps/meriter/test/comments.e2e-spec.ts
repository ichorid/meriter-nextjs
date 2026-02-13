import { INestApplication } from '@nestjs/common';
import { getModelToken } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { uid } from 'uid';
import { TestSetupHelper } from './helpers/test-setup.helper';
import { trpcMutation, trpcQuery } from './helpers/trpc-test-helper';
import { GLOBAL_COMMUNITY_ID } from '../src/domain/common/constants/global.constant';
import { CommunitySchemaClass, CommunityDocument } from '../src/domain/models/community/community.schema';
import { UserSchemaClass, UserDocument } from '../src/domain/models/user/user.schema';
import { WalletSchemaClass, WalletDocument } from '../src/domain/models/wallet/wallet.schema';
import { UserCommunityRoleSchemaClass, UserCommunityRoleDocument } from '../src/domain/models/user-community-role/user-community-role.schema';

describe('Comments E2E (create, list, vote)', () => {
  jest.setTimeout(60000);

  let app: INestApplication;
  let testDb: any;
  let originalEnableCommentVoting: string | undefined;

  let communityModel: Model<CommunityDocument>;
  let userModel: Model<UserDocument>;
  let walletModel: Model<WalletDocument>;
  let userCommunityRoleModel: Model<UserCommunityRoleDocument>;

  beforeAll(async () => {
    originalEnableCommentVoting = process.env.ENABLE_COMMENT_VOTING;
    process.env.ENABLE_COMMENT_VOTING = 'true';

    const context = await TestSetupHelper.createTestApp();
    app = context.app;
    testDb = context.testDb;

    communityModel = app.get(getModelToken(CommunitySchemaClass.name));
    userModel = app.get(getModelToken(UserSchemaClass.name));
    walletModel = app.get(getModelToken(WalletSchemaClass.name));
    userCommunityRoleModel = app.get(getModelToken(UserCommunityRoleSchemaClass.name));
  });

  afterAll(async () => {
    process.env.ENABLE_COMMENT_VOTING = originalEnableCommentVoting;
    await TestSetupHelper.cleanup({ app, testDb });
  });

  it('creates a vote-comment on a publication, lists it, then votes on that comment (vote-on-vote)', async () => {
    const now = new Date();
    const communityId = uid();
    const authorId = uid();
    const replierId = uid();

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
        id: replierId,
        telegramId: `replier_${replierId}`,
        authProvider: 'telegram',
        authId: `replier_${replierId}`,
        displayName: 'Replier',
        username: `replier_${replierId}`,
        firstName: 'Replier',
        lastName: 'User',
        avatarUrl: 'https://example.com/r.jpg',
        communityMemberships: [],
        communityTags: [],
        profile: {},
        createdAt: now,
        updatedAt: now,
      },
    ]);

    await communityModel.create({
      id: communityId,
      name: 'Comments Community',
      members: [authorId, replierId],
      settings: {
        currencyNames: { singular: 'merit', plural: 'merits', genitive: 'merits' },
        dailyEmission: 10,
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
      { id: uid(), userId: replierId, communityId, role: 'participant', createdAt: now, updatedAt: now },
    ]);

    // Post fee and vote deduction use global wallet
    await walletModel.create([
      {
        id: uid(),
        userId: authorId,
        communityId: GLOBAL_COMMUNITY_ID,
        balance: 100,
        currency: { singular: 'merit', plural: 'merits', genitive: 'merits' },
        lastUpdated: now,
        createdAt: now,
        updatedAt: now,
      },
      {
        id: uid(),
        userId: replierId,
        communityId: GLOBAL_COMMUNITY_ID,
        balance: 100,
        currency: { singular: 'merit', plural: 'merits', genitive: 'merits' },
        lastUpdated: now,
        createdAt: now,
        updatedAt: now,
      },
    ]);

    // Create publication
    (global as any).testUserId = authorId;
    const publication = await trpcMutation(app, 'publications.create', {
      communityId,
      content: 'Publication for comments',
      type: 'text',
      hashtags: ['test'],
      postType: 'basic',
      isProject: false,
    });
    const publicationId = publication.id as string;

    // Create "comment" (vote with comment) on publication
    (global as any).testUserId = replierId;
    const voteComment = await trpcMutation(app, 'votes.createWithComment', {
      targetType: 'publication',
      targetId: publicationId,
      quotaAmount: 1,
      walletAmount: 0,
      comment: 'Hello world',
    });
    const commentId = voteComment.id as string;

    // List comments by publication via tRPC (paginated)
    const commentsPage = await trpcQuery(app, 'comments.getByPublicationId', {
      publicationId,
      page: 1,
      pageSize: 20,
    });
    expect(Array.isArray(commentsPage.data)).toBe(true);
    expect(commentsPage.data.some((c: any) => c.id === commentId)).toBe(true);

    // Vote on the "comment" (vote-on-vote)
    (global as any).testUserId = authorId;
    const replyVote = await trpcMutation(app, 'votes.createWithComment', {
      targetType: 'vote',
      targetId: commentId,
      quotaAmount: 1,
      walletAmount: 0,
      comment: 'Reply vote',
    });
    expect(replyVote?.id).toBeDefined();
  });
});


