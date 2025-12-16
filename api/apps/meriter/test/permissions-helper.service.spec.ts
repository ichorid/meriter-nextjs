import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, CanActivate, ExecutionContext } from '@nestjs/common';
import { TestDatabaseHelper } from './test-db.helper';
import { MeriterModule } from '../src/meriter.module';
import { PermissionsHelperService } from '../src/api-v1/common/services/permissions-helper.service';
import { PermissionService } from '../src/domain/services/permission.service';
import { PublicationService } from '../src/domain/services/publication.service';
import { CommentService } from '../src/domain/services/comment.service';
import { PollService } from '../src/domain/services/poll.service';
import { CommunityService } from '../src/domain/services/community.service';
import { UserService } from '../src/domain/services/user.service';
import { UserCommunityRoleService } from '../src/domain/services/user-community-role.service';
import { Connection } from 'mongoose';
import { getConnectionToken } from '@nestjs/mongoose';
import { CommunitySchemaClass, CommunityDocument } from '../src/domain/models/community/community.schema';
import { uid } from 'uid';

describe('PermissionsHelperService', () => {
  jest.setTimeout(60000);
  
  let app: INestApplication;
  let testDb: TestDatabaseHelper;
  let connection: Connection;
  
  let permissionsHelperService: PermissionsHelperService;
  let permissionService: PermissionService;
  let publicationService: PublicationService;
  let commentService: CommentService;
  let pollService: PollService;
  let communityService: CommunityService;
  let userService: UserService;
  let userCommunityRoleService: UserCommunityRoleService;

  // Test user IDs
  let participant1Id: string;
  let lead1Id: string;
  let superadminId: string;
  let viewerId: string;
  let authorId: string;

  // Test community IDs
  let regularCommunityId: string;
  let teamCommunityId: string;
  let marathonCommunityId: string;
  let futureVisionCommunityId: string;

  beforeAll(async () => {
    testDb = new TestDatabaseHelper();
    const mongoUri = await testDb.start();
    process.env.MONGO_URL = mongoUri;
    process.env.JWT_SECRET = 'test-jwt-secret-key-for-permissions-helper';

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [MeriterModule],
    })
      .compile();

    app = moduleFixture.createNestApplication();
    await app.init();

    // Wait a bit for onModuleInit to complete
    await new Promise(resolve => setTimeout(resolve, 1000));

    permissionsHelperService = app.get<PermissionsHelperService>(PermissionsHelperService);
    permissionService = app.get<PermissionService>(PermissionService);
    publicationService = app.get<PublicationService>(PublicationService);
    commentService = app.get<CommentService>(CommentService);
    pollService = app.get<PollService>(PollService);
    communityService = app.get<CommunityService>(CommunityService);
    userService = app.get<UserService>(UserService);
    userCommunityRoleService = app.get<UserCommunityRoleService>(UserCommunityRoleService);
    
    connection = app.get(getConnectionToken());

    // Initialize test IDs
    participant1Id = uid();
    lead1Id = uid();
    superadminId = uid();
    viewerId = uid();
    authorId = uid();

    regularCommunityId = uid();
    teamCommunityId = uid();
    marathonCommunityId = uid();
    futureVisionCommunityId = uid();

    // Create test users and store their internal IDs
    const participant1User = await userService.createOrUpdateUser({
      authProvider: 'test',
      authId: participant1Id,
      username: 'participant1',
      displayName: 'Participant 1',
    });
    participant1Id = participant1User.id; // Use internal ID
    
    const lead1User = await userService.createOrUpdateUser({
      authProvider: 'test',
      authId: lead1Id,
      username: 'lead1',
      displayName: 'Lead 1',
    });
    lead1Id = lead1User.id; // Use internal ID
    
    const superadminUser = await userService.createOrUpdateUser({
      authProvider: 'test',
      authId: superadminId,
      username: 'superadmin',
      displayName: 'Superadmin',
      globalRole: 'superadmin',
    });
    superadminId = superadminUser.id; // Use internal ID
    
    const viewer1User = await userService.createOrUpdateUser({
      authProvider: 'test',
      authId: viewerId,
      username: 'viewer1',
      displayName: 'Viewer 1',
    });
    viewerId = viewer1User.id; // Use internal ID
    
    const author1User = await userService.createOrUpdateUser({
      authProvider: 'test',
      authId: authorId,
      username: 'author1',
      displayName: 'Author 1',
    });
    authorId = author1User.id; // Use internal ID
  });

  beforeEach(async () => {
    // Ensure Future Vision and Marathon communities don't exist (onModuleInit might have created them)
    const communityModel = connection.model<CommunityDocument>(CommunitySchemaClass.name);
    await communityModel.deleteMany({ typeTag: 'future-vision' });
    await communityModel.deleteMany({ typeTag: 'marathon-of-good' });

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

    await communityService.createCommunity({
      id: marathonCommunityId,
      name: 'Marathon of Good',
      typeTag: 'marathon-of-good',
      votingRules: {
        allowedRoles: ['participant', 'lead', 'viewer'],
        canVoteForOwnPosts: false,
      },
      postingRules: {
        allowedRoles: ['participant', 'lead'],
      },
    });

    await communityService.createCommunity({
      id: futureVisionCommunityId,
      name: 'Future Vision',
      typeTag: 'future-vision',
      votingRules: {
        allowedRoles: ['participant', 'lead'],
        canVoteForOwnPosts: true,
      },
      postingRules: {
        allowedRoles: ['participant', 'lead'],
      },
    });

    // Assign roles
    await userCommunityRoleService.setRole(participant1Id, regularCommunityId, 'participant');
    await userCommunityRoleService.setRole(participant1Id, teamCommunityId, 'participant');
    await userCommunityRoleService.setRole(participant1Id, marathonCommunityId, 'participant');
    await userCommunityRoleService.setRole(participant1Id, futureVisionCommunityId, 'participant');
    await userCommunityRoleService.setRole(lead1Id, regularCommunityId, 'lead');
    await userCommunityRoleService.setRole(viewerId, marathonCommunityId, 'viewer');
    await userCommunityRoleService.setRole(authorId, regularCommunityId, 'participant'); // Author needs role for tests
    await userCommunityRoleService.setRole(authorId, futureVisionCommunityId, 'participant'); // Author needs role for future-vision tests
  });

  afterAll(async () => {
    if (testDb) {
      await testDb.stop();
    }
    if (app) {
      await app.close();
    }
  });

  describe('calculatePublicationPermissions', () => {
    it('should return false permissions for null user', async () => {
      const publication = await publicationService.createPublication(authorId, {
        communityId: regularCommunityId,
        content: 'Test publication',
        type: 'text',
      });

      const permissions = await permissionsHelperService.calculatePublicationPermissions(
        null,
        publication.getId.getValue(),
      );

      expect(permissions.canVote).toBe(false);
      expect(permissions.canEdit).toBe(false);
      expect(permissions.canDelete).toBe(false);
      expect(permissions.canComment).toBe(false);
      expect(permissions.voteDisabledReason).toBe('voteDisabled.notLoggedIn');
    });

    it('should allow superadmin to vote on others posts', async () => {
      const publication = await publicationService.createPublication(authorId, {
        communityId: regularCommunityId,
        content: 'Test publication',
        type: 'text',
      });

      const permissions = await permissionsHelperService.calculatePublicationPermissions(
        superadminId,
        publication.getId.getValue(),
      );

      expect(permissions.canVote).toBe(true);
      expect(permissions.canEdit).toBe(true);
      expect(permissions.canDelete).toBe(true);
    });

    it('should prevent voting on own post in regular community', async () => {
      const publication = await publicationService.createPublication(participant1Id, {
        communityId: regularCommunityId,
        content: 'Test publication',
        type: 'text',
      });

      const permissions = await permissionsHelperService.calculatePublicationPermissions(
        participant1Id,
        publication.getId.getValue(),
      );

      expect(permissions.canVote).toBe(false);
      expect(permissions.voteDisabledReason).toBe('voteDisabled.isAuthor');
    });

    it('should allow voting on own post in future-vision community', async () => {
      const publication = await publicationService.createPublication(participant1Id, {
        communityId: futureVisionCommunityId,
        content: 'Test publication',
        type: 'text',
      });

      const permissions = await permissionsHelperService.calculatePublicationPermissions(
        participant1Id,
        publication.getId.getValue(),
      );

      expect(permissions.canVote).toBe(true);
    });

    it('should prevent voting on project posts', async () => {
      const publication = await publicationService.createPublication(authorId, {
        communityId: regularCommunityId,
        content: 'Test project',
        type: 'text',
        postType: 'project',
        isProject: true,
      });

      const permissions = await permissionsHelperService.calculatePublicationPermissions(
        participant1Id,
        publication.getId.getValue(),
      );

      expect(permissions.canVote).toBe(false);
      expect(permissions.voteDisabledReason).toBe('voteDisabled.projectPost');
    });

    it('should allow author to edit own post without votes/comments', async () => {
      const publication = await publicationService.createPublication(authorId, {
        communityId: regularCommunityId,
        content: 'Test publication',
        type: 'text',
      });

      const permissions = await permissionsHelperService.calculatePublicationPermissions(
        authorId,
        publication.getId.getValue(),
      );

      expect(permissions.canEdit).toBe(true);
    });

    it('should allow lead to edit any post in their community', async () => {
      const publication = await publicationService.createPublication(authorId, {
        communityId: regularCommunityId,
        content: 'Test publication',
        type: 'text',
      });

      const permissions = await permissionsHelperService.calculatePublicationPermissions(
        lead1Id,
        publication.getId.getValue(),
      );

      expect(permissions.canEdit).toBe(true);
      expect(permissions.canDelete).toBe(true);
    });
  });

  describe('batchCalculatePublicationPermissions', () => {
    it('should calculate permissions for multiple publications', async () => {
      const pub1 = await publicationService.createPublication(authorId, {
        communityId: regularCommunityId,
        content: 'Publication 1',
        type: 'text',
      });
      const pub2 = await publicationService.createPublication(authorId, {
        communityId: regularCommunityId,
        content: 'Publication 2',
        type: 'text',
      });

      const permissionsMap = await permissionsHelperService.batchCalculatePublicationPermissions(
        participant1Id,
        [pub1.getId.getValue(), pub2.getId.getValue()],
      );

      expect(permissionsMap.size).toBe(2);
      expect(permissionsMap.get(pub1.getId.getValue())).toBeDefined();
      expect(permissionsMap.get(pub2.getId.getValue())).toBeDefined();
    });
  });

  describe('calculateCommentPermissions', () => {
    it('should return false permissions for null user', async () => {
      const publication = await publicationService.createPublication(authorId, {
        communityId: regularCommunityId,
        content: 'Test publication',
        type: 'text',
      });

      const comment = await commentService.createComment(participant1Id, {
        targetType: 'publication',
        targetId: publication.getId.getValue(),
        content: 'Test comment',
      });

      const permissions = await permissionsHelperService.calculateCommentPermissions(
        null,
        comment.getId?.getValue ? comment.getId.getValue() : comment.getId,
      );

      expect(permissions.canVote).toBe(false);
      expect(permissions.canEdit).toBe(false);
      expect(permissions.canDelete).toBe(false);
      expect(permissions.voteDisabledReason).toBe('voteDisabled.notLoggedIn');
    });

    it('should allow author to edit own comment without votes', async () => {
      const publication = await publicationService.createPublication(authorId, {
        communityId: regularCommunityId,
        content: 'Test publication',
        type: 'text',
      });

      const comment = await commentService.createComment(participant1Id, {
        targetType: 'publication',
        targetId: publication.getId.getValue(),
        content: 'Test comment',
      });

      const permissions = await permissionsHelperService.calculateCommentPermissions(
        participant1Id,
        comment.getId?.getValue ? comment.getId.getValue() : comment.getId,
      );

      expect(permissions.canEdit).toBe(true);
    });
  });

  describe('calculatePollPermissions', () => {
    it('should return false permissions for null user', async () => {
      const poll = await pollService.createPoll(authorId, {
        communityId: regularCommunityId,
        question: 'Test poll?',
        description: 'Test description',
        options: [
          { id: 'opt1', text: 'Option 1' },
          { id: 'opt2', text: 'Option 2' },
        ],
        expiresAt: new Date(Date.now() + 86400000), // 1 day from now
      });

      const permissions = await permissionsHelperService.calculatePollPermissions(
        null,
        poll.getId,
      );

      expect(permissions.canVote).toBe(false);
      expect(permissions.canEdit).toBe(false);
      expect(permissions.canDelete).toBe(false);
      expect(permissions.voteDisabledReason).toBe('voteDisabled.notLoggedIn');
    });

    it('should allow voting on active polls', async () => {
      const poll = await pollService.createPoll(authorId, {
        communityId: regularCommunityId,
        question: 'Test poll?',
        description: 'Test description',
        options: [
          { id: 'opt1', text: 'Option 1' },
          { id: 'opt2', text: 'Option 2' },
        ],
        expiresAt: new Date(Date.now() + 86400000), // 1 day from now
      });

      const permissions = await permissionsHelperService.calculatePollPermissions(
        participant1Id,
        poll.getId?.getValue ? poll.getId.getValue() : poll.getId,
      );

      expect(permissions.canVote).toBe(true);
    });

    it('should allow author to edit own poll', async () => {
      const poll = await pollService.createPoll(authorId, {
        communityId: regularCommunityId,
        question: 'Test poll?',
        description: 'Test description',
        options: [
          { id: 'opt1', text: 'Option 1' },
          { id: 'opt2', text: 'Option 2' },
        ],
        expiresAt: new Date(Date.now() + 86400000), // 1 day from now
      });

      const permissions = await permissionsHelperService.calculatePollPermissions(
        authorId,
        poll.getId,
      );

      expect(permissions.canEdit).toBe(true);
      expect(permissions.canDelete).toBe(true);
    });
  });
});

