import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import { getConnectionToken } from '@nestjs/mongoose';
import { Connection, Model } from 'mongoose';
import { uid } from 'uid';
import { TestDatabaseHelper } from './test-db.helper';
import { MeriterModule } from '../src/meriter.module';
import { Community, CommunityDocument } from '../src/domain/models/community/community.schema';
import { User, UserDocument } from '../src/domain/models/user/user.schema';
import { Publication, PublicationDocument } from '../src/domain/models/publication/publication.schema';
import { Comment, CommentDocument } from '../src/domain/models/comment/comment.schema';
import { Vote, VoteDocument } from '../src/domain/models/vote/vote.schema';
import { VoteService } from '../src/domain/services/vote.service';
import { CommentService } from '../src/domain/services/comment.service';

describe('Voting quota spending (e2e)', () => {
  let app: INestApplication;
  let testDb: TestDatabaseHelper;
  let connection: Connection;

  let communityModel: Model<CommunityDocument>;
  let userModel: Model<UserDocument>;
  let publicationModel: Model<PublicationDocument>;
  let commentModel: Model<CommentDocument>;
  let voteModel: Model<VoteDocument>;

  let voteService: VoteService;
  let commentService: CommentService;

  beforeAll(async () => {
    jest.setTimeout(30000);
    testDb = new TestDatabaseHelper();
    const mongoUri = await testDb.start();
    process.env.MONGO_URL = mongoUri;

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [MeriterModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();

    connection = app.get(getConnectionToken());
    communityModel = connection.model<CommunityDocument>(Community.name);
    userModel = connection.model<UserDocument>(User.name);
    publicationModel = connection.model<PublicationDocument>(Publication.name);
    commentModel = connection.model<CommentDocument>(Comment.name);
    voteModel = connection.model<VoteDocument>(Vote.name);

    voteService = app.get<VoteService>(VoteService);
    commentService = app.get<CommentService>(CommentService);
  });

  afterEach(async () => {
    const collections = connection.collections;
    for (const key in collections) {
      const collection = collections[key];
      try {
        await collection.dropIndex('token_1').catch(() => { });
      } catch { }
      await collection.deleteMany({});
    }
  });

  afterAll(async () => {
    await app.close();
    await testDb.stop();
  });

  it('decreases remaining quota after publication vote with sourceType=quota', async () => {
    const communityId = uid();
    const userId = uid();
    const publicationId = uid();

    await communityModel.create({
      id: communityId,
      name: 'Test',
      administrators: [],
      members: [userId],
      settings: { dailyEmission: 10, currencyNames: { singular: 'm', plural: 'm', genitive: 'm' } },
      hashtags: [],
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    await userModel.create({
      id: userId,
      telegramId: userId,
      displayName: 'User',
      communityMemberships: [communityId],
      communityTags: [],
      profile: {},
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    await publicationModel.create({
      id: publicationId,
      communityId,
      authorId: userId,
      content: 'Post',
      type: 'text',
      hashtags: [],
      metrics: { upvotes: 0, downvotes: 0, score: 0, commentCount: 0 },
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    // Before vote: usedToday should be 0
    const today = new Date();
    const startOfDay = new Date(today); startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date(today); endOfDay.setHours(23, 59, 59, 999);

    const beforeAgg = await connection.db.collection('votes').aggregate([
      { $match: { userId, communityId, sourceType: { $in: ['quota', 'daily_quota'] }, createdAt: { $gte: startOfDay, $lt: endOfDay } } },
      { $project: { absAmount: { $abs: '$amount' } } },
      { $group: { _id: null, total: { $sum: '$absAmount' } } },
    ]).toArray();
    const usedBefore = beforeAgg.length ? beforeAgg[0].total : 0;
    expect(usedBefore).toBe(0);

    // Vote with quota
    await voteService.createVote(userId, 'publication', publicationId, 3, 'quota', communityId);

    const afterAgg = await connection.db.collection('votes').aggregate([
      { $match: { userId, communityId, sourceType: { $in: ['quota', 'daily_quota'] }, createdAt: { $gte: startOfDay, $lt: endOfDay } } },
      { $project: { absAmount: { $abs: '$amount' } } },
      { $group: { _id: null, total: { $sum: '$absAmount' } } },
    ]).toArray();
    const usedAfter = afterAgg.length ? afterAgg[0].total : 0;
    expect(usedAfter).toBe(3);
  });

  it('decreases remaining quota after comment vote with sourceType=quota', async () => {
    const communityId = uid();
    const userId = uid();
    const authorId = uid();
    const publicationId = uid();

    await communityModel.create({
      id: communityId,
      name: 'Test',
      administrators: [],
      members: [userId, authorId],
      settings: { dailyEmission: 10, currencyNames: { singular: 'm', plural: 'm', genitive: 'm' } },
      hashtags: [],
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    await userModel.create([
      { id: userId, telegramId: userId, displayName: 'User', communityMemberships: [communityId], communityTags: [], profile: {}, createdAt: new Date(), updatedAt: new Date() },
      { id: authorId, telegramId: authorId, displayName: 'Author', communityMemberships: [communityId], communityTags: [], profile: {}, createdAt: new Date(), updatedAt: new Date() },
    ]);

    await publicationModel.create({
      id: publicationId,
      communityId,
      authorId,
      content: 'Post',
      type: 'text',
      hashtags: [],
      metrics: { upvotes: 0, downvotes: 0, score: 0, commentCount: 0 },
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    // Create a comment to vote on
    const comment = await commentService.createComment(authorId, { targetType: 'publication', targetId: publicationId, content: 'c' });

    const today = new Date();
    const startOfDay = new Date(today); startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date(today); endOfDay.setHours(23, 59, 59, 999);

    const beforeAgg = await connection.db.collection('votes').aggregate([
      { $match: { userId, communityId, sourceType: { $in: ['quota', 'daily_quota'] }, createdAt: { $gte: startOfDay, $lt: endOfDay } } },
      { $project: { absAmount: { $abs: '$amount' } } },
      { $group: { _id: null, total: { $sum: '$absAmount' } } },
    ]).toArray();
    const usedBefore = beforeAgg.length ? beforeAgg[0].total : 0;
    expect(usedBefore).toBe(0);

    // Vote with quota on the comment
    await voteService.createVote(userId, 'comment', comment.getId, 4, 'quota', communityId);

    const afterAgg = await connection.db.collection('votes').aggregate([
      { $match: { userId, communityId, sourceType: { $in: ['quota', 'daily_quota'] }, createdAt: { $gte: startOfDay, $lt: endOfDay } } },
      { $project: { absAmount: { $abs: '$amount' } } },
      { $group: { _id: null, total: { $sum: '$absAmount' } } },
    ]).toArray();
    const usedAfter = afterAgg.length ? afterAgg[0].total : 0;
    expect(usedAfter).toBe(4);
  });

  it('does not affect quota for personal votes', async () => {
    const communityId = uid();
    const userId = uid();
    const publicationId = uid();

    await communityModel.create({
      id: communityId,
      name: 'Test',
      administrators: [],
      members: [userId],
      settings: { dailyEmission: 10, currencyNames: { singular: 'm', plural: 'm', genitive: 'm' } },
      hashtags: [],
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    await userModel.create({ id: userId, telegramId: userId, displayName: 'User', communityMemberships: [communityId], communityTags: [], profile: {}, createdAt: new Date(), updatedAt: new Date() });

    await publicationModel.create({
      id: publicationId,
      communityId,
      authorId: userId,
      content: 'Post',
      type: 'text',
      hashtags: [],
      metrics: { upvotes: 0, downvotes: 0, score: 0, commentCount: 0 },
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    const today = new Date();
    const startOfDay = new Date(today); startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date(today); endOfDay.setHours(23, 59, 59, 999);

    // Personal vote
    await voteService.createVote(userId, 'publication', publicationId, 5, 'personal', communityId);

    const afterAgg = await connection.db.collection('votes').aggregate([
      { $match: { userId, communityId, sourceType: { $in: ['quota', 'daily_quota'] }, createdAt: { $gte: startOfDay, $lt: endOfDay } } },
      { $project: { absAmount: { $abs: '$amount' } } },
      { $group: { _id: null, total: { $sum: '$absAmount' } } },
    ]).toArray();
    const usedAfter = afterAgg.length ? afterAgg[0].total : 0;
    expect(usedAfter).toBe(0);
  });
});


