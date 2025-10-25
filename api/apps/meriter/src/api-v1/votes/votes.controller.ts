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
import { UserGuard } from '../../user.guard';
import { PaginationHelper } from '../../common/helpers/pagination.helper';
import { NotFoundError, ValidationError } from '../../common/exceptions/api.exceptions';
import { Vote, CreateVoteDto } from '../types/domain.types';

@Controller('api/v1')
@UseGuards(UserGuard)
export class VotesController {
  private readonly logger = new Logger(VotesController.name);

  constructor(private readonly voteService: VoteService) {}

  @Post('publications/:id/votes')
  async votePublication(
    @Param('id') id: string,
    @Body() createDto: CreateVoteDto,
    @Req() req: any,
  ) {
    // Create vote with optional comment (atomic operation)
    const result = await this.voteService.createVoteFromDto(req.user.tgUserId, {
      targetType: 'publication',
      targetId: id,
      amount: createDto.amount,
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
    await this.voteService.removeVote(req.user.tgUserId, 'publication', id);
    return { success: true, data: { message: 'Vote removed successfully' } };
  }

  @Post('comments/:id/votes')
  async voteComment(
    @Param('id') id: string,
    @Body() createDto: CreateVoteDto,
    @Req() req: any,
  ) {
    // Create vote with optional comment (atomic operation)
    const result = await this.voteService.createVoteFromDto(req.user.tgUserId, {
      targetType: 'comment',
      targetId: id,
      amount: createDto.amount,
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
    await this.voteService.removeVote(req.user.tgUserId, 'comment', id);
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
