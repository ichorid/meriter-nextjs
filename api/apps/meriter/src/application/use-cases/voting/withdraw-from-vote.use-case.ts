import {
  BadRequestException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { GLOBAL_COMMUNITY_ID } from '../../../domain/common/constants/global.constant';
import type { Comment } from '../../../domain/aggregates/comment/comment.entity';
import { CommentService } from '../../../domain/services/comment.service';
import { CommunityService } from '../../../domain/services/community.service';
import { MeritResolverService } from '../../../domain/services/merit-resolver.service';
import { PublicationService } from '../../../domain/services/publication.service';
import { VoteService } from '../../../domain/services/vote.service';
import { WalletService } from '../../../domain/services/wallet.service';

const DEFAULT_CURRENCY = {
  singular: 'merit',
  plural: 'merits',
  genitive: 'merits',
} as const;

export type WithdrawFromVoteInput = {
  userId: string;
  voteId: string;
  amount?: number;
};

export type WithdrawFromVoteResult = {
  amount: number;
  balance: number;
  message: string;
};

/**
 * BC-04: withdraw merits from a comment (vote entity) score (P-3).
 * inv-08: authorization and eligibility checks run before wallet credit or score reduction.
 */
export class WithdrawFromVoteUseCase {
  constructor(
    private readonly voteService: VoteService,
    private readonly commentService: CommentService,
    private readonly publicationService: PublicationService,
    private readonly communityService: CommunityService,
    private readonly meritResolverService: MeritResolverService,
    private readonly walletService: WalletService,
  ) {}

  async execute(input: WithdrawFromVoteInput): Promise<WithdrawFromVoteResult> {
    const amount = input.amount;
    if (!amount || amount <= 0) {
      throw new BadRequestException('Withdrawal amount must be greater than 0');
    }

    const vote = await this.voteService.getVoteById(input.voteId);
    if (!vote) {
      throw new NotFoundException(`Vote ${input.voteId} not found`);
    }

    const canWithdraw = await this.voteService.canUserWithdraw(
      input.userId,
      'vote',
      input.voteId,
    );
    if (!canWithdraw) {
      throw new ForbiddenException(
        'You are not authorized to withdraw from this comment',
      );
    }

    const comment = await this.commentService.getComment(input.voteId);
    if (!comment) {
      throw new NotFoundException(`Comment ${input.voteId} not found`);
    }

    const currentScore = comment.getScore;
    if (currentScore <= 0) {
      throw new BadRequestException('No votes available to withdraw');
    }

    if (amount > currentScore) {
      throw new BadRequestException(
        `Insufficient votes to withdraw. Available: ${currentScore}, Requested: ${amount}`,
      );
    }

    const publicationId = await this.resolvePublicationIdForComment(comment);
    if (!publicationId) {
      throw new BadRequestException('Could not find publication for this comment');
    }

    const publication = await this.publicationService.getPublication(publicationId);
    if (!publication) {
      throw new NotFoundException(`Publication ${publicationId} not found`);
    }

    const communityId = publication.getCommunityId.getValue();

    const community = await this.communityService.getCommunity(communityId);
    if (community?.typeTag === 'future-vision') {
      throw new ForbiddenException('Withdrawals are not allowed in Future Vision');
    }

    const beneficiaryId = comment.getAuthorId.getValue();

    const { targetCommunityId } = await this.processWithdrawal(
      beneficiaryId,
      communityId,
      input.voteId,
      amount,
    );

    await this.commentService.reduceScore(input.voteId, amount);

    const wallet = await this.walletService.getWallet(beneficiaryId, targetCommunityId);
    const balance = wallet ? wallet.getBalance() : 0;

    return {
      amount,
      balance,
      message: 'Withdrawal successful',
    };
  }

  private async resolvePublicationIdForComment(
    comment: Comment,
  ): Promise<string | null> {
    let currentComment = comment;
    let depth = 0;
    while (currentComment.getTargetType === 'comment' && depth < 20) {
      const parentComment = await this.commentService.getComment(
        currentComment.getTargetId,
      );
      if (!parentComment) {
        break;
      }
      currentComment = parentComment;
      depth++;
    }
    if (currentComment.getTargetType === 'publication') {
      return currentComment.getTargetId;
    }
    return null;
  }

  private async processWithdrawal(
    beneficiaryId: string,
    publicationCommunityId: string,
    referenceId: string,
    amount: number,
  ): Promise<{ targetCommunityId: string }> {
    const publicationCommunity =
      await this.communityService.getCommunity(publicationCommunityId);
    if (!publicationCommunity) {
      throw new NotFoundException(`Community ${publicationCommunityId} not found`);
    }

    const effectiveVotingSettings =
      this.communityService.getEffectiveVotingSettings(publicationCommunity);
    const targetCommunityId = this.meritResolverService.getWalletCommunityId(
      publicationCommunity,
      'withdrawal',
    );

    if (!effectiveVotingSettings.awardsMerits) {
      return { targetCommunityId };
    }

    const targetCommunity =
      targetCommunityId === GLOBAL_COMMUNITY_ID
        ? await this.communityService.getCommunity(GLOBAL_COMMUNITY_ID)
        : publicationCommunity;
    const currency = targetCommunity?.settings?.currencyNames ?? DEFAULT_CURRENCY;

    const description = `Withdrawal from vote ${referenceId}`;

    await this.walletService.addTransaction(
      beneficiaryId,
      targetCommunityId,
      'credit',
      amount,
      'personal',
      'vote_withdrawal',
      referenceId,
      currency,
      description,
    );

    return { targetCommunityId };
  }
}

export function createWithdrawFromVoteUseCase(deps: {
  voteService: VoteService;
  commentService: CommentService;
  publicationService: PublicationService;
  communityService: CommunityService;
  meritResolverService: MeritResolverService;
  walletService: WalletService;
}): WithdrawFromVoteUseCase {
  return new WithdrawFromVoteUseCase(
    deps.voteService,
    deps.commentService,
    deps.publicationService,
    deps.communityService,
    deps.meritResolverService,
    deps.walletService,
  );
}
