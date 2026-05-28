import {
  BadRequestException,
  ForbiddenException,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import type { Connection, Model } from 'mongoose';
import type { PublicationDocument } from '../../../domain/models/publication/publication.schema';
import type { Community } from '../../../domain/models/community/community.schema';
import { formatMeritsForDisplay } from '../../../common/helpers/format-merits.helper';
import {
  isPublicationEntitySourced,
  type PublicationSourceFields,
} from '../../../domain/common/helpers/publication-source.helper';
import type { PublicationInvestment } from '../../../domain/models/publication/publication.schema';
import type { CommunityService } from '../../../domain/services/community.service';
import type { MeritResolverService } from '../../../domain/services/merit-resolver.service';
import type { NotificationService } from '../../../domain/services/notification.service';
import type { PermissionService } from '../../../domain/services/permission.service';
import type { UserService } from '../../../domain/services/user.service';
import type { WalletService } from '../../../domain/services/wallet.service';

export type InvestInPostInput = {
  postId: string;
  investorId: string;
  amount: number;
};

export type InvestInPostResult = {
  postId: string;
  investorId: string;
  amount: number;
  investmentPool: number;
  investmentPoolTotal: number;
  investments: Array<{
    investorId: string;
    amount: number;
    sharePercent: number;
  }>;
};

export type InvestInPostDeps = {
  publicationModel: Model<PublicationDocument>;
  walletService: WalletService;
  meritResolverService: MeritResolverService;
  communityService: CommunityService;
  notificationService: NotificationService;
  userService: UserService;
  permissionService: PermissionService;
};

/**
 * BC-08: invest merits in a publication's cooperative pool.
 * inv-01: wallet-only debit (no quota); solvency checked before side effects.
 * inv-08: community membership and post eligibility gates before wallet debit.
 */
export class InvestInPostUseCase {
  private readonly logger = new Logger(InvestInPostUseCase.name);

  constructor(private readonly deps: InvestInPostDeps) {}

  async execute(input: InvestInPostInput): Promise<InvestInPostResult> {
    const { postId, investorId, amount } = input;

    if (amount <= 0) {
      throw new BadRequestException('Investment amount must be greater than 0');
    }

    const post = await this.deps.publicationModel.findOne({ id: postId }).lean().exec();
    if (!post) {
      throw new NotFoundException('Publication not found');
    }

    const community = await this.assertInvestPermission(investorId, post);

    const walletCommunityId = this.deps.meritResolverService.getWalletCommunityId(
      community,
      'investment',
    );
    await this.assertInvestorSolvency(investorId, walletCommunityId, amount);

    const currency = community.settings?.currencyNames || {
      singular: 'merit',
      plural: 'merits',
      genitive: 'merits',
    };

    const investments = post.investments || [];
    const existingIndex = investments.findIndex(
      (inv: PublicationInvestment) => inv.investorId === investorId,
    );

    const now = new Date();
    let updatedInvestments: PublicationInvestment[];

    if (existingIndex >= 0) {
      const existing = investments[existingIndex];
      const addedAmount = existing.amount + amount;
      updatedInvestments = [...investments];
      updatedInvestments[existingIndex] = {
        investorId: existing.investorId,
        amount: addedAmount,
        createdAt: existing.createdAt,
        updatedAt: now,
        totalEarnings: existing.totalEarnings ?? 0,
        earningsHistory: existing.earningsHistory ?? [],
      };
    } else {
      updatedInvestments = [
        ...investments,
        {
          investorId,
          amount,
          createdAt: now,
          updatedAt: now,
          totalEarnings: 0,
          earningsHistory: [],
        },
      ];
    }

    const currentPool = post.investmentPool ?? 0;
    const currentTotal = post.investmentPoolTotal ?? 0;
    const newPool = currentPool + amount;
    const newTotal = currentTotal + amount;

    try {
      await this.deps.walletService.addTransaction(
        investorId,
        walletCommunityId,
        'debit',
        amount,
        'personal',
        'investment',
        postId,
        currency,
        `Investment in post ${postId}`,
      );
    } catch (err) {
      this.logger.error(`Failed to deduct investment from wallet: ${err}`);
      throw err;
    }

    await this.deps.publicationModel.updateOne(
      { id: postId },
      {
        $set: {
          investmentPool: newPool,
          investmentPoolTotal: newTotal,
          investments: updatedInvestments,
        },
      },
    );

    const totalInvested = updatedInvestments.reduce((sum, inv) => sum + inv.amount, 0);
    const resultInvestments = updatedInvestments.map((inv) => ({
      investorId: inv.investorId,
      amount: inv.amount,
      sharePercent: totalInvested > 0 ? (inv.amount / totalInvested) * 100 : 0,
    }));

    try {
      const investor = await this.deps.userService.getUser(investorId);
      const investorName = investor?.displayName || 'Someone';
      await this.deps.notificationService.createNotification({
        userId: post.authorId,
        type: 'investment_received',
        source: 'user',
        sourceId: investorId,
        metadata: { postId, communityId: post.communityId, investorId, amount },
        title: 'Investment received',
        message: `${investorName} invested ${formatMeritsForDisplay(amount)} merits in your post`,
      });
    } catch (err) {
      this.logger.warn(`Failed to create investment_received notification: ${err}`);
    }

    return {
      postId,
      investorId,
      amount,
      investmentPool: newPool,
      investmentPoolTotal: newTotal,
      investments: resultInvestments,
    };
  }

  /** inv-08: membership and post-type gates before wallet debit. */
  private async assertInvestPermission(
    investorId: string,
    post: PublicationSourceFields & {
      communityId: string;
      authorId: string;
      investingEnabled?: boolean;
      status?: string;
      deleted?: boolean;
    },
  ): Promise<Community> {
    const userRole = await this.deps.permissionService.getUserRoleInCommunity(
      investorId,
      post.communityId,
    );
    if (!userRole) {
      throw new ForbiddenException('You must be a community member to invest in posts');
    }

    if (!post.investingEnabled) {
      throw new BadRequestException('This post does not accept investments');
    }

    if ((post.status ?? 'active') === 'closed') {
      throw new BadRequestException('This post is closed and cannot be modified');
    }

    if (post.deleted) {
      throw new BadRequestException('Cannot invest in a deleted post');
    }

    if (post.authorId === investorId && !isPublicationEntitySourced(post)) {
      throw new BadRequestException('Cannot invest in your own post');
    }

    const community = await this.deps.communityService.getCommunity(post.communityId);
    if (!community) {
      throw new NotFoundException('Community not found');
    }

    if (
      community.typeTag === 'marathon-of-good' &&
      post.sourceEntityType === 'community'
    ) {
      throw new BadRequestException(
        'Investing is not available for community-published Birzha posts',
      );
    }

    return community;
  }

  /** inv-01: wallet solvency gate before debit. */
  private async assertInvestorSolvency(
    investorId: string,
    walletCommunityId: string,
    amount: number,
  ): Promise<void> {
    const wallet = await this.deps.walletService.getWallet(investorId, walletCommunityId);
    if (!wallet?.canAfford(amount)) {
      const balance = wallet ? wallet.getBalance() : 0;
      throw new BadRequestException(
        `Insufficient wallet balance. Available: ${balance}, Requested: ${amount}`,
      );
    }
  }
}

export function createInvestInPostUseCase(
  deps: InvestInPostDeps,
): InvestInPostUseCase {
  return new InvestInPostUseCase(deps);
}

/** tRPC / domain-service wiring: resolves publication model from mongoose connection. */
export function createInvestInPostUseCaseFromContext(ctx: {
  connection: Connection;
  walletService: WalletService;
  meritResolverService: MeritResolverService;
  communityService: CommunityService;
  notificationService: NotificationService;
  userService: UserService;
  permissionService: PermissionService;
}): InvestInPostUseCase {
  return createInvestInPostUseCase({
    publicationModel: ctx.connection.model(
      'PublicationSchemaClass',
    ) as Model<PublicationDocument>,
    walletService: ctx.walletService,
    meritResolverService: ctx.meritResolverService,
    communityService: ctx.communityService,
    notificationService: ctx.notificationService,
    userService: ctx.userService,
    permissionService: ctx.permissionService,
  });
}
