import { INestApplication } from '@nestjs/common';
import { createTestPublication } from './helpers/fixtures';
import { trpcMutation, trpcQuery, trpcQueryWithError } from './helpers/trpc-test-helper';
import { Model, Connection } from 'mongoose';
import { getConnectionToken, getModelToken } from '@nestjs/mongoose';
import { Community, CommunityDocument } from '../src/domain/models/community/community.schema';
import { User, UserDocument } from '../src/domain/models/user/user.schema';
import { Publication, PublicationDocument } from '../src/domain/models/publication/publication.schema';
import { UserCommunityRole, UserCommunityRoleDocument } from '../src/domain/models/user-community-role/user-community-role.schema';
import { WalletService } from '../src/domain/services/wallet.service';
import { uid } from 'uid';
import { TestSetupHelper } from './helpers/test-setup.helper';
import { withSuppressedErrors } from './helpers/error-suppression.helper';

describe('Publication Soft Delete E2E', () => {
  jest.setTimeout(60000);
  
  let app: INestApplication;
  let connection: Connection;
  let testDb: any;
  
  let communityModel: Model<CommunityDocument>;
  let userModel: Model<UserDocument>;
  let publicationModel: Model<PublicationDocument>;
  let userCommunityRoleModel: Model<UserCommunityRoleDocument>;
  let walletService: WalletService;

  // Test user IDs
  let authorId: string;
  let leadId: string;
  let superadminId: string;
  let participantId: string;
  let otherLeadId: string;

  // Test community IDs
  let communityId: string;
  let otherCommunityId: string;

  beforeAll(async () => {
    process.env.JWT_SECRET = 'test-jwt-secret-key-for-soft-delete-e2e';
    const ctx = await TestSetupHelper.createTestApp();
    app = ctx.app;
    testDb = ctx.testDb;

    connection = app.get(getConnectionToken());
    
    // Get models using NestJS getModelToken (standard way)
    communityModel = app.get(getModelToken(Community.name));
    userModel = app.get(getModelToken(User.name));
    publicationModel = app.get(getModelToken(Publication.name));
    userCommunityRoleModel = app.get(getModelToken(UserCommunityRole.name));
    walletService = app.get(WalletService);

    // Initialize test IDs
    authorId = uid();
    leadId = uid();
    superadminId = uid();
    participantId = uid();
    otherLeadId = uid();

    communityId = uid();
    otherCommunityId = uid();
  });

  beforeEach(async () => {
    // Clear database between tests
    const collections = connection.collections;
    for (const key in collections) {
      await collections[key].deleteMany({});
    }

    // Create test users
    await userModel.create([
      {
        id: authorId,
        authProvider: 'telegram',
        authId: `tg-${authorId}`,
        telegramId: uid(),
        username: `author_${uid()}`,
        firstName: 'Author',
        lastName: 'User',
        displayName: 'Author User',
        globalRole: undefined,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        id: leadId,
        authProvider: 'telegram',
        authId: `tg-${leadId}`,
        telegramId: uid(),
        username: `lead_${uid()}`,
        firstName: 'Lead',
        lastName: 'User',
        displayName: 'Lead User',
        globalRole: undefined,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        id: superadminId,
        authProvider: 'telegram',
        authId: `tg-${superadminId}`,
        telegramId: uid(),
        username: `superadmin_${uid()}`,
        firstName: 'Superadmin',
        lastName: 'User',
        displayName: 'Superadmin User',
        globalRole: 'superadmin',
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        id: participantId,
        authProvider: 'telegram',
        authId: `tg-${participantId}`,
        telegramId: uid(),
        username: `participant_${uid()}`,
        firstName: 'Participant',
        lastName: 'User',
        displayName: 'Participant User',
        globalRole: undefined,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        id: otherLeadId,
        authProvider: 'telegram',
        authId: `tg-${otherLeadId}`,
        telegramId: uid(),
        username: `otherlead_${uid()}`,
        firstName: 'Other Lead',
        lastName: 'User',
        displayName: 'Other Lead User',
        globalRole: undefined,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ]);

    // Create test communities
    await communityModel.create([
      {
        id: communityId,
        name: 'Test Community',
        description: 'Test community description',
        typeTag: 'custom',
        isActive: true,
        settings: {
          iconUrl: 'https://example.com/icon.jpg',
          currencyNames: {
            singular: 'merit',
            plural: 'merits',
            genitive: 'merits',
          },
          dailyEmission: 10,
        },
        meritSettings: {
          dailyQuota: 10,
          quotaRecipients: ['lead', 'participant'],
          canEarn: true,
        },
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        id: otherCommunityId,
        name: 'Other Community',
        description: 'Other community description',
        typeTag: 'custom',
        isActive: true,
        settings: {
          iconUrl: 'https://example.com/icon2.jpg',
          currencyNames: {
            singular: 'merit',
            plural: 'merits',
            genitive: 'merits',
          },
          dailyEmission: 10,
        },
        meritSettings: {
          dailyQuota: 10,
          quotaRecipients: ['lead', 'participant'],
          canEarn: true,
        },
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ]);

    // Create user roles
    await userCommunityRoleModel.create([
      {
        id: uid(),
        userId: authorId,
        communityId,
        role: 'participant',
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        id: uid(),
        userId: leadId,
        communityId,
        role: 'lead',
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        id: uid(),
        userId: participantId,
        communityId,
        role: 'participant',
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        id: uid(),
        userId: otherLeadId,
        communityId: otherCommunityId,
        role: 'lead',
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ]);
  });

  afterAll(async () => {
    await TestSetupHelper.cleanup({ app, testDb });
  });

  describe('Soft Delete Behavior', () => {
    it('should soft delete publication and preserve all data', async () => {
      // Create publication as author
      (global as any).testUserId = authorId;
      const pubDto = createTestPublication(communityId, authorId, {
        title: 'Test Post',
        description: 'Test description',
      });
      const created = await trpcMutation(app, 'publications.create', pubDto);
      const publicationId = created.id;

      // Add a vote to ensure data is preserved
      (global as any).testUserId = participantId;
      await trpcMutation(app, 'votes.create', {
        targetType: 'publication',
        targetId: publicationId,
        quotaAmount: 5,
        walletAmount: 0,
        comment: 'Test vote',
      });

      // Get publication before deletion
      const beforeDelete = await trpcQuery(app, 'publications.getById', { id: publicationId });

      // Delete publication
      // Must be deleted by lead/superadmin when votes/comments exist
      (global as any).testUserId = leadId;
      await trpcMutation(app, 'publications.delete', { id: publicationId });

      // Verify publication still exists in database with deleted flag
      const dbPublication = await publicationModel.findOne({ id: publicationId }).lean();
      expect(dbPublication).toBeDefined();
      expect(dbPublication?.deleted).toBe(true);
      expect(dbPublication?.deletedAt).toBeDefined();

      // Verify all original data is preserved
      expect(dbPublication?.id).toBe(beforeDelete.id);
      expect(dbPublication?.content).toBe(beforeDelete.content);
      expect(dbPublication?.title).toBe(beforeDelete.title);
      expect(dbPublication?.metrics).toBeDefined();
    });

    it('should auto-withdraw positive vote balance to effective beneficiary wallet before deletion', async () => {
      // Create publication as author
      (global as any).testUserId = authorId;
      const created = await trpcMutation(app, 'publications.create', createTestPublication(communityId, authorId));

      // Add a vote to create a positive score
      (global as any).testUserId = participantId;
      await trpcMutation(app, 'votes.create', {
        targetType: 'publication',
        targetId: created.id,
        quotaAmount: 5,
        walletAmount: 0,
        comment: 'Test vote',
      });

      // Delete publication (lead)
      (global as any).testUserId = leadId;
      await trpcMutation(app, 'publications.delete', { id: created.id });

      // Wallet should be credited to author (effective beneficiary when no explicit beneficiary is set)
      const wallet = await walletService.getWallet(authorId, communityId);
      expect(wallet).toBeTruthy();
      expect(wallet?.getBalance()).toBe(5);

      // Withdrawal total should match the original positive balance
      const totalWithdrawn = await walletService.getTotalWithdrawnByReference(
        'publication_withdrawal',
        created.id,
      );
      expect(totalWithdrawn).toBe(5);

      // Publication should now have zero score after withdrawal (still deleted)
      const dbPublication = await publicationModel.findOne({ id: created.id }).lean();
      expect(dbPublication?.deleted).toBe(true);
      expect(dbPublication?.metrics?.score).toBe(0);
    });

    it('should auto-withdraw to beneficiary wallet (not author) when beneficiaryId is set', async () => {
      // Create publication with beneficiary
      (global as any).testUserId = authorId;
      const created = await trpcMutation(
        app,
        'publications.create',
        createTestPublication(communityId, authorId, { beneficiaryId: participantId }),
      );

      // Vote by a different user (lead) to avoid self-vote edge cases
      (global as any).testUserId = leadId;
      await trpcMutation(app, 'votes.create', {
        targetType: 'publication',
        targetId: created.id,
        quotaAmount: 7,
        walletAmount: 0,
        comment: 'Test vote',
      });

      // Delete publication (superadmin)
      (global as any).testUserId = superadminId;
      await trpcMutation(app, 'publications.delete', { id: created.id });

      const beneficiaryWallet = await walletService.getWallet(participantId, communityId);
      expect(beneficiaryWallet).toBeTruthy();
      expect(beneficiaryWallet?.getBalance()).toBe(7);

      const authorWallet = await walletService.getWallet(authorId, communityId);
      expect(authorWallet?.getBalance() || 0).toBe(0);
    });

    it('should only auto-withdraw remaining balance when some amount was withdrawn manually before deletion', async () => {
      // Create publication
      (global as any).testUserId = authorId;
      const created = await trpcMutation(app, 'publications.create', createTestPublication(communityId, authorId));

      // Create score 10
      (global as any).testUserId = participantId;
      await trpcMutation(app, 'votes.create', {
        targetType: 'publication',
        targetId: created.id,
        quotaAmount: 10,
        walletAmount: 0,
        comment: 'Test vote',
      });

      // Manual withdraw 3 as author
      (global as any).testUserId = authorId;
      await trpcMutation(app, 'publications.withdraw', { publicationId: created.id, amount: 3 });

      // Delete publication (lead) should auto-withdraw remaining 7
      (global as any).testUserId = leadId;
      await trpcMutation(app, 'publications.delete', { id: created.id });

      const wallet = await walletService.getWallet(authorId, communityId);
      expect(wallet).toBeTruthy();
      expect(wallet?.getBalance()).toBe(10);

      const totalWithdrawn = await walletService.getTotalWithdrawnByReference(
        'publication_withdrawal',
        created.id,
      );
      expect(totalWithdrawn).toBe(10);
    });

    it('should not withdraw when publication has zero score', async () => {
      // Create publication without votes (score = 0)
      (global as any).testUserId = authorId;
      const created = await trpcMutation(app, 'publications.create', createTestPublication(communityId, authorId));

      // Delete publication
      (global as any).testUserId = leadId;
      await trpcMutation(app, 'publications.delete', { id: created.id });

      const totalWithdrawn = await walletService.getTotalWithdrawnByReference(
        'publication_withdrawal',
        created.id,
      );
      expect(totalWithdrawn).toBe(0);

      const wallet = await walletService.getWallet(authorId, communityId);
      expect(wallet).toBeNull();
    });

    it('should auto-withdraw marathon-of-good publication to Future Vision wallet', async () => {
      const marathonCommunityId = uid();
      const futureVisionCommunityId = uid();

      // Create special communities
      await communityModel.create([
        {
          id: marathonCommunityId,
          name: 'Marathon of Good',
          description: 'Test marathon community',
          typeTag: 'marathon-of-good',
          isActive: true,
          settings: {
            iconUrl: 'https://example.com/icon-marathon.jpg',
            currencyNames: { singular: 'merit', plural: 'merits', genitive: 'merits' },
            dailyEmission: 10,
          },
          meritSettings: { dailyQuota: 10, quotaRecipients: ['lead', 'participant'], canEarn: true },
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        {
          id: futureVisionCommunityId,
          name: 'Future Vision',
          description: 'Test future vision community',
          typeTag: 'future-vision',
          isActive: true,
          settings: {
            iconUrl: 'https://example.com/icon-fv.jpg',
            currencyNames: { singular: 'merit', plural: 'merits', genitive: 'merits' },
            dailyEmission: 0,
          },
          meritSettings: { dailyQuota: 0, quotaRecipients: ['lead', 'participant'], canEarn: false },
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ]);

      // Roles in marathon community
      await userCommunityRoleModel.create([
        { id: uid(), userId: authorId, communityId: marathonCommunityId, role: 'participant', createdAt: new Date(), updatedAt: new Date() },
        { id: uid(), userId: leadId, communityId: marathonCommunityId, role: 'lead', createdAt: new Date(), updatedAt: new Date() },
        { id: uid(), userId: participantId, communityId: marathonCommunityId, role: 'participant', createdAt: new Date(), updatedAt: new Date() },
      ]);

      // Create publication in marathon community
      (global as any).testUserId = authorId;
      const created = await trpcMutation(app, 'publications.create', createTestPublication(marathonCommunityId, authorId));

      // Vote to create score
      (global as any).testUserId = participantId;
      await trpcMutation(app, 'votes.create', {
        targetType: 'publication',
        targetId: created.id,
        quotaAmount: 5,
        walletAmount: 0,
        comment: 'Test vote',
      });

      // Delete (lead)
      (global as any).testUserId = leadId;
      await trpcMutation(app, 'publications.delete', { id: created.id });

      // Should credit Future Vision wallet, not marathon wallet
      const fvWallet = await walletService.getWallet(authorId, futureVisionCommunityId);
      expect(fvWallet).toBeTruthy();
      expect(fvWallet?.getBalance()).toBe(5);

      const marathonWallet = await walletService.getWallet(authorId, marathonCommunityId);
      expect(marathonWallet).toBeNull();
    });

    it('should exclude deleted publications from getAll query', async () => {
      // Create two publications
      (global as any).testUserId = authorId;
      const pub1 = await trpcMutation(app, 'publications.create', createTestPublication(communityId, authorId));
      const pub2 = await trpcMutation(app, 'publications.create', createTestPublication(communityId, authorId));

      // Delete one
      await trpcMutation(app, 'publications.delete', { id: pub1.id });

      // Query all publications
      const result = await trpcQuery(app, 'publications.getAll', {
        communityId,
        pageSize: 10,
      });

      // Should only return the non-deleted one
      expect(result.data).toHaveLength(1);
      expect(result.data[0].id).toBe(pub2.id);
      expect(result.data[0].id).not.toBe(pub1.id);
    });

    it('should exclude deleted publications from getById when not lead', async () => {
      // Create and delete a publication
      (global as any).testUserId = authorId;
      const created = await trpcMutation(app, 'publications.create', createTestPublication(communityId, authorId));
      await trpcMutation(app, 'publications.delete', { id: created.id });

      // Regular user should not see deleted publication
      (global as any).testUserId = participantId;
      await withSuppressedErrors(['NOT_FOUND'], async () => {
        const result = await trpcQueryWithError(app, 'publications.getById', { id: created.id });

        // Should return NOT_FOUND (filtered out)
        expect(result.error?.code).toBe('NOT_FOUND');
      });
    });
  });

  describe('getDeleted Endpoint - Permissions', () => {
    it('should allow lead to view deleted publications', async () => {
      // Create and delete a publication
      (global as any).testUserId = authorId;
      const created = await trpcMutation(app, 'publications.create', createTestPublication(communityId, authorId));
      await trpcMutation(app, 'publications.delete', { id: created.id });

      // Lead should be able to view deleted publications
      (global as any).testUserId = leadId;
      const result = await trpcQuery(app, 'publications.getDeleted', {
        communityId,
        pageSize: 10,
      });

      expect(result.data).toHaveLength(1);
      expect(result.data[0].id).toBe(created.id);
      expect(result.data[0].deleted).toBe(true);
    });

    it('should allow superadmin to view deleted publications', async () => {
      // Create and delete a publication
      (global as any).testUserId = authorId;
      const created = await trpcMutation(app, 'publications.create', createTestPublication(communityId, authorId));
      await trpcMutation(app, 'publications.delete', { id: created.id });

      // Superadmin should be able to view deleted publications
      (global as any).testUserId = superadminId;
      const result = await trpcQuery(app, 'publications.getDeleted', {
        communityId,
        pageSize: 10,
      });

      expect(result.data).toHaveLength(1);
      expect(result.data[0].id).toBe(created.id);
    });

    it('should NOT allow participant to view deleted publications', async () => {
      // Create and delete a publication
      (global as any).testUserId = authorId;
      const created = await trpcMutation(app, 'publications.create', createTestPublication(communityId, authorId));
      await trpcMutation(app, 'publications.delete', { id: created.id });

      // Participant should NOT be able to view deleted publications
      (global as any).testUserId = participantId;
      await withSuppressedErrors(['FORBIDDEN'], async () => {
        const result = await trpcQueryWithError(app, 'publications.getDeleted', {
          communityId,
          pageSize: 10,
        });

        expect(result.error?.code).toBe('FORBIDDEN');
      });
    });

    it('should NOT allow lead from different community to view deleted publications', async () => {
      // Create and delete a publication in communityId
      (global as any).testUserId = authorId;
      const created = await trpcMutation(app, 'publications.create', createTestPublication(communityId, authorId));
      await trpcMutation(app, 'publications.delete', { id: created.id });

      // Lead from different community should NOT be able to view
      (global as any).testUserId = otherLeadId;
      await withSuppressedErrors(['FORBIDDEN'], async () => {
        const result = await trpcQueryWithError(app, 'publications.getDeleted', {
          communityId, // Different community
          pageSize: 10,
        });

        expect(result.error?.code).toBe('FORBIDDEN');
      });
    });
  });

  describe('getDeleted Endpoint - Data', () => {
    it('should return only deleted publications for the community', async () => {
      // Create multiple publications
      (global as any).testUserId = authorId;
      const pub1 = await trpcMutation(app, 'publications.create', createTestPublication(communityId, authorId));
      const pub2 = await trpcMutation(app, 'publications.create', createTestPublication(communityId, authorId));
      const pub3 = await trpcMutation(app, 'publications.create', createTestPublication(communityId, authorId));

      // Delete two of them
      await trpcMutation(app, 'publications.delete', { id: pub1.id });
      await trpcMutation(app, 'publications.delete', { id: pub2.id });

      // Query deleted publications
      (global as any).testUserId = leadId;
      const result = await trpcQuery(app, 'publications.getDeleted', {
        communityId,
        pageSize: 10,
      });

      // Should return only deleted ones
      expect(result.data).toHaveLength(2);
      const deletedIds = result.data.map((p: any) => p.id);
      expect(deletedIds).toContain(pub1.id);
      expect(deletedIds).toContain(pub2.id);
      expect(deletedIds).not.toContain(pub3.id);
    });

    it('should preserve votes and comments data in deleted publications', async () => {
      // Create publication
      (global as any).testUserId = authorId;
      const created = await trpcMutation(app, 'publications.create', createTestPublication(communityId, authorId));

      // Add vote and comment
      (global as any).testUserId = participantId;
      await trpcMutation(app, 'votes.create', {
        targetType: 'publication',
        targetId: created.id,
        quotaAmount: 10,
        walletAmount: 0,
        comment: 'Test vote',
      });

      await trpcMutation(app, 'comments.create', {
        targetType: 'publication',
        targetId: created.id,
        content: 'Test comment',
      });

      // Get metrics before deletion
      const beforeDelete = await trpcQuery(app, 'publications.getById', { id: created.id });

      // Delete publication
      (global as any).testUserId = leadId;
      await trpcMutation(app, 'publications.delete', { id: created.id });

      // Query deleted publications
      (global as any).testUserId = leadId;
      const result = await trpcQuery(app, 'publications.getDeleted', {
        communityId,
        pageSize: 10,
      });

      // Metrics should be preserved
      const deleted = result.data.find((p: any) => p.id === created.id);
      expect(deleted).toBeDefined();
      // Score should be withdrawn to 0, but commentCount should remain
      expect(deleted.metrics.score).toBe(0);
      expect(deleted.metrics.commentCount).toBe(beforeDelete.metrics.commentCount);
    });

    it('should return empty array when no deleted publications exist', async () => {
      // Create publication but don't delete it
      (global as any).testUserId = authorId;
      await trpcMutation(app, 'publications.create', createTestPublication(communityId, authorId));

      // Query deleted publications
      (global as any).testUserId = leadId;
      const result = await trpcQuery(app, 'publications.getDeleted', {
        communityId,
        pageSize: 10,
      });

      expect(result.data).toHaveLength(0);
    });
  });

  describe('Integration with Forward Deletion', () => {
    it('should handle deletion of forwarded publications correctly', async () => {
      // Create publication
      (global as any).testUserId = authorId;
      const created = await trpcMutation(app, 'publications.create', createTestPublication(communityId, authorId));

      // Delete publication (this would happen during forward)
      (global as any).testUserId = leadId;
      await trpcMutation(app, 'publications.delete', { id: created.id });

      // Lead should still see it in deleted tab
      (global as any).testUserId = leadId;
      const result = await trpcQuery(app, 'publications.getDeleted', {
        communityId,
        pageSize: 10,
      });

      expect(result.data).toHaveLength(1);
      expect(result.data[0].id).toBe(created.id);
      expect(result.data[0].deleted).toBe(true);
    });
  });
});

