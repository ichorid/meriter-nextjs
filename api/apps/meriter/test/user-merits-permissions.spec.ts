import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import { TestDatabaseHelper } from './test-db.helper';
import { MeriterModule } from '../src/meriter.module';
import { PermissionService } from '../src/domain/services/permission.service';
import { CommunityService } from '../src/domain/services/community.service';
import { UserService } from '../src/domain/services/user.service';
import { UserCommunityRoleService } from '../src/domain/services/user-community-role.service';
import { WalletService } from '../src/domain/services/wallet.service';
import { Connection } from 'mongoose';
import { getConnectionToken } from '@nestjs/mongoose';
import { CommunitySchemaClass, CommunityDocument } from '../src/domain/models/community/community.schema';
import { uid } from 'uid';
import { WalletsController } from '../src/api-v1/wallets/wallets.controller';
import { NotFoundError, ForbiddenError } from '../src/common/exceptions/api.exceptions';

describe('User Merits Permissions', () => {
  jest.setTimeout(60000);
  
  let app: INestApplication;
  let testDb: TestDatabaseHelper;
  let connection: Connection;
  
  let permissionService: PermissionService;
  let communityService: CommunityService;
  let userService: UserService;
  let userCommunityRoleService: UserCommunityRoleService;
  let walletService: WalletService;
  let walletsController: WalletsController;
  
  // Test user IDs
  let participant1Id: string;
  let participant2Id: string;
  let lead1Id: string;
  let superadminId: string;
  let viewerId: string;
  let nonExistentUserId: string;

  // Test community IDs
  let regularCommunityId: string;

  beforeAll(async () => {
    testDb = new TestDatabaseHelper();
    const mongoUri = await testDb.start();
    process.env.MONGO_URL = mongoUri;
    process.env.JWT_SECRET = 'test-jwt-secret-key-for-user-merits-permissions';

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [MeriterModule],
    })
      .compile();

    app = moduleFixture.createNestApplication();
    await app.init();

    // Wait a bit for onModuleInit to complete
    await new Promise(resolve => setTimeout(resolve, 1000));

    permissionService = app.get<PermissionService>(PermissionService);
    communityService = app.get<CommunityService>(CommunityService);
    userService = app.get<UserService>(UserService);
    userCommunityRoleService = app.get<UserCommunityRoleService>(UserCommunityRoleService);
    walletService = app.get<WalletService>(WalletService);
    walletsController = app.get<WalletsController>(WalletsController);
    
    connection = app.get(getConnectionToken());

    // Initialize test IDs
    participant1Id = uid();
    participant2Id = uid();
    lead1Id = uid();
    superadminId = uid();
    viewerId = uid();
    nonExistentUserId = uid();

    regularCommunityId = uid();

    // Create test users and store their internal IDs
    const participant1User = await userService.createOrUpdateUser({
      authProvider: 'test',
      authId: participant1Id,
      username: 'participant1',
      displayName: 'Participant 1',
    });
    participant1Id = participant1User.id;
    
    const participant2User = await userService.createOrUpdateUser({
      authProvider: 'test',
      authId: participant2Id,
      username: 'participant2',
      displayName: 'Participant 2',
    });
    participant2Id = participant2User.id;
    
    const lead1User = await userService.createOrUpdateUser({
      authProvider: 'test',
      authId: lead1Id,
      username: 'lead1',
      displayName: 'Lead 1',
    });
    lead1Id = lead1User.id;
    
    const superadminUser = await userService.createOrUpdateUser({
      authProvider: 'test',
      authId: superadminId,
      username: 'superadmin',
      displayName: 'Superadmin',
      globalRole: 'superadmin',
    });
    superadminId = superadminUser.id;
    
    const viewer1User = await userService.createOrUpdateUser({
      authProvider: 'test',
      authId: viewerId,
      username: 'viewer1',
      displayName: 'Viewer 1',
    });
    viewerId = viewer1User.id;
  });

  beforeEach(async () => {
    // Clean up communities
    const communityModel = connection.model<CommunityDocument>(CommunitySchemaClass.name);
    await communityModel.deleteMany({});

    // Create test community
    await communityService.createCommunity({
      id: regularCommunityId,
      name: 'Regular Community',
      typeTag: 'custom',
      settings: {
        currencyNames: {
          singular: 'merit',
          plural: 'merits',
          genitive: 'merits',
        },
        dailyEmission: 10,
        language: 'en',
        postCost: 1,
        pollCost: 1,
        editWindowDays: 7,
      },
    });

    // Assign roles
    await userCommunityRoleService.setRole(participant1Id, regularCommunityId, 'participant');
    await userCommunityRoleService.setRole(participant2Id, regularCommunityId, 'participant');
    await userCommunityRoleService.setRole(lead1Id, regularCommunityId, 'lead');
    await userCommunityRoleService.setRole(viewerId, regularCommunityId, 'viewer');

    // Create wallets for users
    await walletService.createOrGetWallet(
      participant1Id,
      regularCommunityId,
      { singular: 'merit', plural: 'merits', genitive: 'merits' },
    );
    await walletService.createOrGetWallet(
      participant2Id,
      regularCommunityId,
      { singular: 'merit', plural: 'merits', genitive: 'merits' },
    );
  });

  afterAll(async () => {
    if (testDb) {
      await testDb.stop();
    }
    if (app) {
      await app.close();
    }
  });

  describe('PermissionService.canViewUserMerits', () => {
    it('should return true when user views their own data', async () => {
      const canView = await permissionService.canViewUserMerits(
        participant1Id,
        participant1Id,
        regularCommunityId,
      );
      expect(canView).toBe(true);
    });

    it('should return true when superadmin views any user data', async () => {
      const canView = await permissionService.canViewUserMerits(
        superadminId,
        participant1Id,
        regularCommunityId,
      );
      expect(canView).toBe(true);
    });

    it('should return true when lead views member data in their community', async () => {
      const canView = await permissionService.canViewUserMerits(
        lead1Id,
        participant1Id,
        regularCommunityId,
      );
      expect(canView).toBe(true);
    });

    it('should return false when participant views another participant data', async () => {
      const canView = await permissionService.canViewUserMerits(
        participant1Id,
        participant2Id,
        regularCommunityId,
      );
      expect(canView).toBe(false);
    });

    it('should return false when viewer views participant data', async () => {
      const canView = await permissionService.canViewUserMerits(
        viewerId,
        participant1Id,
        regularCommunityId,
      );
      expect(canView).toBe(false);
    });

    it('should return false when requester does not exist', async () => {
      const canView = await permissionService.canViewUserMerits(
        nonExistentUserId,
        participant1Id,
        regularCommunityId,
      );
      expect(canView).toBe(false);
    });

    it('should return true when superadmin views non-existent user (permission check happens before existence check)', async () => {
      // This test verifies that permission is checked first
      // Superadmin should have permission even if target user doesn't exist
      const canView = await permissionService.canViewUserMerits(
        superadminId,
        nonExistentUserId,
        regularCommunityId,
      );
      expect(canView).toBe(true);
    });
  });

  describe('WalletsController.getUserWallet', () => {
    it('should return wallet when user views their own wallet', async () => {
      const req = { user: { id: participant1Id } };
      const wallet = await walletsController.getUserWallet(
        participant1Id,
        regularCommunityId,
        req as any,
      );
      expect(wallet).toBeDefined();
      expect(wallet.userId).toBe(participant1Id);
    });

    it('should return wallet when superadmin views any user wallet', async () => {
      const req = { user: { id: superadminId } };
      const wallet = await walletsController.getUserWallet(
        participant1Id,
        regularCommunityId,
        req as any,
      );
      expect(wallet).toBeDefined();
      expect(wallet.userId).toBe(participant1Id);
    });

    it('should return wallet when lead views member wallet in their community', async () => {
      const req = { user: { id: lead1Id } };
      const wallet = await walletsController.getUserWallet(
        participant1Id,
        regularCommunityId,
        req as any,
      );
      expect(wallet).toBeDefined();
      expect(wallet.userId).toBe(participant1Id);
    });

    it('should throw ForbiddenError when participant views another participant wallet', async () => {
      const req = { user: { id: participant1Id } };
      await expect(
        walletsController.getUserWallet(
          participant2Id,
          regularCommunityId,
          req as any,
        ),
      ).rejects.toThrow(ForbiddenError);
    });

    it('should throw ForbiddenError when viewer views participant wallet', async () => {
      const req = { user: { id: viewerId } };
      await expect(
        walletsController.getUserWallet(
          participant1Id,
          regularCommunityId,
          req as any,
        ),
      ).rejects.toThrow(ForbiddenError);
    });

    it('should throw ForbiddenError when participant views non-existent user wallet (security: no info leakage)', async () => {
      const req = { user: { id: participant1Id } };
      // Should return 403, not 404, to prevent information leakage
      await expect(
        walletsController.getUserWallet(
          nonExistentUserId,
          regularCommunityId,
          req as any,
        ),
      ).rejects.toThrow(ForbiddenError);
    });

    it('should throw NotFoundError when superadmin views non-existent user wallet (permission granted, then check existence)', async () => {
      const req = { user: { id: superadminId } };
      // Superadmin has permission, so we check existence and return 404
      await expect(
        walletsController.getUserWallet(
          nonExistentUserId,
          regularCommunityId,
          req as any,
        ),
      ).rejects.toThrow(NotFoundError);
    });

    it('should throw NotFoundError when lead views non-existent user wallet (permission granted, then check existence)', async () => {
      const req = { user: { id: lead1Id } };
      // Lead has permission, so we check existence and return 404
      await expect(
        walletsController.getUserWallet(
          nonExistentUserId,
          regularCommunityId,
          req as any,
        ),
      ).rejects.toThrow(NotFoundError);
    });

    it('should handle "me" token for current user', async () => {
      const req = { user: { id: participant1Id } };
      const wallet = await walletsController.getUserWallet(
        'me',
        regularCommunityId,
        req as any,
      );
      expect(wallet).toBeDefined();
      expect(wallet.userId).toBe(participant1Id);
    });
  });

  describe('WalletsController.getUserQuota', () => {
    it('should return quota when user views their own quota', async () => {
      const req = { user: { id: participant1Id } };
      const quota = await walletsController.getUserQuota(
        participant1Id,
        regularCommunityId,
        req as any,
      );
      expect(quota).toBeDefined();
      expect(quota.dailyQuota).toBe(10);
    });

    it('should return quota when superadmin views any user quota', async () => {
      const req = { user: { id: superadminId } };
      const quota = await walletsController.getUserQuota(
        participant1Id,
        regularCommunityId,
        req as any,
      );
      expect(quota).toBeDefined();
      expect(quota.dailyQuota).toBe(10);
    });

    it('should return quota when lead views member quota in their community', async () => {
      const req = { user: { id: lead1Id } };
      const quota = await walletsController.getUserQuota(
        participant1Id,
        regularCommunityId,
        req as any,
      );
      expect(quota).toBeDefined();
      expect(quota.dailyQuota).toBe(10);
    });

    it('should throw ForbiddenError when participant views another participant quota', async () => {
      const req = { user: { id: participant1Id } };
      await expect(
        walletsController.getUserQuota(
          participant2Id,
          regularCommunityId,
          req as any,
        ),
      ).rejects.toThrow(ForbiddenError);
    });

    it('should throw ForbiddenError when viewer views participant quota', async () => {
      const req = { user: { id: viewerId } };
      await expect(
        walletsController.getUserQuota(
          participant1Id,
          regularCommunityId,
          req as any,
        ),
      ).rejects.toThrow(ForbiddenError);
    });

    it('should throw ForbiddenError when participant views non-existent user quota (security: no info leakage)', async () => {
      const req = { user: { id: participant1Id } };
      // Should return 403, not 404, to prevent information leakage
      await expect(
        walletsController.getUserQuota(
          nonExistentUserId,
          regularCommunityId,
          req as any,
        ),
      ).rejects.toThrow(ForbiddenError);
    });

    it('should throw NotFoundError when superadmin views non-existent user quota (permission granted, then check existence)', async () => {
      const req = { user: { id: superadminId } };
      // Superadmin has permission, so we check existence and return 404
      await expect(
        walletsController.getUserQuota(
          nonExistentUserId,
          regularCommunityId,
          req as any,
        ),
      ).rejects.toThrow(NotFoundError);
    });

    it('should throw NotFoundError when lead views non-existent user quota (permission granted, then check existence)', async () => {
      const req = { user: { id: lead1Id } };
      // Lead has permission, so we check existence and return 404
      await expect(
        walletsController.getUserQuota(
          nonExistentUserId,
          regularCommunityId,
          req as any,
        ),
      ).rejects.toThrow(NotFoundError);
    });

    it('should handle "me" token for current user', async () => {
      const req = { user: { id: participant1Id } };
      const quota = await walletsController.getUserQuota(
        'me',
        regularCommunityId,
        req as any,
      );
      expect(quota).toBeDefined();
      expect(quota.dailyQuota).toBe(10);
    });
  });
});

