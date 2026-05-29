import { Logger, NotFoundException } from '@nestjs/common';
import type {
  PublicationInvestment,
} from '../../../domain/models/publication/publication.schema';
import type { CommunityService } from '../../../domain/services/community.service';
import type { MeritResolverService } from '../../../domain/services/merit-resolver.service';
import type { NotificationService } from '../../../domain/services/notification.service';
import type { UserService } from '../../../domain/services/user.service';
import type { WalletService } from '../../../domain/services/wallet.service';
import { formatMeritsForDisplay } from '../../../common/helpers/format-merits.helper';
import type { InvestmentPersistencePort } from '../../../domain/ports/investment.persistence.port';
import type {
  DistributeOnWithdrawalInput,
  DistributeOnWithdrawalPort,
  DistributeOnWithdrawalResult,
} from '../../../domain/ports/distribute-on-withdrawal.port';

export type {
  DistributeOnWithdrawalInput,
  DistributeOnWithdrawalResult,
} from '../../../domain/ports/distribute-on-withdrawal.port';

export type DistributeOnWithdrawalDeps = {
  investmentPersistence: InvestmentPersistencePort;
  walletService: WalletService;
  meritResolverService: MeritResolverService;
  communityService: CommunityService;
  notificationService: NotificationService;
  userService: UserService;
};

/**
 * BC-08: split withdrawal/close amount between author and investors per contract.
 * C-4: investor shares rounded to 0.01; remainder to author.
 */
export class DistributeOnWithdrawalUseCase implements DistributeOnWithdrawalPort {
  private readonly logger = new Logger(DistributeOnWithdrawalUseCase.name);

  constructor(private readonly deps: DistributeOnWithdrawalDeps) {}

  async execute(
    input: DistributeOnWithdrawalInput,
  ): Promise<DistributeOnWithdrawalResult> {
    const {
      postId,
      withdrawAmount,
      session,
      earningsReason = 'withdrawal',
    } = input;

    const post = await this.deps.investmentPersistence.findPublicationById(
      postId,
      session,
    );
    if (!post) {
      throw new NotFoundException('Publication not found');
    }

    const investments = post.investments || [];
    if (investments.length === 0 || post.investingEnabled !== true) {
      return {
        authorAmount: withdrawAmount,
        investorDistributions: [],
      };
    }

    const investorSharePercent = post.investorSharePercent ?? 0;
    const totalInvested = investments.reduce(
      (sum: number, inv: PublicationInvestment) => sum + inv.amount,
      0,
    );
    if (totalInvested <= 0) {
      return {
        authorAmount: withdrawAmount,
        investorDistributions: [],
      };
    }

    const investorTotal = this.roundToHundredths(
      withdrawAmount * (investorSharePercent / 100),
    );

    const community = await this.deps.communityService.getCommunity(post.communityId);
    if (!community) {
      throw new NotFoundException('Community not found');
    }
    const currency = community.settings?.currencyNames || {
      singular: 'merit',
      plural: 'merits',
      genitive: 'merits',
    };

    const investorDistributions: Array<{ investorId: string; amount: number }> = [];
    let distributedTotal = 0;

    for (const inv of investments) {
      const share = investorTotal * (inv.amount / totalInvested);
      const amount = this.roundToHundredths(share);
      distributedTotal += amount;
      if (amount > 0) {
        investorDistributions.push({
          investorId: inv.investorId,
          amount,
        });
      }
    }

    const authorAmount = withdrawAmount - distributedTotal;

    const targetCommunityId = this.deps.meritResolverService.getWalletCommunityId(
      community,
      'withdrawal',
    );
    for (const dist of investorDistributions) {
      await this.deps.walletService.addTransaction(
        dist.investorId,
        targetCommunityId,
        'credit',
        dist.amount,
        'personal',
        'investment_distribution',
        postId,
        currency,
        `Investment distribution from post ${postId}`,
        session,
      );
    }

    await Promise.all(
      investorDistributions.map((dist) =>
        this.deps.investmentPersistence.updateInvestorEarnings(
          postId,
          dist.investorId,
          dist.amount,
          earningsReason,
          new Date(),
          session,
        ),
      ),
    );

    if (!session) {
      try {
        const author = await this.deps.userService.getUser(post.authorId);
        const authorName = author?.displayName || 'Author';
        await Promise.all(
          investorDistributions.map((dist) =>
            this.deps.notificationService.createNotification({
              userId: dist.investorId,
              type: 'investment_distributed',
              source: 'user',
              sourceId: post.authorId,
              metadata: {
                postId,
                communityId: post.communityId,
                withdrawAmount,
                amount: dist.amount,
              },
              title: 'Investment distributed',
              message: `${authorName} withdrew ${formatMeritsForDisplay(withdrawAmount)} merits from post. Your share: ${formatMeritsForDisplay(dist.amount)} merits`,
            }),
          ),
        );
      } catch (err) {
        this.logger.warn(
          `Failed to create investment_distributed notifications: ${err}`,
        );
      }
    }

    return {
      authorAmount,
      investorDistributions,
    };
  }

  private roundToHundredths(x: number): number {
    return Math.round(x * 100) / 100;
  }
}

export function createDistributeOnWithdrawalUseCase(
  deps: DistributeOnWithdrawalDeps,
): DistributeOnWithdrawalUseCase {
  return new DistributeOnWithdrawalUseCase(deps);
}
