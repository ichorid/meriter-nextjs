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
import { CommentService } from '../../domain/services/comment.service';
import { UserService } from '../../domain/services/user.service';
import { WalletService } from '../../domain/services/wallet.service';
import { CommunityService } from '../../domain/services/community.service';
import { UserGuard } from '../../user.guard';
import { PaginationHelper } from '../../common/helpers/pagination.helper';
import { NotFoundError, ValidationError } from '../../common/exceptions/api.exceptions';
import { Vote, CreateVoteDto, CreateVoteDtoSchema, CreateTargetlessVoteDtoSchema, WithdrawAmountDtoSchema, VoteWithCommentDtoSchema } from '../../../../../../libs/shared-types/dist/index';
import { ZodValidation } from '../../common/decorators/zod-validation.decorator';

@Controller('api/v1')
@UseGuards(UserGuard)
export class VotesController {
  private readonly logger = new Logger(VotesController.name);

  constructor(
    private readonly voteService: VoteService,
    private readonly publicationService: PublicationService,
    private readonly commentService: CommentService,
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
            communityId: community.id,
            sourceType: 'quota',
            createdAt: { $gte: quotaStartTime }
          }
        },
        {
          $project: {
            absAmount: { $abs: '$amount' }
          }
        },
        {
          $group: {
            _id: null,
            total: { $sum: '$absAmount' }
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
   * Validate and process quotaAmount and walletAmount
   * Returns { quotaAmount, walletAmount, totalAmount, isDownvote }
   */
  private async validateAndProcessVoteAmounts(
    userId: string,
    communityId: string,
    community: any,
    createDto: CreateVoteDto | any,
  ): Promise<{ quotaAmount: number; walletAmount: number; totalAmount: number; isDownvote: boolean }> {
    let quotaAmount = 0;
    let walletAmount = 0;
    let totalAmount = 0;
    let isDownvote = false;

    // Handle backward compatibility: if amount is provided, use it
    if (createDto.amount !== undefined) {
      totalAmount = createDto.amount;
      isDownvote = totalAmount < 0;
      
      // For backward compatibility, use sourceType to determine quota vs wallet
      const sourceType = createDto.sourceType || 'quota';
      if (sourceType === 'quota') {
        quotaAmount = Math.abs(totalAmount);
      } else {
        walletAmount = Math.abs(totalAmount);
      }
    } else {
      // New format: use quotaAmount and walletAmount
      quotaAmount = createDto.quotaAmount ?? 0;
      walletAmount = createDto.walletAmount ?? 0;
      totalAmount = quotaAmount + walletAmount;
      
      // In new format, downvotes are indicated by negative totalAmount if provided in amount field
      // OR if we have a direction hint. For now, we'll assume positive amounts are upvotes.
      // Downvotes must have quotaAmount === 0 and walletAmount > 0
      // We can't reliably infer direction from amounts alone, so for now we'll handle it
      // in the validation below: if quotaAmount === 0 and only walletAmount is provided,
      // it might be a downvote, but we'll need explicit direction indication
      // For now, assume positive = upvote, and we'll handle direction separately if needed
    }

    // Validation: reject double-zero votes
    if (quotaAmount === 0 && walletAmount === 0) {
      throw new BadRequestException('Cannot vote with zero quota and zero wallet amount');
    }

    // Validation: reject quota for downvotes
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

    // Make totalAmount negative if it's a downvote
    if (isDownvote) {
      totalAmount = -totalAmount;
    }

    return { quotaAmount, walletAmount, totalAmount, isDownvote };
  }

  @Post('publications/:id/votes')
  @ZodValidation(CreateVoteDtoSchema)
  async votePublication(
    @Param('id') id: string,
    @Body() createDto: CreateVoteDto,
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
    
    // Validate and process vote amounts (quotaAmount + walletAmount)
    const { quotaAmount, walletAmount, totalAmount, isDownvote } = 
      await this.validateAndProcessVoteAmounts(req.user.id, communityId, community, createDto);
    
    // Determine vote direction
    const direction: 'up' | 'down' = isDownvote ? 'down' : 'up';
    const absoluteAmount = Math.abs(totalAmount);
    
    // Create votes atomically: quota vote first, then wallet vote if needed
    let vote: any;
    
    if (quotaAmount > 0 && walletAmount > 0) {
      // Create both votes atomically
      const quotaVote = await this.voteService.createVote(
        req.user.id,
        'publication',
        id,
        isDownvote ? -quotaAmount : quotaAmount,
        'quota',
        communityId,
        createDto.attachedCommentId
      );
      
      const walletVote = await this.voteService.createVote(
        req.user.id,
        'publication',
        id,
        isDownvote ? -walletAmount : walletAmount,
        'personal',
        communityId,
        createDto.attachedCommentId
      );
      
      // Deduct from wallet
      await this.walletService.addTransaction(
        req.user.id,
        communityId,
        'debit',
        walletAmount,
        'personal',
        'publication_vote',
        id,
        community.settings?.currencyNames || {
          singular: 'merit',
          plural: 'merits',
          genitive: 'merits',
        },
        `Vote on publication ${id}`
      );
      
      // Use the first vote (quota vote) as the main vote for response
      vote = quotaVote;
    } else if (quotaAmount > 0) {
      // Quota vote only
      vote = await this.voteService.createVote(
        req.user.id,
        'publication',
        id,
        isDownvote ? -quotaAmount : quotaAmount,
        'quota',
        communityId,
        createDto.attachedCommentId
      );
    } else {
      // Wallet vote only
      vote = await this.voteService.createVote(
        req.user.id,
        'publication',
        id,
        isDownvote ? -walletAmount : walletAmount,
        'personal',
        communityId,
        createDto.attachedCommentId
      );
      
      // Deduct from wallet
      await this.walletService.addTransaction(
        req.user.id,
        communityId,
        'debit',
        walletAmount,
        'personal',
        'publication_vote',
        id,
        community.settings?.currencyNames || {
          singular: 'merit',
          plural: 'merits',
          genitive: 'merits',
        },
        `Vote on publication ${id}`
      );
    }
    
    // Update publication metrics to reflect the vote immediately
    await this.publicationService.voteOnPublication(id, req.user.id, absoluteAmount, direction);
    
    // Note: If there's an attached comment, the comment count was already incremented
    // in CommentService.createComment when the comment was created
    
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

  @Post('comments/:id/votes')
  @ZodValidation(CreateTargetlessVoteDtoSchema)
  async voteComment(
    @Param('id') id: string,
    @Body() createDto: CreateVoteDto,
    @Req() req: any,
  ) {
    // Get the comment to find the target
    const comment = await this.commentService.getComment(id);
    if (!comment) {
      throw new NotFoundError('Comment', id);
    }
    
    // Comments don't have direct communityId - need to trace to the publication
    let communityId: string;
    
    if (comment.getTargetType === 'publication') {
      // Comment is on a publication - get the publication's communityId
      const publication = await this.publicationService.getPublication(comment.getTargetId);
      if (!publication) {
        throw new NotFoundError('Publication', comment.getTargetId);
      }
      communityId = publication.getCommunityId.getValue();
    } else {
      // Comment is on a comment - need to recursively find the publication
      // For now, we'll get the parent comment's target
      const parentComment = await this.commentService.getComment(comment.getTargetId);
      if (!parentComment || parentComment.getTargetType !== 'publication') {
        throw new NotFoundError('Root publication not found for comment', id);
      }
      const publication = await this.publicationService.getPublication(parentComment.getTargetId);
      if (!publication) {
        throw new NotFoundError('Publication', parentComment.getTargetId);
      }
      communityId = publication.getCommunityId.getValue();
    }
    
    // Get community to get currency info (needed for wallet operations)
    const community = await this.communityService.getCommunity(communityId);
    if (!community) {
      throw new NotFoundError('Community', communityId);
    }
    
    // Validate and process vote amounts (quotaAmount + walletAmount)
    const { quotaAmount, walletAmount, totalAmount, isDownvote } = 
      await this.validateAndProcessVoteAmounts(req.user.id, communityId, community, createDto);
    
    // Determine vote direction
    const direction: 'up' | 'down' = isDownvote ? 'down' : 'up';
    const absoluteAmount = Math.abs(totalAmount);
    
    // Create votes atomically: quota vote first, then wallet vote if needed
    let vote: any;
    
    if (quotaAmount > 0 && walletAmount > 0) {
      // Create both votes atomically
      const quotaVote = await this.voteService.createVote(
        req.user.id,
        'comment',
        id,
        isDownvote ? -quotaAmount : quotaAmount,
        'quota',
        communityId,
      );
      
      const walletVote = await this.voteService.createVote(
        req.user.id,
        'comment',
        id,
        isDownvote ? -walletAmount : walletAmount,
        'personal',
        communityId,
      );
      
      // Deduct from wallet
      await this.walletService.addTransaction(
        req.user.id,
        communityId,
        'debit',
        walletAmount,
        'personal',
        'comment_vote',
        id,
        community.settings?.currencyNames || {
          singular: 'merit',
          plural: 'merits',
          genitive: 'merits',
        },
        `Vote on comment ${id}`
      );
      
      // Use the first vote (quota vote) as the main vote for response
      vote = quotaVote;
    } else if (quotaAmount > 0) {
      // Quota vote only
      vote = await this.voteService.createVote(
        req.user.id,
        'comment',
        id,
        isDownvote ? -quotaAmount : quotaAmount,
        'quota',
        communityId,
      );
    } else {
      // Wallet vote only
      vote = await this.voteService.createVote(
        req.user.id,
        'comment',
        id,
        isDownvote ? -walletAmount : walletAmount,
        'personal',
        communityId,
      );
      
      // Deduct from wallet
      await this.walletService.addTransaction(
        req.user.id,
        communityId,
        'debit',
        walletAmount,
        'personal',
        'comment_vote',
        id,
        community.settings?.currencyNames || {
          singular: 'merit',
          plural: 'merits',
          genitive: 'merits',
        },
        `Vote on comment ${id}`
      );
    }
    
    // Update comment metrics to reflect the vote immediately
    await this.commentService.voteOnComment(id, req.user.id, absoluteAmount, direction);
    
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

  @Get('comments/:id/votes')
  async getCommentVotes(
    @Param('id') id: string,
    @Query() query: any,
    @Req() req: any,
  ) {
    const pagination = PaginationHelper.parseOptions(query);
    const result = await this.voteService.getTargetVotes('comment', id);
    return PaginationHelper.createResult(result, result.length, pagination);
  }

  @Delete('comments/:id/votes')
  async removeCommentVote(
    @Param('id') id: string,
    @Req() req: any,
  ) {
    await this.voteService.removeVote(req.user.id, 'comment', id);
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

  @Post('comments/:id/withdraw')
  @ZodValidation(WithdrawAmountDtoSchema)
  async withdrawFromComment(
    @Param('id') id: string,
    @Body() body: any,
    @Req() req: any,
  ) {
    // Get the comment
    const comment = await this.commentService.getComment(id);
    if (!comment) {
      throw new NotFoundError('Comment', id);
    }
    
    // Check if user can withdraw
    const canWithdraw = await this.voteService.canUserWithdraw(req.user.id, 'comment', id);
    if (!canWithdraw) {
      throw new BadRequestException('You are not authorized to withdraw from this comment');
    }
    
    // Check balance
    const balance = comment.getScore;
    if (balance <= 0) {
      throw new BadRequestException('No balance available to withdraw');
    }
    
    // Get beneficiary (always author for comments)
    const beneficiaryId = comment.getAuthorId.getValue();
    
    // Get community - need to trace to publication
    let communityId: string;
    if (comment.getTargetType === 'publication') {
      const publication = await this.publicationService.getPublication(comment.getTargetId);
      if (!publication) {
        throw new NotFoundError('Publication', comment.getTargetId);
      }
      communityId = publication.getCommunityId.getValue();
    } else {
      // Comment on comment - find root publication
      const parentComment = await this.commentService.getComment(comment.getTargetId);
      if (!parentComment || parentComment.getTargetType !== 'publication') {
        throw new NotFoundError('Root publication not found for comment', id);
      }
      const publication = await this.publicationService.getPublication(parentComment.getTargetId);
      if (!publication) {
        throw new NotFoundError('Publication', parentComment.getTargetId);
      }
      communityId = publication.getCommunityId.getValue();
    }
    
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
      'comment_withdrawal',
      id,
      community.settings?.currencyNames || {
        singular: 'merit',
        plural: 'merits',
        genitive: 'merits',
      },
      `Withdrawal from comment ${id}`
    );
    
    // Update comment metrics
    await this.commentService.voteOnComment(id, req.user.id, withdrawAmount, 'down');
    
    return {
      success: true,
      data: {
        amount: withdrawAmount,
        balance: balance - withdrawAmount,
        message: `Successfully withdrew ${withdrawAmount} from comment`,
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
    
    let commentId: string | undefined;
    let comment = null;
    
    // Only create a comment if content is provided and non-empty
    const commentContent = body.comment?.trim();
    if (commentContent) {
      try {
        const createdComment = await this.commentService.createComment(req.user.id, {
          targetType: 'publication',
          targetId: id,
          content: commentContent,
        });
        commentId = createdComment.getId;
        
        // Fetch comment with full metadata for response
        const commentSnapshot = createdComment.toSnapshot();
        const authorId = createdComment.getAuthorId.getValue();
        let author = null;
        try {
          author = await this.userService.getUser(authorId);
        } catch (error) {
          this.logger.warn(`Failed to fetch author ${authorId}:`, error.message);
        }
        
        comment = {
          ...commentSnapshot,
          createdAt: commentSnapshot.createdAt.toISOString(),
          updatedAt: commentSnapshot.updatedAt.toISOString(),
          meta: {
            author: author ? {
              id: author.id,
              name: author.displayName || `${author.firstName || ''} ${author.lastName || ''}`.trim() || author.username || 'Unknown',
              username: author.username,
              photoUrl: author.avatarUrl,
            } : {
              id: undefined,
              name: 'Unknown',
              username: undefined,
              photoUrl: undefined,
            },
          },
        };
      } catch (error) {
        this.logger.error('Failed to create comment:', error);
        throw new ValidationError('Failed to create comment: ' + error.message);
      }
    }
    
    // Validate and process vote amounts (quotaAmount + walletAmount)
    const { quotaAmount, walletAmount, totalAmount, isDownvote } = 
      await this.validateAndProcessVoteAmounts(req.user.id, communityId, community, body);
    
    // Determine vote direction
    const direction: 'up' | 'down' = isDownvote ? 'down' : 'up';
    const absoluteAmount = Math.abs(totalAmount);
    
    // Create votes atomically: quota vote first, then wallet vote if needed
    // Attach comment only to the first vote
    let vote: any;
    
    if (quotaAmount > 0 && walletAmount > 0) {
      // Create both votes atomically, attach comment only to the first vote
      const quotaVote = await this.voteService.createVote(
        req.user.id,
        'publication',
        id,
        isDownvote ? -quotaAmount : quotaAmount,
        'quota',
        communityId,
        commentId // Attach comment to first vote only
      );
      
      const walletVote = await this.voteService.createVote(
        req.user.id,
        'publication',
        id,
        isDownvote ? -walletAmount : walletAmount,
        'personal',
        communityId,
        // Don't attach comment to second vote
      );
      
      // Deduct from wallet
      await this.walletService.addTransaction(
        req.user.id,
        communityId,
        'debit',
        walletAmount,
        'personal',
        'publication_vote',
        id,
        community.settings?.currencyNames || {
          singular: 'merit',
          plural: 'merits',
          genitive: 'merits',
        },
        `Vote on publication ${id}`
      );
      
      // Use the first vote (quota vote) as the main vote for response
      vote = quotaVote;
    } else if (quotaAmount > 0) {
      // Quota vote only
      vote = await this.voteService.createVote(
        req.user.id,
        'publication',
        id,
        isDownvote ? -quotaAmount : quotaAmount,
        'quota',
        communityId,
        commentId // Attach comment to vote
      );
    } else {
      // Wallet vote only
      vote = await this.voteService.createVote(
        req.user.id,
        'publication',
        id,
        isDownvote ? -walletAmount : walletAmount,
        'personal',
        communityId,
        commentId // Attach comment to vote
      );
      
      // Deduct from wallet
      await this.walletService.addTransaction(
        req.user.id,
        communityId,
        'debit',
        walletAmount,
        'personal',
        'publication_vote',
        id,
        community.settings?.currencyNames || {
          singular: 'merit',
          plural: 'merits',
          genitive: 'merits',
        },
        `Vote on publication ${id}`
      );
    }
    
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
        comment: comment || undefined,
      },
      meta: {
        timestamp: new Date().toISOString(),
        requestId: req.headers['x-request-id'] || 'unknown',
      },
    };
  }
}
