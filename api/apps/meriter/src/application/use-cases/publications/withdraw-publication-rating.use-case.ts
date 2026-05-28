import { TRPCError } from '@trpc/server';
import { NotFoundError } from '../../../common/exceptions/api.exceptions';
import { GLOBAL_COMMUNITY_ID } from '../../../domain/common/constants/global.constant';
import type { CommunityService } from '../../../domain/services/community.service';
import type { CommunityWalletService } from '../../../domain/services/community-wallet.service';
import type { InvestmentService } from '../../../domain/services/investment.service';
import type { MeritResolverService } from '../../../domain/services/merit-resolver.service';
import type { PublicationService } from '../../../domain/services/publication.service';
import type { VoteService } from '../../../domain/services/vote.service';
import type { WalletService } from '../../../domain/services/wallet.service';

export type WithdrawPublicationRatingContext = {
  user: { id: string };
  publicationService: PublicationService;
  communityService: CommunityService;
  voteService: VoteService;
  investmentService: InvestmentService;
  communityWalletService: CommunityWalletService;
  meritResolverService: MeritResolverService;
  walletService: WalletService;
};

export type WithdrawPublicationRatingInput = {
  publicationId: string;
  amount: number;
};

export type WithdrawPublicationRatingResult = {
  amount: number;
  balance: number;
  message: string;
};

type CurrencyNames = { singular: string; plural: string; genitive: string };

const DEFAULT_CURRENCY: CurrencyNames = {
  singular: 'merit',
  plural: 'merits',
  genitive: 'merits',
};

/**
 * BC-03: withdraw merits from publication rating (metrics.score).
 * inv-04: closed posts cannot be modified (archive enforced).
 * inv-08: authorization and eligibility checks before wallet credit or score reduction.
 */
export class WithdrawPublicationRatingUseCase {
  constructor(private readonly ctx: WithdrawPublicationRatingContext) {}

  async execute(
    input: WithdrawPublicationRatingInput,
  ): Promise<WithdrawPublicationRatingResult> {
    const userId = this.ctx.user.id;
    const amount = input.amount;
    if (!amount || amount <= 0) {
      throw new TRPCError({
        code: 'BAD_REQUEST',
        message: 'Withdrawal amount must be greater than 0',
      });
    }

    const publication = await this.ctx.publicationService.getPublication(
      input.publicationId,
    );
    if (!publication) {
      throw new NotFoundError('Publication', input.publicationId);
    }

    const pubDoc = await this.ctx.publicationService.getPublicationDocument(
      input.publicationId,
    );
    if ((pubDoc?.status ?? 'active') === 'closed') {
      throw new TRPCError({
        code: 'BAD_REQUEST',
        message: 'This post is closed and cannot be modified',
      });
    }

    const postCommunityId = publication.getCommunityId.getValue();
    const postCommunity =
      await this.ctx.communityService.getCommunity(postCommunityId);
    if (postCommunity?.settings?.allowWithdraw === false) {
      throw new TRPCError({
        code: 'FORBIDDEN',
        message: 'Withdrawals are disabled in this community',
      });
    }

    const sourceEntityType = pubDoc?.sourceEntityType;
    const sourceEntityId = pubDoc?.sourceEntityId as string | undefined;
    const isBirzhaSourcePost =
      postCommunity?.typeTag === 'marathon-of-good' &&
      (sourceEntityType === 'project' || sourceEntityType === 'community') &&
      !!sourceEntityId;

    if (isBirzhaSourcePost) {
      if (!sourceEntityId) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'Source post is missing sourceEntityId',
        });
      }
      if (!(await this.ctx.communityService.isUserAdmin(sourceEntityId, userId))) {
        throw new TRPCError({
          code: 'FORBIDDEN',
          message: 'Only a source administrator can withdraw from this publication',
        });
      }
    } else {
      const canWithdraw = await this.ctx.voteService.canUserWithdraw(
        userId,
        'publication',
        input.publicationId,
      );
      if (!canWithdraw) {
        throw new TRPCError({
          code: 'FORBIDDEN',
          message: 'You are not authorized to withdraw from this publication',
        });
      }
    }

    const currentScore = publication.getMetrics.score;
    if (currentScore <= 0) {
      throw new TRPCError({
        code: 'BAD_REQUEST',
        message: 'No votes available to withdraw',
      });
    }

    if (amount > currentScore) {
      throw new TRPCError({
        code: 'BAD_REQUEST',
        message: `Insufficient votes to withdraw. Available: ${currentScore}, Requested: ${amount}`,
      });
    }

    const beneficiaryId = publication.getEffectiveBeneficiary().getValue();
    const communityId = publication.getCommunityId.getValue();

    const hasInvestments =
      pubDoc?.investments && pubDoc.investments.length > 0;

    let authorShare: number;
    if (hasInvestments && pubDoc?.investorSharePercent != null) {
      const distribution = await this.ctx.investmentService.distributeOnWithdrawal(
        input.publicationId,
        amount,
      );
      authorShare = distribution.authorAmount;
    } else {
      authorShare = amount;
    }

    let targetCommunityId: string;
    if (isBirzhaSourcePost && sourceEntityId) {
      await this.ctx.communityWalletService.createWallet(sourceEntityId);
      await this.ctx.communityWalletService.deposit(
        sourceEntityId,
        authorShare,
        'publication_withdrawal',
      );
      targetCommunityId = GLOBAL_COMMUNITY_ID;
    } else {
      const result = await this.processWithdrawal(
        beneficiaryId,
        communityId,
        input.publicationId,
        authorShare,
      );
      targetCommunityId = result.targetCommunityId;
    }

    await this.ctx.publicationService.reduceScore(input.publicationId, amount);

    const wallet = await this.ctx.walletService.getWallet(
      beneficiaryId,
      targetCommunityId,
    );
    const balance = wallet ? wallet.getBalance() : 0;

    return {
      amount,
      balance,
      message: 'Withdrawal successful',
    };
  }

  private async processWithdrawal(
    beneficiaryId: string,
    publicationCommunityId: string,
    publicationId: string,
    amount: number,
  ): Promise<{ targetCommunityId: string }> {
    const publicationCommunity =
      await this.ctx.communityService.getCommunity(publicationCommunityId);
    if (!publicationCommunity) {
      throw new NotFoundError('Community', publicationCommunityId);
    }

    const effectiveVotingSettings =
      this.ctx.communityService.getEffectiveVotingSettings(publicationCommunity);
    const targetCommunityId = this.ctx.meritResolverService.getWalletCommunityId(
      publicationCommunity,
      'withdrawal',
    );

    if (!effectiveVotingSettings.awardsMerits) {
      return { targetCommunityId };
    }

    const targetCommunity =
      targetCommunityId === GLOBAL_COMMUNITY_ID
        ? await this.ctx.communityService.getCommunity(GLOBAL_COMMUNITY_ID)
        : publicationCommunity;
    const currency = targetCommunity?.settings?.currencyNames ?? DEFAULT_CURRENCY;

    const description = `Withdrawal from publication ${publicationId}`;

    await this.ctx.walletService.addTransaction(
      beneficiaryId,
      targetCommunityId,
      'credit',
      amount,
      'personal',
      'publication_withdrawal',
      publicationId,
      currency,
      description,
    );

    return { targetCommunityId };
  }
}

export function createWithdrawPublicationRatingUseCase(
  ctx: WithdrawPublicationRatingContext,
): WithdrawPublicationRatingUseCase {
  return new WithdrawPublicationRatingUseCase(ctx);
}
