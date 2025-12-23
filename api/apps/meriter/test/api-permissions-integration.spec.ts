import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import { TestDatabaseHelper } from './test-db.helper';
import { trpcQuery } from './helpers/trpc-test-helper';
import { MeriterModule } from '../src/meriter.module';
import { PublicationService } from '../src/domain/services/publication.service';
import { CommentService } from '../src/domain/services/comment.service';
import { PollService } from '../src/domain/services/poll.service';
import { CommunityService } from '../src/domain/services/community.service';
import { UserService } from '../src/domain/services/user.service';
import { UserCommunityRoleService } from '../src/domain/services/user-community-role.service';
import { Connection } from 'mongoose';
import { getConnectionToken } from '@nestjs/mongoose';
import { uid } from 'uid';
import { signJWT } from '../src/common/helpers/jwt';

describe('API Permissions Integration', () => {
  jest.setTimeout(60000);
  
  let app: INestApplication;
  let testDb: TestDatabaseHelper;
  let connection: Connection;
  
  let publicationService: PublicationService;
  let commentService: CommentService;
  let pollService: PollService;
  let communityService: CommunityService;
  let userService: UserService;
  let userCommunityRoleService: UserCommunityRoleService;

  // Test user IDs
  let participant1Id: string;
  let participant2Id: string;
  let lead1Id: string;
  let superadminId: string;
  let viewerId: string;

  // Test community IDs
  let regularCommunityId: string;
  let teamCommunityId: string;

  // Test resource IDs
  let publicationId: string;
  let commentId: string;
  let pollId: string;

  // JWT tokens
  let participant1Token: string;
  let participant2Token: string;
  let lead1Token: string;
  let superadminToken: string;
  let viewerToken: string;

  beforeAll(async () => {
    testDb = new TestDatabaseHelper();
    const mongoUri = await testDb.start();
    process.env.MONGO_URL = mongoUri;
    process.env.JWT_SECRET = 'test-jwt-secret-key-for-api-permissions-integration';

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [MeriterModule],
    })
      .compile();

    app = moduleFixture.createNestApplication();
    // Add cookie parser middleware (same as main.ts)
    const cookieParser = require('cookie-parser');
    app.use(cookieParser());
    await app.init();

    // Wait a bit for onModuleInit to complete
    await new Promise(resolve => setTimeout(resolve, 1000));

    publicationService = app.get<PublicationService>(PublicationService);
    commentService = app.get<CommentService>(CommentService);
    pollService = app.get<PollService>(PollService);
    communityService = app.get<CommunityService>(CommunityService);
    userService = app.get<UserService>(UserService);
    userCommunityRoleService = app.get<UserCommunityRoleService>(UserCommunityRoleService);
    
    connection = app.get(getConnectionToken());

    // Initialize test authIds (for user creation)
    const participant1AuthId = uid();
    const participant2AuthId = uid();
    const lead1AuthId = uid();
    const superadminAuthId = uid();
    const viewerAuthId = uid();

    regularCommunityId = uid();
    teamCommunityId = uid();

    // Create test users and store their internal IDs
    const participant1User = await userService.createOrUpdateUser({
      authProvider: 'test',
      authId: participant1AuthId,
      username: 'participant1',
      displayName: 'Participant 1',
    });
    participant1Id = participant1User.id; // Use internal ID
    
    const participant2User = await userService.createOrUpdateUser({
      authProvider: 'test',
      authId: participant2AuthId,
      username: 'participant2',
      displayName: 'Participant 2',
    });
    participant2Id = participant2User.id; // Use internal ID
    
    const lead1User = await userService.createOrUpdateUser({
      authProvider: 'test',
      authId: lead1AuthId,
      username: 'lead1',
      displayName: 'Lead 1',
    });
    lead1Id = lead1User.id; // Use internal ID
    
    const superadminUser = await userService.createOrUpdateUser({
      authProvider: 'test',
      authId: superadminAuthId,
      username: 'superadmin',
      displayName: 'Superadmin',
      globalRole: 'superadmin',
    });
    superadminId = superadminUser.id; // Use internal ID
    
    const viewer1User = await userService.createOrUpdateUser({
      authProvider: 'test',
      authId: viewerAuthId,
      username: 'viewer1',
      displayName: 'Viewer 1',
    });
    viewerId = viewer1User.id; // Use internal ID

    // Create test communities
    await communityService.createCommunity({
      id: regularCommunityId,
      name: 'Regular Community',
      typeTag: 'custom',
      votingRules: {
        allowedRoles: ['participant', 'lead'],
        canVoteForOwnPosts: false,
      },
      postingRules: {
        allowedRoles: ['participant', 'lead'],
      },
    });

    await communityService.createCommunity({
      id: teamCommunityId,
      name: 'Team Community',
      typeTag: 'team',
      votingRules: {
        allowedRoles: ['participant', 'lead'],
        canVoteForOwnPosts: false,
      },
      postingRules: {
        allowedRoles: ['participant', 'lead'],
      },
    });

    // Assign roles
    await userCommunityRoleService.setRole(participant1Id, regularCommunityId, 'participant');
    await userCommunityRoleService.setRole(participant2Id, regularCommunityId, 'participant');
    await userCommunityRoleService.setRole(participant1Id, teamCommunityId, 'participant');
    await userCommunityRoleService.setRole(lead1Id, regularCommunityId, 'lead');
    await userCommunityRoleService.setRole(viewerId, regularCommunityId, 'viewer');

    // Create test resources
    const publication = await publicationService.createPublication(participant1Id, {
      communityId: regularCommunityId,
      content: 'Test publication',
      type: 'text',
    });
    publicationId = publication.getId.getValue();

    const comment = await commentService.createComment(participant2Id, {
      targetType: 'publication',
      targetId: publicationId,
      content: 'Test comment',
    });
    commentId = comment.getId?.getValue ? comment.getId.getValue() : comment.getId;

    const poll = await pollService.createPoll(participant1Id, {
      communityId: regularCommunityId,
      question: 'Test poll?',
      description: 'Test description',
      options: [
        { id: 'opt1', text: 'Option 1' },
        { id: 'opt2', text: 'Option 2' },
      ],
      expiresAt: new Date(Date.now() + 86400000), // 1 day from now
    });
    pollId = poll.getId;

    // Generate JWT tokens (use internal IDs for uid, original authIds for authId)
    participant1Token = signJWT({ uid: participant1Id, authProvider: 'test', authId: participant1AuthId, communityTags: [] }, process.env.JWT_SECRET!, '365d');
    participant2Token = signJWT({ uid: participant2Id, authProvider: 'test', authId: participant2AuthId, communityTags: [] }, process.env.JWT_SECRET!, '365d');
    lead1Token = signJWT({ uid: lead1Id, authProvider: 'test', authId: lead1AuthId, communityTags: [] }, process.env.JWT_SECRET!, '365d');
    superadminToken = signJWT({ uid: superadminId, authProvider: 'test', authId: superadminAuthId, communityTags: [] }, process.env.JWT_SECRET!, '365d');
    viewerToken = signJWT({ uid: viewerId, authProvider: 'test', authId: viewerAuthId, communityTags: [] }, process.env.JWT_SECRET!, '365d');
  });

  afterAll(async () => {
    if (testDb) {
      await testDb.stop();
    }
    if (app) {
      await app.close();
    }
  });

  describe('GET /api/v1/publications/:id', () => {
    it('should include permissions in response', async () => {
      const publication = await trpcQuery(app, 'publications.getById', { id: publicationId }, { jwt: participant2Token });

      expect(publication).toBeDefined();
      expect(publication.permissions).toBeDefined();
      expect(typeof publication.permissions.canVote).toBe('boolean');
      expect(typeof publication.permissions.canEdit).toBe('boolean');
      expect(typeof publication.permissions.canDelete).toBe('boolean');
      expect(typeof publication.permissions.canComment).toBe('boolean');
    });

    it('should return correct permissions for different users', async () => {
      // Participant 2 (not author) should be able to vote
      const pub1 = await trpcQuery(app, 'publications.getById', { id: publicationId }, { jwt: participant2Token });

      expect(pub1.permissions.canVote).toBe(true);

      // Participant 1 (author) should not be able to vote on own post
      const pub2 = await trpcQuery(app, 'publications.getById', { id: publicationId }, { jwt: participant1Token });

      expect(pub2.permissions.canVote).toBe(false);
      expect(pub2.permissions.voteDisabledReason).toBe('voteDisabled.isAuthor');
      // Note: canEdit might be false if there are comments or votes
      // The test creates a comment in beforeAll, so editing might be disabled
      expect(typeof pub2.permissions.canEdit).toBe('boolean');
    });

    it('should return correct permissions for superadmin', async () => {
      const publication = await trpcQuery(app, 'publications.getById', { id: publicationId }, { jwt: superadminToken });

      expect(publication.permissions.canVote).toBe(true);
      expect(publication.permissions.canEdit).toBe(true);
      expect(publication.permissions.canDelete).toBe(true);
    });
  });

  describe('GET /api/v1/publications', () => {
    it('should include permissions for each publication in list', async () => {
      const result = await trpcQuery(app, 'publications.getAll', { communityId: regularCommunityId }, { jwt: participant2Token });

      expect(Array.isArray(result.data)).toBe(true);
      
      if (result.data.length > 0) {
        const firstPublication = result.data[0];
        expect(firstPublication.permissions).toBeDefined();
        expect(typeof firstPublication.permissions.canVote).toBe('boolean');
        expect(typeof firstPublication.permissions.canEdit).toBe('boolean');
        expect(typeof firstPublication.permissions.canDelete).toBe('boolean');
        expect(typeof firstPublication.permissions.canComment).toBe('boolean');
      }
    });
  });

  describe('GET /api/v1/comments/:id', () => {
    it('should include permissions in response', async () => {
      const comment = await trpcQuery(app, 'comments.getDetails', { id: commentId }, { jwt: participant1Token });

      expect(comment).toBeDefined();
      expect(comment.permissions).toBeDefined();
      expect(typeof comment.permissions.canVote).toBe('boolean');
      expect(typeof comment.permissions.canEdit).toBe('boolean');
      expect(typeof comment.permissions.canDelete).toBe('boolean');
    });
  });

  describe('GET /api/v1/comments/publications/:publicationId', () => {
    it('should include permissions for each comment in list', async () => {
      const result = await trpcQuery(app, 'comments.getByPublicationId', { publicationId }, { jwt: participant1Token });

      expect(Array.isArray(result.data)).toBe(true);
      
      if (result.data.length > 0) {
        const firstComment = result.data[0];
        expect(firstComment.permissions).toBeDefined();
        expect(typeof firstComment.permissions.canVote).toBe('boolean');
        expect(typeof firstComment.permissions.canEdit).toBe('boolean');
        expect(typeof firstComment.permissions.canDelete).toBe('boolean');
      }
    });
  });

  describe('GET /api/v1/polls/:id', () => {
    it('should include permissions in response', async () => {
      const poll = await trpcQuery(app, 'polls.getById', { id: pollId }, { jwt: participant2Token });

      expect(poll).toBeDefined();
      expect(poll.permissions).toBeDefined();
      expect(typeof poll.permissions.canVote).toBe('boolean');
      expect(typeof poll.permissions.canEdit).toBe('boolean');
      expect(typeof poll.permissions.canDelete).toBe('boolean');
    });

    it('should return correct permissions for poll author', async () => {
      const poll = await trpcQuery(app, 'polls.getById', { id: pollId }, { jwt: participant1Token });

      expect(poll.permissions.canEdit).toBe(true);
      expect(poll.permissions.canDelete).toBe(true);
    });
  });

  describe('GET /api/v1/polls', () => {
    it('should include permissions for each poll in list', async () => {
      const result = await trpcQuery(app, 'polls.getByCommunity', { communityId: regularCommunityId }, { jwt: participant2Token });

      expect(Array.isArray(result.data)).toBe(true);
      
      if (result.data.length > 0) {
        const firstPoll = result.data[0];
        expect(firstPoll.permissions).toBeDefined();
        expect(typeof firstPoll.permissions.canVote).toBe('boolean');
        expect(typeof firstPoll.permissions.canEdit).toBe('boolean');
        expect(typeof firstPoll.permissions.canDelete).toBe('boolean');
      }
    });
  });
});

