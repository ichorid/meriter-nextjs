import { NotFoundException } from '@nestjs/common';
import type {
  PublicationInvestment,
} from '../../../domain/models/publication/publication.schema';
import type { CommunityService } from '../../../domain/services/community.service';
import type { MeritResolverService } from '../../../domain/services/merit-resolver.service';
import type { WalletService } from '../../../domain/services/wallet.service';
import type {
  DistributeOnWithdrawalPort,
  DistributeOnWithdrawalResult,
} from '../../../domain/ports/distribute-on-withdrawal.port';
import type {
  HandlePostCloseInput,
  HandlePostClosePort,
  HandlePostCloseResult,
} from '../../../domain/ports/handle-post-close.port';
import type { InvestmentPersistencePort } from '../../../domain/ports/investment.persistence.port';

export type {
  HandlePostCloseInput,
  HandlePostCloseResult,
} from '../../../domain/ports/handle-post-close.port';

export type HandlePostCloseDeps = {
  investmentPersistence: InvestmentPersistencePort;
  walletService: WalletService;
  meritResolverService: MeritResolverService;
  communityService: CommunityService;
  distributeOnWithdrawalUseCase: DistributeOnWithdrawalPort;
};

/**
 * BC-08: close-time pool return and rating distribution for investing posts.
 * Mode A: pool + rating by contract. Mode B: proportional pool return then rating by contract.
 */
export class HandlePostCloseUseCase implements HandlePostClosePort {
  constructor(private readonly deps: HandlePostCloseDeps) {}

  async execute(input: HandlePostCloseInput): Promise<HandlePostCloseResult> {
    const { postId, session } = input;

    const post = await this.deps.investmentPersistence.findPublicationById(
      postId,
      session,
    );
    if (!post) {
      throw new NotFoundException('Publication not found');
    }

    const poolReturned: Array<{ investorId: string; amount: number }> = [];
    let ratingDistributed: DistributeOnWithdrawalResult = {
      authorAmount: 0,
      investorDistributions: [],
    };
    let totalRatingDistributed = 0;

    const investments = post.investments || [];
    const investingActive =
      post.investingEnabled === true && investments.length > 0;
    const currentPool = post.investmentPool ?? 0;
    const currentScore = post.metrics?.score ?? 0;
    const totalInvested = investments.reduce(
      (sum: number, inv: PublicationInvestment) => sum + inv.amount,
      0,
    );

    const distributeAllByContract = investingActive
      ? (await this.deps.communityService.getCommunity(post.communityId))?.settings
          ?.distributeAllByContractOnClose ?? true
      : false;

    if (investingActive && distributeAllByContract) {
      const totalToDistribute = currentScore + currentPool;
      await this.deps.investmentPersistence.updatePublication(
        postId,
        { set: { investmentPool: 0 } },
        session,
      );
      if (totalToDistribute > 0) {
        ratingDistributed = await this.deps.distributeOnWithdrawalUseCase.execute({
          postId,
          withdrawAmount: totalToDistribute,
          session,
          earningsReason: 'close',
        });
      }
      totalRatingDistributed = currentScore;
    } else if (
      investingActive &&
      !distributeAllByContract &&
      currentPool > 0 &&
      totalInvested > 0
    ) {
      const community = await this.deps.communityService.getCommunity(post.communityId);
      if (community) {
        const currency = community.settings?.currencyNames || {
          singular: 'merit',
          plural: 'merits',
          genitive: 'merits',
        };
        const targetCommunityId = this.deps.meritResolverService.getWalletCommunityId(
          community,
          'withdrawal',
        );

        let returnedTotal = 0;
        for (let i = 0; i < investments.length; i++) {
          const inv = investments[i];
          const share = (inv.amount / totalInvested) * currentPool;
          const amount = Math.floor(share);
          returnedTotal += amount;
          if (amount > 0) {
            poolReturned.push({ investorId: inv.investorId, amount });
            await this.deps.walletService.addTransaction(
              inv.investorId,
              targetCommunityId,
              'credit',
              amount,
              'personal',
              'investment_pool_return',
              postId,
              currency,
              `Investment pool return from closed post ${postId}`,
              session,
            );
          }
        }
        const remainder = currentPool - returnedTotal;
        if (remainder > 0 && poolReturned.length > 0) {
          poolReturned[0].amount += remainder;
          await this.deps.walletService.addTransaction(
            poolReturned[0].investorId,
            targetCommunityId,
            'credit',
            remainder,
            'personal',
            'investment_pool_return',
            postId,
            currency,
            `Investment pool return (remainder) from closed post ${postId}`,
            session,
          );
        }

        await this.deps.investmentPersistence.updatePublication(
          postId,
          { set: { investmentPool: 0 } },
          session,
        );

        await Promise.all(
          poolReturned.map((p) =>
            this.deps.investmentPersistence.updateInvestorEarnings(
              postId,
              p.investorId,
              p.amount,
              'pool_return',
              new Date(),
              session,
            ),
          ),
        );
      }
    } else if (
      investingActive &&
      !distributeAllByContract &&
      (currentPool === 0 || totalInvested === 0)
    ) {
      await this.deps.investmentPersistence.updatePublication(
        postId,
        { set: { investmentPool: 0 } },
        session,
      );
    }

    if (currentScore > 0 && investingActive && !distributeAllByContract) {
      ratingDistributed = await this.deps.distributeOnWithdrawalUseCase.execute({
        postId,
        withdrawAmount: currentScore,
        session,
        earningsReason: 'close',
      });
      totalRatingDistributed = currentScore;
    } else if (currentScore > 0 && !investingActive) {
      ratingDistributed = {
        authorAmount: currentScore,
        investorDistributions: [],
      };
      totalRatingDistributed = currentScore;
    }

    return {
      poolReturned,
      ratingDistributed,
      totalRatingDistributed,
    };
  }
}

export function createHandlePostCloseUseCase(
  deps: HandlePostCloseDeps,
): HandlePostCloseUseCase {
  return new HandlePostCloseUseCase(deps);
}
