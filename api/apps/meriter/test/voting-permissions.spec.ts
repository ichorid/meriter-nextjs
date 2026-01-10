import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, CanActivate, ExecutionContext } from '@nestjs/common';
import { TestDatabaseHelper } from './test-db.helper';
import { MeriterModule } from '../src/meriter.module';
import { PermissionService } from '../src/domain/services/permission.service';
import { PublicationService } from '../src/domain/services/publication.service';
import { Model, Connection } from 'mongoose';
import { getConnectionToken } from '@nestjs/mongoose';
import { CommunitySchemaClass, CommunityDocument } from '../src/domain/models/community/community.schema';
import { UserSchemaClass, UserDocument } from '../src/domain/models/user/user.schema';
import { PublicationSchemaClass, PublicationDocument } from '../src/domain/models/publication/publication.schema';
import { UserCommunityRoleSchemaClass, UserCommunityRoleDocument } from '../src/domain/models/user-community-role/user-community-role.schema';
import { uid } from 'uid';

class _AllowAllGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const req = context.switchToHttp().getRequest();
    req.user = { 
      id: (global as any).testUserId || 'test-user-id',
      telegramId: 'test-telegram-id',
      displayName: 'Test User',
      username: 'testuser',
      communityTags: [],
    };
    return true;
  }
}

