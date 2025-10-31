import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import { TestDatabaseHelper } from './test-db.helper';
import { MeriterModule } from '../src/meriter.module';
import { Model, Connection } from 'mongoose';
import { getConnectionToken } from '@nestjs/mongoose';
import { Community, CommunityDocument } from '../src/domain/models/community/community.schema';
import { User, UserDocument } from '../src/domain/models/user/user.schema';
import { Publication, PublicationDocument } from '../src/domain/models/publication/publication.schema';
import { Comment, CommentDocument } from '../src/domain/models/comment/comment.schema';
import { Wallet, WalletDocument } from '../src/domain/models/wallet/wallet.schema';
import { uid } from 'uid';
import * as request from 'supertest';
import { signJWT } from '../src/common/helpers/jwt';

describe('Comment Vote Amount - API E2E', () => {
  let app: INestApplication;
  let testDb: TestDatabaseHelper;
  let connection: Connection;
  
  let communityModel: Model<CommunityDocument>;
  let userModel: Model<UserDocument>;
  let publicationModel: Model<PublicationDocument>;
  let commentModel: Model<CommentDocument>;
  let walletModel: Model<WalletDocument>;

  let testUserId: string;
  let testCommunityId: string;
  let testPublicationId: string;
  let jwtSecret: string;

  beforeAll(async () => {
    jest.setTimeout(30000);
    
    testDb = new TestDatabaseHelper();
    const mongoUri = await testDb.start();
    process.env.MONGO_URL = mongoUri;
    
    // Set JWT secret for testing
    jwtSecret = process.env.JWT_SECRET || 'test-secret-key';
    process.env.JWT_SECRET = jwtSecret;

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [MeriterModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    // Add cookie parser middleware (same as main.ts)
    const cookieParser = require('cookie-parser');
    app.use(cookieParser());
    await app.init();

    connection = app.get(getConnectionToken());
    
    communityModel = connection.model<CommunityDocument>(Community.name);
    userModel = connection.model<UserDocument>(User.name);
    publicationModel = connection.model<PublicationDocument>(Publication.name);
    commentModel = connection.model<CommentDocument>(Comment.name);
    walletModel = connection.model<WalletDocument>(Wallet.name);
  });

  beforeEach(async () => {
    // Create test user
    testUserId = uid();
    testCommunityId = uid();
    
    await userModel.create({
      id: testUserId,
      telegramId: `user_${testUserId}`,
      displayName: 'Test User',
      username: 'testuser',
      firstName: 'Test',
      lastName: 'User',
      avatarUrl: 'https://example.com/avatar.jpg',
      communityMemberships: [testCommunityId],
      communityTags: [],
      profile: {},
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    // Create test community
    await communityModel.create({
      id: testCommunityId,
      telegramChatId: `chat_${testCommunityId}`,
      name: 'Test Community',
      administrators: [],
      members: [testUserId],
      settings: {
        iconUrl: 'https://example.com/icon.png',
        currencyNames: {
          singular: 'merit',
          plural: 'merits',
          genitive: 'merits',
        },
        dailyEmission: 10,
      },
      hashtags: ['test'],
      hashtagDescriptions: {},
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    // Create test wallet
    await walletModel.create({
      id: uid(),
      userId: testUserId,
      communityId: testCommunityId,
      balance: 100,
      currency: {
        singular: 'merit',
        plural: 'merits',
        genitive: 'merits',
      },
      lastUpdated: new Date(),
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    // Create test publication
    testPublicationId = uid();
    await publicationModel.create({
      id: testPublicationId,
      communityId: testCommunityId,
      authorId: testUserId,
      content: 'Test publication for voting with comment',
      type: 'text',
      hashtags: ['test'],
      metrics: {
        upvotes: 0,
        downvotes: 0,
        score: 0,
        commentCount: 0,
      },
      createdAt: new Date(),
      updatedAt: new Date(),
    });
  });

  afterEach(async () => {
    const collections = connection.collections;
    for (const key in collections) {
      const collection = collections[key];
      try {
        await collection.dropIndex('token_1').catch(() => {});
      } catch (err) {
        // Index doesn't exist, ignore
      }
      await collection.deleteMany({});
    }
  });

  afterAll(async () => {
    await app.close();
    await testDb.stop();
  });

  function generateJWT(userId: string, telegramId: string, tags: string[] = []): string {
    return signJWT(
      { uid: userId, telegramId, tags },
      jwtSecret,
      '365d'
    );
  }

  it('should return correct vote amount when fetching comments after voting with quota using combined endpoint', async () => {
    const jwt = generateJWT(testUserId, `user_${testUserId}`, []);
    
    // Use the new combined endpoint to vote with comment in a single request
    const voteAmount = 5;
    const commentText = 'This is a comment that will have a vote';
    const voteResponse = await request(app.getHttpServer())
      .post(`/api/v1/publications/${testPublicationId}/vote-with-comment`)
      .set('Cookie', `jwt=${jwt}`)
      .send({
        amount: voteAmount,
        sourceType: 'quota',
        comment: commentText,
      })
      .expect(201);

    expect(voteResponse.body.data.vote).toBeDefined();
    expect(voteResponse.body.data.vote.amount).toBe(voteAmount);
    expect(voteResponse.body.data.vote.attachedCommentId).toBeDefined();
    expect(voteResponse.body.data.comment).toBeDefined();
    expect(voteResponse.body.data.comment.content).toBe(commentText);

    const commentId = voteResponse.body.data.vote.attachedCommentId;

    // Step 2: Fetch comments for the publication
    const commentsResponse = await request(app.getHttpServer())
      .get(`/api/v1/comments/publications/${testPublicationId}`)
      .set('Cookie', `jwt=${jwt}`)
      .expect(200);

    expect(commentsResponse.body.data).toBeDefined();
    expect(Array.isArray(commentsResponse.body.data)).toBe(true);
    expect(commentsResponse.body.data.length).toBe(1);

    const comment = commentsResponse.body.data[0];
    
    // Step 3: Verify the comment has the correct vote amount data
    expect(comment.id).toBe(commentId);
    expect(comment.amountTotal).toBe(voteAmount); // Should be 5, not 0
    expect(comment.plus).toBe(voteAmount); // Should be 5 for positive vote
    expect(comment.minus).toBe(0); // Should be 0 for positive vote
    expect(comment.directionPlus).toBe(true); // Should be true for positive vote
    expect(comment.sum).toBe(voteAmount); // Should be 5
  });
});

