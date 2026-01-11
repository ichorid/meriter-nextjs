import { Test, TestingModule } from '@nestjs/testing';
import { MeritDestinationFactor } from '../../src/domain/services/factors/merit-destination.factor';
import { CommunityService } from '../../src/domain/services/community.service';

describe('MeritDestinationFactor', () => {
  let factor: MeritDestinationFactor;
  let communityService: jest.Mocked<CommunityService>;

  beforeEach(async () => {
    const mockCommunityService = {
      getCommunity: jest.fn(),
      getCommunityByTypeTag: jest.fn(),
      getEffectiveVotingSettings: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        MeritDestinationFactor,
        {
          provide: CommunityService,
          useValue: mockCommunityService,
        },
      ],
    }).compile();

    factor = module.get<MeritDestinationFactor>(MeritDestinationFactor);
    communityService = module.get(CommunityService);
  });

  describe('Regular groups', () => {
    it('should route to same community wallet for regular groups', async () => {
      const community = {
        id: 'community1',
        typeTag: 'custom',
        settings: {
          currencyNames: {
            singular: 'merit',
            plural: 'merits',
            genitive: 'merits',
          },
        },
      };

      communityService.getEffectiveVotingSettings.mockReturnValue({
        awardsMerits: true,
      } as any);

      const result = await factor.evaluate(
        {
          userId: 'user1',
          communityId: 'community1',
          effectiveBeneficiaryId: 'user2',
          community: community as any,
        },
        100,
      );

      expect(result.destinations).toHaveLength(1);
      expect(result.destinations[0].userId).toBe('user2');
      expect(result.destinations[0].communityId).toBe('community1');
      expect(result.destinations[0].amount).toBe(100);
    });
  });

  describe('Marathon of Good', () => {
    it('should route to Future Vision wallet for Marathon of Good', async () => {
      const marathonCommunity = {
        id: 'marathon1',
        typeTag: 'marathon-of-good',
        settings: {
          currencyNames: {
            singular: 'merit',
            plural: 'merits',
            genitive: 'merits',
          },
        },
      };

      const futureVisionCommunity = {
        id: 'futureVision1',
        typeTag: 'future-vision',
        settings: {
          currencyNames: {
            singular: 'merit',
            plural: 'merits',
            genitive: 'merits',
          },
        },
      };

      communityService.getCommunityByTypeTag.mockResolvedValue(futureVisionCommunity as any);
      communityService.getEffectiveVotingSettings.mockReturnValue({
        awardsMerits: true,
      } as any);

      const result = await factor.evaluate(
        {
          userId: 'user1',
          communityId: 'marathon1',
          effectiveBeneficiaryId: 'user2',
          community: marathonCommunity as any,
        },
        100,
      );

      expect(result.destinations).toHaveLength(1);
      expect(result.destinations[0].userId).toBe('user2');
      expect(result.destinations[0].communityId).toBe('futureVision1');
      expect(result.destinations[0].amount).toBe(100);
    });
  });

  describe('Future Vision', () => {
    it('should return empty destinations for Future Vision', async () => {
      const community = {
        id: 'community1',
        typeTag: 'future-vision',
      };

      communityService.getEffectiveVotingSettings.mockReturnValue({
        awardsMerits: true,
      } as any);

      const result = await factor.evaluate(
        {
          userId: 'user1',
          communityId: 'community1',
          effectiveBeneficiaryId: 'user2',
          community: community as any,
        },
        100,
      );

      expect(result.destinations).toHaveLength(0);
    });
  });

  describe('Team communities', () => {
    it('should route to team community wallet', async () => {
      const community = {
        id: 'team1',
        typeTag: 'team',
        settings: {
          currencyNames: {
            singular: 'merit',
            plural: 'merits',
            genitive: 'merits',
          },
        },
      };

      communityService.getEffectiveVotingSettings.mockReturnValue({
        awardsMerits: true,
      } as any);

      const result = await factor.evaluate(
        {
          userId: 'user1',
          communityId: 'team1',
          effectiveBeneficiaryId: 'user2',
          community: community as any,
        },
        100,
      );

      expect(result.destinations).toHaveLength(1);
      expect(result.destinations[0].communityId).toBe('team1');
    });
  });

  describe('awardsMerits setting', () => {
    it('should return empty destinations if awardsMerits is false', async () => {
      const community = {
        id: 'community1',
        typeTag: 'custom',
      };

      communityService.getEffectiveVotingSettings.mockReturnValue({
        awardsMerits: false,
      } as any);

      const result = await factor.evaluate(
        {
          userId: 'user1',
          communityId: 'community1',
          effectiveBeneficiaryId: 'user2',
          community: community as any,
        },
        100,
      );

      expect(result.destinations).toHaveLength(0);
    });
  });

  describe('meritConversion setting', () => {
    it('should use custom merit conversion if set', async () => {
      const community = {
        id: 'community1',
        typeTag: 'custom',
        settings: {
          currencyNames: {
            singular: 'merit',
            plural: 'merits',
            genitive: 'merits',
          },
        },
      };

      const targetCommunity = {
        id: 'targetCommunity1',
        typeTag: 'custom',
        settings: {
          currencyNames: {
            singular: 'merit',
            plural: 'merits',
            genitive: 'merits',
          },
        },
      };

      communityService.getCommunity.mockResolvedValue(targetCommunity as any);
      communityService.getEffectiveVotingSettings.mockReturnValue({
        awardsMerits: true,
        meritConversion: {
          targetCommunityId: 'targetCommunity1',
          ratio: 2.0,
        },
      } as any);

      const result = await factor.evaluate(
        {
          userId: 'user1',
          communityId: 'community1',
          effectiveBeneficiaryId: 'user2',
          community: community as any,
        },
        100,
      );

      expect(result.destinations).toHaveLength(1);
      expect(result.destinations[0].communityId).toBe('targetCommunity1');
      expect(result.destinations[0].amount).toBe(200); // 100 * 2.0
    });
  });
});