describe('Voting Permissions', () => {
  jest.setTimeout(60000);
  
  let app: INestApplication;
  let testDb: TestDatabaseHelper;
  let connection: Connection;
  
  let permissionService: PermissionService;
  let publicationService: PublicationService;
  
  let communityModel: Model<CommunityDocument>;
  let userModel: Model<UserDocument>;
  let userCommunityRoleModel: Model<UserCommunityRoleDocument>;

  // Test user IDs
  let participant1Id: string;
  let participant2Id: string;
  let lead1Id: string;
  let lead2Id: string;
  let superadminId: string;
  let viewerId: string;
  let nonTeamMemberId: string;

  // Test community IDs
  let marathonCommunityId: string;
  let visionCommunityId: string;
  let regularCommunityId: string;
  let team1CommunityId: string;
  let team2CommunityId: string;

  // Test publication IDs
  let marathonPubId: string;
  let visionPubId: string;
  let regularPubId: string;
  let team1PubId: string;

  beforeAll(async () => {
    testDb = new TestDatabaseHelper();
    const mongoUri = await testDb.start();
    process.env.MONGO_URL = mongoUri;
    process.env.JWT_SECRET = 'test-jwt-secret-key-for-voting-permissions';

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [MeriterModule],
    })
      .compile();

    app = moduleFixture.createNestApplication();
    await app.init();

    // Wait a bit for onModuleInit to complete (CommunityService.ensureBaseCommunities)
    await new Promise(resolve => setTimeout(resolve, 1000));

    permissionService = app.get<PermissionService>(PermissionService);
    publicationService = app.get<PublicationService>(PublicationService);
    
    connection = app.get(getConnectionToken());
    
    communityModel = connection.model<CommunityDocument>(CommunitySchemaClass.name);
    userModel = connection.model<UserDocument>(UserSchemaClass.name);
    const _publicationModel = connection.model<PublicationDocument>(PublicationSchemaClass.name);
    userCommunityRoleModel = connection.model<UserCommunityRoleDocument>(UserCommunityRoleSchemaClass.name);

    // Drop telegramChatId index if it exists (legacy index from old schema)
    try {
      await communityModel.collection.dropIndex('telegramChatId_1');
    } catch (_e) {
      // Index doesn't exist or already dropped, ignore
    }

    // Initialize test IDs
    participant1Id = uid();
    participant2Id = uid();
    lead1Id = uid();
    lead2Id = uid();
    superadminId = uid();
    viewerId = uid();
    nonTeamMemberId = uid();

    marathonCommunityId = uid();
    visionCommunityId = uid();
    regularCommunityId = uid();
    team1CommunityId = uid();
    team2CommunityId = uid();

    marathonPubId = uid();
    visionPubId = uid();
    regularPubId = uid();
    team1PubId = uid();
  });

  beforeEach(async () => {
    // Clear database between tests
    const collections = connection.collections;
    for (const key in collections) {
      const collection = collections[key];
      await collection.deleteMany({});
    }

    // Ensure Future Vision and Marathon communities don't exist (onModuleInit might have created them)
    await communityModel.deleteMany({ typeTag: 'future-vision' });
    await communityModel.deleteMany({ typeTag: 'marathon-of-good' });

    // Create Future Vision and Marathon communities FIRST
    // This prevents onModuleInit from trying to create them
    await communityModel.create([
      {
        id: marathonCommunityId,
        name: 'Marathon of Good',
        typeTag: 'marathon-of-good',
        members: [],
        settings: {
          dailyEmission: 10,
          currencyNames: { singular: 'merit', plural: 'merits', genitive: 'merits' },
        },
        votingRules: {
          allowedRoles: ['superadmin', 'lead', 'participant', 'viewer'],
          canVoteForOwnPosts: false,
          participantsCannotVoteForLead: false,
          spendsMerits: true,
          awardsMerits: true,
        },
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        id: visionCommunityId,
        name: 'Future Vision',
        typeTag: 'future-vision',
        members: [],
        settings: {
          dailyEmission: 10,
          currencyNames: { singular: 'merit', plural: 'merits', genitive: 'merits' },
        },
        votingRules: {
          allowedRoles: ['superadmin', 'lead', 'participant', 'viewer'],
          canVoteForOwnPosts: false,
          participantsCannotVoteForLead: false,
          spendsMerits: true,
          awardsMerits: true,
        },
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ]);

    // Create users
    await userModel.create([
      {
        id: participant1Id,
        authProvider: 'telegram',
        authId: `tg-${participant1Id}`,
        displayName: 'Participant 1',
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        id: participant2Id,
        authProvider: 'telegram',
        authId: `tg-${participant2Id}`,
        displayName: 'Participant 2',
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        id: lead1Id,
        authProvider: 'telegram',
        authId: `tg-${lead1Id}`,
        displayName: 'Lead 1',
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        id: lead2Id,
        authProvider: 'telegram',
        authId: `tg-${lead2Id}`,
        displayName: 'Lead 2',
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        id: superadminId,
        authProvider: 'telegram',
        authId: `tg-${superadminId}`,
        displayName: 'Superadmin',
        globalRole: 'superadmin',
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        id: viewerId,
        authProvider: 'telegram',
        authId: `tg-${viewerId}`,
        displayName: 'Viewer',
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        id: nonTeamMemberId,
        authProvider: 'telegram',
        authId: `tg-${nonTeamMemberId}`,
        displayName: 'Non Team Member',
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ]);

    // Create remaining communities
    await communityModel.create([
      {
        id: regularCommunityId,
        name: 'Regular Community',
        typeTag: 'custom',
        members: [],
        settings: {
          dailyEmission: 10,
          currencyNames: { singular: 'merit', plural: 'merits', genitive: 'merits' },
        },
        votingRules: {
          allowedRoles: ['superadmin', 'lead', 'participant', 'viewer'],
          canVoteForOwnPosts: false,
          participantsCannotVoteForLead: false,
          spendsMerits: true,
          awardsMerits: true,
        },
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        id: team1CommunityId,
        name: 'Team 1 Community',
        typeTag: 'team',
        members: [],
        settings: {
          dailyEmission: 10,
          currencyNames: { singular: 'merit', plural: 'merits', genitive: 'merits' },
        },
        votingRules: {
          allowedRoles: ['superadmin', 'lead', 'participant', 'viewer'],
          canVoteForOwnPosts: false,
          participantsCannotVoteForLead: false,
          spendsMerits: true,
          awardsMerits: true,
        },
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        id: team2CommunityId,
        name: 'Team 2 Community',
        typeTag: 'team',
        members: [],
        settings: {
          dailyEmission: 10,
          currencyNames: { singular: 'merit', plural: 'merits', genitive: 'merits' },
        },
        votingRules: {
          allowedRoles: ['superadmin', 'lead', 'participant', 'viewer'],
          canVoteForOwnPosts: false,
          participantsCannotVoteForLead: false,
          spendsMerits: true,
          awardsMerits: true,
        },
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ]);

    // Create user community roles
    const now = new Date();
    await userCommunityRoleModel.create([
      { id: uid(), userId: participant1Id, communityId: marathonCommunityId, role: 'participant', createdAt: now, updatedAt: now },
      { id: uid(), userId: participant1Id, communityId: visionCommunityId, role: 'participant', createdAt: now, updatedAt: now },
      { id: uid(), userId: participant1Id, communityId: regularCommunityId, role: 'participant', createdAt: now, updatedAt: now },
      { id: uid(), userId: participant1Id, communityId: team1CommunityId, role: 'participant', createdAt: now, updatedAt: now },
      { id: uid(), userId: participant2Id, communityId: marathonCommunityId, role: 'participant', createdAt: now, updatedAt: now },
      { id: uid(), userId: participant2Id, communityId: visionCommunityId, role: 'participant', createdAt: now, updatedAt: now },
      { id: uid(), userId: participant2Id, communityId: regularCommunityId, role: 'participant', createdAt: now, updatedAt: now },
      { id: uid(), userId: participant2Id, communityId: team2CommunityId, role: 'participant', createdAt: now, updatedAt: now },
      { id: uid(), userId: lead1Id, communityId: marathonCommunityId, role: 'lead', createdAt: now, updatedAt: now },
      { id: uid(), userId: lead1Id, communityId: visionCommunityId, role: 'lead', createdAt: now, updatedAt: now },
      { id: uid(), userId: lead1Id, communityId: regularCommunityId, role: 'lead', createdAt: now, updatedAt: now },
      { id: uid(), userId: lead1Id, communityId: team1CommunityId, role: 'lead', createdAt: now, updatedAt: now },
      { id: uid(), userId: lead2Id, communityId: marathonCommunityId, role: 'lead', createdAt: now, updatedAt: now },
      { id: uid(), userId: lead2Id, communityId: visionCommunityId, role: 'lead', createdAt: now, updatedAt: now },
      { id: uid(), userId: lead2Id, communityId: regularCommunityId, role: 'lead', createdAt: now, updatedAt: now },
      { id: uid(), userId: lead2Id, communityId: team2CommunityId, role: 'lead', createdAt: now, updatedAt: now },
      { id: uid(), userId: viewerId, communityId: marathonCommunityId, role: 'viewer', createdAt: now, updatedAt: now },
      { id: uid(), userId: viewerId, communityId: visionCommunityId, role: 'viewer', createdAt: now, updatedAt: now },
      { id: uid(), userId: viewerId, communityId: regularCommunityId, role: 'viewer', createdAt: now, updatedAt: now },
    ]);

    // Create publications
    const marathonPub = await publicationService.createPublication(lead1Id, {
      communityId: marathonCommunityId,
      content: 'Marathon publication',
      type: 'text',
    });
    marathonPubId = marathonPub.getId.getValue();

    const visionPub = await publicationService.createPublication(participant1Id, {
      communityId: visionCommunityId,
      content: 'Vision publication',
      type: 'text',
    });
    visionPubId = visionPub.getId.getValue();

    const regularPub = await publicationService.createPublication(lead2Id, {
      communityId: regularCommunityId,
      content: 'Regular publication',
      type: 'text',
    });
    regularPubId = regularPub.getId.getValue();

    const team1Pub = await publicationService.createPublication(participant1Id, {
      communityId: team1CommunityId,
      content: 'Team 1 publication',
      type: 'text',
    });
    team1PubId = team1Pub.getId.getValue();
  });

  afterAll(async () => {
    await app.close();
    await testDb.stop();
  });

  describe('Outside Team Communities', () => {
    describe('Participants', () => {
      it('should allow participant to vote for lead from same team in regular communities (restriction is special-groups only)', async () => {
        // Create a publication by lead1 (same team as participant1) in a regular community
        const pub = await publicationService.createPublication(lead1Id, {
          communityId: regularCommunityId,
          content: 'Lead 1 publication',
          type: 'text',
        });

        const canVote = await permissionService.canVote(participant1Id, pub.getId.getValue());
        expect(canVote).toBe(true);
      });

      it('should allow participant to vote for lead from different team', async () => {
        const canVote = await permissionService.canVote(participant1Id, regularPubId);
        expect(canVote).toBe(true); // lead2 is from different team
      });

      it('should allow participant to vote for participant from different team', async () => {
        // Create publication by participant2 (different team)
        const pub = await publicationService.createPublication(participant2Id, {
          communityId: regularCommunityId,
          content: 'Participant 2 publication',
          type: 'text',
        });

        const canVote = await permissionService.canVote(participant1Id, pub.getId.getValue());
        expect(canVote).toBe(true);
      });

      it('should allow participant to vote for participant from marathon community', async () => {
        // Create publication by participant2 in marathon community
        const pub = await publicationService.createPublication(participant2Id, {
          communityId: marathonCommunityId,
          content: 'Marathon participant publication',
          type: 'text',
        });

        const canVote = await permissionService.canVote(participant1Id, pub.getId.getValue());
        expect(canVote).toBe(true);
      });

      it('should allow participant to vote for participant from vision community', async () => {
        // Create publication by participant2 in vision community
        const pub = await publicationService.createPublication(participant2Id, {
          communityId: visionCommunityId,
          content: 'Vision participant publication',
          type: 'text',
        });

        const canVote = await permissionService.canVote(participant1Id, pub.getId.getValue());
        expect(canVote).toBe(true);
      });

      it('should NOT allow participant to vote for teammate (lead) in marathon-of-good', async () => {
        // marathonPubId is authored by lead1, and participant1 shares team1 with lead1
        const canVote = await permissionService.canVote(participant1Id, marathonPubId);
        expect(canVote).toBe(false);
      });

      it('should NOT allow participant to vote for teammate (lead) in future-vision', async () => {
        const pub = await publicationService.createPublication(lead1Id, {
          communityId: visionCommunityId,
          content: 'Vision lead publication',
          type: 'text',
        });

        const canVote = await permissionService.canVote(participant1Id, pub.getId.getValue());
        expect(canVote).toBe(false);
      });

      it('should allow participant to vote for non-teammate in future-vision', async () => {
        // participant2 is in a different team than participant1 in this test setup
        const pub = await publicationService.createPublication(participant2Id, {
          communityId: visionCommunityId,
          content: 'Vision participant 2 publication',
          type: 'text',
        });

        const canVote = await permissionService.canVote(participant1Id, pub.getId.getValue());
        expect(canVote).toBe(true);
      });

      it('should allow participant to vote for own effective beneficiary in Future Vision (exception)', async () => {
        // Participant1 can vote for their own post in Future Vision
        const pub = await publicationService.createPublication(participant1Id, {
          communityId: visionCommunityId,
          content: 'Participant 1 Future Vision publication',
          type: 'text',
        });

        const canVote = await permissionService.canVote(participant1Id, pub.getId.getValue());
        expect(canVote).toBe(true); // Exception: Future Vision allows self-voting for participants
      });

      it('should not allow participant to vote for own effective beneficiary in regular communities', async () => {
        const pub = await publicationService.createPublication(participant1Id, {
          communityId: regularCommunityId,
          content: 'Participant 1 regular publication',
          type: 'text',
        });

        const canVote = await permissionService.canVote(participant1Id, pub.getId.getValue());
        expect(canVote).toBe(false); // No exception for regular communities
      });

      it('should allow participant to vote for their own post if there is a different beneficiary', async () => {
        // Create publication by participant1 with participant2 as beneficiary
        const pub = await publicationService.createPublication(participant1Id, {
          communityId: regularCommunityId,
          content: 'Post with beneficiary',
          type: 'text',
          beneficiaryId: participant2Id, // Different beneficiary
        });

        // Participant1 (author) can vote because effective beneficiary is participant2 (different)
        const canVote = await permissionService.canVote(participant1Id, pub.getId.getValue());
        expect(canVote).toBe(true); // Can vote because effective beneficiary != author
      });

      it('should not allow participant to vote for post where they are the beneficiary', async () => {
        // Create publication by participant2 with participant1 as beneficiary
        const pub = await publicationService.createPublication(participant2Id, {
          communityId: regularCommunityId,
          content: 'Post where participant1 is beneficiary',
          type: 'text',
          beneficiaryId: participant1Id, // Participant1 is beneficiary
        });

        // Participant1 (beneficiary) cannot vote because effective beneficiary = participant1
        const canVote = await permissionService.canVote(participant1Id, pub.getId.getValue());
        expect(canVote).toBe(false); // Cannot vote for own effective beneficiary
      });
    });

    describe('Leads', () => {
      it('should allow lead to vote for anything except own effective beneficiary', async () => {
        const canVote = await permissionService.canVote(lead1Id, regularPubId);
        expect(canVote).toBe(true);
      });

      it('should not allow lead to vote for own effective beneficiary (own posts)', async () => {
        const canVote = await permissionService.canVote(lead1Id, marathonPubId);
        expect(canVote).toBe(false);
      });

      it('should allow lead to vote for own effective beneficiary in Future Vision (exception)', async () => {
        // Lead1 can vote for their own post in Future Vision
        const pub = await publicationService.createPublication(lead1Id, {
          communityId: visionCommunityId,
          content: 'Lead 1 Future Vision publication',
          type: 'text',
        });

        const canVote = await permissionService.canVote(lead1Id, pub.getId.getValue());
        expect(canVote).toBe(true); // Exception: Future Vision allows self-voting for leads
      });
    });

    describe('Superadmin', () => {
      it('should allow superadmin to vote for anything except own effective beneficiary', async () => {
        const canVote = await permissionService.canVote(superadminId, regularPubId);
        expect(canVote).toBe(true);
      });

      it('should not allow superadmin to vote for own effective beneficiary (own posts)', async () => {
        const pub = await publicationService.createPublication(superadminId, {
          communityId: regularCommunityId,
          content: 'Superadmin publication',
          type: 'text',
        });

        const canVote = await permissionService.canVote(superadminId, pub.getId.getValue());
        expect(canVote).toBe(false);
      });

      it('should allow superadmin to vote for own effective beneficiary in Future Vision (exception)', async () => {
        const pub = await publicationService.createPublication(superadminId, {
          communityId: visionCommunityId,
          content: 'Superadmin Future Vision publication',
          type: 'text',
        });

        const canVote = await permissionService.canVote(superadminId, pub.getId.getValue());
        expect(canVote).toBe(true); // Exception: Future Vision allows self-voting for superadmin
      });
    });

    describe('Viewers', () => {
      it('should allow viewer to vote for leads in marathon-of-good community', async () => {
        const canVote = await permissionService.canVote(viewerId, marathonPubId);
        expect(canVote).toBe(true);
      });

      it('should not allow viewer to vote in regular communities', async () => {
        const canVote = await permissionService.canVote(viewerId, regularPubId);
        expect(canVote).toBe(false);
      });

      it('should not allow viewer to vote in future-vision community', async () => {
        const canVote = await permissionService.canVote(viewerId, visionPubId);
        expect(canVote).toBe(false);
      });

      it('should not allow viewer to vote for own posts', async () => {
        const pub = await publicationService.createPublication(viewerId, {
          communityId: marathonCommunityId,
          content: 'Viewer publication',
          type: 'text',
        });

        const canVote = await permissionService.canVote(viewerId, pub.getId.getValue());
        expect(canVote).toBe(false);
      });
    });
  });

  describe('Inside Team Communities', () => {
    it('should allow team member (participant) to vote for other team members', async () => {
      // Create publication by lead1 (same team)
      const pub = await publicationService.createPublication(lead1Id, {
        communityId: team1CommunityId,
        content: 'Team lead publication',
        type: 'text',
      });

      const canVote = await permissionService.canVote(participant1Id, pub.getId.getValue());
      expect(canVote).toBe(true);
    });

    it('should not allow team member (participant) to vote for themselves', async () => {
      const canVote = await permissionService.canVote(participant1Id, team1PubId);
      expect(canVote).toBe(false);
    });

    it('should allow team lead to vote for team participants', async () => {
      const canVote = await permissionService.canVote(lead1Id, team1PubId);
      expect(canVote).toBe(true);
    });

    it('should not allow team lead to vote for themselves', async () => {
      const pub = await publicationService.createPublication(lead1Id, {
        communityId: team1CommunityId,
        content: 'Team lead own publication',
        type: 'text',
      });

      const canVote = await permissionService.canVote(lead1Id, pub.getId.getValue());
      expect(canVote).toBe(false);
    });

    it('should not allow non-team members to vote in team community', async () => {
      const canVote = await permissionService.canVote(nonTeamMemberId, team1PubId);
      expect(canVote).toBe(false);
    });

    it('should not allow participant from different team to vote in team community', async () => {
      const canVote = await permissionService.canVote(participant2Id, team1PubId);
      expect(canVote).toBe(false);
    });
  });
});

