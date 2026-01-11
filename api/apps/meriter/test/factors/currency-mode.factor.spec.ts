import { Test, TestingModule } from '@nestjs/testing';
import { CurrencyModeFactor } from '../../src/domain/services/factors/currency-mode.factor';
import { SocialCurrencyConstraintFactor } from '../../src/domain/services/factors/social-currency-constraint.factor';
import { ContextCurrencyModeFactor } from '../../src/domain/services/factors/context-currency-mode.factor';

describe('CurrencyModeFactor', () => {
  let factor: CurrencyModeFactor;
  let socialConstraintFactor: jest.Mocked<SocialCurrencyConstraintFactor>;
  let contextCurrencyModeFactor: jest.Mocked<ContextCurrencyModeFactor>;

  beforeEach(async () => {
    const mockSocialConstraintFactor = {
      evaluate: jest.fn(),
    };

    const mockContextCurrencyModeFactor = {
      evaluate: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CurrencyModeFactor,
        {
          provide: SocialCurrencyConstraintFactor,
          useValue: mockSocialConstraintFactor,
        },
        {
          provide: ContextCurrencyModeFactor,
          useValue: mockContextCurrencyModeFactor,
        },
      ],
    }).compile();

    factor = module.get<CurrencyModeFactor>(CurrencyModeFactor);
    socialConstraintFactor = module.get(SocialCurrencyConstraintFactor);
    contextCurrencyModeFactor = module.get(ContextCurrencyModeFactor);
  });

  describe('Composition logic', () => {
    it('should use social constraint when it applies (priority)', async () => {
      socialConstraintFactor.evaluate.mockResolvedValue({
        constraint: 'wallet-only',
        reason: 'Self-voting requires wallet merits only',
      });

      const result = await factor.evaluate({
        userId: 'user1',
        communityId: 'community1',
        effectiveBeneficiaryId: 'user1',
        community: { id: 'community1' } as any,
      });

      expect(result.allowedQuota).toBe(false);
      expect(result.allowedWallet).toBe(true);
      expect(result.requiredCurrency).toBe('wallet');
      expect(result.reason).toContain('Self-voting');
      expect(contextCurrencyModeFactor.evaluate).not.toHaveBeenCalled();
    });

    it('should use context currency mode when social constraint does not apply', async () => {
      socialConstraintFactor.evaluate.mockResolvedValue({
        constraint: null,
      });

      contextCurrencyModeFactor.evaluate.mockResolvedValue({
        allowedQuota: true,
        allowedWallet: true,
      });

      const result = await factor.evaluate({
        userId: 'user1',
        communityId: 'community1',
        effectiveBeneficiaryId: 'user2',
        community: { id: 'community1' } as any,
        targetType: 'publication',
        userRole: 'participant',
      });

      expect(result.allowedQuota).toBe(true);
      expect(result.allowedWallet).toBe(true);
      expect(contextCurrencyModeFactor.evaluate).toHaveBeenCalled();
    });

    it('should pass through context currency mode result when social constraint is null', async () => {
      socialConstraintFactor.evaluate.mockResolvedValue({
        constraint: null,
      });

      contextCurrencyModeFactor.evaluate.mockResolvedValue({
        allowedQuota: false,
        allowedWallet: true,
        requiredCurrency: 'wallet',
        reason: 'Future Vision only allows wallet voting',
      });

      const result = await factor.evaluate({
        userId: 'user1',
        communityId: 'community1',
        effectiveBeneficiaryId: 'user2',
        community: { id: 'community1', typeTag: 'future-vision' } as any,
        targetType: 'publication',
        userRole: 'participant',
      });

      expect(result.allowedQuota).toBe(false);
      expect(result.allowedWallet).toBe(true);
      expect(result.requiredCurrency).toBe('wallet');
      expect(result.reason).toContain('Future Vision');
    });
  });
});
