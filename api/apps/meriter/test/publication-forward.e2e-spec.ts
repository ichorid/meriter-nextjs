import { TestSetupHelper } from './helpers/test-setup.helper';
import { trpcMutation, trpcMutationWithError, trpcQuery } from './helpers/trpc-test-helper';
import { withSuppressedErrors } from './helpers/error-suppression.helper';
import { uid } from 'uid';
import { getConnectionToken } from '@nestjs/mongoose';
import { CommunityService } from '../src/domain/services/community.service';
import { UserService } from '../src/domain/services/user.service';

describe('Publication Forward E2E', () => {
  jest.setTimeout(120000);

  function setTestUserId(userId: string) {
    (global as any).testUserId = userId;
  }

  async function waitFor<T>(
    fn: () => Promise<T>,
    predicate: (value: T) => boolean,
    timeoutMs = 5000,
    intervalMs = 100,
  ): Promise<T> {
    const startedAt = Date.now();
    // eslint-disable-next-line no-constant-condition
    while (true) {
      const value = await fn();
      if (predicate(value)) return value;
      if (Date.now() - startedAt > timeoutMs) {
        throw new Error('Timed out waiting for condition');
      }
      await new Promise((resolve) => setTimeout(resolve, intervalMs));
    }
  }
  
  let app: any;
  let testDb: any;
  let connection: any;
  let communityService: CommunityService;
  let userService: UserService;
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
        userId: authorId,
        communityId: teamCommunityId,
        role: 'participant',
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
      {
        id: uid(),
        userId: authorId,
        communityId: marathonCommunityId,
        role: 'participant',
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        id: uid(),
        userId: authorId,
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
    await connection.db.collection('votes').deleteMany({});
    await connection.db.collection('poll_casts').deleteMany({});
  });

  describe('Non-lead propose forward flow', () => {
    it('should allow participant to propose forward, lead to confirm, and create copy in target', async () => {
      // Author creates a post (as in real UI: create -> view -> someone else proposes forward)
      setTestUserId(authorId);
      const created = await trpcMutation(app, 'publications.create', {
        communityId: teamCommunityId,
        content: 'Test post to forward',
        type: 'text',
        postType: 'basic',
        title: 'Test Post',
        description: 'Test description',
      });
      const publicationId = created.id as string;

      // Participant opens the post details page (should not be pending yet)
      setTestUserId(participantId);
      const beforePropose = await trpcQuery(app, 'publications.getById', { id: publicationId });
      expect(beforePropose.id).toBe(publicationId);
      expect(beforePropose.forwardStatus ?? null).toBeNull();

      // Participant proposes forward
      await trpcMutation(app, 'publications.proposeForward', {
        publicationId,
        targetCommunityId: marathonCommunityId,
      });

      // Participant re-opens the post details page and sees "pending forward"
      const pendingPub = await waitFor(
        () => trpcQuery(app, 'publications.getById', { id: publicationId }),
        (pub) => pub.forwardStatus === 'pending',
      );
      expect(pendingPub.forwardTargetCommunityId).toBe(marathonCommunityId);
      expect(pendingPub.forwardProposedBy).toBe(participantId);

      // Verify quota was consumed
      const quotaUsage = await connection.db.collection('quota_usage').findOne({
        userId: participantId,
        communityId: teamCommunityId,
        usageType: 'forward_proposal',
        referenceId: publicationId,
      });
      expect(quotaUsage).toBeDefined();
      expect(quotaUsage?.amountQuota).toBe(1);

      // Lead opens notifications page and sees the forward proposal notification (unread)
      setTestUserId(leadId);
      const notifList = await waitFor(
        () => trpcQuery(app, 'notifications.getAll', { unreadOnly: true, type: 'forward_proposal', pageSize: 50 }),
        (res) => Array.isArray(res.data) && res.data.length > 0,
      );
      const forwardNotif = (notifList.data as any[]).find((n) => n.type === 'forward_proposal');
      expect(forwardNotif).toBeDefined();
      // notifications.getAll returns an enriched shape (no raw metadata)
      expect(forwardNotif.relatedId).toBe(publicationId);
      expect(forwardNotif.community?.id).toBe(teamCommunityId);
      expect(forwardNotif.actor?.id).toBe(participantId);

      // Lead opens the post details page and sees it is pending review
      const leadView = await trpcQuery(app, 'publications.getById', { id: publicationId });
      expect(leadView.forwardStatus).toBe('pending');
      expect(leadView.forwardTargetCommunityId).toBe(marathonCommunityId);
      expect(leadView.forwardProposedBy).toBe(participantId);

      // Lead confirms forward (review popup -> confirm)
      const result = await trpcMutation(app, 'publications.forward', {
        publicationId,
        targetCommunityId: marathonCommunityId,
      });

      expect(result.success).toBe(true);
      expect(result.forwardedPublicationId).toBeDefined();

      // Lead marks notification as read after handling it
      await trpcMutation(app, 'notifications.markAsRead', { id: forwardNotif.id });
      const unreadAfter = await trpcQuery(app, 'notifications.getUnreadCount');
      expect(unreadAfter.count).toBe(0);

      // Verify original publication is marked as forwarded (as seen by API)
      const forwardedPub = await trpcQuery(app, 'publications.getById', { id: publicationId });
      expect(forwardedPub.forwardStatus).toBe('forwarded');
      expect(forwardedPub.forwardTargetCommunityId).toBe(marathonCommunityId);
      expect(forwardedPub.forwardProposedBy).toBeUndefined();

      // Verify new publication was created in target community
      const forwardedPublicationId = result.forwardedPublicationId as string;
      const newPub = await trpcQuery(app, 'publications.getById', { id: forwardedPublicationId });
      expect(newPub).toBeDefined();
      expect(newPub.communityId).toBe(marathonCommunityId);
      expect(newPub.authorId).toBe(authorId); // original author preserved
      expect(newPub.content).toBe('Test post to forward');
      expect(newPub.title).toBe('Test Post');
      expect(newPub.description).toBe('Test description');
      expect(newPub.metrics?.score).toBe(0); // metrics reset
      expect(newPub.metrics?.upvotes).toBe(0);

      // Target community feed now includes the forwarded copy (what users would see)
      const targetFeed = await trpcQuery(app, 'publications.getAll', { communityId: marathonCommunityId, pageSize: 50 });
      const ids = (targetFeed.data as any[]).map((p) => p.id);
      expect(ids).toContain(forwardedPublicationId);
    });

    it('should allow lead to reject forward proposal and clear status', async () => {
      // Author creates a post
      setTestUserId(authorId);
      const created = await trpcMutation(app, 'publications.create', {
        communityId: teamCommunityId,
        content: 'Test post',
        type: 'text',
        postType: 'basic',
        title: 'Reject Test Post',
        description: 'Reject test description',
      });
      const publicationId = created.id as string;

      // Participant proposes forward
      setTestUserId(participantId);
      await trpcMutation(app, 'publications.proposeForward', {
        publicationId,
        targetCommunityId: marathonCommunityId,
      });

      // Lead sees notification and rejects from review flow
      setTestUserId(leadId);
      const notifList = await waitFor(
        () => trpcQuery(app, 'notifications.getAll', { unreadOnly: true, type: 'forward_proposal', pageSize: 50 }),
        (res) => Array.isArray(res.data) && res.data.length > 0,
      );
      const forwardNotif = (notifList.data as any[]).find((n) => n.type === 'forward_proposal');
      expect(forwardNotif).toBeDefined();

      const result = await trpcMutation(app, 'publications.rejectForward', {
        publicationId,
      });

      expect(result.success).toBe(true);

      // Lead marks notification as read after rejecting
      await trpcMutation(app, 'notifications.markAsRead', { id: forwardNotif.id });

      // Verify status is cleared (as seen by API)
      const pub = await trpcQuery(app, 'publications.getById', { id: publicationId });
      expect(pub.forwardStatus ?? null).toBeNull();
      expect(pub.forwardTargetCommunityId).toBeUndefined();
      expect(pub.forwardProposedBy).toBeUndefined();
    });
  });

  describe('Lead direct forward flow', () => {
    it('should allow lead to forward directly without proposal', async () => {
      // Author creates a post
      setTestUserId(authorId);
      const created = await trpcMutation(app, 'publications.create', {
        communityId: teamCommunityId,
        content: 'Test post for direct forward',
        type: 'text',
        postType: 'basic',
        title: 'Direct Forward Test',
        description: 'Description',
        hashtags: ['test'],
      });
      const publicationId = created.id as string;

      // Lead forwards directly
      setTestUserId(leadId);
      const result = await trpcMutation(app, 'publications.forward', {
        publicationId,
        targetCommunityId: futureVisionCommunityId,
      });

      expect(result.success).toBe(true);

      // Verify quota was NOT consumed (leads can forward for free)
      const quotaUsage = await connection.db.collection('quota_usage').findOne({
        userId: leadId,
        communityId: teamCommunityId,
        usageType: 'forward',
        referenceId: publicationId,
      });
      expect(quotaUsage).toBeNull();

      // Verify original is marked as forwarded
      const original = await trpcQuery(app, 'publications.getById', { id: publicationId });
      expect(original.forwardStatus).toBe('forwarded');

      // Verify copy was created
      const forwardedPublicationId = result.forwardedPublicationId as string;
      const copy = await trpcQuery(app, 'publications.getById', { id: forwardedPublicationId });
      expect(copy.communityId).toBe(futureVisionCommunityId);
      expect(copy.content).toBe('Test post for direct forward');
      expect(copy.title).toBe('Direct Forward Test');
      expect(copy.hashtags).toEqual(['test']);
    });

    it('should forward project posts with all taxonomy fields', async () => {
      // Create a project post
      setTestUserId(authorId);
      const created = await trpcMutation(app, 'publications.create', {
        communityId: teamCommunityId,
        content: 'Project content',
        type: 'text',
        postType: 'project',
        isProject: true,
        title: 'Test Project',
        description: 'Project description',
        impactArea: 'Education & Youth',
        stage: 'Idea / looking for team',
        beneficiaries: ['Children & teens'],
        methods: ['Direct service'],
        helpNeeded: ['Money'],
      });
      const publicationId = created.id as string;

      // Lead forwards
      setTestUserId(leadId);
      const result = await trpcMutation(app, 'publications.forward', {
        publicationId,
        targetCommunityId: marathonCommunityId,
      });

      // Verify project fields are copied
      const copy = await trpcQuery(app, 'publications.getById', { id: result.forwardedPublicationId as string });
      expect(copy.postType).toBe('project');
      expect(copy.isProject).toBe(true);
      expect(copy.impactArea).toBe('Education & Youth');
      expect(copy.stage).toBe('Idea / looking for team');
      expect(copy.beneficiaries).toEqual(['Children & teens']);
      expect(copy.methods).toEqual(['Direct service']);
      expect(copy.helpNeeded).toEqual(['Money']);
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

      // Make author/participant members (so the create/view steps match real flow)
      await connection.db.collection('user_community_roles').insertMany([
        { id: uid(), userId: authorId, communityId: regularCommunityId, role: 'participant', createdAt: new Date(), updatedAt: new Date() },
        { id: uid(), userId: participantId, communityId: regularCommunityId, role: 'participant', createdAt: new Date(), updatedAt: new Date() },
      ]);

      // Author creates post in regular community
      setTestUserId(authorId);
      const created = await trpcMutation(app, 'publications.create', {
        communityId: regularCommunityId,
        content: 'Test post',
        type: 'text',
        postType: 'basic',
        title: 'Regular Community Post',
        description: 'Regular community description',
      });
      const publicationId = created.id as string;

      // Try to propose forward (should fail)
      setTestUserId(participantId);
      await withSuppressedErrors(['BAD_REQUEST'], async () => {
        const result = await trpcMutationWithError(app, 'publications.proposeForward', {
          publicationId,
          targetCommunityId: marathonCommunityId,
        });

        expect(result.error).toBeDefined();
        expect(result.error?.code).toBe('BAD_REQUEST');
        expect(result.error?.message).toContain('team groups');
      });
    });

    it('should reject forward proposal for poll posts', async () => {
      // Create a poll post
      setTestUserId(authorId);
      const created = await trpcMutation(app, 'publications.create', {
        communityId: teamCommunityId,
        content: 'Poll content',
        type: 'text',
        postType: 'poll',
        title: 'Poll Post',
        description: 'Poll post description',
      });
      const publicationId = created.id as string;

      // Try to propose forward (should fail)
      setTestUserId(participantId);
      await withSuppressedErrors(['BAD_REQUEST'], async () => {
        const result = await trpcMutationWithError(app, 'publications.proposeForward', {
          publicationId,
          targetCommunityId: marathonCommunityId,
        });

        expect(result.error).toBeDefined();
        expect(result.error?.code).toBe('BAD_REQUEST');
        expect(result.error?.message).toContain('polls');
      });
    });

    it('should reject forward proposal when lead tries to use proposeForward', async () => {
      // Create a post
      setTestUserId(authorId);
      const created = await trpcMutation(app, 'publications.create', {
        communityId: teamCommunityId,
        content: 'Test post',
        type: 'text',
        postType: 'basic',
        title: 'Lead Propose Test',
        description: 'Lead propose description',
      });
      const publicationId = created.id as string;

      // Lead tries to propose (should fail - should use forward directly)
      setTestUserId(leadId);
      await withSuppressedErrors(['FORBIDDEN'], async () => {
        const result = await trpcMutationWithError(app, 'publications.proposeForward', {
          publicationId,
          targetCommunityId: marathonCommunityId,
        });

        expect(result.error).toBeDefined();
        expect(result.error?.code).toBe('FORBIDDEN');
        expect(result.error?.message).toContain('Leads should use the forward endpoint');
      });
    });

    it('should reject forward when insufficient quota', async () => {
      // Create a post
      setTestUserId(authorId);
      const created = await trpcMutation(app, 'publications.create', {
        communityId: teamCommunityId,
        content: 'Test post',
        type: 'text',
        postType: 'basic',
        title: 'Insufficient Quota Test',
        description: 'Insufficient quota description',
      });
      const publicationId = created.id as string;

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
      setTestUserId(participantId);
      await withSuppressedErrors(['BAD_REQUEST'], async () => {
        const result = await trpcMutationWithError(app, 'publications.proposeForward', {
          publicationId,
          targetCommunityId: marathonCommunityId,
        });

        expect(result.error).toBeDefined();
        expect(result.error?.code).toBe('BAD_REQUEST');
        expect(result.error?.message).toContain('Insufficient quota');
      });
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
      setTestUserId(authorId);
      const created = await trpcMutation(app, 'publications.create', {
        communityId: teamCommunityId,
        content: 'Test post',
        type: 'text',
        postType: 'basic',
        title: 'Restricted Target Test',
        description: 'Restricted target description',
      });
      const publicationId = created.id as string;

      // Try to forward to restricted community (should fail)
      setTestUserId(participantId);
      await withSuppressedErrors(['BAD_REQUEST'], async () => {
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
});

