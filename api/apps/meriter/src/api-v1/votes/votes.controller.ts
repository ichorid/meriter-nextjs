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
} from '@nestjs/common';
import { VoteService } from '../../domain/services/vote.service';
import { PublicationService } from '../../domain/services/publication.service';
import { CommentService } from '../../domain/services/comment.service';
import { UserService } from '../../domain/services/user.service';
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
    
    // Note: If there's an attached comment, the comment count was already incremented
    // in CommentService.createComment when the comment was created
    
    // Get updated wallet/balance info
    const { WalletsController } = await import('../wallets/wallets.controller');
    
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
    
    // Create vote directly, forwarding sourceType (default to 'quota')
    const result = await this.voteService.createVote(
      req.user.id,
      'comment',
      id,
      createDto.amount,
      (createDto.sourceType || 'quota') as 'personal' | 'quota',
      communityId,
    );
    
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
    
    let commentId: string | undefined;
    let comment = null;
    
    // Create comment first if provided
    if (body.comment && body.comment.trim()) {
      try {
        const createdComment = await this.commentService.createComment(req.user.id, {
          targetType: 'publication',
          targetId: id,
          content: body.comment.trim(),
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
              name: author.displayName || `${author.firstName || ''} ${author.lastName || ''}`.trim() || author.username || 'Unknown',
              username: author.username,
              telegramId: author.telegramId,
              photoUrl: author.avatarUrl,
            } : {
              name: 'Unknown',
              username: undefined,
              telegramId: undefined,
              photoUrl: undefined,
            },
          },
        };
      } catch (error) {
        this.logger.error('Failed to create comment:', error);
        throw new ValidationError('Failed to create comment: ' + error.message);
      }
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
    
    // Get updated wallet/balance info if needed
    const { WalletsController } = await import('../wallets/wallets.controller');
    
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
