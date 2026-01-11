import { Test, TestingModule } from '@nestjs/testing';
import { RoleHierarchyFactor } from '../../src/domain/services/factors/role-hierarchy.factor';
import { CommunityService } from '../../src/domain/services/community.service';
import { PermissionService } from '../../src/domain/services/permission.service';
import { UserService } from '../../src/domain/services/user.service';
import { ActionType } from '../../src/domain/common/constants/action-types.constants';
import { GLOBAL_ROLE_SUPERADMIN } from '../../src/domain/common/constants/roles.constants';

describe('RoleHierarchyFactor', () => {
  let factor: RoleHierarchyFactor;
  let communityService: jest.Mocked<CommunityService>;
  let permissionService: jest.Mocked<PermissionService>;
  let userService: jest.Mocked<UserService>;

  const mockUser = {
    id: 'user1',
    globalRole: null as any,
  };

  const mockCommunity = {
    id: 'community1',
    typeTag: 'custom',
    votingSettings: {
      votingRestriction: 'any' as const,
      spendsMerits: true,
      awardsMerits: true,
    },
    permissionRules: [],
    settings: {},
  };

  beforeEach(async () => {
    const mockCommunityService = {
      getCommunity: jest.fn(),
      getEffectivePermissionRules: jest.fn(),
    };

    const mockPermissionService = {
      getUserRoleInCommunity: jest.fn(),
    };

    const mockUserService = {
      getUserById: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RoleHierarchyFactor,
        {
          provide: CommunityService,
          useValue: mockCommunityService,
        },
        {
          provide: PermissionService,
          useValue: mockPermissionService,
        },
        {
          provide: UserService,
          useValue: mockUserService,
        },
      ],
    }).compile();

    factor = module.get<RoleHierarchyFactor>(RoleHierarchyFactor);
    communityService = module.get(CommunityService);
    permissionService = module.get(PermissionService);
    userService = module.get(UserService);
  });

  describe('Superadmin bypass', () => {
    it('should allow superadmin to perform any action', async () => {
      userService.getUserById.mockResolvedValue({
        ...mockUser,
        globalRole: GLOBAL_ROLE_SUPERADMIN,
      } as any);

      const result = await factor.evaluate({
        userId: 'user1',
        communityId: 'community1',
        action: ActionType.VOTE,
        community: mockCommunity as any,
      });

      expect(result.allowed).toBe(true);
    });
  });

  describe('Role-based permissions', () => {
    beforeEach(() => {
      userService.getUserById.mockResolvedValue(mockUser as any);
      communityService.getCommunity.mockResolvedValue(mockCommunity as any);
    });

    it('should deny if user has no role', async () => {
      permissionService.getUserRoleInCommunity.mockResolvedValue(null);
      communityService.getEffectivePermissionRules.mockReturnValue([]);

      const result = await factor.evaluate({
        userId: 'user1',
        communityId: 'community1',
        action: ActionType.VOTE,
        community: mockCommunity as any,
      });

      expect(result.allowed).toBe(false);
      expect(result.reason).toContain('no role');
    });

    it('should allow if matching rule allows action', async () => {
      permissionService.getUserRoleInCommunity.mockResolvedValue('participant');
      communityService.getEffectivePermissionRules.mockReturnValue([
        {
          role: 'participant',
          action: ActionType.VOTE,
          allowed: true,
        },
      ] as any);

      const result = await factor.evaluate({
        userId: 'user1',
        communityId: 'community1',
        action: ActionType.VOTE,
        community: mockCommunity as any,
      });

      expect(result.allowed).toBe(true);
    });

    it('should deny if matching rule denies action', async () => {
      permissionService.getUserRoleInCommunity.mockResolvedValue('participant');
      communityService.getEffectivePermissionRules.mockReturnValue([
        {
          role: 'participant',
          action: ActionType.VOTE,
          allowed: false,
        },
      ] as any);

      const result = await factor.evaluate({
        userId: 'user1',
        communityId: 'community1',
        action: ActionType.VOTE,
        community: mockCommunity as any,
      });

      expect(result.allowed).toBe(false);
    });
  });

  describe('Voting restrictions', () => {
    beforeEach(() => {
      userService.getUserById.mockResolvedValue(mockUser as any);
      communityService.getCommunity.mockResolvedValue(mockCommunity as any);
      permissionService.getUserRoleInCommunity.mockResolvedValue('participant');
      communityService.getEffectivePermissionRules.mockReturnValue([
        {
          role: 'participant',
          action: ActionType.VOTE,
          allowed: true,
        },
      ] as any);
    });

    it('should block voting if not-same-team restriction applies and users share team communities', async () => {
      const communityWithRestriction = {
        ...mockCommunity,
        votingSettings: {
          ...mockCommunity.votingSettings,
          votingRestriction: 'not-same-team' as const,
        },
      };

      const result = await factor.evaluate({
        userId: 'user1',
        communityId: 'community1',
        action: ActionType.VOTE,
        community: communityWithRestriction as any,
        effectiveBeneficiaryId: 'user2',
        sharedTeamCommunities: ['team1'],
      });

      expect(result.allowed).toBe(false);
      expect(result.reason).toContain('not-same-team');
    });

    it('should allow voting if not-same-team restriction applies but users do not share team communities', async () => {
      const communityWithRestriction = {
        ...mockCommunity,
        votingSettings: {
          ...mockCommunity.votingSettings,
          votingRestriction: 'not-same-team' as const,
        },
      };

      const result = await factor.evaluate({
        userId: 'user1',
        communityId: 'community1',
        action: ActionType.VOTE,
        community: communityWithRestriction as any,
        effectiveBeneficiaryId: 'user2',
        sharedTeamCommunities: [],
      });

      expect(result.allowed).toBe(true);
    });

    it('should allow voting if restriction is "any"', async () => {
      const result = await factor.evaluate({
        userId: 'user1',
        communityId: 'community1',
        action: ActionType.VOTE,
        community: mockCommunity as any,
        effectiveBeneficiaryId: 'user2',
        sharedTeamCommunities: ['team1'],
      });

      expect(result.allowed).toBe(true);
    });
  });

  describe('Team communities', () => {
    beforeEach(() => {
      userService.getUserById.mockResolvedValue(mockUser as any);
      permissionService.getUserRoleInCommunity.mockResolvedValue('participant');
      communityService.getEffectivePermissionRules.mockReturnValue([
        {
          role: 'participant',
          action: ActionType.VOTE,
          allowed: true,
        },
      ] as any);
    });

    it('should deny if user is not a team member in team community', async () => {
      const teamCommunity = {
        ...mockCommunity,
        typeTag: 'team',
      };
      communityService.getCommunity.mockResolvedValue(teamCommunity as any);

      const result = await factor.evaluate({
        userId: 'user1',
        communityId: 'community1',
        action: ActionType.VOTE,
        community: teamCommunity as any,
        isTeamMember: false,
      });

      expect(result.allowed).toBe(false);
      expect(result.reason).toContain('team member');
    });

    it('should allow if user is a team member in team community', async () => {
      const teamCommunity = {
        ...mockCommunity,
        typeTag: 'team',
      };
      communityService.getCommunity.mockResolvedValue(teamCommunity as any);

      const result = await factor.evaluate({
        userId: 'user1',
        communityId: 'community1',
        action: ActionType.VOTE,
        community: teamCommunity as any,
        isTeamMember: true,
      });

      expect(result.allowed).toBe(true);
    });
  });
});
