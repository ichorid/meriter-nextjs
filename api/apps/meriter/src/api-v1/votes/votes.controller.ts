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
    
    // Create vote with optional comment (atomic operation)
    const result = await this.voteService.createVoteFromDto(req.user.id, {
      targetType: 'publication',
      targetId: id,
      amount: createDto.amount,
      communityId,
    });
    
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
    
    // Create vote with optional comment (atomic operation)
    const result = await this.voteService.createVoteFromDto(req.user.id, {
      targetType: 'comment',
      targetId: id,
      amount: createDto.amount,
      communityId,
    });
    
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
}
