import { Test, TestingModule } from '@nestjs/testing';
import { ContextCurrencyModeFactor } from '../../src/domain/services/factors/context-currency-mode.factor';
import { CommunityService } from '../../src/domain/services/community.service';

describe('ContextCurrencyModeFactor', () => {
  let factor: ContextCurrencyModeFactor;
  let communityService: jest.Mocked<CommunityService>;

  beforeEach(async () => {
    const mockCommunityService = {
      getEffectiveMeritSettings: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ContextCurrencyModeFactor,
        {
          provide: CommunityService,
          useValue: mockCommunityService,
        },
      ],
    }).compile();

    factor = module.get<ContextCurrencyModeFactor>(ContextCurrencyModeFactor);
    communityService = module.get(CommunityService);
  });

  describe('Marathon of Good', () => {
    it('should return quota-only for post/comment in Marathon of Good', async () => {
      const community = {
        id: 'community1',
        typeTag: 'marathon-of-good',
      };

      const result = await factor.evaluate({
        userId: 'user1',
        communityId: 'community1',
        community: community as any,
        targetType: 'publication',
        userRole: 'participant',
      });

      expect(result.allowedQuota).toBe(true);
      expect(result.allowedWallet).toBe(false);
      expect(result.requiredCurrency).toBe('quota');
    });
  });

  describe('Future Vision', () => {
    it('should return wallet-only for post/comment in Future Vision', async () => {
      const community = {
        id: 'community1',
        typeTag: 'future-vision',
      };

      const result = await factor.evaluate({
        userId: 'user1',
        communityId: 'community1',
        community: community as any,
        targetType: 'publication',
        userRole: 'participant',
      });

      expect(result.allowedQuota).toBe(false);
      expect(result.allowedWallet).toBe(true);
      expect(result.requiredCurrency).toBe('wallet');
    });
  });

  describe('Projects', () => {
    it('should return wallet-only for projects', async () => {
      const community = {
        id: 'community1',
        typeTag: 'custom',
      };

      const result = await factor.evaluate({
        userId: 'user1',
        communityId: 'community1',
        community: community as any,
        targetType: 'publication',
        postType: 'project',
        isProject: true,
        userRole: 'participant',
      });

      expect(result.allowedQuota).toBe(false);
      expect(result.allowedWallet).toBe(true);
      expect(result.requiredCurrency).toBe('wallet');
    });
  });

  describe('Downvotes', () => {
    it('should return wallet-only for downvotes', async () => {
      const community = {
        id: 'community1',
        typeTag: 'custom',
      };

      const result = await factor.evaluate({
        userId: 'user1',
        communityId: 'community1',
        community: community as any,
        targetType: 'publication',
        direction: 'down',
        userRole: 'participant',
      });

      expect(result.allowedQuota).toBe(false);
      expect(result.allowedWallet).toBe(true);
      expect(result.requiredCurrency).toBe('wallet');
    });
  });

  // Note: Viewer role has been removed - all users are now participants by default
  // Tests for viewer role have been removed as the role no longer exists

  describe('Default case', () => {
    it('should return both-allowed for default case', async () => {
      const community = {
        id: 'community1',
        typeTag: 'custom',
      };

      communityService.getEffectiveMeritSettings.mockReturnValue({
        quotaRecipients: ['participant', 'lead'],
        dailyQuota: 10,
      } as any);

      const result = await factor.evaluate({
        userId: 'user1',
        communityId: 'community1',
        community: community as any,
        targetType: 'publication',
        userRole: 'participant',
      });

      expect(result.allowedQuota).toBe(true);
      expect(result.allowedWallet).toBe(true);
      expect(result.requiredCurrency).toBeUndefined();
    });

    it('should respect quotaRecipients for default case', async () => {
      const community = {
        id: 'community1',
        typeTag: 'custom',
      };

      communityService.getEffectiveMeritSettings.mockReturnValue({
        quotaRecipients: ['lead'],
        dailyQuota: 10,
      } as any);

      const result = await factor.evaluate({
        userId: 'user1',
        communityId: 'community1',
        community: community as any,
        targetType: 'publication',
        userRole: 'participant',
      });

      expect(result.allowedQuota).toBe(false);
      expect(result.allowedWallet).toBe(true);
    });
  });
});
