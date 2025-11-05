import {
  Controller,
  Post,
  Get,
  Delete,
  Param,
  Body,
  Query,
  Req,
  UseGuards,
  Logger,
  BadRequestException,
} from '@nestjs/common';
import { InjectConnection } from '@nestjs/mongoose';
import { Connection } from 'mongoose';
import { VoteService } from '../../domain/services/vote.service';
import { UserSettingsService } from '../../domain/services/user-settings.service';
import { UserUpdatesService } from '../../domain/services/user-updates.service';
import { TgBotsService } from '../../tg-bots/tg-bots.service';
import { PublicationService } from '../../domain/services/publication.service';
import { UserService } from '../../domain/services/user.service';
import { WalletService } from '../../domain/services/wallet.service';
import { CommunityService } from '../../domain/services/community.service';
import { UserGuard } from '../../user.guard';
import { PaginationHelper } from '../../common/helpers/pagination.helper';
import { NotFoundError, ValidationError } from '../../common/exceptions/api.exceptions';
import { Vote, VoteWithCommentDto, VoteWithCommentDtoSchema, WithdrawAmountDtoSchema } from '../../../../../../libs/shared-types/dist/index';
import { ZodValidation } from '../../common/decorators/zod-validation.decorator';

@Controller('api/v1')
@UseGuards(UserGuard)
export class VotesController {
  private readonly logger = new Logger(VotesController.name);

  constructor(
    private readonly voteService: VoteService,
    private readonly publicationService: PublicationService,
    private readonly userService: UserService,
    private readonly walletService: WalletService,
    private readonly communityService: CommunityService,
    private readonly userSettingsService: UserSettingsService,
    private readonly userUpdatesService: UserUpdatesService,
    private readonly tgBotsService: TgBotsService,
    @InjectConnection() private readonly connection: Connection,
  ) {}

  /**
   * Calculate remaining quota for a user in a community
   */
  private async getRemainingQuota(userId: string, communityId: string, community: any): Promise<number> {
    if (!community.settings?.dailyEmission || typeof community.settings.dailyEmission !== 'number') {
      return 0;
    }

    const dailyQuota = community.settings.dailyEmission;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const quotaStartTime = community.lastQuotaResetAt 
      ? new Date(community.lastQuotaResetAt)
      : today;

    const usedToday = await this.connection.db
      .collection('votes')
      .aggregate([
        {
          $match: {
            userId,
            communityId,
            createdAt: { $gte: quotaStartTime }
          }
        },
        {
          $group: {
            _id: null,
            total: { $sum: '$amountQuota' }
          }
        }
      ])
      .toArray();

    const used = usedToday.length > 0 ? usedToday[0].total : 0;
    return Math.max(0, dailyQuota - used);
  }

  /**
   * Get wallet balance for a user in a community
   */
  private async getWalletBalance(userId: string, communityId: string): Promise<number> {
    const wallet = await this.walletService.getWallet(userId, communityId);
    return wallet ? wallet.getBalance() : 0;
  }

  /**
   * Create vote with quota and/or wallet amounts
   * Creates a single vote document with both amounts
   */
  private async createVoteWithQuotaAndWallet(
    userId: string,
    targetType: 'publication' | 'vote',
    targetId: string,
    quotaAmount: number,
    walletAmount: number,
    isDownvote: boolean,
    communityId: string,
    community: any,
    comment: string
  ): Promise<any> {
    // Validate that quota is not used for downvotes
    if (isDownvote && quotaAmount > 0) {
      throw new BadRequestException('Quota cannot be used for downvotes');
    }

    // Create single vote with both amounts
    const vote = await this.voteService.createVote(
      userId,
      targetType,
      targetId,
      quotaAmount,
      walletAmount,
      comment,
      communityId
    );
    
    // Deduct from wallet if wallet amount is used
    if (walletAmount > 0) {
      const transactionType = targetType === 'publication' ? 'publication_vote' : 'vote_vote';
      await this.walletService.addTransaction(
        userId,
        communityId,
        'debit',
        walletAmount,
        'personal',
        transactionType,
        targetId,
        community.settings?.currencyNames || {
          singular: 'merit',
          plural: 'merits',
          genitive: 'merits',
        },
        `Vote on ${targetType} ${targetId}`
      );
    }
    
    return vote;
  }


