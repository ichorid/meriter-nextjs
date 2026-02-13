import { Test, TestingModule } from '@nestjs/testing';
import { MeritResolverService } from '../src/domain/services/merit-resolver.service';
import { GLOBAL_COMMUNITY_ID } from '../src/domain/common/constants/global.constant';

describe('MeritResolverService', () => {
  let service: MeritResolverService;

  const priorityCommunity = {
    id: 'marathon-id',
    typeTag: 'marathon-of-good',
  };

  const localCommunity = {
    id: 'team-id',
    typeTag: 'team',
  };

  beforeAll(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [MeritResolverService],
    }).compile();

    service = module.get<MeritResolverService>(MeritResolverService);
  });

  describe('fee operation', () => {
    it.each(['fee'] as const)('always returns GLOBAL for operationType "%s"', (op) => {
      expect(service.getWalletCommunityId(priorityCommunity, op)).toBe(GLOBAL_COMMUNITY_ID);
      expect(service.getWalletCommunityId(localCommunity, op)).toBe(GLOBAL_COMMUNITY_ID);
      expect(service.getWalletCommunityId(null, op)).toBe(GLOBAL_COMMUNITY_ID);
      expect(service.getWalletCommunityId(undefined, op)).toBe(GLOBAL_COMMUNITY_ID);
    });
  });

  describe('non-fee operations with priority community', () => {
    const operations = ['voting', 'withdrawal', 'tappalka_reward', 'investment'] as const;

    it.each(operations)('returns GLOBAL for "%s" with priority community', (op) => {
      expect(service.getWalletCommunityId(priorityCommunity, op)).toBe(GLOBAL_COMMUNITY_ID);
    });

    it('returns GLOBAL for community with isPriority=true', () => {
      const customPriority = { id: 'custom-id', typeTag: 'custom', isPriority: true };
      expect(service.getWalletCommunityId(customPriority, 'voting')).toBe(GLOBAL_COMMUNITY_ID);
    });
  });

  describe('non-fee operations with local community', () => {
    it.each(['voting', 'tappalka_reward', 'investment'] as const)(
      'returns community.id for "%s" with local community',
      (op) => {
        expect(service.getWalletCommunityId(localCommunity, op)).toBe('team-id');
      },
    );

    it('returns GLOBAL for "withdrawal" with local community (withdrawal always uses global wallet)', () => {
      expect(service.getWalletCommunityId(localCommunity, 'withdrawal')).toBe(GLOBAL_COMMUNITY_ID);
    });
  });

  describe('all priority typeTags', () => {
    it.each([
      ['marathon-of-good', 'md-id'],
      ['future-vision', 'fv-id'],
      ['team-projects', 'tp-id'],
      ['support', 'sup-id'],
    ] as const)('returns GLOBAL for typeTag "%s"', (typeTag, id) => {
      const community = { id, typeTag };
      expect(service.getWalletCommunityId(community, 'voting')).toBe(GLOBAL_COMMUNITY_ID);
      expect(service.getWalletCommunityId(community, 'withdrawal')).toBe(GLOBAL_COMMUNITY_ID);
    });
  });

  describe('null/undefined community for non-fee', () => {
    it('throws for null community', () => {
      expect(() => service.getWalletCommunityId(null, 'voting')).toThrow(
        'Community is required for non-fee merit operations',
      );
    });

    it('throws for undefined community on operations that require community', () => {
      // withdrawal does not require community (returns GLOBAL)
      expect(service.getWalletCommunityId(undefined, 'withdrawal')).toBe(GLOBAL_COMMUNITY_ID);
      // voting requires community
      expect(() => service.getWalletCommunityId(undefined, 'voting')).toThrow(
        'Community is required for non-fee merit operations',
      );
    });
  });
});
