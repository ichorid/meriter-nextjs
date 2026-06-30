import { NotFoundError } from '../../../common/exceptions/api.exceptions';
import { GLOBAL_COMMUNITY_ID } from '../../../domain/common/constants/global.constant';

type CurrencyNames = { singular: string; plural: string; genitive: string };

type WithdrawalContext = {
  communityService: {
    getCommunity(communityId: string): Promise<{
      id: string;
      settings?: {
        currencyNames?: CurrencyNames;
        allowWithdraw?: boolean;
      };
    } | null>;
    getEffectiveVotingSettings(community: {
      settings?: Record<string, unknown>;
    }): { awardsMerits: boolean };
  };
  walletContextResolverService: {
    resolvePersonalWalletCommunityId(
      community: unknown,
      op: 'withdrawal',
    ): Promise<string>;
  };
  walletService: {
    addTransaction(
      userId: string,
      communityId: string,
      type: 'credit' | 'debit',
      amount: number,
      sourceType: 'personal' | 'quota',
      referenceType: string,
      referenceId: string,
      currency: CurrencyNames,
      description?: string,
    ): Promise<unknown>;
  };
};

/**
 * Process withdrawal and credit wallet (quota/wallet routing via MeritResolver).
 */
export async function processPublicationWithdrawal(
  beneficiaryId: string,
  publicationCommunityId: string,
  publicationId: string,
  amount: number,
  referenceType: 'publication_withdrawal' | 'comment_withdrawal' | 'vote_withdrawal',
  ctx: WithdrawalContext,
): Promise<{ targetCommunityId: string; currency: CurrencyNames }> {
  const publicationCommunity = await ctx.communityService.getCommunity(publicationCommunityId);
  if (!publicationCommunity) {
    throw new NotFoundError('Community', publicationCommunityId);
  }

  const effectiveVotingSettings = ctx.communityService.getEffectiveVotingSettings(publicationCommunity);
  if (!effectiveVotingSettings.awardsMerits) {
    const currency = publicationCommunity.settings?.currencyNames || {
      singular: 'merit',
      plural: 'merits',
      genitive: 'merits',
    };
    const targetCommunityId =
      await ctx.walletContextResolverService.resolvePersonalWalletCommunityId(
        publicationCommunity,
        'withdrawal',
      );
    return { targetCommunityId, currency };
  }

  const targetCommunityId =
    await ctx.walletContextResolverService.resolvePersonalWalletCommunityId(
      publicationCommunity,
      'withdrawal',
    );

  const targetCommunity =
    targetCommunityId === GLOBAL_COMMUNITY_ID
      ? await ctx.communityService.getCommunity(GLOBAL_COMMUNITY_ID)
      : publicationCommunity;
  const currency = targetCommunity?.settings?.currencyNames || {
    singular: 'merit',
    plural: 'merits',
    genitive: 'merits',
  };

  const description = `Withdrawal from ${referenceType.replace('_withdrawal', '')} ${publicationId}`;

  await ctx.walletService.addTransaction(
    beneficiaryId,
    targetCommunityId,
    'credit',
    amount,
    'personal',
    referenceType,
    publicationId,
    currency,
    description,
  );

  return { targetCommunityId, currency };
}

export type PublicationForAutoWithdraw = {
  getMetrics: { score: number };
  getCommunityId: { getValue(): string };
  getEffectiveBeneficiary(): { getValue(): string };
};

export type AutoWithdrawContext = WithdrawalContext & {
  publicationService: {
    reduceScore(publicationId: string, amount: number): Promise<unknown>;
  };
};

export async function autoWithdrawPublicationBalanceBeforeDelete(
  publicationId: string,
  publication: PublicationForAutoWithdraw,
  ctx: AutoWithdrawContext,
): Promise<number> {
  const currentScore = publication.getMetrics.score;
  if (currentScore <= 0) return 0;

  const beneficiaryId = publication.getEffectiveBeneficiary().getValue();
  const communityId = publication.getCommunityId.getValue();

  const community = await ctx.communityService.getCommunity(communityId);
  if (community?.settings?.allowWithdraw === false) {
    return 0;
  }

  await processPublicationWithdrawal(
    beneficiaryId,
    communityId,
    publicationId,
    currentScore,
    'publication_withdrawal',
    ctx,
  );

  await ctx.publicationService.reduceScore(publicationId, currentScore);
  return currentScore;
}
