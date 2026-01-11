import { Test, TestingModule } from '@nestjs/testing';
import { VoteFactorService } from '../src/domain/services/vote-factor.service';
import { RoleHierarchyFactor } from '../src/domain/services/factors/role-hierarchy.factor';
import { SocialCurrencyConstraintFactor } from '../src/domain/services/factors/social-currency-constraint.factor';
import { ContextCurrencyModeFactor } from '../src/domain/services/factors/context-currency-mode.factor';
import { CurrencyModeFactor } from '../src/domain/services/factors/currency-mode.factor';
import { MeritDestinationFactor } from '../src/domain/services/factors/merit-destination.factor';
import { PermissionContextService } from '../src/domain/services/permission-context.service';
import { PermissionService } from '../src/domain/services/permission.service';
import { CommunityService } from '../src/domain/services/community.service';
import { ActionType } from '../src/domain/common/constants/action-types.constants';

describe('VoteFactorService', () => {
  let service: VoteFactorService;
  let roleHierarchyFactor: jest.Mocked<RoleHierarchyFactor>;
  let socialConstraintFactor: jest.Mocked<SocialCurrencyConstraintFactor>;
  let contextCurrencyModeFactor: jest.Mocked<ContextCurrencyModeFactor>;
  let currencyModeFactor: jest.Mocked<CurrencyModeFactor>;
  let meritDestinationFactor: jest.Mocked<MeritDestinationFactor>;
  let permissionService: jest.Mocked<PermissionService>;
  let communityService: jest.Mocked<CommunityService>;

  beforeEach(async () => {
    const mockRoleHierarchyFactor = {
      evaluate: jest.fn(),
    };

    const mockSocialConstraintFactor = {
      evaluate: jest.fn(),
    };

    const mockContextCurrencyModeFactor = {
      evaluate: jest.fn(),
    };

    const mockCurrencyModeFactor = {
      evaluate: jest.fn(),
    };

    const mockMeritDestinationFactor = {
      evaluate: jest.fn(),
    };

    const mockPermissionContextService = {};

    const mockPermissionService = {
      getUserRoleInCommunity: jest.fn(),
    };

    const mockCommunityService = {
      getCommunity: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        VoteFactorService,
        {
          provide: RoleHierarchyFactor,
          useValue: mockRoleHierarchyFactor,
        },
        {
          provide: SocialCurrencyConstraintFactor,
          useValue: mockSocialConstraintFactor,
        },
        {
          provide: ContextCurrencyModeFactor,
          useValue: mockContextCurrencyModeFactor,
        },
        {
          provide: CurrencyModeFactor,
          useValue: mockCurrencyModeFactor,
        },
        {
          provide: MeritDestinationFactor,
          useValue: mockMeritDestinationFactor,
        },
        {
          provide: PermissionContextService,
          useValue: mockPermissionContextService,
        },
        {
          provide: PermissionService,
          useValue: mockPermissionService,
        },
        {
          provide: CommunityService,
          useValue: mockCommunityService,
        },
      ],
    }).compile();

    service = module.get<VoteFactorService>(VoteFactorService);
    roleHierarchyFactor = module.get(RoleHierarchyFactor);
    socialConstraintFactor = module.get(SocialCurrencyConstraintFactor);
    contextCurrencyModeFactor = module.get(ContextCurrencyModeFactor);
    currencyModeFactor = module.get(CurrencyModeFactor);
    meritDestinationFactor = module.get(MeritDestinationFactor);
    permissionService = module.get(PermissionService);
    communityService = module.get(CommunityService);
  });

  describe('evaluateRoleHierarchy', () => {
    it('should delegate to RoleHierarchyFactor', async () => {
      const mockCommunity = { id: 'community1' };
      communityService.getCommunity.mockResolvedValue(mockCommunity as any);

      roleHierarchyFactor.evaluate.mockResolvedValue({
        allowed: true,
      });

      const result = await service.evaluateRoleHierarchy(
        'user1',
        'community1',
        ActionType.VOTE,
      );

      expect(result.allowed).toBe(true);
      expect(roleHierarchyFactor.evaluate).toHaveBeenCalled();
    });
  });

  describe('evaluateCurrencyMode', () => {
    it('should delegate to CurrencyModeFactor', async () => {
      const mockCommunity = { id: 'community1' };
      communityService.getCommunity.mockResolvedValue(mockCommunity as any);

      currencyModeFactor.evaluate.mockResolvedValue({
        allowedQuota: true,
        allowedWallet: true,
      });

      const result = await service.evaluateCurrencyMode(
        'user1',
        'community1',
        'user2',
        'publication',
        'basic',
        false,
        'up',
        'participant',
        [],
      );

      expect(result.allowedQuota).toBe(true);
      expect(result.allowedWallet).toBe(true);
      expect(currencyModeFactor.evaluate).toHaveBeenCalled();
    });
  });

  describe('evaluateMeritDestination', () => {
    it('should delegate to MeritDestinationFactor', async () => {
      const mockCommunity = { id: 'community1' };
      communityService.getCommunity.mockResolvedValue(mockCommunity as any);

      meritDestinationFactor.evaluate.mockResolvedValue({
        destinations: [{
          userId: 'user2',
          communityId: 'community1',
          amount: 100,
          currency: { singular: 'merit', plural: 'merits', genitive: 'merits' },
        }],
      });

      const result = await service.evaluateMeritDestination(
        'community1',
        'user2',
        100,
      );

      expect(result.destinations).toHaveLength(1);
      expect(meritDestinationFactor.evaluate).toHaveBeenCalled();
    });
  });

  describe('evaluateAllFactors', () => {
    it('should evaluate all factors and return combined result', async () => {
      const mockCommunity = { id: 'community1' };
      communityService.getCommunity.mockResolvedValue(mockCommunity as any);
      permissionService.getUserRoleInCommunity.mockResolvedValue('participant');

      roleHierarchyFactor.evaluate.mockResolvedValue({
        allowed: true,
      });

      socialConstraintFactor.evaluate.mockResolvedValue({
        constraint: null,
      });

      contextCurrencyModeFactor.evaluate.mockResolvedValue({
        allowedQuota: true,
        allowedWallet: true,
      });

      currencyModeFactor.evaluate.mockResolvedValue({
        allowedQuota: true,
        allowedWallet: true,
      });

      meritDestinationFactor.evaluate.mockResolvedValue({
        destinations: [],
      });

      const result = await service.evaluateAllFactors(
        'user1',
        'community1',
        ActionType.VOTE,
        'user2',
        'publication',
      );

      expect(result.roleHierarchy.allowed).toBe(true);
      expect(result.socialConstraint.constraint).toBeNull();
      expect(result.contextCurrency.allowedQuota).toBe(true);
      expect(result.currencyMode.allowedQuota).toBe(true);
      expect(result.meritDestination.destinations).toEqual([]);
    });
  });
});
