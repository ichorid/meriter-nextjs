import { Test, TestingModule } from '@nestjs/testing';
import { SocialCurrencyConstraintFactor } from '../../src/domain/services/factors/social-currency-constraint.factor';

describe('SocialCurrencyConstraintFactor', () => {
  let factor: SocialCurrencyConstraintFactor;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [SocialCurrencyConstraintFactor],
    }).compile();

    factor = module.get<SocialCurrencyConstraintFactor>(SocialCurrencyConstraintFactor);
  });

  describe('Self-voting constraint', () => {
    it('should apply wallet-only constraint for self-voting', async () => {
      const community = {
        id: 'community1',
        typeTag: 'custom',
      };

      const result = await factor.evaluate({
        userId: 'user1',
        communityId: 'community1',
        effectiveBeneficiaryId: 'user1',
        community: community as any,
      });

      expect(result.constraint).toBe('wallet-only');
      expect(result.reason).toContain('Self-voting');
    });

    it('should apply wallet-only constraint even in regular communities', async () => {
      const community = {
        id: 'community1',
        typeTag: 'custom',
      };

      const result = await factor.evaluate({
        userId: 'user1',
        communityId: 'community1',
        effectiveBeneficiaryId: 'user1',
        community: community as any,
      });

      expect(result.constraint).toBe('wallet-only');
    });
  });

  describe('Teammate voting constraint', () => {
    it('should apply wallet-only constraint for teammate voting in Future Vision', async () => {
      const community = {
        id: 'community1',
        typeTag: 'future-vision',
      };

      const result = await factor.evaluate({
        userId: 'user1',
        communityId: 'community1',
        effectiveBeneficiaryId: 'user2',
        community: community as any,
        sharedTeamCommunities: ['team1'],
      });

      expect(result.constraint).toBe('wallet-only');
      expect(result.reason).toContain('teammates');
    });

    it('should apply wallet-only constraint for teammate voting in Marathon of Good', async () => {
      const community = {
        id: 'community1',
        typeTag: 'marathon-of-good',
      };

      const result = await factor.evaluate({
        userId: 'user1',
        communityId: 'community1',
        effectiveBeneficiaryId: 'user2',
        community: community as any,
        sharedTeamCommunities: ['team1'],
      });

      expect(result.constraint).toBe('wallet-only');
    });

    it('should not apply constraint if no shared team communities', async () => {
      const community = {
        id: 'community1',
        typeTag: 'future-vision',
      };

      const result = await factor.evaluate({
        userId: 'user1',
        communityId: 'community1',
        effectiveBeneficiaryId: 'user2',
        community: community as any,
        sharedTeamCommunities: [],
      });

      expect(result.constraint).toBeNull();
    });

    it('should not apply constraint for teammate voting in regular communities', async () => {
      const community = {
        id: 'community1',
        typeTag: 'custom',
      };

      const result = await factor.evaluate({
        userId: 'user1',
        communityId: 'community1',
        effectiveBeneficiaryId: 'user2',
        community: community as any,
        sharedTeamCommunities: ['team1'],
      });

      expect(result.constraint).toBeNull();
    });
  });

  describe('Others content', () => {
    it('should return null constraint for voting on others content', async () => {
      const community = {
        id: 'community1',
        typeTag: 'custom',
      };

      const result = await factor.evaluate({
        userId: 'user1',
        communityId: 'community1',
        effectiveBeneficiaryId: 'user2',
        community: community as any,
      });

      expect(result.constraint).toBeNull();
    });
  });

  describe('Priority order', () => {
    it('should prioritize self-voting over teammate voting', async () => {
      const community = {
        id: 'community1',
        typeTag: 'future-vision',
      };

      // Even if they share team communities, self-voting should still apply
      const result = await factor.evaluate({
        userId: 'user1',
        communityId: 'community1',
        effectiveBeneficiaryId: 'user1', // Self-voting
        community: community as any,
        sharedTeamCommunities: ['team1'],
      });

      expect(result.constraint).toBe('wallet-only');
      expect(result.reason).toContain('Self-voting');
    });
  });
});