  /**
   * Validate and process quotaAmount and walletAmount
   * Returns { quotaAmount, walletAmount, totalAmount, isDownvote }
   * Note: Downvotes are determined by having quotaAmount === 0 and walletAmount > 0
   */
  private async validateAndProcessVoteAmounts(
    userId: string,
    communityId: string,
    community: any,
    createDto: VoteWithCommentDto | any,
  ): Promise<{ quotaAmount: number; walletAmount: number; totalAmount: number; isDownvote: boolean }> {
    const quotaAmount = createDto.quotaAmount ?? 0;
    const walletAmount = createDto.walletAmount ?? 0;
    const totalAmount = quotaAmount + walletAmount;
    
    // Downvotes are indicated by quotaAmount === 0 and walletAmount > 0
    // This is inferred from the fact that quota cannot be used for downvotes
    const isDownvote = quotaAmount === 0 && walletAmount > 0;

    // Validation: reject double-zero votes
    if (quotaAmount === 0 && walletAmount === 0) {
      throw new BadRequestException('Cannot vote with zero quota and zero wallet amount');
    }

    // Validation: reject quota for downvotes (only check if explicitly downvote)
    // Note: We determine downvote by quotaAmount === 0, so this check is redundant
    // but kept for clarity
    if (isDownvote && quotaAmount > 0) {
      throw new BadRequestException('Quota cannot be used for downvotes (negative votes)');
    }

    // Get available quota and wallet balance
    const remainingQuota = await this.getRemainingQuota(userId, communityId, community);
    const walletBalance = await this.getWalletBalance(userId, communityId);

    // Validation: check quota limit
    if (quotaAmount > remainingQuota) {
      throw new BadRequestException(`Insufficient quota. Available: ${remainingQuota}, Requested: ${quotaAmount}`);
    }

    // Validation: check wallet balance
    if (walletAmount > walletBalance) {
      throw new BadRequestException(`Insufficient wallet balance. Available: ${walletBalance}, Requested: ${walletAmount}`);
    }

    // Validation: total vote amount should not exceed available quota + wallet
    if (totalAmount > remainingQuota + walletBalance) {
      throw new BadRequestException(`Insufficient total balance. Available: ${remainingQuota + walletBalance}, Requested: ${totalAmount}`);
    }

    return { quotaAmount, walletAmount, totalAmount, isDownvote };
  }

  @Post('publications/:id/votes')
  @ZodValidation(VoteWithCommentDtoSchema)
  async votePublication(
    @Param('id') id: string,
    @Body() createDto: VoteWithCommentDto,
    @Req() req: any,
  ) {
    // Get the publication to find the communityId
    const publication = await this.publicationService.getPublication(id);
    if (!publication) {
      throw new NotFoundError('Publication', id);
    }
    
    const communityId = publication.getCommunityId.getValue();
    
    // Get community to get currency info (needed for wallet operations)
    const community = await this.communityService.getCommunity(communityId);
    if (!community) {
      throw new NotFoundError('Community', communityId);
    }
    
    // Validate comment is provided
    const comment = (createDto as any).comment?.trim() || '';
    if (!comment) {
      throw new BadRequestException('Comment is required');
    }
    
    // Validate and process vote amounts (quotaAmount + walletAmount)
    const { quotaAmount, walletAmount, totalAmount, isDownvote } = 
      await this.validateAndProcessVoteAmounts(req.user.id, communityId, community, createDto);
    
    // Determine vote direction
    const direction: 'up' | 'down' = isDownvote ? 'down' : 'up';
    const absoluteAmount = Math.abs(totalAmount);
    
    // Create votes atomically: quota vote first, then wallet vote if needed
    const vote = await this.createVoteWithQuotaAndWallet(
      req.user.id,
      'publication',
      id,
      quotaAmount,
      walletAmount,
      isDownvote,
      communityId,
      community,
      comment
    );
    
    // Update publication metrics to reflect the vote immediately
    await this.publicationService.voteOnPublication(id, req.user.id, absoluteAmount, direction);
    
    // Immediate notification if enabled for beneficiary
    try {
      const beneficiaryId = publication.getEffectiveBeneficiary()?.getValue();
      if (beneficiaryId) {
        const settings = await this.userSettingsService.getOrCreate(beneficiaryId);
        if (settings.updatesFrequency === 'immediate') {
          this.logger.log(`Immediate updates enabled; sending Telegram notification to beneficiary=${beneficiaryId} for publication=${id}`);
          const voterDisplayName = req.user.displayName || `${req.user.firstName || ''} ${req.user.lastName || ''}`.trim() || req.user.username || 'Unknown';
          await this.tgBotsService.sendImmediateVoteNotification(
            beneficiaryId,
            {
              actorId: req.user.id,
              actorName: voterDisplayName,
              actorUsername: req.user.username,
              targetType: 'publication',
              targetId: id,
              publicationId: id,
              communityId: communityId,
              amount: absoluteAmount,
              direction: direction,
              createdAt: new Date(),
            },
            'en'
          );
        }
      }
    } catch {}
    
    return {
      data: {
        vote,
      },
      meta: {
        timestamp: new Date().toISOString(),
        requestId: req.headers['x-request-id'] || 'unknown',
      },
    };
  }

