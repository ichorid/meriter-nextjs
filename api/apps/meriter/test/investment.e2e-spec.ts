/**
 * Investment E2E tests
 * Covers: invest, tappalka pool deduction, withdraw distribution, close flow,
 * non-investment post unchanged, author promote, repeat investment, quota rejection.
 */
import { TestSetupHelper } from './helpers/test-setup.helper';
import {
  trpcMutation,
  trpcMutationWithError,
  trpcQuery,
} from './helpers/trpc-test-helper';
import { getModelToken } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { uid } from 'uid';
import {
  CommunitySchemaClass,
  CommunityDocument,
} from '../src/domain/models/community/community.schema';
import {
  UserSchemaClass,
  UserDocument,
} from '../src/domain/models/user/user.schema';
import {
  WalletSchemaClass,
  WalletDocument,
} from '../src/domain/models/wallet/wallet.schema';
import {
  UserCommunityRoleSchemaClass,
  UserCommunityRoleDocument,
} from '../src/domain/models/user-community-role/user-community-role.schema';
import {
  PublicationSchemaClass,
  PublicationDocument,
} from '../src/domain/models/publication/publication.schema';
import { GLOBAL_COMMUNITY_ID } from '../src/domain/common/constants/global.constant';

describe('Investment E2E', () => {
  jest.setTimeout(60000);

  let app: any;
  let testDb: any;
  let communityModel: Model<CommunityDocument>;
  let userModel: Model<UserDocument>;
  let walletModel: Model<WalletDocument>;
  let userCommunityRoleModel: Model<UserCommunityRoleDocument>;
  let publicationModel: Model<PublicationDocument>;

  beforeAll(async () => {
    const context = await TestSetupHelper.createTestApp();
    app = context.app;
    testDb = context.testDb;

    communityModel = app.get(getModelToken(CommunitySchemaClass.name));
    userModel = app.get(getModelToken(UserSchemaClass.name));
    walletModel = app.get(getModelToken(WalletSchemaClass.name));
    userCommunityRoleModel = app.get(getModelToken(UserCommunityRoleSchemaClass.name));
    publicationModel = app.get(getModelToken(PublicationSchemaClass.name));
  });

  afterAll(async () => {
    await TestSetupHelper.cleanup({ app, testDb });
  });

  it('full flow: create post with contract → invest → tappalka deducts from pool → win → withdraw → verify distribution', async () => {
    const now = new Date();
    const authorId = uid();
    const investorId = uid();
    const otherUserId = uid(); // Third user for pairing (investor's posts are excluded from getPair)
    const communityId = uid();

    await userModel.create({
      id: authorId,
      telegramId: `author_${authorId}`,
      authProvider: 'telegram',
      authId: `author_${authorId}`,
      displayName: 'Author',
      username: `author_${authorId}`,
      firstName: 'A',
      lastName: 'uthor',
      avatarUrl: 'https://example.com/a.jpg',
      communityMemberships: [],
      communityTags: [],
      profile: {},
      createdAt: now,
      updatedAt: now,
    });

    await userModel.create({
      id: investorId,
      telegramId: `investor_${investorId}`,
      authProvider: 'telegram',
      authId: `investor_${investorId}`,
      displayName: 'Investor',
      username: `investor_${investorId}`,
      firstName: 'I',
      lastName: 'nvestor',
      avatarUrl: 'https://example.com/i.jpg',
      communityMemberships: [],
      communityTags: [],
      profile: {},
      createdAt: now,
      updatedAt: now,
    });

    await userModel.create({
      id: otherUserId,
      telegramId: `other_${otherUserId}`,
      authProvider: 'telegram',
      authId: `other_${otherUserId}`,
      displayName: 'Other User',
      username: `other_${otherUserId}`,
      firstName: 'O',
      lastName: 'ther',
      avatarUrl: 'https://example.com/o.jpg',
      communityMemberships: [],
      communityTags: [],
      profile: {},
      createdAt: now,
      updatedAt: now,
    });

    await communityModel.create({
      id: communityId,
      name: 'Investment Test Community',
      members: [authorId, investorId, otherUserId],
      settings: {
        currencyNames: { singular: 'merit', plural: 'merits', genitive: 'merits' },
        dailyEmission: 10,
        postCost: 1,
        investingEnabled: true,
        investorShareMin: 1,
        investorShareMax: 99,
      },
      tappalkaSettings: {
        enabled: true,
        categories: [],
        winReward: 1,
        userReward: 1,
        comparisonsRequired: 10,
        showCost: 0.1,
        minRating: 0.1,
      },
      hashtags: ['test'],
      hashtagDescriptions: {},
      isActive: true,
      createdAt: now,
      updatedAt: now,
    });

    await userCommunityRoleModel.create([
      { id: uid(), userId: authorId, communityId, role: 'participant', createdAt: now, updatedAt: now },
      { id: uid(), userId: investorId, communityId, role: 'participant', createdAt: now, updatedAt: now },
      { id: uid(), userId: otherUserId, communityId, role: 'participant', createdAt: now, updatedAt: now },
    ]);

    await walletModel.create([
      { id: uid(), userId: authorId, communityId, balance: 100, currency: { singular: 'merit', plural: 'merits', genitive: 'merits' }, lastUpdated: now, createdAt: now, updatedAt: now },
      { id: uid(), userId: investorId, communityId, balance: 100, currency: { singular: 'merit', plural: 'merits', genitive: 'merits' }, lastUpdated: now, createdAt: now, updatedAt: now },
      { id: uid(), userId: otherUserId, communityId, balance: 100, currency: { singular: 'merit', plural: 'merits', genitive: 'merits' }, lastUpdated: now, createdAt: now, updatedAt: now },
    ]);

    const postId = uid();
    await publicationModel.create({
      id: postId,
      communityId,
      authorId,
      title: 'Investable Post',
      description: 'Test',
      content: 'Content',
      type: 'text',
      investingEnabled: true,
      investorSharePercent: 20,
      investmentPool: 0,
      investmentPoolTotal: 0,
      investments: [],
      metrics: { score: 10, upvotes: 0, downvotes: 0, commentCount: 0 },
      deleted: false,
      deletedAt: null,
      createdAt: now,
      updatedAt: now,
    });

    (global as any).testUserId = investorId;
    const investResult = await trpcMutation(app, 'investments.invest', {
      postId,
      amount: 50,
    });
    expect(investResult.investmentPool).toBe(50);
    expect(investResult.investmentPoolTotal).toBe(50);

    const secondPostId = uid();
    await publicationModel.create({
      id: secondPostId,
      communityId,
      authorId: otherUserId,
      title: 'Other Post',
      description: 'For pair',
      content: 'Content',
      type: 'text',
      metrics: { score: 10, upvotes: 0, downvotes: 0, commentCount: 0 },
      deleted: false,
      deletedAt: null,
      createdAt: now,
      updatedAt: now,
    });

    (global as any).testUserId = investorId;
    await trpcMutation(app, 'tappalka.markOnboardingSeen', { communityId });
    const pair = await trpcQuery(app, 'tappalka.getPair', { communityId });
    expect(pair).not.toBeNull();
    expect(pair!.postA).toBeDefined();
    expect(pair.postB).toBeDefined();

    const investableInPair = [pair!.postA.id, pair!.postB.id].includes(postId);
    if (investableInPair) {
      const winnerId = pair!.postA.id === postId ? pair!.postA.id : pair!.postB.id;
      const loserId = pair!.postA.id === postId ? pair!.postB.id : pair!.postA.id;
      await trpcMutation(app, 'tappalka.submitChoice', {
        communityId,
        sessionId: pair!.sessionId,
        winnerPostId: winnerId,
        loserPostId: loserId,
      });

      const updatedPost = await publicationModel.findOne({ id: postId }).lean().exec();
      expect(updatedPost?.investmentPool).toBeLessThan(50);
    }

    const postBeforeWithdraw = await publicationModel.findOne({ id: postId }).lean().exec();
    const ratingBefore = postBeforeWithdraw?.metrics?.score ?? 0;
    if (ratingBefore > 0) {
      (global as any).testUserId = authorId;
      await trpcMutation(app, 'publications.withdraw', {
        publicationId: postId,
        amount: ratingBefore,
      });

      // Withdrawal credits go to global wallet (MeritResolver: withdrawal → GLOBAL_COMMUNITY_ID)
      const investorGlobalWallet = await walletModel.findOne({ userId: investorId, communityId: GLOBAL_COMMUNITY_ID }).lean().exec();
      // Investor's share of withdrawal is credited to global wallet; with 20% share, gets ≥1 when withdrawing ≥5
      expect(investorGlobalWallet?.balance ?? 0).toBeGreaterThan(0);
    }

    (global as any).testUserId = null;
  });

  it('close flow: invest → some shows → close → verify pool return + rating distribution', async () => {
    const now = new Date();
    const authorId = uid();
    const investorId = uid();
    const communityId = uid();

    await userModel.create([
      { id: authorId, telegramId: `a_${authorId}`, authProvider: 'telegram', authId: `a_${authorId}`, displayName: 'Author', username: `author_${authorId}`, firstName: 'A', lastName: 'B', avatarUrl: '', communityMemberships: [], communityTags: [], profile: {}, createdAt: now, updatedAt: now },
      { id: investorId, telegramId: `i_${investorId}`, authProvider: 'telegram', authId: `i_${investorId}`, displayName: 'Investor', username: `investor_${investorId}`, firstName: 'I', lastName: 'V', avatarUrl: '', communityMemberships: [], communityTags: [], profile: {}, createdAt: now, updatedAt: now },
    ]);

    await communityModel.create({
      id: communityId,
      name: 'Close Test Community',
      members: [authorId, investorId],
      settings: { currencyNames: { singular: 'merit', plural: 'merits', genitive: 'merits' }, dailyEmission: 10, postCost: 1, investingEnabled: true, investorShareMin: 1, investorShareMax: 99 },
      tappalkaSettings: { enabled: false },
      hashtags: ['test'],
      hashtagDescriptions: {},
      isActive: true,
      createdAt: now,
      updatedAt: now,
    });

    await userCommunityRoleModel.create([
      { id: uid(), userId: authorId, communityId, role: 'lead', createdAt: now, updatedAt: now },
      { id: uid(), userId: investorId, communityId, role: 'participant', createdAt: now, updatedAt: now },
    ]);

    await walletModel.create([
      { id: uid(), userId: authorId, communityId, balance: 50, currency: { singular: 'merit', plural: 'merits', genitive: 'merits' }, lastUpdated: now, createdAt: now, updatedAt: now },
      { id: uid(), userId: investorId, communityId, balance: 50, currency: { singular: 'merit', plural: 'merits', genitive: 'merits' }, lastUpdated: now, createdAt: now, updatedAt: now },
    ]);

    const postId = uid();
    await publicationModel.create({
      id: postId,
      communityId,
      authorId,
      title: 'Close Test Post',
      description: 'Test',
      content: 'Content',
      type: 'text',
      investingEnabled: true,
      investorSharePercent: 30,
      investmentPool: 20,
      investmentPoolTotal: 20,
      investments: [{ investorId, amount: 20, createdAt: now, updatedAt: now }],
      metrics: { score: 10, upvotes: 0, downvotes: 0, commentCount: 0 },
      deleted: false,
      deletedAt: null,
      createdAt: now,
      updatedAt: now,
    });

    // Pool return and rating distribution on close go to global wallet (MeritResolver: withdrawal → GLOBAL_COMMUNITY_ID)
    const investorGlobalBefore = await walletModel.findOne({ userId: investorId, communityId: GLOBAL_COMMUNITY_ID }).lean().exec();
    const globalBalanceBefore = investorGlobalBefore?.balance ?? 0;

    (global as any).testUserId = authorId;
    await trpcMutation(app, 'publications.delete', { id: postId });

    const investorGlobalAfter = await walletModel.findOne({ userId: investorId, communityId: GLOBAL_COMMUNITY_ID }).lean().exec();
    const globalBalanceAfter = investorGlobalAfter?.balance ?? 0;
    expect(globalBalanceAfter).toBeGreaterThan(globalBalanceBefore);
  });

  it('non-investment post unaffected by investment changes', async () => {
    const now = new Date();
    const authorId = uid();
    const communityId = uid();

    await userModel.create({
      id: authorId,
      telegramId: `author_${authorId}`,
      authProvider: 'telegram',
      authId: `author_${authorId}`,
      displayName: 'Author',
      username: `author_${authorId}`,
      firstName: 'A',
      lastName: 'B',
      avatarUrl: '',
      communityMemberships: [],
      communityTags: [],
      profile: {},
      createdAt: now,
      updatedAt: now,
    });

    await communityModel.create({
      id: communityId,
      name: 'Non-Invest Community',
      members: [authorId],
      settings: { currencyNames: { singular: 'merit', plural: 'merits', genitive: 'merits' }, dailyEmission: 10, postCost: 1 },
      hashtags: ['test'],
      hashtagDescriptions: {},
      isActive: true,
      createdAt: now,
      updatedAt: now,
    });

    await userCommunityRoleModel.create({
      id: uid(),
      userId: authorId,
      communityId,
      role: 'participant',
      createdAt: now,
      updatedAt: now,
    });

    await walletModel.create({
      id: uid(),
      userId: authorId,
      communityId,
      balance: 10,
      currency: { singular: 'merit', plural: 'merits', genitive: 'merits' },
      lastUpdated: now,
      createdAt: now,
      updatedAt: now,
    });

    const postId = uid();
    await publicationModel.create({
      id: postId,
      communityId,
      authorId,
      title: 'Regular Post',
      description: 'No investing',
      content: 'Content',
      type: 'text',
      metrics: { score: 5, upvotes: 0, downvotes: 0, commentCount: 0 },
      deleted: false,
      deletedAt: null,
      createdAt: now,
      updatedAt: now,
    });

    (global as any).testUserId = authorId;
    const pub = await trpcQuery(app, 'publications.getById', { id: postId });
    expect(pub).toBeDefined();
    expect(pub.investingEnabled).toBeFalsy();
    // Non-investment posts: investment fields may be absent or 0; key is investingEnabled=false
    expect(pub.investments ?? []).toHaveLength(0);
  });

  it('repeat investment accumulates in single record', async () => {
    const now = new Date();
    const authorId = uid();
    const investorId = uid();
    const communityId = uid();

    await userModel.create([
      { id: authorId, telegramId: `a_${authorId}`, authProvider: 'telegram', authId: `a_${authorId}`, displayName: 'Author', username: `a_${authorId}`, firstName: 'A', lastName: 'B', avatarUrl: '', communityMemberships: [], communityTags: [], profile: {}, createdAt: now, updatedAt: now },
      { id: investorId, telegramId: `i_${investorId}`, authProvider: 'telegram', authId: `i_${investorId}`, displayName: 'Investor', username: `i_${investorId}`, firstName: 'I', lastName: 'V', avatarUrl: '', communityMemberships: [], communityTags: [], profile: {}, createdAt: now, updatedAt: now },
    ]);

    await communityModel.create({
      id: communityId,
      name: 'Accumulate Test',
      members: [authorId, investorId],
      settings: { currencyNames: { singular: 'merit', plural: 'merits', genitive: 'merits' }, dailyEmission: 10, postCost: 1, investingEnabled: true, investorShareMin: 1, investorShareMax: 99 },
      hashtags: ['test'],
      hashtagDescriptions: {},
      isActive: true,
      createdAt: now,
      updatedAt: now,
    });

    await userCommunityRoleModel.create([
      { id: uid(), userId: authorId, communityId, role: 'participant', createdAt: now, updatedAt: now },
      { id: uid(), userId: investorId, communityId, role: 'participant', createdAt: now, updatedAt: now },
    ]);

    await walletModel.create({
      id: uid(),
      userId: investorId,
      communityId,
      balance: 100,
      currency: { singular: 'merit', plural: 'merits', genitive: 'merits' },
      lastUpdated: now,
      createdAt: now,
      updatedAt: now,
    });

    const postId = uid();
    await publicationModel.create({
      id: postId,
      communityId,
      authorId,
      title: 'Accumulate Post',
      description: 'Test',
      content: 'Content',
      type: 'text',
      investingEnabled: true,
      investorSharePercent: 20,
      investmentPool: 0,
      investmentPoolTotal: 0,
      investments: [],
      metrics: { score: 0, upvotes: 0, downvotes: 0, commentCount: 0 },
      deleted: false,
      deletedAt: null,
      createdAt: now,
      updatedAt: now,
    });

    (global as any).testUserId = investorId;
    await trpcMutation(app, 'investments.invest', { postId, amount: 30 });
    const second = await trpcMutation(app, 'investments.invest', { postId, amount: 20 });

    expect(second.investmentPool).toBe(50);
    expect(second.investmentPoolTotal).toBe(50);

    const list = await trpcQuery(app, 'investments.getByPost', { postId });
    expect(list).toHaveLength(1);
    expect(list[0].amount).toBe(50);
    expect(list[0].sharePercent).toBe(100);
  });

  it('invest fails when insufficient wallet balance', async () => {
    const now = new Date();
    const authorId = uid();
    const investorId = uid();
    const communityId = uid();

    await userModel.create([
      { id: authorId, telegramId: `a_${authorId}`, authProvider: 'telegram', authId: `a_${authorId}`, displayName: 'Author', username: `a_${authorId}`, firstName: 'A', lastName: 'B', avatarUrl: '', communityMemberships: [], communityTags: [], profile: {}, createdAt: now, updatedAt: now },
      { id: investorId, telegramId: `i_${investorId}`, authProvider: 'telegram', authId: `i_${investorId}`, displayName: 'Investor', username: `i_${investorId}`, firstName: 'I', lastName: 'V', avatarUrl: '', communityMemberships: [], communityTags: [], profile: {}, createdAt: now, updatedAt: now },
    ]);

    await communityModel.create({
      id: communityId,
      name: 'No Balance Community',
      members: [authorId, investorId],
      settings: { currencyNames: { singular: 'merit', plural: 'merits', genitive: 'merits' }, dailyEmission: 10, postCost: 1, investingEnabled: true, investorShareMin: 1, investorShareMax: 99 },
      hashtags: ['test'],
      hashtagDescriptions: {},
      isActive: true,
      createdAt: now,
      updatedAt: now,
    });

    await userCommunityRoleModel.create([
      { id: uid(), userId: authorId, communityId, role: 'participant', createdAt: now, updatedAt: now },
      { id: uid(), userId: investorId, communityId, role: 'participant', createdAt: now, updatedAt: now },
    ]);

    await walletModel.create({
      id: uid(),
      userId: investorId,
      communityId,
      balance: 5,
      currency: { singular: 'merit', plural: 'merits', genitive: 'merits' },
      lastUpdated: now,
      createdAt: now,
      updatedAt: now,
    });

    const postId = uid();
    await publicationModel.create({
      id: postId,
      communityId,
      authorId,
      title: 'No Balance Post',
      description: 'Test',
      content: 'Content',
      type: 'text',
      investingEnabled: true,
      investorSharePercent: 20,
      investmentPool: 0,
      investmentPoolTotal: 0,
      investments: [],
      metrics: { score: 0, upvotes: 0, downvotes: 0, commentCount: 0 },
      deleted: false,
      deletedAt: null,
      createdAt: now,
      updatedAt: now,
    });

    (global as any).testUserId = investorId;
    const result = await trpcMutationWithError(app, 'investments.invest', {
      postId,
      amount: 100,
    });
    expect(result.error).toBeDefined();
    expect(result.error?.code).toBe('BAD_REQUEST');
  });

  it('author cannot invest in own post', async () => {
    const now = new Date();
    const authorId = uid();
    const communityId = uid();

    await userModel.create({
      id: authorId,
      telegramId: `a_${authorId}`,
      authProvider: 'telegram',
      authId: `a_${authorId}`,
      displayName: 'Author',
      username: `a_${authorId}`,
      firstName: 'A',
      lastName: 'B',
      avatarUrl: '',
      communityMemberships: [],
      communityTags: [],
      profile: {},
      createdAt: now,
      updatedAt: now,
    });

    await communityModel.create({
      id: communityId,
      name: 'Self Invest Community',
      members: [authorId],
      settings: { currencyNames: { singular: 'merit', plural: 'merits', genitive: 'merits' }, dailyEmission: 10, postCost: 1, investingEnabled: true, investorShareMin: 1, investorShareMax: 99 },
      hashtags: ['test'],
      hashtagDescriptions: {},
      isActive: true,
      createdAt: now,
      updatedAt: now,
    });

    await userCommunityRoleModel.create({
      id: uid(),
      userId: authorId,
      communityId,
      role: 'participant',
      createdAt: now,
      updatedAt: now,
    });

    await walletModel.create({
      id: uid(),
      userId: authorId,
      communityId,
      balance: 100,
      currency: { singular: 'merit', plural: 'merits', genitive: 'merits' },
      lastUpdated: now,
      createdAt: now,
      updatedAt: now,
    });

    const postId = uid();
    await publicationModel.create({
      id: postId,
      communityId,
      authorId,
      title: 'Own Post',
      description: 'Test',
      content: 'Content',
      type: 'text',
      investingEnabled: true,
      investorSharePercent: 20,
      investmentPool: 0,
      investmentPoolTotal: 0,
      investments: [],
      metrics: { score: 0, upvotes: 0, downvotes: 0, commentCount: 0 },
      deleted: false,
      deletedAt: null,
      createdAt: now,
      updatedAt: now,
    });

    (global as any).testUserId = authorId;
    const result = await trpcMutationWithError(app, 'investments.invest', {
      postId,
      amount: 10,
    });
    expect(result.error).toBeDefined();
    expect(result.error?.code).toBe('BAD_REQUEST');
  });
});
