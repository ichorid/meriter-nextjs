import { autoWithdrawPublicationBalanceBeforeDelete } from '../src/trpc/routers/publications.router';

describe('autoWithdrawPublicationBalanceBeforeDelete', () => {
  it('should withdraw full available positive balance and reduce score', async () => {
    const publicationId = 'pub-1';
    const communityId = 'community-1';
    const beneficiaryId = 'beneficiary-1';

    const publication = {
      getMetrics: { score: 5 },
      getCommunityId: { getValue: () => communityId },
      getEffectiveBeneficiary: () => ({ getValue: () => beneficiaryId }),
    };

    const addTransaction = jest.fn().mockResolvedValue({});
    const reduceScore = jest.fn().mockResolvedValue({});

    const ctx = {
      communityService: {
        getCommunity: jest.fn().mockResolvedValue({
          id: communityId,
          typeTag: 'custom',
          settings: {
            currencyNames: { singular: 'merit', plural: 'merits', genitive: 'merits' },
          },
        }),
        getCommunityByTypeTag: jest.fn().mockResolvedValue(null),
        getEffectiveVotingSettings: jest.fn().mockReturnValue({
          awardsMerits: true,
        }),
      },
      walletService: {
        addTransaction,
        getWallet: jest.fn().mockResolvedValue(null),
      },
      publicationService: {
        reduceScore,
      },
    };

    const withdrawn = await autoWithdrawPublicationBalanceBeforeDelete(publicationId, publication, ctx);

    expect(withdrawn).toBe(5);
    expect(addTransaction).toHaveBeenCalledWith(
      beneficiaryId,
      communityId,
      'credit',
      5,
      'personal',
      'publication_withdrawal',
      publicationId,
      { singular: 'merit', plural: 'merits', genitive: 'merits' },
      expect.stringContaining(`Withdrawal from publication ${publicationId}`),
    );
    expect(reduceScore).toHaveBeenCalledWith(publicationId, 5);
  });

  it('should not withdraw when nothing is available', async () => {
    const publicationId = 'pub-2';

    const publication = {
      getMetrics: { score: 0 },
      getCommunityId: { getValue: () => 'community-1' },
      getEffectiveBeneficiary: () => ({ getValue: () => 'beneficiary-1' }),
    };

    const ctx = {
      communityService: {
        getCommunity: jest.fn(),
        getCommunityByTypeTag: jest.fn(),
        getEffectiveVotingSettings: jest.fn().mockReturnValue({
          awardsMerits: true,
        }),
      },
      walletService: {
        addTransaction: jest.fn(),
        getWallet: jest.fn().mockResolvedValue(null),
      },
      publicationService: {
        reduceScore: jest.fn(),
      },
    };

    const withdrawn = await autoWithdrawPublicationBalanceBeforeDelete(publicationId, publication, ctx);
    expect(withdrawn).toBe(0);
    expect(ctx.walletService.addTransaction).not.toHaveBeenCalled();
    expect(ctx.publicationService.reduceScore).not.toHaveBeenCalled();
  });
});