  @Get('publications/:id/votes')
  async getPublicationVotes(
    @Param('id') id: string,
    @Query() query: any,
    @Req() req: any,
  ) {
    const pagination = PaginationHelper.parseOptions(query);
    const result = await this.voteService.getTargetVotes('publication', id);
    return PaginationHelper.createResult(result, result.length, pagination);
  }

  @Delete('publications/:id/votes')
  async removePublicationVote(
    @Param('id') id: string,
    @Req() req: any,
  ) {
    await this.voteService.removeVote(req.user.id, 'publication', id);
    return { success: true, data: { message: 'Vote removed successfully' } };
  }

  @Post('votes/:id/votes')
  @ZodValidation(VoteWithCommentDtoSchema)
  async voteVote(
    @Param('id') id: string,
    @Body() createDto: VoteWithCommentDto,
    @Req() req: any,
  ) {
    // Validate that target vote exists
    const targetVote = await this.voteService.getVoteById(id);
    if (!targetVote) {
      throw new NotFoundError('Vote', id);
    }
    
    // Get community ID from target vote
    const communityId = targetVote.communityId;
    
    // Get community to get currency info (needed for wallet operations)
    const community = await this.communityService.getCommunity(communityId);
    if (!community) {
      throw new NotFoundError('Community', communityId);
    }
    
    // Validate comment is provided
    const comment = (createDto as any).comment?.trim() || '';
    if (!comment) {
      throw new BadRequestException('Comment is required when voting on a vote');
    }
    
    // Validate and process vote amounts (quotaAmount + walletAmount)
    const { quotaAmount, walletAmount, totalAmount, isDownvote } = 
      await this.validateAndProcessVoteAmounts(req.user.id, communityId, community, createDto);
    
    // Determine vote direction
    const direction: 'up' | 'down' = isDownvote ? 'down' : 'up';
    const absoluteAmount = Math.abs(totalAmount);
    
    // Create votes atomically: quota vote first, then wallet vote if needed
    // Vote on the target vote (the beneficiary is the target vote's author)
    const vote = await this.createVoteWithQuotaAndWallet(
      req.user.id,
      'vote',
      id,
      quotaAmount,
      walletAmount,
      isDownvote,
      communityId,
      community,
      comment
    );
    
    return {
      data: {
        vote,
      },
      meta: {
        timestamp: new Date().toISOString(),
        requestId: req.headers['x-request-id'] || 'unknown',
      },
    };
  }

  @Get('votes/:id/replies')
  async getVoteReplies(
    @Param('id') id: string,
    @Query() query: any,
    @Req() req: any,
  ) {
    // Validate that vote exists
    const vote = await this.voteService.getVoteById(id);
    if (!vote) {
      throw new NotFoundError('Vote', id);
    }
    
    const pagination = PaginationHelper.parseOptions(query);
    const skip = PaginationHelper.getSkip(pagination);
    const limit = pagination.limit;
    
    // Get votes on this vote
    const votes = await this.voteService.getVotesOnVote(id);
    
    // Sort votes
    const sortField = query.sort || 'createdAt';
    const sortOrder = (query.order || 'desc') === 'asc' ? 1 : -1;
    votes.sort((a, b) => {
      if (sortField === 'createdAt') {
        return (new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()) * sortOrder;
      } else if (sortField === 'score') {
        // Calculate score as sum of quota and wallet amounts
        const scoreA = (a.amountQuota || 0) + (a.amountWallet || 0);
        const scoreB = (b.amountQuota || 0) + (b.amountWallet || 0);
        return (scoreA - scoreB) * sortOrder;
      }
      return 0;
    });
    
    // Apply pagination
    const paginatedVotes = votes.slice(skip, skip + limit);
    
    return PaginationHelper.createResult(paginatedVotes, votes.length, pagination);
  }

  @Delete('votes/:id/votes')
  async removeVoteVote(
    @Param('id') id: string,
    @Req() req: any,
  ) {
    await this.voteService.removeVote(req.user.id, 'vote', id);
    return { success: true, data: { message: 'Vote removed successfully' } };
  }

  @Get('votes/:id/details')
  async getVoteDetails(
    @Param('id') id: string,
    @Req() req: any,
  ) {
    // This would need to be implemented in VoteService
    return {
      data: {
        vote: null,
      },
      meta: {
        timestamp: new Date().toISOString(),
        requestId: req.headers['x-request-id'] || 'unknown',
      },
    };
  }

