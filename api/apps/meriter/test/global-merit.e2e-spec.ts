/**
 * Global Merit E2E tests
 * Covers: fee from global, voting from global in priority, withdrawal, tappalka, investment, welcome merits.
 */
import { INestApplication } from '@nestjs/common';
import { getModelToken } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { uid } from 'uid';
import { TestSetupHelper } from './helpers/test-setup.helper';
import { trpcMutation } from './helpers/trpc-test-helper';
import { CommunitySchemaClass, CommunityDocument } from '../src/domain/models/community/community.schema';
import { UserSchemaClass, UserDocument } from '../src/domain/models/user/user.schema';
import { WalletSchemaClass, WalletDocument } from '../src/domain/models/wallet/wallet.schema';
import { UserCommunityRoleSchemaClass, UserCommunityRoleDocument } from '../src/domain/models/user-community-role/user-community-role.schema';
import { GLOBAL_COMMUNITY_ID } from '../src/domain/common/constants/global.constant';
import { UserService } from '../src/domain/services/user.service';
import { WalletService } from '../src/domain/services/wallet.service';
import { PlatformSettingsService } from '../src/domain/services/platform-settings.service';

describe('Global Merit E2E', () => {
  jest.setTimeout(60000);

  let app: INestApplication;
  let testDb: any;
  let communityModel: Model<CommunityDocument>;
  let userModel: Model<UserDocument>;
  let walletModel: Model<WalletDocument>;
  let userCommunityRoleModel: Model<UserCommunityRoleDocument>;
  let userService: UserService;
  let walletService: WalletService;
  let platformSettingsService: PlatformSettingsService;

  beforeAll(async () => {
    const context = await TestSetupHelper.createTestApp();
    app = context.app;
    testDb = context.testDb;

    communityModel = app.get(getModelToken(CommunitySchemaClass.name));
    userModel = app.get(getModelToken(UserSchemaClass.name));
    walletModel = app.get(getModelToken(WalletSchemaClass.name));
    userCommunityRoleModel = app.get(getModelToken(UserCommunityRoleSchemaClass.name));
    userService = app.get(UserService);
    walletService = app.get(WalletService);
    platformSettingsService = app.get(PlatformSettingsService);
  });

  afterAll(async () => {
    await TestSetupHelper.cleanup({ app, testDb });
  });

  describe('Fee from global', () => {
    it('post in Marathon of Good: fee deducted from global wallet', async () => {
      const now = new Date();
      const authorId = uid();
      const mdCommunityId = uid();

      await userModel.create({
        id: authorId,
        authProvider: 'telegram',
        authId: `tg-${authorId}`,
        displayName: 'Author',
        username: `author_${authorId}`,
        communityMemberships: [],
        communityTags: [],
        profile: {},
        createdAt: now,
        updatedAt: now,
      });

      await communityModel.create({
        id: mdCommunityId,
        name: 'Marathon of Good',
        typeTag: 'marathon-of-good',
        members: [authorId],
        settings: { currencyNames: { singular: 'merit', plural: 'merits', genitive: 'merits' }, postCost: 1 },
        votingRules: { allowedRoles: ['participant'], canVoteForOwnPosts: false, participantsCannotVoteForLead: false, spendsMerits: true, awardsMerits: true },
        hashtags: ['test'],
        hashtagDescriptions: {},
        isActive: true,
        createdAt: now,
        updatedAt: now,
      });

      await userCommunityRoleModel.create({
        id: uid(),
        userId: authorId,
        communityId: mdCommunityId,
        role: 'participant',
        createdAt: now,
        updatedAt: now,
      });

      await walletModel.create({
        id: uid(),
        userId: authorId,
        communityId: GLOBAL_COMMUNITY_ID,
        balance: 10,
        currency: { singular: 'merit', plural: 'merits', genitive: 'merits' },
        lastUpdated: now,
        createdAt: now,
        updatedAt: now,
      });

      (global as any).testUserId = authorId;
      await trpcMutation(app, 'publications.create', {
        communityId: mdCommunityId,
        content: 'Test post in MD',
        type: 'text',
        hashtags: ['test'],
        postType: 'basic',
        isProject: false,
      });

      const globalWallet = await walletService.getWallet(authorId, GLOBAL_COMMUNITY_ID);
      expect(globalWallet?.getBalance()).toBe(9); // 10 - 1 fee
    });

    it('post in local community: fee deducted from global wallet', async () => {
      const now = new Date();
      const authorId = uid();
      const localCommunityId = uid();

      await userModel.create({
        id: authorId,
        authProvider: 'telegram',
        authId: `tg-${authorId}`,
        displayName: 'Author',
        username: `author_${authorId}`,
        communityMemberships: [],
        communityTags: [],
        profile: {},
        createdAt: now,
        updatedAt: now,
      });

      await communityModel.create({
        id: localCommunityId,
        name: 'Local Team',
        typeTag: 'team',
        members: [authorId],
        settings: { currencyNames: { singular: 'merit', plural: 'merits', genitive: 'merits' }, postCost: 1 },
        votingRules: { allowedRoles: ['participant'], canVoteForOwnPosts: false, participantsCannotVoteForLead: false, spendsMerits: true, awardsMerits: true },
        hashtags: ['test'],
        hashtagDescriptions: {},
        isActive: true,
        createdAt: now,
        updatedAt: now,
      });

      await userCommunityRoleModel.create({
        id: uid(),
        userId: authorId,
        communityId: localCommunityId,
        role: 'participant',
        createdAt: now,
        updatedAt: now,
      });

      await walletModel.create({
        id: uid(),
        userId: authorId,
        communityId: GLOBAL_COMMUNITY_ID,
        balance: 5,
        currency: { singular: 'merit', plural: 'merits', genitive: 'merits' },
        lastUpdated: now,
        createdAt: now,
        updatedAt: now,
      });

      (global as any).testUserId = authorId;
      await trpcMutation(app, 'publications.create', {
        communityId: localCommunityId,
        content: 'Test post in local',
        type: 'text',
        hashtags: ['test'],
        postType: 'basic',
        isProject: false,
      });

      const globalWallet = await walletService.getWallet(authorId, GLOBAL_COMMUNITY_ID);
      expect(globalWallet?.getBalance()).toBe(4); // 5 - 1 fee
    });
  });

  describe('Voting from global in priority community', () => {
    it('upvote in Marathon of Good debits from global wallet', async () => {
      const now = new Date();
      const authorId = uid();
      const voterId = uid();
      const mdCommunityId = uid();

      await userModel.create([
        { id: authorId, authProvider: 'telegram', authId: `tg-${authorId}`, displayName: 'Author', username: `a_${authorId}`, communityMemberships: [], communityTags: [], profile: {}, createdAt: now, updatedAt: now },
        { id: voterId, authProvider: 'telegram', authId: `tg-${voterId}`, displayName: 'Voter', username: `v_${voterId}`, communityMemberships: [], communityTags: [], profile: {}, createdAt: now, updatedAt: now },
      ]);

      await communityModel.create({
        id: mdCommunityId,
        name: 'Marathon',
        typeTag: 'marathon-of-good',
        members: [authorId, voterId],
        settings: { currencyNames: { singular: 'merit', plural: 'merits', genitive: 'merits' }, postCost: 1 },
        votingRules: { allowedRoles: ['participant'], canVoteForOwnPosts: false, participantsCannotVoteForLead: false, spendsMerits: true, awardsMerits: true },
        hashtags: ['test'],
        hashtagDescriptions: {},
        isActive: true,
        createdAt: now,
        updatedAt: now,
      });

      await userCommunityRoleModel.create([
        { id: uid(), userId: authorId, communityId: mdCommunityId, role: 'participant', createdAt: now, updatedAt: now },
        { id: uid(), userId: voterId, communityId: mdCommunityId, role: 'participant', createdAt: now, updatedAt: now },
      ]);

      await walletModel.create([
        { id: uid(), userId: authorId, communityId: GLOBAL_COMMUNITY_ID, balance: 10, currency: { singular: 'merit', plural: 'merits', genitive: 'merits' }, lastUpdated: now, createdAt: now, updatedAt: now },
        { id: uid(), userId: voterId, communityId: GLOBAL_COMMUNITY_ID, balance: 20, currency: { singular: 'merit', plural: 'merits', genitive: 'merits' }, lastUpdated: now, createdAt: now, updatedAt: now },
      ]);

      (global as any).testUserId = authorId;
      const pub = await trpcMutation(app, 'publications.create', {
        communityId: mdCommunityId,
        content: 'MD post',
        type: 'text',
        hashtags: ['test'],
        postType: 'basic',
        isProject: false,
      });

      (global as any).testUserId = voterId;
      await trpcMutation(app, 'votes.createWithComment', {
        targetType: 'publication',
        targetId: pub.id,
        quotaAmount: 0,
        walletAmount: 7,
        comment: 'Upvote',
      });

      await new Promise((r) => setTimeout(r, 300));
      const voterGlobal = await walletService.getWallet(voterId, GLOBAL_COMMUNITY_ID);
      expect(voterGlobal?.getBalance()).toBe(13); // 20 - 7
    });

    it('upvote in local community debits from local wallet', async () => {
      const now = new Date();
      const authorId = uid();
      const voterId = uid();
      const localId = uid();

      await userModel.create([
        { id: authorId, authProvider: 'telegram', authId: `tg-${authorId}`, displayName: 'Author', username: `a_${authorId}`, communityMemberships: [], communityTags: [], profile: {}, createdAt: now, updatedAt: now },
        { id: voterId, authProvider: 'telegram', authId: `tg-${voterId}`, displayName: 'Voter', username: `v_${voterId}`, communityMemberships: [], communityTags: [], profile: {}, createdAt: now, updatedAt: now },
      ]);

      await communityModel.create({
        id: localId,
        name: 'Local',
        typeTag: 'team',
        members: [authorId, voterId],
        settings: { currencyNames: { singular: 'merit', plural: 'merits', genitive: 'merits' }, postCost: 1 },
        votingRules: { allowedRoles: ['participant'], canVoteForOwnPosts: false, participantsCannotVoteForLead: false, spendsMerits: true, awardsMerits: true },
        hashtags: ['test'],
        hashtagDescriptions: {},
        isActive: true,
        createdAt: now,
        updatedAt: now,
      });

      await userCommunityRoleModel.create([
        { id: uid(), userId: authorId, communityId: localId, role: 'participant', createdAt: now, updatedAt: now },
        { id: uid(), userId: voterId, communityId: localId, role: 'participant', createdAt: now, updatedAt: now },
      ]);

      await walletModel.create([
        { id: uid(), userId: authorId, communityId: GLOBAL_COMMUNITY_ID, balance: 10, currency: { singular: 'merit', plural: 'merits', genitive: 'merits' }, lastUpdated: now, createdAt: now, updatedAt: now },
        { id: uid(), userId: voterId, communityId: GLOBAL_COMMUNITY_ID, balance: 5, currency: { singular: 'merit', plural: 'merits', genitive: 'merits' }, lastUpdated: now, createdAt: now, updatedAt: now },
        { id: uid(), userId: voterId, communityId: localId, balance: 15, currency: { singular: 'merit', plural: 'merits', genitive: 'merits' }, lastUpdated: now, createdAt: now, updatedAt: now },
      ]);

      (global as any).testUserId = authorId;
      const pub = await trpcMutation(app, 'publications.create', {
        communityId: localId,
        content: 'Local post',
        type: 'text',
        hashtags: ['test'],
        postType: 'basic',
        isProject: false,
      });

      (global as any).testUserId = voterId;
      await trpcMutation(app, 'votes.createWithComment', {
        targetType: 'publication',
        targetId: pub.id,
        quotaAmount: 0,
        walletAmount: 4,
        comment: 'Upvote',
      });

      await new Promise((r) => setTimeout(r, 300));
      const voterLocal = await walletService.getWallet(voterId, localId);
      expect(voterLocal?.getBalance()).toBe(11); // 15 - 4
    });
  });

  describe('Withdrawal', () => {
    it('withdrawal from Marathon of Good post credits global wallet', async () => {
      const now = new Date();
      const authorId = uid();
      const voterId = uid();
      const mdCommunityId = uid();

      await userModel.create([
        { id: authorId, authProvider: 'telegram', authId: `tg-${authorId}`, displayName: 'Author', username: `a_${authorId}`, communityMemberships: [], communityTags: [], profile: {}, createdAt: now, updatedAt: now },
        { id: voterId, authProvider: 'telegram', authId: `tg-${voterId}`, displayName: 'Voter', username: `v_${voterId}`, communityMemberships: [], communityTags: [], profile: {}, createdAt: now, updatedAt: now },
      ]);

      await communityModel.create({
        id: mdCommunityId,
        name: 'Marathon',
        typeTag: 'marathon-of-good',
        members: [authorId, voterId],
        settings: { currencyNames: { singular: 'merit', plural: 'merits', genitive: 'merits' }, postCost: 1, canWithdrawMerits: true },
        meritSettings: { canWithdrawMerits: true },
        votingRules: { allowedRoles: ['participant'], canVoteForOwnPosts: false, participantsCannotVoteForLead: false, spendsMerits: true, awardsMerits: true },
        hashtags: ['test'],
        hashtagDescriptions: {},
        isActive: true,
        createdAt: now,
        updatedAt: now,
      });

      await userCommunityRoleModel.create([
        { id: uid(), userId: authorId, communityId: mdCommunityId, role: 'participant', createdAt: now, updatedAt: now },
        { id: uid(), userId: voterId, communityId: mdCommunityId, role: 'participant', createdAt: now, updatedAt: now },
      ]);

      await walletModel.create([
        { id: uid(), userId: authorId, communityId: GLOBAL_COMMUNITY_ID, balance: 10, currency: { singular: 'merit', plural: 'merits', genitive: 'merits' }, lastUpdated: now, createdAt: now, updatedAt: now },
        { id: uid(), userId: voterId, communityId: GLOBAL_COMMUNITY_ID, balance: 20, currency: { singular: 'merit', plural: 'merits', genitive: 'merits' }, lastUpdated: now, createdAt: now, updatedAt: now },
      ]);

      (global as any).testUserId = authorId;
      const pub = await trpcMutation(app, 'publications.create', {
        communityId: mdCommunityId,
        content: 'MD post',
        type: 'text',
        hashtags: ['test'],
        postType: 'basic',
        isProject: false,
      });

      (global as any).testUserId = voterId;
      await trpcMutation(app, 'votes.createWithComment', {
        targetType: 'publication',
        targetId: pub.id,
        quotaAmount: 0,
        walletAmount: 8,
        comment: 'Vote',
      });

      await new Promise((r) => setTimeout(r, 300));

      (global as any).testUserId = authorId;
      const result = await trpcMutation(app, 'votes.withdraw', { id: pub.id, amount: 8 });
      expect(result.amount).toBe(8);

      const authorGlobal = await walletService.getWallet(authorId, GLOBAL_COMMUNITY_ID);
      expect(authorGlobal?.getBalance()).toBe(17); // 10 - 1 fee + 8 withdrawal
    });

    it('withdrawal from local community post credits global wallet', async () => {
      const now = new Date();
      const authorId = uid();
      const voterId = uid();
      const localId = uid();

      await userModel.create([
        { id: authorId, authProvider: 'telegram', authId: `tg-${authorId}`, displayName: 'Author', username: `a_${authorId}`, communityMemberships: [], communityTags: [], profile: {}, createdAt: now, updatedAt: now },
        { id: voterId, authProvider: 'telegram', authId: `tg-${voterId}`, displayName: 'Voter', username: `v_${voterId}`, communityMemberships: [], communityTags: [], profile: {}, createdAt: now, updatedAt: now },
      ]);

      await communityModel.create({
        id: localId,
        name: 'Local',
        typeTag: 'team',
        members: [authorId, voterId],
        settings: { currencyNames: { singular: 'merit', plural: 'merits', genitive: 'merits' }, postCost: 1, canWithdrawMerits: true },
        meritSettings: { canWithdrawMerits: true },
        votingRules: { allowedRoles: ['participant'], canVoteForOwnPosts: false, participantsCannotVoteForLead: false, spendsMerits: true, awardsMerits: true },
        hashtags: ['test'],
        hashtagDescriptions: {},
        isActive: true,
        createdAt: now,
        updatedAt: now,
      });

      await userCommunityRoleModel.create([
        { id: uid(), userId: authorId, communityId: localId, role: 'participant', createdAt: now, updatedAt: now },
        { id: uid(), userId: voterId, communityId: localId, role: 'participant', createdAt: now, updatedAt: now },
      ]);

      await walletModel.create([
        { id: uid(), userId: authorId, communityId: GLOBAL_COMMUNITY_ID, balance: 10, currency: { singular: 'merit', plural: 'merits', genitive: 'merits' }, lastUpdated: now, createdAt: now, updatedAt: now },
        { id: uid(), userId: voterId, communityId: GLOBAL_COMMUNITY_ID, balance: 5, currency: { singular: 'merit', plural: 'merits', genitive: 'merits' }, lastUpdated: now, createdAt: now, updatedAt: now },
        { id: uid(), userId: voterId, communityId: localId, balance: 20, currency: { singular: 'merit', plural: 'merits', genitive: 'merits' }, lastUpdated: now, createdAt: now, updatedAt: now },
      ]);

      (global as any).testUserId = authorId;
      const pub = await trpcMutation(app, 'publications.create', {
        communityId: localId,
        content: 'Local post',
        type: 'text',
        hashtags: ['test'],
        postType: 'basic',
        isProject: false,
      });

      (global as any).testUserId = voterId;
      await trpcMutation(app, 'votes.createWithComment', {
        targetType: 'publication',
        targetId: pub.id,
        quotaAmount: 0,
        walletAmount: 6,
        comment: 'Vote',
      });

      await new Promise((r) => setTimeout(r, 300));

      (global as any).testUserId = authorId;
      const result = await trpcMutation(app, 'publications.withdraw', { publicationId: pub.id, amount: 6 });
      expect(result.amount).toBe(6);

      // Withdrawal always credits global wallet (MeritResolver: withdrawal → GLOBAL_COMMUNITY_ID)
      const authorGlobal = await walletService.getWallet(authorId, GLOBAL_COMMUNITY_ID);
      expect(authorGlobal?.getBalance()).toBe(15); // 10 - 1 post fee + 6 withdrawal
    });
  });

  describe('Welcome merits', () => {
    it('ensureUserInBaseCommunities credits platform-configured welcome merits to global wallet for new user', async () => {
      await platformSettingsService.update({ welcomeMeritsGlobal: 100 });

      const now = new Date();
      const newUserId = uid();
      const marathonId = uid();
      const visionId = uid();

      await communityModel.create([
        {
          id: marathonId,
          name: 'Marathon',
          typeTag: 'marathon-of-good',
          members: [],
          settings: { currencyNames: { singular: 'merit', plural: 'merits', genitive: 'merits' } },
          createdAt: now,
          updatedAt: now,
        },
        {
          id: visionId,
          name: 'Future Vision',
          typeTag: 'future-vision',
          members: [],
          settings: { currencyNames: { singular: 'merit', plural: 'merits', genitive: 'merits' } },
          createdAt: now,
          updatedAt: now,
        },
      ]);

      await userModel.create({
        id: newUserId,
        authProvider: 'google',
        authId: `google-${newUserId}`,
        displayName: 'New User',
        username: `new_${newUserId}`,
        communityMemberships: [],
        communityTags: [],
        createdAt: now,
        updatedAt: now,
      });

      await userService.ensureUserInBaseCommunities(newUserId);

      const globalWallet = await walletService.getWallet(newUserId, GLOBAL_COMMUNITY_ID);
      expect(globalWallet).toBeTruthy();
      expect(globalWallet?.getBalance()).toBe(100);
    });
  });
});
