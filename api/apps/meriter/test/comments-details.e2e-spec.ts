import { INestApplication } from '@nestjs/common';
import { getConnectionToken, getModelToken } from '@nestjs/mongoose';
import { Connection, Model } from 'mongoose';
import { uid } from 'uid';
import { TestSetupHelper } from './helpers/test-setup.helper';
import { trpcMutation, trpcQuery, trpcQueryWithError } from './helpers/trpc-test-helper';
import { CommunitySchemaClass, CommunityDocument } from '../src/domain/models/community/community.schema';
import { PublicationSchemaClass, PublicationDocument } from '../src/domain/models/publication/publication.schema';
import { UserSchemaClass, UserDocument } from '../src/domain/models/user/user.schema';
import { WalletSchemaClass, WalletDocument } from '../src/domain/models/wallet/wallet.schema';
import { UserCommunityRoleSchemaClass, UserCommunityRoleDocument } from '../src/domain/models/user-community-role/user-community-role.schema';

describe('comments.getDetails (e2e)', () => {
  jest.setTimeout(60000);

  let app: INestApplication;
  let testDb: any;
  let connection: Connection;
  let originalEnableCommentVoting: string | undefined;

  let communityModel: Model<CommunityDocument>;
  let userModel: Model<UserDocument>;
  let publicationModel: Model<PublicationDocument>;
  let walletModel: Model<WalletDocument>;
  let userCommunityRoleModel: Model<UserCommunityRoleDocument>;

  let testCommunityId: string;
  let authorId: string;
  let voterId: string;
  let beneficiaryId: string;
  let publicationId: string;

  async function seedBaseCommunity(): Promise<void> {
    testCommunityId = uid();
    authorId = uid();
    voterId = uid();
    beneficiaryId = uid();

    await userModel.create([
      {
        id: authorId,
        telegramId: `author_${authorId}`,
        authProvider: 'telegram',
        authId: `author_${authorId}`,
        displayName: 'Author',
        username: 'author',
        firstName: 'Author',
        lastName: 'User',
        avatarUrl: 'https://example.com/a.jpg',
        communityMemberships: [],
        communityTags: [],
        profile: {},
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        id: voterId,
        telegramId: `voter_${voterId}`,
        authProvider: 'telegram',
        authId: `voter_${voterId}`,
        displayName: 'Voter',
        username: 'voter',
        firstName: 'Voter',
        lastName: 'User',
        avatarUrl: 'https://example.com/v.jpg',
        communityMemberships: [],
        communityTags: [],
        profile: {},
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        id: beneficiaryId,
        telegramId: `beneficiary_${beneficiaryId}`,
        authProvider: 'telegram',
        authId: `beneficiary_${beneficiaryId}`,
        displayName: 'Beneficiary',
        username: 'beneficiary',
        firstName: 'Beneficiary',
        lastName: 'User',
        avatarUrl: 'https://example.com/b.jpg',
        communityMemberships: [],
        communityTags: [],
        profile: {},
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ]);

    await communityModel.create({
      id: testCommunityId,
      name: 'Test Community',
      members: [authorId, voterId, beneficiaryId],
      settings: {
        currencyNames: { singular: 'merit', plural: 'merits', genitive: 'merits' },
        dailyEmission: 10,
      },
      hashtags: ['test'],
      hashtagDescriptions: {},
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    // PermissionService reads roles from UserCommunityRole collection
    const now = new Date();
    await userCommunityRoleModel.create([
      { id: uid(), userId: authorId, communityId: testCommunityId, role: 'participant', createdAt: now, updatedAt: now },
      { id: uid(), userId: voterId, communityId: testCommunityId, role: 'participant', createdAt: now, updatedAt: now },
      { id: uid(), userId: beneficiaryId, communityId: testCommunityId, role: 'participant', createdAt: now, updatedAt: now },
    ]);

    // Wallets for voting
    await walletModel.create([
      {
        id: uid(),
        userId: voterId,
        communityId: testCommunityId,
        balance: 100,
        currency: { singular: 'merit', plural: 'merits', genitive: 'merits' },
        lastUpdated: now,
        createdAt: now,
        updatedAt: now,
      },
    ]);

    publicationId = uid();
    await publicationModel.create({
      id: publicationId,
      communityId: testCommunityId,
      authorId,
      content: 'Publication for comment details tests',
      type: 'text',
      hashtags: ['test'],
      postType: 'basic',
      isProject: false,
      metrics: { upvotes: 0, downvotes: 0, score: 0, commentCount: 0 },
      createdAt: now,
      updatedAt: now,
    });
  }

  beforeAll(async () => {
    originalEnableCommentVoting = process.env.ENABLE_COMMENT_VOTING;
    process.env.ENABLE_COMMENT_VOTING = 'true';

    const context = await TestSetupHelper.createTestApp();
    app = context.app;
    testDb = context.testDb;

    connection = app.get(getConnectionToken());
    communityModel = app.get(getModelToken(CommunitySchemaClass.name));
    userModel = app.get(getModelToken(UserSchemaClass.name));
    publicationModel = app.get(getModelToken(PublicationSchemaClass.name));
    walletModel = app.get(getModelToken(WalletSchemaClass.name));
    userCommunityRoleModel = app.get(getModelToken(UserCommunityRoleSchemaClass.name));
  });

  beforeEach(async () => {
    // Clean DB between tests for isolation
    const collections = connection.collections;
    for (const key in collections) {
      await collections[key].deleteMany({});
    }
    await seedBaseCommunity();
  });

  afterAll(async () => {
    process.env.ENABLE_COMMENT_VOTING = originalEnableCommentVoting;
    await TestSetupHelper.cleanup({ app, testDb });
  });

  it('returns details for a regular comment (legacy comment document)', async () => {
    (global as any).testUserId = voterId;

    const created = await trpcMutation(app, 'comments.create', {
      targetType: 'publication',
      targetId: publicationId,
      content: 'Regular comment',
    });

    const commentId = created.id;
    const details = await trpcQuery(app, 'comments.getDetails', { id: commentId });

    expect(details.comment.id).toBe(commentId);
    expect(details.comment.content).toBe('Regular comment');
    expect(details.author.id).toBe(voterId);
    // Legacy comment enrichment may not include community (vote-comment flow is primary).
    expect(details.community).toBeNull();
    expect(details.voteTransaction).toBeNull();
    // Legacy comments currently have no vote metrics (votes targetType is publication|vote)
    expect(details.metrics.score).toBe(0);
  });

  it('returns details for a vote-comment on a publication without beneficiary (beneficiary resolves to publication author)', async () => {
    (global as any).testUserId = voterId;

    const vote = await trpcMutation(app, 'votes.createWithComment', {
      targetType: 'publication',
      targetId: publicationId,
      quotaAmount: 10,
      walletAmount: 0,
      comment: 'Vote comment',
    });

    const details = await trpcQuery(app, 'comments.getDetails', { id: vote.id });
    expect(details.voteTransaction).toBeDefined();
    expect(details.voteTransaction.amountTotal).toBe(10);

    expect(details.author.id).toBe(voterId);
    expect(details.beneficiary).toBeDefined();
    expect(details.beneficiary.id).toBe(authorId);
    expect(details.beneficiary.id).not.toBe(details.author.id);
  });

  it('returns details for a vote-comment on a publication with beneficiary', async () => {
    const pubId = uid();
    await publicationModel.create({
      id: pubId,
      communityId: testCommunityId,
      authorId,
      beneficiaryId,
      content: 'Publication with beneficiary',
      type: 'text',
      hashtags: ['test'],
      postType: 'basic',
      isProject: false,
      metrics: { upvotes: 0, downvotes: 0, score: 0, commentCount: 0 },
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    (global as any).testUserId = voterId;
    const vote = await trpcMutation(app, 'votes.createWithComment', {
      targetType: 'publication',
      targetId: pubId,
      quotaAmount: 10,
      walletAmount: 0,
      comment: 'Vote comment with beneficiary',
    });

    const details = await trpcQuery(app, 'comments.getDetails', { id: vote.id });
    expect(details.beneficiary).toBeDefined();
    expect(details.beneficiary.id).toBe(beneficiaryId);
    expect(details.author.id).toBe(voterId);
    expect(details.beneficiary.id).not.toBe(details.author.id);
  });

  it('does not return beneficiary when beneficiary equals comment author (allowed in future-vision)', async () => {
    // Create Future Vision community where self-voting is allowed and quota is 0
    const fvCommunityId = uid();
    await communityModel.create({
      id: fvCommunityId,
      name: 'Future Vision',
      typeTag: 'future-vision',
      members: [voterId],
      settings: {
        currencyNames: { singular: 'merit', plural: 'merits', genitive: 'merits' },
        dailyEmission: 10,
      },
      hashtags: ['vision'],
      hashtagDescriptions: {},
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    const now = new Date();
    await userCommunityRoleModel.create({
      id: uid(),
      userId: voterId,
      communityId: fvCommunityId,
      role: 'participant',
      createdAt: now,
      updatedAt: now,
    });

    await walletModel.create({
      id: uid(),
      userId: voterId,
      communityId: fvCommunityId,
      balance: 100,
      currency: { singular: 'merit', plural: 'merits', genitive: 'merits' },
      lastUpdated: now,
      createdAt: now,
      updatedAt: now,
    });

    const fvPubId = uid();
    await publicationModel.create({
      id: fvPubId,
      communityId: fvCommunityId,
      authorId: voterId,
      content: 'FV self-vote publication',
      type: 'text',
      hashtags: ['vision'],
      postType: 'basic',
      isProject: false,
      metrics: { upvotes: 0, downvotes: 0, score: 0, commentCount: 0 },
      createdAt: now,
      updatedAt: now,
    });

    (global as any).testUserId = voterId;
    const vote = await trpcMutation(app, 'votes.createWithComment', {
      targetType: 'publication',
      targetId: fvPubId,
      quotaAmount: 0,
      walletAmount: 5,
      comment: 'Self vote in Future Vision',
    });

    const details = await trpcQuery(app, 'comments.getDetails', { id: vote.id });
    expect(details.author.id).toBe(voterId);
    expect(details.beneficiary).toBeNull();
  });

  it('returns NOT_FOUND for an unknown id', async () => {
    const missingId = uid();
    const result = await trpcQueryWithError(app, 'comments.getDetails', { id: missingId });
    expect(result.error?.code).toBe('NOT_FOUND');
  });
});


