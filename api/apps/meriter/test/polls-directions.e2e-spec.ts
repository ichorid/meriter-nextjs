import { TestSetupHelper } from './helpers/test-setup.helper';
import { createTestPoll } from './helpers/fixtures';
import {
  trpcMutation,
  trpcMutationWithError,
  trpcQuery,
  trpcQueryWithError,
} from './helpers/trpc-test-helper';
import { getModelToken } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { uid } from 'uid';
import { CommunitySchemaClass, CommunityDocument } from '../src/domain/models/community/community.schema';
import { UserSchemaClass, UserDocument } from '../src/domain/models/user/user.schema';
import { WalletSchemaClass, WalletDocument } from '../src/domain/models/wallet/wallet.schema';
import { UserCommunityRoleSchemaClass, UserCommunityRoleDocument } from '../src/domain/models/user-community-role/user-community-role.schema';
import { GLOBAL_COMMUNITY_ID } from '../src/domain/common/constants/global.constant';

describe('Polls E2E (directions, quotaAllowed, getCasts, pollCreation)', () => {
  let app: any;
  let testDb: any;
  let communityModel: Model<CommunityDocument>;
  let userModel: Model<UserDocument>;
  let walletModel: Model<WalletDocument>;
  let userCommunityRoleModel: Model<UserCommunityRoleDocument>;

  const now = () => new Date();
  const currency = { singular: 'merit', plural: 'merits', genitive: 'merits' };

  async function createUser(displayName: string): Promise<string> {
    const userId = uid();
    await userModel.create({
      id: userId,
      authProvider: 'telegram',
      authId: `user_${userId}`,
      displayName,
      username: `u_${userId}`,
      avatarUrl: 'https://example.com/avatar.jpg',
      communityMemberships: [],
      communityTags: [],
      profile: {},
      createdAt: now(),
      updatedAt: now(),
    });
    return userId;
  }

  async function createCommunity(overrides: Record<string, unknown> = {}): Promise<string> {
    const communityId = uid();
    await communityModel.create({
      id: communityId,
      name: `Poll Community ${communityId}`,
      members: [],
      settings: {
        currencyNames: currency,
        dailyEmission: 10,
        ...((overrides.settings as Record<string, unknown>) ?? {}),
      },
      meritSettings: {
        dailyQuota: 10,
        quotaEnabled: true,
        quotaRecipients: ['participant', 'lead'],
        canEarn: true,
        canSpend: true,
      },
      hashtags: [],
      hashtagDescriptions: {},
      isActive: true,
      createdAt: now(),
      updatedAt: now(),
      ...Object.fromEntries(Object.entries(overrides).filter(([k]) => k !== 'settings')),
    });
    return communityId;
  }

  async function addMember(
    userId: string,
    communityId: string,
    role: 'participant' | 'lead' = 'participant',
  ): Promise<void> {
    await userCommunityRoleModel.create({
      id: uid(),
      userId,
      communityId,
      role,
      createdAt: now(),
      updatedAt: now(),
    });
  }

  async function createWallet(userId: string, communityId: string, balance: number): Promise<void> {
    await walletModel.create({
      id: uid(),
      userId,
      communityId,
      balance,
      currency,
      lastUpdated: now(),
      createdAt: now(),
      updatedAt: now(),
    });
  }

  async function getBalance(userId: string, communityId: string): Promise<number> {
    const wallet = await walletModel.findOne({ userId, communityId }).lean();
    return wallet?.balance ?? 0;
  }

  function actAs(userId: string): void {
    (global as any).testUserId = userId;
  }

  /** Creates member with community + global wallets and returns userId. */
  async function createMemberWithWallets(
    communityId: string,
    communityBalance: number,
    globalBalance: number,
    role: 'participant' | 'lead' = 'participant',
  ): Promise<string> {
    const userId = await createUser(`Member ${uid()}`);
    await addMember(userId, communityId, role);
    await createWallet(userId, communityId, communityBalance);
    await createWallet(userId, GLOBAL_COMMUNITY_ID, globalBalance);
    return userId;
  }

  async function createPollAs(
    userId: string,
    communityId: string,
    overrides: Record<string, unknown> = {},
  ) {
    actAs(userId);
    return trpcMutation(app, 'polls.create', createTestPoll(communityId, overrides as any));
  }

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

  it('down cast is wallet-only, burns merits, and increments amountDown', async () => {
    const communityId = await createCommunity();
    const author = await createMemberWithWallets(communityId, 100, 100);
    const voter = await createMemberWithWallets(communityId, 100, 100);

    const poll = await createPollAs(author, communityId);
    const optionId = poll.options[0].id;

    actAs(voter);
    const result = await trpcMutation(app, 'polls.cast', {
      pollId: poll.id,
      data: { optionId, walletAmount: 5, quotaAmount: 0, direction: 'down' },
    });
    expect(result.success).toBe(true);
    expect(result.data.direction).toBe('down');
    expect(result.data.amountWallet).toBe(5);
    expect(result.data.amountQuota).toBe(0);

    // Voter debited from community wallet
    expect(await getBalance(voter, communityId)).toBe(95);
    // Burn: nobody credited (author wallets untouched)
    expect(await getBalance(author, communityId)).toBe(100);

    const updated = await trpcQuery(app, 'polls.getById', { id: poll.id });
    const option = updated.options.find((o: any) => o.id === optionId);
    expect(option.amountDown).toBe(5);
    expect(option.amountUp).toBe(0);
    expect(option.amount).toBe(-5);
  });

  it('rejects down cast when wallet balance is insufficient even with quota available', async () => {
    const communityId = await createCommunity();
    const author = await createMemberWithWallets(communityId, 100, 100);
    const voter = await createMemberWithWallets(communityId, 0, 0);

    const poll = await createPollAs(author, communityId, {
      settings: { quotaAllowed: true },
    });
    const optionId = poll.options[0].id;

    actAs(voter);
    const { error } = await trpcMutationWithError(app, 'polls.cast', {
      pollId: poll.id,
      data: { optionId, walletAmount: 3, quotaAmount: 0, direction: 'down' },
    });
    expect(error).toBeDefined();
    expect(error?.code).toBe('BAD_REQUEST');
    // No quota consumed as fallback
    expect(await getBalance(voter, communityId)).toBe(0);
  });

  it('rejects quota-funded up cast when quotaAllowed is false (default)', async () => {
    const communityId = await createCommunity();
    const author = await createMemberWithWallets(communityId, 100, 100);
    const voter = await createMemberWithWallets(communityId, 0, 0);

    const poll = await createPollAs(author, communityId);
    const optionId = poll.options[0].id;

    actAs(voter);
    const { error } = await trpcMutationWithError(app, 'polls.cast', {
      pollId: poll.id,
      data: { optionId, walletAmount: 0, quotaAmount: 3 },
    });
    expect(error).toBeDefined();
    expect(error?.code).toBe('BAD_REQUEST');
  });

  it('accepts quota for up cast when quotaAllowed is true', async () => {
    const communityId = await createCommunity();
    const author = await createMemberWithWallets(communityId, 100, 100);
    const voter = await createMemberWithWallets(communityId, 0, 0);

    const poll = await createPollAs(author, communityId, {
      settings: { quotaAllowed: true },
    });
    const optionId = poll.options[0].id;

    actAs(voter);
    const result = await trpcMutation(app, 'polls.cast', {
      pollId: poll.id,
      data: { optionId, walletAmount: 0, quotaAmount: 3 },
    });
    expect(result.success).toBe(true);
    expect(result.data.amountQuota).toBe(3);
    expect(result.data.amountWallet).toBe(0);
    expect(result.data.direction).toBe('up');
    // Wallet untouched
    expect(await getBalance(voter, communityId)).toBe(0);

    const updated = await trpcQuery(app, 'polls.getById', { id: poll.id });
    const option = updated.options.find((o: any) => o.id === optionId);
    expect(option.amountUp).toBe(3);
    expect(option.amountDown).toBe(0);
    expect(option.amount).toBe(3);
  });

  it('accumulates multiple casts in both directions into option aggregates', async () => {
    const communityId = await createCommunity();
    const author = await createMemberWithWallets(communityId, 100, 100);
    const voter = await createMemberWithWallets(communityId, 100, 100);

    const poll = await createPollAs(author, communityId);
    const optionId = poll.options[0].id;

    actAs(voter);
    await trpcMutation(app, 'polls.cast', {
      pollId: poll.id,
      data: { optionId, walletAmount: 2, quotaAmount: 0 },
    });
    await trpcMutation(app, 'polls.cast', {
      pollId: poll.id,
      data: { optionId, walletAmount: 3, quotaAmount: 0, direction: 'up' },
    });
    await trpcMutation(app, 'polls.cast', {
      pollId: poll.id,
      data: { optionId, walletAmount: 1, quotaAmount: 0, direction: 'down' },
    });

    const updated = await trpcQuery(app, 'polls.getById', { id: poll.id });
    const option = updated.options.find((o: any) => o.id === optionId);
    expect(option.amountUp).toBe(5);
    expect(option.amountDown).toBe(1);
    expect(option.amount).toBe(4);

    const results = await trpcQuery(app, 'polls.getResults', { id: poll.id });
    const optionResult = results.find((r: any) => r.optionId === optionId);
    expect(optionResult.amountUp).toBe(5);
    expect(optionResult.amountDown).toBe(1);
    expect(optionResult.amount).toBe(4);
  });

  it('getCasts requires community membership and returns enriched rows + casters summary', async () => {
    const communityId = await createCommunity();
    const author = await createMemberWithWallets(communityId, 100, 100);
    const voter = await createMemberWithWallets(communityId, 100, 100);
    const outsider = await createUser('Outsider');
    await createWallet(outsider, GLOBAL_COMMUNITY_ID, 100);

    const poll = await createPollAs(author, communityId);
    const optionA = poll.options[0].id;
    const optionB = poll.options[1].id;

    actAs(voter);
    await trpcMutation(app, 'polls.cast', {
      pollId: poll.id,
      data: { optionId: optionA, walletAmount: 4, quotaAmount: 0 },
    });
    await trpcMutation(app, 'polls.cast', {
      pollId: poll.id,
      data: { optionId: optionB, walletAmount: 2, quotaAmount: 0, direction: 'down' },
    });

    // Non-member is rejected
    actAs(outsider);
    const { error } = await trpcQueryWithError(app, 'polls.getCasts', { pollId: poll.id });
    expect(error).toBeDefined();
    expect(error?.code).toBe('FORBIDDEN');

    // Member sees the feed
    actAs(author);
    const feed = await trpcQuery(app, 'polls.getCasts', { pollId: poll.id });
    expect(feed.total).toBe(2);
    expect(feed.items).toHaveLength(2);

    const upItem = feed.items.find((i: any) => i.direction === 'up');
    expect(upItem.userId).toBe(voter);
    expect(upItem.userDisplayName).toBeTruthy();
    expect(upItem.optionId).toBe(optionA);
    expect(upItem.optionText).toBeTruthy();
    expect(upItem.amount).toBe(4);
    expect(upItem.createdAt).toBeTruthy();

    const downItem = feed.items.find((i: any) => i.direction === 'down');
    expect(downItem.optionId).toBe(optionB);
    expect(downItem.amount).toBe(2);

    expect(feed.casters).toHaveLength(1);
    expect(feed.casters[0].userId).toBe(voter);
    expect(feed.casters[0].totalUp).toBe(4);
    expect(feed.casters[0].totalDown).toBe(2);

    // optionId filter scopes feed and casters
    const filtered = await trpcQuery(app, 'polls.getCasts', {
      pollId: poll.id,
      optionId: optionA,
    });
    expect(filtered.total).toBe(1);
    expect(filtered.items[0].optionId).toBe(optionA);
    expect(filtered.casters).toHaveLength(1);
    expect(filtered.casters[0].userId).toBe(voter);
    expect(filtered.casters[0].totalUp).toBe(4);
    expect(filtered.casters[0].totalDown).toBe(0);

    const filteredB = await trpcQuery(app, 'polls.getCasts', {
      pollId: poll.id,
      optionId: optionB,
    });
    expect(filteredB.total).toBe(1);
    expect(filteredB.casters).toHaveLength(1);
    expect(filteredB.casters[0].totalUp).toBe(0);
    expect(filteredB.casters[0].totalDown).toBe(2);
  });

  it("pollCreation 'admin' blocks plain members but allows lead", async () => {
    const communityId = await createCommunity({
      settings: { pollCreation: 'admin' },
    });
    const participant = await createMemberWithWallets(communityId, 100, 100);
    const lead = await createMemberWithWallets(communityId, 100, 100, 'lead');

    actAs(participant);
    const { error } = await trpcMutationWithError(
      app,
      'polls.create',
      createTestPoll(communityId, {}),
    );
    expect(error).toBeDefined();
    expect(error?.code).toBe('FORBIDDEN');

    actAs(lead);
    const poll = await trpcMutation(app, 'polls.create', createTestPoll(communityId, {}));
    expect(poll?.id).toBeDefined();
  });
});
