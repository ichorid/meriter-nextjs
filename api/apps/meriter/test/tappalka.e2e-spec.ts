import { TestSetupHelper } from './helpers/test-setup.helper';
import { trpcMutation, trpcQuery } from './helpers/trpc-test-helper';
import { getModelToken } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { uid } from 'uid';
import {
  CommunitySchemaClass,
  CommunityDocument,
} from '../src/domain/models/community/community.schema';
import { UserSchemaClass, UserDocument } from '../src/domain/models/user/user.schema';
import { WalletSchemaClass, WalletDocument } from '../src/domain/models/wallet/wallet.schema';
import {
  UserCommunityRoleSchemaClass,
  UserCommunityRoleDocument,
} from '../src/domain/models/user-community-role/user-community-role.schema';
import {
  PublicationSchemaClass,
  PublicationDocument,
} from '../src/domain/models/publication/publication.schema';
import {
  TappalkaProgressSchemaClass,
  TappalkaProgressDocument,
} from '../src/domain/models/tappalka/tappalka-progress.schema';

describe('Tappalka E2E', () => {
  jest.setTimeout(60000);

  let app: any;
  let testDb: any;
  let communityModel: Model<CommunityDocument>;
  let userModel: Model<UserDocument>;
  let walletModel: Model<WalletDocument>;
  let userCommunityRoleModel: Model<UserCommunityRoleDocument>;
  let publicationModel: Model<PublicationDocument>;
  let tappalkaProgressModel: Model<TappalkaProgressDocument>;

  beforeAll(async () => {
    const context = await TestSetupHelper.createTestApp();
    app = context.app;
    testDb = context.testDb;

    communityModel = app.get(getModelToken(CommunitySchemaClass.name));
    userModel = app.get(getModelToken(UserSchemaClass.name));
    walletModel = app.get(getModelToken(WalletSchemaClass.name));
    userCommunityRoleModel = app.get(getModelToken(UserCommunityRoleSchemaClass.name));
    publicationModel = app.get(getModelToken(PublicationSchemaClass.name));
    tappalkaProgressModel = app.get(getModelToken(TappalkaProgressSchemaClass.name));
  });

  afterAll(async () => {
    await TestSetupHelper.cleanup({ app, testDb });
  });

  it('should complete full tappalka flow: onboarding → 10 comparisons → receive reward', async () => {
    const now = new Date();
    const userId = uid();
    const userId2 = uid();
    const userId3 = uid();
    const communityId = uid();

    // Create test user (the one who will do comparisons)
    await userModel.create({
      id: userId,
      telegramId: `user_${userId}`,
      authProvider: 'telegram',
      authId: `user_${userId}`,
      displayName: 'Tappalka User',
      username: `tappalka_user_${userId}`,
      firstName: 'Tappalka',
      lastName: 'User',
      avatarUrl: 'https://example.com/u.jpg',
      communityMemberships: [],
      communityTags: [],
      profile: {},
      createdAt: now,
      updatedAt: now,
    });

    // Create other users (authors of posts)
    await userModel.create({
      id: userId2,
      telegramId: `user_${userId2}`,
      authProvider: 'telegram',
      authId: `user_${userId2}`,
      displayName: 'Post Author 1',
      username: `author1_${userId2}`,
      firstName: 'Author',
      lastName: '1',
      avatarUrl: 'https://example.com/u2.jpg',
      communityMemberships: [],
      communityTags: [],
      profile: {},
      createdAt: now,
      updatedAt: now,
    });

    await userModel.create({
      id: userId3,
      telegramId: `user_${userId3}`,
      authProvider: 'telegram',
      authId: `user_${userId3}`,
      displayName: 'Post Author 2',
      username: `author2_${userId3}`,
      firstName: 'Author',
      lastName: '2',
      avatarUrl: 'https://example.com/u3.jpg',
      communityMemberships: [],
      communityTags: [],
      profile: {},
      createdAt: now,
      updatedAt: now,
    });

    // Create community with tappalka enabled
    await communityModel.create({
      id: communityId,
      name: 'Tappalka Test Community',
      members: [userId, userId2, userId3],
      settings: {
        currencyNames: { singular: 'merit', plural: 'merits', genitive: 'merits' },
        dailyEmission: 10,
        postCost: 1,
      },
      tappalkaSettings: {
        enabled: true,
        categories: [],
        winReward: 1,
        userReward: 5, // Reward for completing 10 comparisons
        comparisonsRequired: 10,
        showCost: 0.1,
        minRating: 1,
        onboardingText: 'Welcome to Tappalka! Compare posts and earn merits.',
      },
      hashtags: ['test'],
      hashtagDescriptions: {},
      isActive: true,
      createdAt: now,
      updatedAt: now,
    });

    // Create user roles
    const role1 = await userCommunityRoleModel.create({
      id: uid(),
      userId,
      communityId,
      role: 'participant',
      createdAt: now,
      updatedAt: now,
    });

    const role2 = await userCommunityRoleModel.create({
      id: uid(),
      userId: userId2,
      communityId,
      role: 'participant',
      createdAt: now,
      updatedAt: now,
    });

    const role3 = await userCommunityRoleModel.create({
      id: uid(),
      userId: userId3,
      communityId,
      role: 'participant',
      createdAt: now,
      updatedAt: now,
    });

    // Create wallet for user
    await walletModel.create({
      id: uid(),
      userId,
      communityId,
      balance: 0,
      currency: { singular: 'merit', plural: 'merits', genitive: 'merits' },
      lastUpdated: now,
      createdAt: now,
      updatedAt: now,
    });

    // Create multiple posts from other users (need at least 2 for each comparison)
    // Create 20 posts to ensure we have enough for 10 comparisons
    const postIds: string[] = [];
    for (let i = 0; i < 20; i++) {
      const authorId = i % 2 === 0 ? userId2 : userId3;
      const post = await publicationModel.create({
        id: uid(),
        communityId,
        authorId,
        title: `Test Post ${i + 1}`,
        description: `Description ${i + 1}`,
        content: `Content ${i + 1}`,
        type: 'text',
        metrics: {
          score: 10, // High enough to pay showCost
          upvotes: 0,
          downvotes: 0,
          commentCount: 0,
        },
        deleted: false,
        deletedAt: null,
        createdAt: now,
        updatedAt: now,
      });
      postIds.push(post.id);
    }

    // Set test user ID for tRPC context
    (global as any).testUserId = userId;

    // Step 1: Get progress (should show onboarding not seen)
    const initialProgress = await trpcQuery(app, 'tappalka.getProgress', {
      communityId,
    });

    expect(initialProgress).toBeDefined();
    expect(initialProgress.onboardingSeen).toBe(false);
    expect(initialProgress.onboardingText).toBe('Welcome to Tappalka! Compare posts and earn merits.');
    expect(initialProgress.currentComparisons).toBe(0);
    expect(initialProgress.comparisonsRequired).toBe(10);
    expect(initialProgress.meritBalance).toBe(0);

    // Step 2: Mark onboarding as seen
    await trpcMutation(app, 'tappalka.markOnboardingSeen', {
      communityId,
    });

    // Step 3: Verify onboarding is marked as seen
    const progressAfterOnboarding = await trpcQuery(app, 'tappalka.getProgress', {
      communityId,
    });
    expect(progressAfterOnboarding.onboardingSeen).toBe(true);

    // Step 4: Get first pair
    const firstPair = await trpcQuery(app, 'tappalka.getPair', {
      communityId,
    });

    expect(firstPair).toBeDefined();
    expect(firstPair.postA).toBeDefined();
    expect(firstPair.postB).toBeDefined();
    expect(firstPair.sessionId).toBeDefined();
    expect(firstPair.postA.id).not.toBe(firstPair.postB.id);

    // Step 5: Make 10 comparisons
    let currentPair = firstPair;
    let totalComparisons = 0;

    for (let i = 0; i < 10; i++) {
      // Submit choice (always choose postA as winner)
      const result = await trpcMutation(app, 'tappalka.submitChoice', {
        communityId,
        sessionId: currentPair.sessionId,
        winnerPostId: currentPair.postA.id,
        loserPostId: currentPair.postB.id,
      });

      expect(result.success).toBe(true);
      expect(result.newComparisonCount).toBeDefined();
      totalComparisons++;

      // Check progress after each comparison
      const progress = await trpcQuery(app, 'tappalka.getProgress', {
        communityId,
      });

      if (i < 9) {
        // Before 10th comparison, count should increment
        expect(progress.currentComparisons).toBe(i + 1);
        expect(result.rewardEarned).toBe(false);
        expect(result.userMeritsEarned).toBeUndefined();
      } else {
        // After 10th comparison, should receive reward
        expect(result.rewardEarned).toBe(true);
        expect(result.userMeritsEarned).toBe(5);
        expect(progress.currentComparisons).toBe(0); // Reset after reward
      }

      // Use next pair if available
      if (result.nextPair) {
        currentPair = result.nextPair;
      } else {
        // If no more pairs, get a new one
        currentPair = await trpcQuery(app, 'tappalka.getPair', {
          communityId,
        });
        expect(currentPair).not.toBeNull();
      }
    }

    // Step 6: Verify final wallet balance
    const finalWallet = await walletModel.findOne({ userId, communityId }).lean();
    expect(finalWallet).toBeDefined();
    expect(finalWallet?.balance).toBe(5); // Should have received userReward

    // Step 7: Verify final progress
    const finalProgress = await trpcQuery(app, 'tappalka.getProgress', {
      communityId,
    });

    expect(finalProgress.currentComparisons).toBe(0); // Reset after reward
    expect(finalProgress.meritBalance).toBe(5); // Updated wallet balance

    // Step 8: Verify that posts received winReward (check a few posts)
    // Since we always choose postA as winner, find a post that has score > 10 (meaning it won at least once)
    // Note: posts start with score 10, winReward is 1, showCost is 0.1
    // If a post wins once: 10 - 0.1 + 1 = 10.9
    // But if it's shown multiple times and wins, it could be higher
    // If it's shown but loses: 10 - 0.1 = 9.9
    const allPosts = await publicationModel.find({ id: { $in: postIds } }).lean();
    const winningPosts = allPosts.filter((p) => p.metrics.score > 10);
    expect(winningPosts.length).toBeGreaterThan(0); // At least one post should have won
    // Check that at least one post that won has score > 10
    const sampleWinningPost = winningPosts[0];
    expect(sampleWinningPost?.metrics.score).toBeGreaterThan(10); // Should have received winReward

    // Step 9: Verify that showCost was deducted from posts
    // Posts that were shown should have lower rating (showCost deducted)
    // But winners also got winReward, so net change depends on whether they won or lost
    // At least some posts should have been modified (showCost deducted or winReward added)
    const modifiedPosts = allPosts.filter((p) => p.metrics.score !== 10);
    expect(modifiedPosts.length).toBeGreaterThan(0);
  });

  it('should handle onboarding flow correctly', async () => {
    const now = new Date();
    const userId = uid();
    const userId2 = uid();
    const communityId = uid();

    // Create users
    await userModel.create({
      id: userId,
      telegramId: `user_${userId}`,
      authProvider: 'telegram',
      authId: `user_${userId}`,
      displayName: 'Onboarding Test User',
      username: `onboarding_user_${userId}`,
      firstName: 'Onboarding',
      lastName: 'User',
      avatarUrl: 'https://example.com/u.jpg',
      communityMemberships: [],
      communityTags: [],
      profile: {},
      createdAt: now,
      updatedAt: now,
    });

    await userModel.create({
      id: userId2,
      telegramId: `user_${userId2}`,
      authProvider: 'telegram',
      authId: `user_${userId2}`,
      displayName: 'Post Author',
      username: `author_${userId2}`,
      firstName: 'Author',
      lastName: 'User',
      avatarUrl: 'https://example.com/u2.jpg',
      communityMemberships: [],
      communityTags: [],
      profile: {},
      createdAt: now,
      updatedAt: now,
    });

    // Create community with custom onboarding text
    await communityModel.create({
      id: communityId,
      name: 'Onboarding Test Community',
      members: [userId, userId2],
      settings: {
        currencyNames: { singular: 'merit', plural: 'merits', genitive: 'merits' },
      },
      tappalkaSettings: {
        enabled: true,
        categories: [],
        winReward: 1,
        userReward: 1,
        comparisonsRequired: 10,
        showCost: 0.1,
        minRating: 1,
        onboardingText: 'Custom onboarding message for this community',
      },
      hashtags: [],
      hashtagDescriptions: {},
      isActive: true,
      createdAt: now,
      updatedAt: now,
    });

    await userCommunityRoleModel.create({
      id: uid(),
      userId,
      communityId,
      role: 'participant',
      createdAt: now,
      updatedAt: now,
    });

    await walletModel.create({
      id: uid(),
      userId,
      communityId,
      balance: 0,
      currency: { singular: 'merit', plural: 'merits', genitive: 'merits' },
      lastUpdated: now,
      createdAt: now,
      updatedAt: now,
    });

    // Create posts
    await publicationModel.create({
      id: uid(),
      communityId,
      authorId: userId2,
      title: 'Test Post 1',
      description: 'Description 1',
      content: 'Content 1',
      type: 'text',
      metrics: {
        score: 10,
        upvotes: 0,
        downvotes: 0,
        commentCount: 0,
      },
      deleted: false,
      deletedAt: null,
      createdAt: now,
      updatedAt: now,
    });

    await publicationModel.create({
      id: uid(),
      communityId,
      authorId: userId2,
      title: 'Test Post 2',
      description: 'Description 2',
      content: 'Content 2',
      type: 'text',
      metrics: {
        score: 10,
        upvotes: 0,
        downvotes: 0,
        commentCount: 0,
      },
      deleted: false,
      deletedAt: null,
      createdAt: now,
      updatedAt: now,
    });

    (global as any).testUserId = userId;

    // Check initial progress - onboarding should not be seen
    const initialProgress = await trpcQuery(app, 'tappalka.getProgress', {
      communityId,
    });

    expect(initialProgress.onboardingSeen).toBe(false);
    expect(initialProgress.onboardingText).toBe('Custom onboarding message for this community');

    // Mark onboarding as seen
    await trpcMutation(app, 'tappalka.markOnboardingSeen', {
      communityId,
    });

    // Verify onboarding is now seen
    const progressAfter = await trpcQuery(app, 'tappalka.getProgress', {
      communityId,
    });

    expect(progressAfter.onboardingSeen).toBe(true);

    // Verify in database
    const progressDoc = await tappalkaProgressModel
      .findOne({ userId, communityId })
      .lean();
    expect(progressDoc?.onboardingSeen).toBe(true);
  });
});

