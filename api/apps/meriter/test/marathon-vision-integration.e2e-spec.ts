import { INestApplication } from '@nestjs/common';
import { getModelToken } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { uid } from 'uid';
import { TestSetupHelper } from './helpers/test-setup.helper';
import { trpcMutation, trpcMutationWithError, trpcQuery } from './helpers/trpc-test-helper';
import { withSuppressedErrors } from './helpers/error-suppression.helper';
import { CommunitySchemaClass, CommunityDocument } from '../src/domain/models/community/community.schema';
import { UserSchemaClass, UserDocument } from '../src/domain/models/user/user.schema';
import { WalletSchemaClass, WalletDocument } from '../src/domain/models/wallet/wallet.schema';
import { UserCommunityRoleSchemaClass, UserCommunityRoleDocument } from '../src/domain/models/user-community-role/user-community-role.schema';

describe('Marathon/Future Vision integration (e2e)', () => {
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

  beforeEach(async () => {
    await communityModel.deleteMany({});
    await userModel.deleteMany({});
    await walletModel.deleteMany({});
    await userCommunityRoleModel.deleteMany({});
  });

  afterAll(async () => {
    process.env.ENABLE_COMMENT_VOTING = originalEnableCommentVoting;
    await TestSetupHelper.cleanup({ app, testDb });
  });

  it('enforces special-group voting rules and quota semantics', async () => {
    const now = new Date();

    const marathonCommunityId = uid();
    const visionCommunityId = uid();

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

    await communityModel.create([
      {
        id: marathonCommunityId,
        name: 'Marathon of Good',
        typeTag: 'marathon-of-good',
        members: [authorId, voterId],
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
        hashtags: ['marathon'],
        hashtagDescriptions: {},
        isActive: true,
        createdAt: now,
        updatedAt: now,
      },
      {
        id: visionCommunityId,
        name: 'Future Vision',
        typeTag: 'future-vision',
        members: [authorId, voterId],
        settings: {
          currencyNames: { singular: 'merit', plural: 'merits', genitive: 'merits' },
          dailyEmission: 10, // base emission can be non-zero; effective quota must still be 0 for future-vision
        },
        votingRules: {
          allowedRoles: ['superadmin', 'lead', 'participant', 'viewer'],
          canVoteForOwnPosts: false,
          participantsCannotVoteForLead: false,
          spendsMerits: true,
          awardsMerits: true,
        },
        hashtags: ['vision'],
        hashtagDescriptions: {},
        isActive: true,
        createdAt: now,
        updatedAt: now,
      },
    ]);

    // Roles are read from UserCommunityRole
    await userCommunityRoleModel.create([
      // voter is viewer in marathon (viewers can vote with quota, but cannot use wallet)
      { id: uid(), userId: voterId, communityId: marathonCommunityId, role: 'viewer', createdAt: now, updatedAt: now },
      // voter is participant in future-vision (wallet voting)
      { id: uid(), userId: voterId, communityId: visionCommunityId, role: 'participant', createdAt: now, updatedAt: now },
      // author is participant in both
      { id: uid(), userId: authorId, communityId: marathonCommunityId, role: 'participant', createdAt: now, updatedAt: now },
      { id: uid(), userId: authorId, communityId: visionCommunityId, role: 'participant', createdAt: now, updatedAt: now },
    ]);

    // Wallet for voter in future-vision (wallet voting)
    await walletModel.create({
      id: uid(),
      userId: voterId,
      communityId: visionCommunityId,
      balance: 100,
      currency: { singular: 'merit', plural: 'merits', genitive: 'merits' },
      lastUpdated: now,
      createdAt: now,
      updatedAt: now,
    });

    // Create a publication in marathon-of-good by author
    (global as any).testUserId = authorId;
    const marathonPub = await trpcMutation(app, 'publications.create', {
      communityId: marathonCommunityId,
      content: 'Marathon post',
      type: 'text',
      hashtags: ['marathon'],
      postType: 'basic',
      isProject: false,
    });

    // voter: can vote with quota in marathon
    (global as any).testUserId = voterId;
    await trpcMutation(app, 'votes.createWithComment', {
      targetType: 'publication',
      targetId: marathonPub.id,
      quotaAmount: 3,
      walletAmount: 0,
      comment: 'Great deed!',
    });

    const quota = await trpcQuery(app, 'wallets.getQuota', {
      userId: voterId,
      communityId: marathonCommunityId,
    });
    expect(quota.dailyQuota).toBe(10);
    expect(quota.used).toBe(3);
    expect(quota.remaining).toBe(7);

    // voter: cannot vote with wallet in marathon
    await withSuppressedErrors(['BAD_REQUEST'], async () => {
      const walletVoteInMarathon = await trpcMutationWithError(app, 'votes.createWithComment', {
        targetType: 'publication',
        targetId: marathonPub.id,
        quotaAmount: 0,
        walletAmount: 5,
        comment: 'Wallet vote attempt',
      });
      expect(walletVoteInMarathon.error?.code).toBe('BAD_REQUEST');
      expect(walletVoteInMarathon.error?.message).toContain('Marathon of Good only allows quota voting');
    });

    // Create a publication in future-vision by author
    (global as any).testUserId = authorId;
    const visionPub = await trpcMutation(app, 'publications.create', {
      communityId: visionCommunityId,
      content: 'Vision post',
      type: 'text',
      hashtags: ['vision'],
      postType: 'basic',
      isProject: false,
    });

    // voter: future-vision quota is effectively 0
    (global as any).testUserId = voterId;
    const fvQuota = await trpcQuery(app, 'wallets.getQuota', {
      userId: voterId,
      communityId: visionCommunityId,
    });
    expect(fvQuota.dailyQuota).toBe(0);
    expect(fvQuota.used).toBe(0);
    expect(fvQuota.remaining).toBe(0);

    // voter: quota voting rejected in future-vision
    await withSuppressedErrors(['BAD_REQUEST'], async () => {
      const quotaVoteInVision = await trpcMutationWithError(app, 'votes.createWithComment', {
        targetType: 'publication',
        targetId: visionPub.id,
        quotaAmount: 3,
        walletAmount: 0,
        comment: 'Quota vote attempt',
      });
      expect(quotaVoteInVision.error?.code).toBe('BAD_REQUEST');
      expect(quotaVoteInVision.error?.message).toContain('Future Vision only allows wallet voting');
    });

    // voter: wallet voting allowed in future-vision
    const walletVoteInVision = await trpcMutation(app, 'votes.createWithComment', {
      targetType: 'publication',
      targetId: visionPub.id,
      quotaAmount: 0,
      walletAmount: 5,
      comment: 'Wallet vote',
    });
    expect(walletVoteInVision.amountWallet).toBe(5);
    expect(walletVoteInVision.direction).toBe('up');

    // author: withdrawals are forbidden in future-vision (output group)
    (global as any).testUserId = authorId;
    await withSuppressedErrors(['FORBIDDEN'], async () => {
      const withdraw = await trpcMutationWithError(app, 'publications.withdraw', {
        publicationId: visionPub.id,
        amount: 1,
      });
      expect(withdraw.error?.code).toBe('FORBIDDEN');
      expect(withdraw.error?.message).toContain('Withdrawals are not allowed in Future Vision');
    });
  });
});