  @Post('publications/:id/withdraw')
  @ZodValidation(WithdrawAmountDtoSchema)
  async withdrawFromPublication(
    @Param('id') id: string,
    @Body() body: any,
    @Req() req: any,
  ) {
    // Get the publication
    const publication = await this.publicationService.getPublication(id);
    if (!publication) {
      throw new NotFoundError('Publication', id);
    }
    
    // Check if user can withdraw
    const canWithdraw = await this.voteService.canUserWithdraw(req.user.id, 'publication', id);
    if (!canWithdraw) {
      throw new BadRequestException('You are not authorized to withdraw from this publication');
    }
    
    // Check balance
    const balance = publication.getScore;
    if (balance <= 0) {
      throw new BadRequestException('No balance available to withdraw');
    }
    
    // Get beneficiary (beneficiaryId if set, otherwise authorId)
    const beneficiaryId = publication.getBeneficiaryId?.getValue() || publication.getAuthorId.getValue();
    const communityId = publication.getCommunityId.getValue();
    
    // Get community to get currency info
    const community = await this.communityService.getCommunity(communityId);
    if (!community) {
      throw new NotFoundError('Community', communityId);
    }
    
    // Get withdrawable amount (if amount specified, use it, otherwise withdraw all)
    const withdrawAmount = body.amount ? Math.min(body.amount, balance) : balance;
    
    if (withdrawAmount <= 0) {
      throw new BadRequestException('Withdraw amount must be positive');
    }
    
    // Transfer to wallet
    await this.walletService.addTransaction(
      beneficiaryId,
      communityId,
      'credit',
      withdrawAmount,
      'personal',
      'publication_withdrawal',
      id,
      community.settings?.currencyNames || {
        singular: 'merit',
        plural: 'merits',
        genitive: 'merits',
      },
      `Withdrawal from publication ${id}`
    );
    
    // Update publication metrics
    await this.publicationService.voteOnPublication(id, req.user.id, withdrawAmount, 'down');
    
    return {
      success: true,
      data: {
        amount: withdrawAmount,
        balance: balance - withdrawAmount,
        message: `Successfully withdrew ${withdrawAmount} from publication`,
      },
      meta: {
        timestamp: new Date().toISOString(),
        requestId: req.headers['x-request-id'] || 'unknown',
      },
    };
  }

  @Post('votes/:id/withdraw')
  @ZodValidation(WithdrawAmountDtoSchema)
  async withdrawFromVote(
    @Param('id') id: string,
    @Body() body: any,
    @Req() req: any,
  ) {
    // Get the vote
    const vote = await this.voteService.getVoteById(id);
    if (!vote) {
      throw new NotFoundError('Vote', id);
    }
    
    // Check if user can withdraw (must be the vote author)
    const canWithdraw = await this.voteService.canUserWithdraw(req.user.id, 'vote', id);
    if (!canWithdraw) {
      throw new BadRequestException('You are not authorized to withdraw from this vote');
    }
    
    // Get votes on this vote to calculate balance
    const votesOnVote = await this.voteService.getVotesOnVote(id);
    const balance = votesOnVote.reduce((sum, v) => sum + ((v.amountQuota || 0) + (v.amountWallet || 0)), 0);
    
    if (balance <= 0) {
      throw new BadRequestException('No balance available to withdraw');
    }
    
    // Get beneficiary (vote author)
    const beneficiaryId = vote.userId;
    const communityId = vote.communityId;
    
    // Get community to get currency info
    const community = await this.communityService.getCommunity(communityId);
    if (!community) {
      throw new NotFoundError('Community', communityId);
    }
    
    // Get withdrawable amount (if amount specified, use it, otherwise withdraw all)
    const withdrawAmount = body.amount ? Math.min(body.amount, balance) : balance;
    
    if (withdrawAmount <= 0) {
      throw new BadRequestException('Withdraw amount must be positive');
    }
    
    // Transfer to wallet
    await this.walletService.addTransaction(
      beneficiaryId,
      communityId,
      'credit',
      withdrawAmount,
      'personal',
      'vote_withdrawal',
      id,
      community.settings?.currencyNames || {
        singular: 'merit',
        plural: 'merits',
        genitive: 'merits',
      },
      `Withdrawal from vote ${id}`
    );
    
    return {
      success: true,
      data: {
        amount: withdrawAmount,
        balance: balance - withdrawAmount,
        message: `Successfully withdrew ${withdrawAmount} from vote`,
      },
      meta: {
        timestamp: new Date().toISOString(),
        requestId: req.headers['x-request-id'] || 'unknown',
      },
    };
  }

  @Post('publications/:id/vote-with-comment')
  @ZodValidation(VoteWithCommentDtoSchema)
  async votePublicationWithComment(
    @Param('id') id: string,
    @Body() body: any,
    @Req() req: any,
  ) {
    // This endpoint is now redundant since votePublication requires comment
    // But keeping for backward compatibility - redirect to votePublication logic
    return this.votePublication(id, body, req);
  }
}
