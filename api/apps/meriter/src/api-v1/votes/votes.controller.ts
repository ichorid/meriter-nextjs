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
import { VoteService } from '../../domain/services/vote.service';
import { PublicationService } from '../../domain/services/publication.service';
import { CommentService } from '../../domain/services/comment.service';
import { UserService } from '../../domain/services/user.service';
import { WalletService } from '../../domain/services/wallet.service';
import { CommunityService } from '../../domain/services/community.service';
import { UserGuard } from '../../user.guard';
import { PaginationHelper } from '../../common/helpers/pagination.helper';
import { NotFoundError, ValidationError } from '../../common/exceptions/api.exceptions';
import { Vote, CreateVoteDto } from '../../../../../../libs/shared-types/dist/index';

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
  ) {}

  @Post('publications/:id/votes')
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
    
    // Determine sourceType - use 'quota' if not specified, otherwise use provided value
    // For quota votes, the frontend should pass sourceType: 'quota'
    const sourceType = createDto.sourceType || 'quota';
    
    // Get community to get currency info (needed for wallet operations)
    const community = await this.communityService.getCommunity(communityId);
    if (!community) {
      throw new NotFoundError('Community', communityId);
    }
    
    // Create vote with optional attached comment ID
    const vote = await this.voteService.createVote(
      req.user.id,
      'publication',
      id,
      createDto.amount,
      sourceType as 'personal' | 'quota',
      communityId,
      createDto.attachedCommentId
    );
    
    // Update publication metrics to reflect the vote immediately
    const direction: 'up' | 'down' = createDto.amount > 0 ? 'up' : 'down';
    await this.publicationService.voteOnPublication(id, req.user.id, Math.abs(createDto.amount), direction);
    
    // Deduct from wallet if sourceType is 'personal'
    if (sourceType === 'personal') {
      await this.walletService.addTransaction(
        req.user.id,
        communityId,
        'debit',
        Math.abs(createDto.amount),
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
    
    // Note: If there's an attached comment, the comment count was already incremented
    // in CommentService.createComment when the comment was created
    
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
    
    // Determine sourceType - use 'quota' if not specified, otherwise use provided value
    const sourceType = (createDto.sourceType || 'quota') as 'personal' | 'quota';
    
    // Get community to get currency info (needed for wallet operations)
    const community = await this.communityService.getCommunity(communityId);
    if (!community) {
      throw new NotFoundError('Community', communityId);
    }
    
    // Create vote directly, forwarding sourceType
    const result = await this.voteService.createVote(
      req.user.id,
      'comment',
      id,
      createDto.amount,
      sourceType,
      communityId,
    );
    
    // Update comment metrics to reflect the vote immediately
    const direction: 'up' | 'down' = createDto.amount > 0 ? 'up' : 'down';
    await this.commentService.voteOnComment(id, req.user.id, Math.abs(createDto.amount), direction);
    
    // Deduct from wallet if sourceType is 'personal'
    if (sourceType === 'personal') {
      await this.walletService.addTransaction(
        req.user.id,
        communityId,
        'debit',
        Math.abs(createDto.amount),
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
    
    return {
      data: {
        vote: result,
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
  async withdrawFromPublication(
    @Param('id') id: string,
    @Body() body: { amount?: number },
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
  async withdrawFromComment(
    @Param('id') id: string,
    @Body() body: { amount?: number },
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
  async votePublicationWithComment(
    @Param('id') id: string,
    @Body() body: {
      amount: number;
      sourceType?: 'personal' | 'quota';
      comment?: string;
    },
    @Req() req: any,
  ) {
    // Get the publication to find the communityId
    const publication = await this.publicationService.getPublication(id);
    if (!publication) {
      throw new NotFoundError('Publication', id);
    }
    
    const communityId = publication.getCommunityId.getValue();
    const sourceType = body.sourceType || 'quota';
    
    // Get community to get currency info (needed for wallet operations)
    const community = await this.communityService.getCommunity(communityId);
    if (!community) {
      throw new NotFoundError('Community', communityId);
    }
    
    let commentId: string | undefined;
    let comment = null;
    
    // Always create a comment for votes, even if comment text is empty
    // This ensures votes appear in the comments list
    try {
      const commentContent = (body.comment && body.comment.trim()) ? body.comment.trim() : '';
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
    
    // Create vote with attached comment ID
    const vote = await this.voteService.createVote(
      req.user.id,
      'publication',
      id,
      body.amount,
      sourceType as 'personal' | 'quota',
      communityId,
      commentId // Attach comment to vote
    );
    
    // Update publication metrics to reflect the vote immediately
    const direction: 'up' | 'down' = body.amount > 0 ? 'up' : 'down';
    await this.publicationService.voteOnPublication(id, req.user.id, Math.abs(body.amount), direction);
    
    // Deduct from wallet if sourceType is 'personal'
    if (sourceType === 'personal') {
      await this.walletService.addTransaction(
        req.user.id,
        communityId,
        'debit',
        Math.abs(body.amount),
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
