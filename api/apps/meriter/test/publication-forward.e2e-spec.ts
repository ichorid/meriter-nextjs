import { TestSetupHelper } from './helpers/test-setup.helper';
import { trpcMutation, trpcMutationWithError } from './helpers/trpc-test-helper';
import { uid } from 'uid';
import { getConnectionToken } from '@nestjs/mongoose';
import { CommunityService } from '../src/domain/services/community.service';
import { UserService } from '../src/domain/services/user.service';
import { PublicationService } from '../src/domain/services/publication.service';

describe('Publication Forward E2E', () => {
  jest.setTimeout(120000);

  async function waitForNotification(
    filter: Record<string, unknown>,
    timeoutMs = 3000,
    intervalMs = 100,
  ): Promise<any | null> {
    const startedAt = Date.now();
    // eslint-disable-next-line no-constant-condition
    while (true) {
      const notification = await connection.db.collection('notifications').findOne(filter);
      if (notification) {
        return notification;
      }
      if (Date.now() - startedAt > timeoutMs) {
        return null;
      }
      await new Promise((resolve) => setTimeout(resolve, intervalMs));
    }
  }
  
  let app: any;
  let testDb: any;
  let connection: any;
  let communityService: CommunityService;
  let userService: UserService;
  let publicationService: PublicationService;
  // (unused) keep available for future assertions:
  // let userCommunityRoleService: UserCommunityRoleService;
  // let quotaUsageService: QuotaUsageService;
  // let notificationService: NotificationService;

  // Test user IDs
  let participantId: string;
  let leadId: string;
  let authorId: string;

  // Test community IDs
  let teamCommunityId: string;
  let marathonCommunityId: string;
  let futureVisionCommunityId: string;

  beforeAll(async () => {
    const context = await TestSetupHelper.createTestApp();
    app = context.app;
    testDb = context.testDb;
    connection = app.get(getConnectionToken());
    
    communityService = app.get(CommunityService);
    userService = app.get(UserService);
    publicationService = app.get(PublicationService);
    // userCommunityRoleService = app.get(UserCommunityRoleService);
    // quotaUsageService = app.get(QuotaUsageService);
    // notificationService = app.get(NotificationService);
    
    connection = app.get(getConnectionToken());

    // Create test users
    const participantUser = await userService.createOrUpdateUser({
      authProvider: 'test',
      authId: uid(),
      username: 'participant',
      displayName: 'Participant',
    });
    participantId = participantUser.id;

    const leadUser = await userService.createOrUpdateUser({
      authProvider: 'test',
      authId: uid(),
      username: 'lead',
      displayName: 'Lead',
    });
    leadId = leadUser.id;

    const authorUser = await userService.createOrUpdateUser({
      authProvider: 'test',
      authId: uid(),
      username: 'author',
      displayName: 'Author',
    });
    authorId = authorUser.id;

    // Create test communities
    teamCommunityId = uid();
    
    // Find or use existing marathon and future-vision communities (created by onModuleInit)
    const existingMarathon = await connection.db.collection('communities').findOne({ typeTag: 'marathon-of-good' });
    const existingFutureVision = await connection.db.collection('communities').findOne({ typeTag: 'future-vision' });
    
    if (existingMarathon) {
      marathonCommunityId = existingMarathon.id;
    } else {
      marathonCommunityId = uid();
      await communityService.createCommunity({
        id: marathonCommunityId,
        name: 'Marathon of Good',
        typeTag: 'marathon-of-good',
        settings: {
          currencyNames: { singular: 'merit', plural: 'merits', genitive: 'merits' },
          dailyEmission: 100,
        },
        postingRules: {
          allowedRoles: ['lead', 'participant'],
        },
      });
    }
    
    if (existingFutureVision) {
      futureVisionCommunityId = existingFutureVision.id;
    } else {
      futureVisionCommunityId = uid();
      await communityService.createCommunity({
        id: futureVisionCommunityId,
        name: 'Future Vision',
        typeTag: 'future-vision',
        settings: {
          currencyNames: { singular: 'merit', plural: 'merits', genitive: 'merits' },
          dailyEmission: 0,
        },
        postingRules: {
          allowedRoles: ['lead', 'participant'],
        },
      });
    }

    await communityService.createCommunity({
      id: teamCommunityId,
      name: 'Test Team',
      typeTag: 'team',
      settings: {
        currencyNames: { singular: 'merit', plural: 'merits', genitive: 'merits' },
        dailyEmission: 100,
        forwardCost: 1,
      },
      postingRules: {
        allowedRoles: ['lead', 'participant'],
      },
    });

    // Create user roles using direct collection insert
    await connection.db.collection('user_community_roles').insertMany([
      {
        id: uid(),
        userId: participantId,
        communityId: teamCommunityId,
        role: 'participant',
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        id: uid(),
        userId: leadId,
        communityId: teamCommunityId,
        role: 'lead',
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        id: uid(),
        userId: participantId,
        communityId: marathonCommunityId,
        role: 'participant',
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        id: uid(),
        userId: participantId,
        communityId: futureVisionCommunityId,
        role: 'participant',
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        id: uid(),
        userId: leadId,
        communityId: marathonCommunityId,
        role: 'participant',
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        id: uid(),
        userId: leadId,
        communityId: futureVisionCommunityId,
        role: 'participant',
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ]);
  });

  afterAll(async () => {
    await TestSetupHelper.cleanup({ app, testDb });
  });

  beforeEach(async () => {
    // Clear publications, quota usage, and notifications between tests
    // Use connection directly to access collections
    await connection.db.collection('publications').deleteMany({});
    await connection.db.collection('quota_usage').deleteMany({});
    await connection.db.collection('notifications').deleteMany({});
  });

  describe('Non-lead propose forward flow', () => {
    it('should allow participant to propose forward, lead to confirm, and create copy in target', async () => {
      // Create a post in team community
      (global as any).testUserId = authorId;
      const publication = await publicationService.createPublication(authorId, {
        communityId: teamCommunityId,
        content: 'Test post to forward',
        type: 'text',
        postType: 'basic',
        title: 'Test Post',
        description: 'Test description',
      });
      const publicationId = publication.getId.getValue();

      // Participant proposes forward
      (global as any).testUserId = participantId;
      await trpcMutation(app, 'publications.proposeForward', {
        publicationId,
        targetCommunityId: marathonCommunityId,
      });

      // Verify publication is marked as pending
      const pendingPub = await publicationService.getPublicationDocument(publicationId);
      expect(pendingPub?.forwardStatus).toBe('pending');
      expect(pendingPub?.forwardTargetCommunityId).toBe(marathonCommunityId);
      expect(pendingPub?.forwardProposedBy).toBe(participantId);

      // Verify quota was consumed
      const quotaUsage = await connection.db.collection('quota_usage').findOne({
        userId: participantId,
        communityId: teamCommunityId,
        usageType: 'forward_proposal',
        referenceId: publicationId,
      });
      expect(quotaUsage).toBeDefined();
      expect(quotaUsage?.amountQuota).toBe(1);

      // Verify notification was created for lead
      const notification = await waitForNotification({
        userId: leadId,
        type: 'forward_proposal',
      });
      expect(notification).not.toBeNull();
      expect(notification?.type).toBe('forward_proposal');
      expect(notification?.metadata?.publicationId).toBe(publicationId);
      expect(notification?.metadata?.communityId).toBe(teamCommunityId);
      expect(notification?.metadata?.forwardProposedBy).toBe(participantId);
      expect(notification?.metadata?.forwardTargetCommunityId).toBe(marathonCommunityId);

      // Lead confirms forward
      (global as any).testUserId = leadId;
      const result = await trpcMutation(app, 'publications.forward', {
        publicationId,
        targetCommunityId: marathonCommunityId,
      });

      expect(result.success).toBe(true);
      expect(result.forwardedPublicationId).toBeDefined();

      // Verify original publication is marked as forwarded
      const forwardedPub = await publicationService.getPublicationDocument(publicationId);
      expect(forwardedPub?.forwardStatus).toBe('forwarded');
      expect(forwardedPub?.forwardTargetCommunityId).toBe(marathonCommunityId);
      expect(forwardedPub?.forwardProposedBy).toBeUndefined();

      // Verify new publication was created in target community
      const newPub = await publicationService.getPublicationDocument(result.forwardedPublicationId);
      expect(newPub).toBeDefined();
      expect(newPub?.communityId).toBe(marathonCommunityId);
      expect(newPub?.authorId).toBe(authorId); // Original author
      expect(newPub?.content).toBe('Test post to forward');
      expect(newPub?.title).toBe('Test Post');
      expect(newPub?.description).toBe('Test description');
      expect(newPub?.metrics?.score).toBe(0); // Metrics reset
      expect(newPub?.metrics?.upvotes).toBe(0);
    });

    it('should allow lead to reject forward proposal and clear status', async () => {
      // Create a post
      (global as any).testUserId = authorId;
      const publication = await publicationService.createPublication(authorId, {
        communityId: teamCommunityId,
        content: 'Test post',
        type: 'text',
        postType: 'basic',
      });
      const publicationId = publication.getId.getValue();

      // Participant proposes forward
      (global as any).testUserId = participantId;
      await trpcMutation(app, 'publications.proposeForward', {
        publicationId,
        targetCommunityId: marathonCommunityId,
      });

      // Lead rejects
      (global as any).testUserId = leadId;
      const result = await trpcMutation(app, 'publications.rejectForward', {
        publicationId,
      });

      expect(result.success).toBe(true);

      // Verify status is cleared
      const pub = await publicationService.getPublicationDocument(publicationId);
      expect(pub?.forwardStatus).toBeNull();
      expect(pub?.forwardTargetCommunityId).toBeUndefined();
      expect(pub?.forwardProposedBy).toBeUndefined();
    });
  });

  describe('Lead direct forward flow', () => {
    it('should allow lead to forward directly without proposal', async () => {
      // Create a post
      (global as any).testUserId = authorId;
      const publication = await publicationService.createPublication(authorId, {
        communityId: teamCommunityId,
        content: 'Test post for direct forward',
        type: 'text',
        postType: 'basic',
        title: 'Direct Forward Test',
        description: 'Description',
        hashtags: ['test'],
      });
      const publicationId = publication.getId.getValue();

      // Lead forwards directly
      (global as any).testUserId = leadId;
      const result = await trpcMutation(app, 'publications.forward', {
        publicationId,
        targetCommunityId: futureVisionCommunityId,
      });

      expect(result.success).toBe(true);

      // Verify quota was consumed
      const quotaUsage = await connection.db.collection('quota_usage').findOne({
        userId: leadId,
        communityId: teamCommunityId,
        usageType: 'forward',
        referenceId: publicationId,
      });
      expect(quotaUsage).toBeDefined();
      expect(quotaUsage?.amountQuota).toBe(1);

      // Verify original is marked as forwarded
      const original = await publicationService.getPublicationDocument(publicationId);
      expect(original?.forwardStatus).toBe('forwarded');

      // Verify copy was created
      const copy = await publicationService.getPublicationDocument(result.forwardedPublicationId);
      expect(copy?.communityId).toBe(futureVisionCommunityId);
      expect(copy?.content).toBe('Test post for direct forward');
      expect(copy?.title).toBe('Direct Forward Test');
      expect(copy?.hashtags).toEqual(['test']);
    });

    it('should forward project posts with all taxonomy fields', async () => {
      // Create a project post
      (global as any).testUserId = authorId;
      const publication = await publicationService.createPublication(authorId, {
        communityId: teamCommunityId,
        content: 'Project content',
        type: 'text',
        postType: 'project',
        isProject: true,
        title: 'Test Project',
        description: 'Project description',
        impactArea: 'education',
        stage: 'planning',
        beneficiaries: ['children'],
        methods: ['volunteering'],
        helpNeeded: ['funding'],
      });
      const publicationId = publication.getId.getValue();

      // Lead forwards
      (global as any).testUserId = leadId;
      const result = await trpcMutation(app, 'publications.forward', {
        publicationId,
        targetCommunityId: marathonCommunityId,
      });

      // Verify project fields are copied
      const copy = await publicationService.getPublicationDocument(result.forwardedPublicationId);
      expect(copy?.postType).toBe('project');
      expect(copy?.isProject).toBe(true);
      expect(copy?.impactArea).toBe('education');
      expect(copy?.stage).toBe('planning');
      expect(copy?.beneficiaries).toEqual(['children']);
      expect(copy?.methods).toEqual(['volunteering']);
      expect(copy?.helpNeeded).toEqual(['funding']);
    });
  });

  describe('Validation and error cases', () => {
    it('should reject forward proposal from non-team community', async () => {
      // Create a regular community
      const regularCommunityId = uid();
      await communityService.createCommunity({
        id: regularCommunityId,
        name: 'Regular Community',
        typeTag: 'custom',
        settings: {
          currencyNames: { singular: 'merit', plural: 'merits', genitive: 'merits' },
          dailyEmission: 100,
        },
        postingRules: {
          allowedRoles: ['lead', 'participant'],
        },
      });

      // Create post in regular community
      (global as any).testUserId = authorId;
      const publication = await publicationService.createPublication(authorId, {
        communityId: regularCommunityId,
        content: 'Test post',
        type: 'text',
        postType: 'basic',
      });
      const publicationId = publication.getId.getValue();

      // Try to propose forward (should fail)
      (global as any).testUserId = participantId;
      const result = await trpcMutationWithError(app, 'publications.proposeForward', {
        publicationId,
        targetCommunityId: marathonCommunityId,
      });

      expect(result.error).toBeDefined();
      expect(result.error?.code).toBe('BAD_REQUEST');
      expect(result.error?.message).toContain('team groups');
    });

    it('should reject forward proposal for poll posts', async () => {
      // Create a poll post
      (global as any).testUserId = authorId;
      const publication = await publicationService.createPublication(authorId, {
        communityId: teamCommunityId,
        content: 'Poll content',
        type: 'text',
        postType: 'poll',
      });
      const publicationId = publication.getId.getValue();

      // Try to propose forward (should fail)
      (global as any).testUserId = participantId;
      const result = await trpcMutationWithError(app, 'publications.proposeForward', {
        publicationId,
        targetCommunityId: marathonCommunityId,
      });

      expect(result.error).toBeDefined();
      expect(result.error?.code).toBe('BAD_REQUEST');
      expect(result.error?.message).toContain('polls');
    });

    it('should reject forward proposal when lead tries to use proposeForward', async () => {
      // Create a post
      (global as any).testUserId = authorId;
      const publication = await publicationService.createPublication(authorId, {
        communityId: teamCommunityId,
        content: 'Test post',
        type: 'text',
        postType: 'basic',
      });
      const publicationId = publication.getId.getValue();

      // Lead tries to propose (should fail - should use forward directly)
      (global as any).testUserId = leadId;
      const result = await trpcMutationWithError(app, 'publications.proposeForward', {
        publicationId,
        targetCommunityId: marathonCommunityId,
      });

      expect(result.error).toBeDefined();
      expect(result.error?.code).toBe('FORBIDDEN');
      expect(result.error?.message).toContain('Leads should use the forward endpoint');
    });

    it('should reject forward when insufficient quota', async () => {
      // Create a post
      (global as any).testUserId = authorId;
      const publication = await publicationService.createPublication(authorId, {
        communityId: teamCommunityId,
        content: 'Test post',
        type: 'text',
        postType: 'basic',
      });
      const publicationId = publication.getId.getValue();

      // Consume all quota
      await connection.db.collection('quota_usage').insertOne({
        id: uid(),
        userId: participantId,
        communityId: teamCommunityId,
        amountQuota: 100, // Use all quota
        usageType: 'vote',
        referenceId: uid(),
        createdAt: new Date(),
      });

      // Try to propose forward (should fail)
      (global as any).testUserId = participantId;
      const result = await trpcMutationWithError(app, 'publications.proposeForward', {
        publicationId,
        targetCommunityId: marathonCommunityId,
      });

      expect(result.error).toBeDefined();
      expect(result.error?.code).toBe('BAD_REQUEST');
      expect(result.error?.message).toContain('Insufficient quota');
    });

    it('should reject forward when target community does not support post type', async () => {
      // Create a restricted community that doesn't allow participants to post
      const restrictedCommunityId = uid();
      await communityService.createCommunity({
        id: restrictedCommunityId,
        name: 'Restricted Community',
        typeTag: 'custom',
        settings: {
          currencyNames: { singular: 'merit', plural: 'merits', genitive: 'merits' },
          dailyEmission: 100,
        },
        postingRules: {
          allowedRoles: ['lead'], // Only leads can post
        },
      });

      // Create a post
      (global as any).testUserId = authorId;
      const publication = await publicationService.createPublication(authorId, {
        communityId: teamCommunityId,
        content: 'Test post',
        type: 'text',
        postType: 'basic',
      });
      const publicationId = publication.getId.getValue();

      // Try to forward to restricted community (should fail)
      (global as any).testUserId = participantId;
      const result = await trpcMutationWithError(app, 'publications.proposeForward', {
        publicationId,
        targetCommunityId: restrictedCommunityId,
      });

      expect(result.error).toBeDefined();
      expect(result.error?.code).toBe('BAD_REQUEST');
      expect(result.error?.message).toContain('does not support');
    });
  });
});

