import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Param,
  Body,
  Query,
  Req,
  UseGuards,
  Logger,
} from '@nestjs/common';
import { PollsService } from './polls.service';
import { UserGuard } from '../../user.guard';
import { PaginationHelper } from '../../common/helpers/pagination.helper';
import { NotFoundError, ForbiddenError, ValidationError } from '../../common/exceptions/api.exceptions';
import { Poll, CreatePollDto, CreatePollVoteDto } from '../types/domain.types';

@Controller('api/v1/polls')
@UseGuards(UserGuard)
export class PollsController {
  private readonly logger = new Logger(PollsController.name);

  constructor(private readonly pollsService: PollsService) {}

  @Get()
  async getPolls(@Query() query: any) {
    const pagination = PaginationHelper.parseOptions(query);
    const result = await this.pollsService.getPolls(pagination, query);
    return result;
  }

  @Get(':id')
  async getPoll(@Param('id') id: string, @Req() req: any): Promise<Poll> {
    const poll = await this.pollsService.getPoll(id, req.user.tgUserId);
    if (!poll) {
      throw new NotFoundError('Poll', id);
    }
    return poll;
  }

  @Post()
  async createPoll(
    @Body() createDto: CreatePollDto,
    @Req() req: any,
  ): Promise<Poll> {
    return this.pollsService.createPoll(createDto, req.user.tgUserId);
  }

  @Put(':id')
  async updatePoll(
    @Param('id') id: string,
    @Body() updateDto: Partial<CreatePollDto>,
    @Req() req: any,
  ): Promise<Poll> {
    const poll = await this.pollsService.getPoll(id, req.user.tgUserId);
    if (!poll) {
      throw new NotFoundError('Poll', id);
    }

    if (poll.authorId !== req.user.tgUserId) {
      throw new ForbiddenError('Only the author can update this poll');
    }

    return this.pollsService.updatePoll(id, updateDto);
  }

  @Delete(':id')
  async deletePoll(@Param('id') id: string, @Req() req: any) {
    const poll = await this.pollsService.getPoll(id, req.user.tgUserId);
    if (!poll) {
      throw new NotFoundError('Poll', id);
    }

    if (poll.authorId !== req.user.tgUserId) {
      throw new ForbiddenError('Only the author can delete this poll');
    }

    await this.pollsService.deletePoll(id);
    return { success: true, data: { message: 'Poll deleted successfully' } };
  }

  @Post(':id/votes')
  async voteOnPoll(
    @Param('id') id: string,
    @Body() createDto: CreatePollVoteDto,
    @Req() req: any,
  ) {
    return this.pollsService.createPollVote(id, createDto, req.user.tgUserId);
  }

  @Get(':id/results')
  async getPollResults(@Param('id') id: string, @Req() req: any) {
    return this.pollsService.getPollResults(id, req.user.tgUserId);
  }

  @Get(':id/my-votes')
  async getMyPollVotes(@Param('id') id: string, @Req() req: any) {
    return this.pollsService.getUserPollVotes(id, req.user.tgUserId);
  }

  @Get('communities/:communityId')
  async getCommunityPolls(
    @Param('communityId') communityId: string,
    @Query() query: any,
    @Req() req: any,
  ) {
    const pagination = PaginationHelper.parseOptions(query);
    const result = await this.pollsService.getCommunityPolls(
      communityId,
      pagination,
      req.user.tgUserId,
    );
    return result;
  }
}
